/**
 * Core types for the Complexity Scoring System (CSMS).
 *
 * Type hierarchy:
 * - StepFeatures: Per-step extracted features (input to scoring)
 * - BuildFeatures: Aggregate features for entire build
 * - StructuralSignals: Graph-based signals (bouncing, merges, etc.)
 * - StepEffort: Per-step score with explanation
 * - CategoryBreakdown: Score breakdown by category
 * - ScoreReport: Full report with all details
 */

import type { ActionFamily } from "../schema";
import type { StationSide } from "../../../config/stations.config";
import type { SignalName } from "../../../config/complexity.config";

// ============================================
// Feature Types (extracted from steps/build)
// ============================================

/**
 * Per-step extracted features.
 * These are deterministic extractions from step data.
 */
export interface StepFeatures {
  /** Step identifier */
  stepId: string;

  /** Canonical station side (hot_side, cold_side, expo, vending) */
  stationSide: StationSide;

  /** Station ID if specified */
  stationId: string | undefined;

  /** Action family from step */
  actionFamily: ActionFamily;

  /** Technique ID if specified (canonical form) */
  techniqueId: string | undefined;

  /** Equipment appliance ID if specified */
  equipmentId: string | undefined;

  /** Duration in seconds (0 if not specified) */
  durationSeconds: number;

  /** Whether step is active time (requires attention) */
  isActive: boolean;

  /** Whether this is a hot side step */
  isHotSide: boolean;

  /** Whether this is a cold side step */
  isColdSide: boolean;

  /** Whether this is an expo step (excluded from hot/cold ratio) */
  isExpo: boolean;

  /** Whether this is a vending step */
  isVending: boolean;

  /** Number of inputs (for merge detection) */
  inputCount: number;

  /** Number of outputs */
  outputCount: number;

  /** Quantity value if specified (for portion steps) */
  quantityValue: number | undefined;
}

/**
 * Aggregate features for entire build.
 */
export interface BuildFeatures {
  /** Build identifier */
  buildId: string;

  /** Total step count */
  stepCount: number;

  /** Steps on hot side */
  hotSideStepCount: number;

  /** Steps on cold side */
  coldSideStepCount: number;

  /** Steps at expo */
  expoStepCount: number;

  /** Steps at vending */
  vendingStepCount: number;

  /** Unique stations used */
  uniqueStations: string[];

  /** Unique equipment used */
  uniqueEquipment: string[];

  /** Unique action families used */
  uniqueActionFamilies: ActionFamily[];

  /** Total duration (sum of all step durations) */
  totalDurationSeconds: number;

  /** Total active time */
  totalActiveSeconds: number;

  /** Entry point count (steps with no dependencies) */
  entryPointCount: number;

  /** Per-step features */
  stepFeatures: StepFeatures[];
}

// ============================================
// Structural Signals
// ============================================

/**
 * Structural signals extracted from build graph.
 * These indicate complexity from workflow patterns.
 */
export interface StructuralSignals {
  /** Number of grouping-level bounces (S16a violations) */
  groupingBounces: number;

  /** Number of station-level bounces (S16b violations) */
  stationBounces: number;

  /** Number of merge points (steps with 2+ inputs) */
  mergePointCount: number;

  /** Number of deep merges (steps with 3+ inputs) */
  deepMergeCount: number;

  /** Number of parallel entry points (steps with no dependsOn) */
  parallelEntryPoints: number;

  /** Number of short equipment steps (<45s) */
  shortEquipmentSteps: number;

  /** Number of back-to-back equipment steps */
  backToBackEquipment: number;

  /** Total transfer count from derived data */
  transferCount: number;

  /** Number of station transitions */
  stationTransitions: number;

  /** Details for each signal (for explanation) */
  details: Partial<Record<SignalName, SignalDetail[]>>;
}

/**
 * Detail for a single signal occurrence.
 */
export interface SignalDetail {
  /** Step ID(s) involved */
  stepIds: string[];
  /** Human-readable description */
  description: string;
}

// ============================================
// Scoring Types
// ============================================

/**
 * Per-step effort score with explanation.
 */
export interface StepEffort {
  /** Step identifier */
  stepId: string;

  /** Location contribution to score */
  locationScore: number;

  /** Technique contribution to score */
  techniqueScore: number;

  /** Equipment contribution to score */
  equipmentScore: number;

  /** Action family base contribution */
  actionFamilyScore: number;

  /** Total effort for this step */
  totalEffort: number;

  /** Explanation of how score was calculated */
  explanation: string[];
}

/**
 * Score breakdown by category.
 */
export interface CategoryBreakdown {
  /** Location category score (hot/cold/expo/vending) */
  location: number;

  /** Technique category score */
  technique: number;

