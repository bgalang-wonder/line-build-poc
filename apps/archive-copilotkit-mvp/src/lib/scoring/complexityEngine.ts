/**
 * Complexity Scoring Engine for Line Builds
 *
 * Multi-factor scoring system that accounts for:
 * - Work variety (number of different action types)
 * - Equipment variety (number of different equipment pieces)
 * - Station changes (transitions between work locations)
 * - Time breakdown (total duration, active vs passive, parallelization)
 *
 * Each factor is normalized to 0-100, weighted, and composed into a final score.
 */

import { WorkUnit, LineBuild, ActionType } from "../model/types";

// ============================================================================
// Types and Configuration
// ============================================================================

export interface ComplexityScore {
  overall: number; // 0-100 final score
  factors: {
    workVariety: number;
    equipmentVariety: number;
    stationChanges: number;
    timeBreakdown: number;
  };
  reasoning: string; // Human-readable explanation
  timestamp: string; // ISO 8601
}

export interface ComplexityWeights {
  workVariety: number;
  equipmentVariety: number;
  stationChanges: number;
  timeBreakdown: number;
}

// Default weights - tunable for calibration against legacy data
const DEFAULT_WEIGHTS: ComplexityWeights = {
  workVariety: 0.25,
  equipmentVariety: 0.25,
  stationChanges: 0.25,
  timeBreakdown: 0.25,
};

// ============================================================================
// Work Variety Scoring
// ============================================================================

/**
 * Score based on how many different action types are used.
 * More variety = more complex (chef must know more skills).
 *
 * Scoring:
 * - 1 action type: 10 (very simple)
 * - 2-3 action types: 30
 * - 4-5 action types: 50
 * - 6+ action types: 80
 */
function scoreWorkVariety(workUnits: WorkUnit[]): number {
  const uniqueActions = new Set(workUnits.map((wu) => wu.tags.action));
  const count = uniqueActions.size;

  if (count === 1) return 10;
  if (count <= 3) return 30;
  if (count <= 5) return 50;
  return 80;
}

// ============================================================================
// Equipment Variety Scoring
// ============================================================================

/**
 * Score based on how many different equipment pieces are used.
 * More equipment = more complex (more coordination, scheduling needed).
 *
 * Scoring:
 * - No equipment (all PREP): 5
 * - 1 equipment type: 20
 * - 2-3 equipment types: 45
 * - 4+ equipment types: 75
 */
function scoreEquipmentVariety(workUnits: WorkUnit[]): number {
  const equipmentUsed = workUnits
    .filter((wu) => wu.tags.equipment)
    .map((wu) => wu.tags.equipment);

  if (equipmentUsed.length === 0) return 5; // No equipment needed

  const uniqueEquipment = new Set(equipmentUsed);
  const count = uniqueEquipment.size;

  if (count === 1) return 20;
  if (count <= 3) return 45;
  return 75;
}

// ============================================================================
// Station Changes Scoring
// ============================================================================

/**
 * Score based on how many times the work moves between different stations.
 * More transitions = more complex (chef has to move around, coordination needed).
 *
 * Scoring:
 * - 0-1 station: 10
 * - 2 stations: 25
 * - 3 stations: 50
 * - 4+ stations: 80
 */
function scoreStationChanges(workUnits: WorkUnit[]): number {
  // Follow dependency order to count actual transitions
  const stationSequence: string[] = [];

  for (const wu of workUnits) {
    const station = wu.tags.station || "default";
    // Only count if it's different from the last station
    if (stationSequence.length === 0 || stationSequence[stationSequence.length - 1] !== station) {
      stationSequence.push(station);
    }
  }

  const transitionCount = stationSequence.length;

  if (transitionCount <= 1) return 10;
  if (transitionCount === 2) return 25;
  if (transitionCount === 3) return 50;
  return 80;
}

// ============================================================================
// Time Breakdown Scoring
// ============================================================================

