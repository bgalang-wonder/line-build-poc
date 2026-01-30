/**
 * Build complexity scoring.
 *
 * Calculates overall complexity metrics for a line build based on:
 * - Number and type of derived transfers
 * - Step count and action variety
 * - Station transitions
 * - Pod assignments (when available)
 *
 * Used for:
 * - Identifying builds that need extra review
 * - Comparing build complexity across menu items
 * - Routing and scheduling optimization
 */

import type { BenchTopLineBuild, DerivedTransferStep, Step } from "./schema";
import { ActionFamily } from "./schema";
import { TRANSFER_SCORING, type TransferType } from "../../config/transfers.config";
import { getDerivedTransfersSync } from "./derivedCache";
import {
  assignPodForStep,
  MOCK_HDR_POD_CONFIG,
  type HdrPodConfig,
} from "../../config/hdr-pod.mock";

// ============================================
// Types
// ============================================

export interface ComplexityMetrics {
  /** Overall complexity score (higher = more complex) */
  overallScore: number;

  /** Complexity rating for human readability */
  rating: "low" | "medium" | "high" | "very_high";

  /** Breakdown by category */
  breakdown: {
    /** Total steps in the build */
    stepCount: number;
    /** Complexity from step count (more steps = more complex) */
    stepCountScore: number;

    /** Total derived transfers */
    transferCount: number;
    /** Breakdown by transfer type */
    transfersByType: Record<TransferType, number>;
    /** Complexity from transfers */
    transferScore: number;

    /** Number of unique stations used */
    uniqueStations: number;
    /** Number of station transitions */
    stationTransitions: number;
    /** Complexity from station changes */
    stationScore: number;

    /** Number of unique pods used (if pod assignment available) */
    uniquePods: number;
    /** Number of pod transitions */
    podTransitions: number;
    /** Complexity from pod changes */
    podScore: number;

    /** Variety of action families used */
    actionFamilyCount: number;
    /** Complexity from action variety */
    actionVarietyScore: number;
  };

  /** Flags for specific concerns */
  flags: {
    /** Has any inter-pod transfers */
    hasInterPodTransfers: boolean;
    /** Has more than 10 steps */
    isLongBuild: boolean;
    /** Uses more than 4 unique stations */
    hasHighStationVariety: boolean;
    /** Has parallel tracks (based on dependency structure) */
    hasParallelTracks: boolean;
  };
}

// ============================================
// Scoring Weights
// ============================================

const WEIGHTS = {
  /** Points per step */
  stepCount: 0.5,
  /** Points per unique station */
  stationUnique: 1,
  /** Points per station transition */
  stationTransition: 0.5,
  /** Points per unique pod */
  podUnique: 2,
  /** Points per pod transition */
  podTransition: 1.5,
  /** Points per unique action family */
  actionFamily: 0.25,
};

const RATING_THRESHOLDS = {
  low: 10,
  medium: 25,
  high: 50,
  // Above 50 is very_high
};

// ============================================
// Core Complexity Calculation
// ============================================

/**
 * Calculate complexity metrics for a build.
 *
 * @param build The normalized build (should have derivedTransfers populated)
 * @param hdrConfig Optional HDR config for pod assignment (defaults to mock)
 */
export function calculateComplexity(
  build: BenchTopLineBuild,
  hdrConfig: HdrPodConfig = MOCK_HDR_POD_CONFIG
): ComplexityMetrics {
  const steps = build.steps;
  const transfers = getDerivedTransfersSync(build);

  // Step metrics
  const stepCount = steps.length;
  const stepCountScore = stepCount * WEIGHTS.stepCount;

  // Transfer metrics
  const transfersByType = countTransfersByType(transfers);
  const transferScore = calculateTransferScore(transfers);
  const transferCount = transfers.length;

  // Station metrics
  const { uniqueStations, stationTransitions } = calculateStationMetrics(steps);
  const stationScore =
    uniqueStations * WEIGHTS.stationUnique +
    stationTransitions * WEIGHTS.stationTransition;

  // Pod metrics (requires pod assignment)
  const { uniquePods, podTransitions } = calculatePodMetrics(steps, hdrConfig);
  const podScore =
    uniquePods * WEIGHTS.podUnique + podTransitions * WEIGHTS.podTransition;

  // Action variety
  const actionFamilies = new Set(steps.map((s) => s.action.family));
  const actionFamilyCount = actionFamilies.size;
  const actionVarietyScore = actionFamilyCount * WEIGHTS.actionFamily;

  // Overall score
  const overallScore =
    stepCountScore +
    transferScore +
    stationScore +
    podScore +
    actionVarietyScore;

  // Rating
  const rating = getComplexityRating(overallScore);

  // Flags
  const hasInterPodTransfers = transfersByType.inter_pod > 0;
  const isLongBuild = stepCount > 10;
  const hasHighStationVariety = uniqueStations > 4;
  const hasParallelTracks = detectParallelTracks(build);

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    rating,
    breakdown: {
      stepCount,
      stepCountScore: Math.round(stepCountScore * 10) / 10,
      transferCount,
      transfersByType,
      transferScore: Math.round(transferScore * 10) / 10,
      uniqueStations,
      stationTransitions,
      stationScore: Math.round(stationScore * 10) / 10,
      uniquePods,
      podTransitions,
      podScore: Math.round(podScore * 10) / 10,
      actionFamilyCount,
      actionVarietyScore: Math.round(actionVarietyScore * 10) / 10,
    },
    flags: {
      hasInterPodTransfers,
      isLongBuild,
      hasHighStationVariety,
      hasParallelTracks,
    },
  };
}