  /** Equipment category score */
  equipment: number;

  /** Packaging/container category score */
  packaging: number;

  /** Station movement/transition score */
  stationMovement: number;

  /** Task count base score */
  taskCount: number;

  /** Structural signals score */
  structuralSignals: number;
}

/**
 * Top contributor to complexity score.
 */
export interface TopContributor {
  /** Step ID or signal name */
  source: string;
  /** Type of contribution */
  type: "step" | "signal";
  /** Contribution amount */
  contribution: number;
  /** Explanation */
  explanation: string;
}

/**
 * Full complexity score report.
 */
export interface ScoreReport {
  /** Build identifier */
  buildId: string;

  /** Raw score before normalization */
  rawScore: number;

  /** Normalized score (0-100 scale based on portfolio p95) */
  normalizedScore: number | null;

  /** Complexity rating */
  rating: "low" | "medium" | "high" | "very_high";

  /** Hot/cold work ratio (0-1, where 1 = all hot side) */
  hotRatio: number;

  /** Category breakdown */
  breakdown: CategoryBreakdown;

  /** Top contributors to complexity */
  topContributors: TopContributor[];

  /** Structural signals */
  signals: StructuralSignals;

  /** Build features summary */
  features: BuildFeatures;

  /** Per-step effort details */
  stepEfforts: StepEffort[];

  /** Timestamp of calculation */
  calculatedAt: string;

  /** Config version used */
  configVersion: string;
}

// ============================================
// Portfolio Types
// ============================================

/**
 * Statistics for portfolio normalization.
 */
export interface PortfolioStats {
  /** Number of builds in portfolio */
  buildCount: number;

  /** Minimum raw score */
  min: number;

  /** Maximum raw score */
  max: number;

  /** Median (p50) raw score */
  p50: number;

  /** 75th percentile raw score */
  p75: number;

  /** 95th percentile raw score (used for normalization) */
  p95: number;

  /** Mean raw score */
  mean: number;

  /** Standard deviation */
  stdDev: number;
}

/**
 * Portfolio scoring result.
 */
export interface PortfolioScoreResult {
  /** Individual build reports */
  reports: ScoreReport[];

  /** Portfolio statistics */
  stats: PortfolioStats;

  /** Builds ranked by complexity (highest first) */
  ranking: Array<{
    buildId: string;
    rawScore: number;
    normalizedScore: number;
    rating: ScoreReport["rating"];
  }>;

  /** Timestamp of calculation */
  calculatedAt: string;
}

// ============================================
// Receipt Types (for persistence)
// ============================================

/**
 * Single build score receipt.
 */
export interface ScoreReceipt {
  type: "single";
  buildId: string;
  report: ScoreReport;
  timestamp: string;
}

/**
 * Portfolio score receipt.
 */
export interface PortfolioReceipt {
  type: "portfolio";
  result: PortfolioScoreResult;
  timestamp: string;
}

// ============================================
// Weight Impact Preview Types
// ============================================

/**
 * Rating type alias for clarity.
 */
export type Rating = "low" | "medium" | "high" | "very_high";

/**
 * Impact of weight changes on a single build.
 */
export interface BuildImpact {
  /** Build identifier */
  buildId: string;
  /** Baseline scores (current config) */
  baseline: {
    rawScore: number;
    rating: Rating;
    rank: number;
  };
  /** Preview scores (proposed config) */
  preview: {
    rawScore: number;
    rating: Rating;
    rank: number;
  };
  /** Computed deltas */
  delta: {
    rawScore: number;
    ratingChanged: boolean;
    rankShift: number;
  };
}

/**
 * Count of builds migrating between rating levels.
 */
export interface RatingMigration {
  /** Original rating */
  from: Rating;
  /** New rating after weight change */
  to: Rating;
  /** Number of builds in this migration */
  count: number;
  /** IDs of affected builds */
  buildIds: string[];
}

/**
 * Side-by-side comparison of portfolio statistics.
 */
export interface StatsComparison {
  /** Baseline portfolio stats */
  baseline: PortfolioStats;
  /** Preview portfolio stats */
  preview: PortfolioStats;
  /** Computed deltas */
  delta: {
    mean: number;
    p50: number;
    p95: number;
    stdDev: number;
  };
}

/**
 * Complete weight impact preview result.
 */
export interface WeightImpactPreview {
  /** Per-build impact details */
  buildImpacts: BuildImpact[];
  /** Rating migration summary */
  migrations: RatingMigration[];
  /** Stats comparison */
  stats: StatsComparison;
  /** Count of builds with rating changes */
  ratingChangedCount: number;
  /** Count of builds with rank changes */
  rankChangedCount: number;
  /** Timestamp of preview calculation */
  calculatedAt: string;
}