/**
 * Score based on total work time and time type distribution.
 * More time + more active time = more complex (longer, more engagement).
 *
 * Factors:
 * - Total time (sum of all durations)
 * - Active vs passive ratio (more active = more complex)
 * - Time concentration (if all time in one step = less complex than spread out)
 *
 * Scoring approach:
 * - Convert all times to minutes
 * - Calculate percentile: 0-5 min (low), 5-15 min (medium), 15-30 min (high), 30+ min (very high)
 * - Weight by active time percentage
 */
function scoreTimeBreakdown(workUnits: WorkUnit[]): number {
  const workUnitsWithTime = workUnits.filter((wu) => wu.tags.time);

  if (workUnitsWithTime.length === 0) {
    return 10; // No timing specified
  }

  // Convert all times to minutes
  let totalMinutes = 0;
  let activeMinutes = 0;

  for (const wu of workUnitsWithTime) {
    if (wu.tags.time) {
      const minutes =
        wu.tags.time.unit === "min"
          ? wu.tags.time.value
          : wu.tags.time.value / 60;

      totalMinutes += minutes;

      if (wu.tags.time.type === "active") {
        activeMinutes += minutes;
      }
    }
  }

  // Score based on total time
  let timeScore = 0;
  if (totalMinutes <= 5) timeScore = 15;
  else if (totalMinutes <= 15) timeScore = 40;
  else if (totalMinutes <= 30) timeScore = 65;
  else timeScore = 85;

  // Adjust by active time percentage
  const activePercentage = activeMinutes / totalMinutes;
  const activeBonus = activePercentage * 20; // Max +20 points for 100% active

  return Math.min(100, timeScore + activeBonus);
}

// ============================================================================
// Score Composition
// ============================================================================

/**
 * Compose individual factor scores into a final complexity score.
 * Uses weighted averaging with a non-linear composition to avoid scores
 * clustering at the extremes.
 */
function composeScore(
  factors: {
    workVariety: number;
    equipmentVariety: number;
    stationChanges: number;
    timeBreakdown: number;
  },
  weights: ComplexityWeights = DEFAULT_WEIGHTS,
): number {
  // Validate weights sum to 1
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.01) {
    throw new Error(`Weights must sum to 1, got ${weightSum}`);
  }

  // Weighted average
  const weighted =
    factors.workVariety * weights.workVariety +
    factors.equipmentVariety * weights.equipmentVariety +
    factors.stationChanges * weights.stationChanges +
    factors.timeBreakdown * weights.timeBreakdown;

  // Apply slight sigmoid to avoid clustering at extremes
  // Keeps scores in readable range (10-90 mostly)
  const normalized = weighted / 100;
  const adjusted = normalized < 0.5
    ? normalized * 2 * 0.5 // Compress low end
    : 0.5 + (normalized - 0.5) * 1.5; // Stretch high end

  return Math.round(Math.max(10, Math.min(100, adjusted * 100)));
}

// ============================================================================
// Reasoning Generation
// ============================================================================