// ============================================
// Helper Functions
// ============================================

function countTransfersByType(
  transfers: DerivedTransferStep[]
): Record<TransferType, number> {
  const counts: Record<TransferType, number> = {
    intra_station: 0,
    inter_station: 0,
    inter_pod: 0,
  };

  for (const t of transfers) {
    counts[t.transferType]++;
  }

  return counts;
}

function calculateTransferScore(transfers: DerivedTransferStep[]): number {
  return transfers.reduce((sum, t) => {
    return sum + TRANSFER_SCORING[t.transferType].complexityScore;
  }, 0);
}

function calculateStationMetrics(steps: Step[]): {
  uniqueStations: number;
  stationTransitions: number;
} {
  const stations = steps
    .map((s) => s.stationId)
    .filter((id): id is NonNullable<typeof id> => id !== undefined);

  const uniqueStations = new Set(stations).size;

  let stationTransitions = 0;
  for (let i = 1; i < stations.length; i++) {
    if (stations[i] !== stations[i - 1]) {
      stationTransitions++;
    }
  }

  return { uniqueStations, stationTransitions };
}

function calculatePodMetrics(
  steps: Step[],
  hdrConfig: HdrPodConfig
): {
  uniquePods: number;
  podTransitions: number;
} {
  // Assign pods to each step
  const podAssignments = steps.map((step) => {
    const equipmentId = step.equipment?.applianceId;
    return assignPodForStep(equipmentId, step.stationId, hdrConfig);
  });

  const validPods = podAssignments.filter(
    (p): p is string => p !== undefined
  );
  const uniquePods = new Set(validPods).size;

  let podTransitions = 0;
  for (let i = 1; i < podAssignments.length; i++) {
    const prev = podAssignments[i - 1];
    const curr = podAssignments[i];
    if (prev && curr && prev !== curr) {
      podTransitions++;
    }
  }

  return { uniquePods, podTransitions };
}

function getComplexityRating(
  score: number
): "low" | "medium" | "high" | "very_high" {
  if (score <= RATING_THRESHOLDS.low) return "low";
  if (score <= RATING_THRESHOLDS.medium) return "medium";
  if (score <= RATING_THRESHOLDS.high) return "high";
  return "very_high";
}

/**
 * Detect if the build has parallel tracks (multiple steps at same orderIndex
 * or complex dependency structure).
 */
function detectParallelTracks(build: BenchTopLineBuild): boolean {
  // Check for multiple steps with same orderIndex
  const orderIndices = build.steps.map((s) => s.orderIndex);
  const uniqueIndices = new Set(orderIndices);
  if (uniqueIndices.size < orderIndices.length) {
    return true; // Duplicate orderIndex = parallel tracks
  }

  // Check for complex dependency structure (step depending on multiple others)
  for (const step of build.steps) {
    if (step.dependsOn && step.dependsOn.length > 1) {
      return true; // Multiple dependencies = merge point = parallel tracks
    }
  }

  return false;
}

// ============================================
// Comparison Utilities
// ============================================

/**
 * Compare complexity between two builds.
 */
export function compareComplexity(
  build1: BenchTopLineBuild,
  build2: BenchTopLineBuild,
  hdrConfig: HdrPodConfig = MOCK_HDR_POD_CONFIG
): {
  build1Score: number;
  build2Score: number;
  difference: number;
  moreComplex: "build1" | "build2" | "equal";
} {
  const metrics1 = calculateComplexity(build1, hdrConfig);
  const metrics2 = calculateComplexity(build2, hdrConfig);

  const difference = metrics1.overallScore - metrics2.overallScore;
  const moreComplex =
    difference > 0.5 ? "build1" : difference < -0.5 ? "build2" : "equal";

  return {
    build1Score: metrics1.overallScore,
    build2Score: metrics2.overallScore,
    difference: Math.round(difference * 10) / 10,
    moreComplex,
  };
}

/**
 * Get a human-readable summary of complexity.
 */
export function getComplexitySummary(metrics: ComplexityMetrics): string {
  const parts: string[] = [
    `Complexity: ${metrics.rating.toUpperCase()} (score: ${metrics.overallScore})`,
    `${metrics.breakdown.stepCount} steps, ${metrics.breakdown.transferCount} transfers`,
    `${metrics.breakdown.uniqueStations} stations, ${metrics.breakdown.uniquePods} pods`,
  ];

  const flags: string[] = [];
  if (metrics.flags.hasInterPodTransfers) flags.push("inter-pod transfers");
  if (metrics.flags.isLongBuild) flags.push("long build");
  if (metrics.flags.hasHighStationVariety) flags.push("high station variety");
  if (metrics.flags.hasParallelTracks) flags.push("parallel tracks");

  if (flags.length > 0) {
    parts.push(`Flags: ${flags.join(", ")}`);
  }

  return parts.join(" | ");
}