function generateReasoning(
  factors: {
    workVariety: number;
    equipmentVariety: number;
    stationChanges: number;
    timeBreakdown: number;
  },
  score: number,
): string {
  const parts: string[] = [];

  if (factors.workVariety >= 70) {
    parts.push("high work variety (6+ action types)");
  } else if (factors.workVariety >= 40) {
    parts.push("moderate work variety (4-5 action types)");
  }

  if (factors.equipmentVariety >= 70) {
    parts.push("multiple equipment types");
  } else if (factors.equipmentVariety >= 40) {
    parts.push("several pieces of equipment");
  }

  if (factors.stationChanges >= 70) {
    parts.push("frequent station transitions");
  } else if (factors.stationChanges >= 40) {
    parts.push("some station movement");
  }

  if (factors.timeBreakdown >= 70) {
    parts.push("significant active time");
  } else if (factors.timeBreakdown >= 40) {
    parts.push("moderate timing requirements");
  }

  if (parts.length === 0) {
    return "Simple recipe with minimal complexity drivers.";
  }

  const reason = parts.join(", ").replace(/, ([^,]*)$/, " and $1");
  return `Complexity driven by ${reason}.`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Calculate complexity score for a single work unit.
 * Used for UI indicators on individual steps.
 */
export function scoreWorkUnit(
  workUnit: WorkUnit,
  weights?: ComplexityWeights,
): ComplexityScore {
  // Single unit scoring: treat the unit in isolation
  const factors = {
    workVariety: 20, // Single unit has single action
    equipmentVariety: workUnit.tags.equipment ? 40 : 10,
    stationChanges: 10, // Single unit, no transitions
    timeBreakdown: scoreTimeBreakdown([workUnit]),
  };

  const overall = composeScore(factors, weights);

  return {
    overall,
    factors,
    reasoning: generateReasoning(factors, overall),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate complexity score for an entire line build.
 * Aggregates all work units and accounts for parallelization potential.
 */
export function scoreLineBuild(
  lineBuild: LineBuild,
  weights?: ComplexityWeights,
): ComplexityScore {
  const factors = {
    workVariety: scoreWorkVariety(lineBuild.workUnits),
    equipmentVariety: scoreEquipmentVariety(lineBuild.workUnits),
    stationChanges: scoreStationChanges(lineBuild.workUnits),
    timeBreakdown: scoreTimeBreakdown(lineBuild.workUnits),
  };

  const overall = composeScore(factors, weights);

  return {
    overall,
    factors,
    reasoning: generateReasoning(factors, overall),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate complexity filtered by prep type.
 * Supports filtering: "include_prep", "exclude_prep", "prep_only"
 */
export function scoreLineBuildFiltered(
  lineBuild: LineBuild,
  filterMode: "include_prep" | "exclude_prep" | "prep_only" = "include_prep",
  weights?: ComplexityWeights,
): ComplexityScore {
  let filtered = lineBuild.workUnits;

  if (filterMode === "exclude_prep") {
    filtered = lineBuild.workUnits.filter((wu) => wu.tags.prepType !== "pre_service");
  } else if (filterMode === "prep_only") {
    filtered = lineBuild.workUnits.filter((wu) => wu.tags.prepType === "pre_service");
  }

  const tempBuild: LineBuild = {
    ...lineBuild,
    workUnits: filtered,
  };

  return scoreLineBuild(tempBuild, weights);
}

/**
 * Calibrate weights against a known dataset.
 * Used for tuning the scoring algorithm to match legacy data.
 */
export function calibrateWeights(
  dataset: Array<{
    lineBuild: LineBuild;
    legacyScore: number;
  }>,
  iterations: number = 100,
): ComplexityWeights {
  // Simple hill-climbing optimization
  let bestWeights = { ...DEFAULT_WEIGHTS };
  let bestError = calculateMeanSquaredError(dataset, bestWeights);

  for (let i = 0; i < iterations; i++) {
    // Try adjusting each weight slightly
    const keys = (Object.keys(bestWeights) as Array<keyof ComplexityWeights>);

    for (const key of keys) {
      const adjusted = { ...bestWeights };
      adjusted[key] *= 1.05; // Increase by 5%

      // Renormalize to sum to 1
      const sum = Object.values(adjusted).reduce((a, b) => a + b, 0);
      const normalized: ComplexityWeights = {
        workVariety: adjusted.workVariety / sum,
        equipmentVariety: adjusted.equipmentVariety / sum,
        stationChanges: adjusted.stationChanges / sum,
        timeBreakdown: adjusted.timeBreakdown / sum,
      };

      const error = calculateMeanSquaredError(dataset, normalized);
      if (error < bestError) {
        bestWeights = normalized;
        bestError = error;
      }
    }
  }

  return bestWeights;
}

function calculateMeanSquaredError(
  dataset: Array<{ lineBuild: LineBuild; legacyScore: number }>,
  weights: ComplexityWeights,
): number {
  let sumSquaredError = 0;

  for (const { lineBuild, legacyScore } of dataset) {
    const calculated = scoreLineBuild(lineBuild, weights);
    const error = calculated.overall - legacyScore;
    sumSquaredError += error * error;
  }

  return sumSquaredError / dataset.length;
}
