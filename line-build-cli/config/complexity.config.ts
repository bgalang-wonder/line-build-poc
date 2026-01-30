/**
 * Complexity Scoring System (CSMS) Configuration.
 *
 * All weights and thresholds for build complexity scoring.
 * This config is the source of truth for scoring calculations.
 *
 * Design principles:
 * 1. Config-driven: No hardcoded weights in scoring logic
 * 2. Separation: Feature extraction (deterministic) vs scoring (configurable)
 * 3. Explainability: Every score has derivation trail
 */

import type { ActionFamily } from "../scripts/lib/schema";

// ============================================
// Signal Names (for structural signals)
// ============================================

export type SignalName =
  | "groupingBounces"
  | "stationBounces"
  | "mergePointCount"
  | "deepMergeCount"
  | "parallelEntryPoints"
  | "shortEquipmentSteps"
  | "backToBackEquipment"
  | "transferCount"
  | "stationTransitions";

// ============================================
// Config Types
// ============================================

export interface TechniqueWeights {
  /** Default weight for techniques not in overrides */
  default: number;
  /** Per-technique weight overrides (techniqueId -> weight) */
  overrides: Record<string, number>;
}

export interface LocationWeights {
  hot_side: number;
  cold_side: number;
  expo: number;
  vending: number;
}

export interface EquipmentWeights {
  /** Default weight for equipment not in overrides */
  default: number;
  /** Per-equipment weight overrides (applianceId -> weight) */
  overrides: Record<string, number>;
}

export interface RatingThresholds {
  /** Upper bound for "low" rating (inclusive) */
  low: number;
  /** Upper bound for "medium" rating (inclusive) */
  medium: number;
  /** Upper bound for "high" rating (inclusive) */
  high: number;
  // Above high is "very_high"
}

export interface CategoryMultipliers {
  location: number;
  technique: number;
  packaging: number;
  stationMovement: number;
  taskCount: number;
}

export interface ComplexityConfig {
  /** Config version for migration/compatibility */
  version: string;

  /** Technique weights by techniqueId */
  technique: TechniqueWeights;

  /** Location weights by groupingId/stationSide */
  location: LocationWeights;

  /** Equipment weights by applianceId */
  equipment: EquipmentWeights;

  /** Structural signal weights */
  signals: Record<SignalName, number>;

  /** Thresholds for various calculations */
  thresholds: {
    /** Duration threshold for "short" equipment steps (seconds) */
    shortEquipmentSeconds: number;
    /** Rating thresholds */
    ratings: RatingThresholds;
  };

  /** Category multipliers for final score calculation */
  categoryMultipliers: CategoryMultipliers;

  /** Action family base weights */
  actionFamilyWeights: Partial<Record<ActionFamily, number>>;
}

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
  version: "1.0.0",

  technique: {
    default: 1.0,
    overrides: {
      // High complexity techniques
      fry: 1.8,
      saute: 1.5,
      grill: 1.5,
      broil: 1.4,
      bake: 1.3,
      // Medium complexity
      sous_vide: 1.2,
      steam: 1.2,
      press: 1.2,
      toast: 1.0,
      reheat: 0.8,
      // Low complexity
      scoop: 0.5,
      pour: 0.5,
      dispense: 0.4,
      vend: 0.3,
      // Prep techniques
      dice: 1.2,
      slice: 1.0,
      chop: 1.0,
      wash: 0.5,
      peel: 0.8,
      open_pack: 0.3,
      get: 0.2,
      // Transfer (minimal)
      place: 0.2,
      retrieve: 0.2,
      move: 0.3,
      pass: 0.2,
      handoff: 0.3,
    },
  },

  location: {
    hot_side: 2.0,
    cold_side: 1.0,
    expo: 0.5,
    vending: 0.3,
  },

  equipment: {
    default: 1.0,
    overrides: {
      // High complexity equipment
      fryer: 2.0,
      clamshell_grill: 1.8,
      pizza_oven: 1.8,
      pizza_conveyor_oven: 1.5,
      // Medium complexity
      turbo: 1.5,
      waterbath: 1.3,
      toaster: 1.2,
      press: 1.2,
      microwave: 1.0,
      // Low complexity / holding
      hot_box: 0.5,
      hot_well: 0.5,
      steam_well: 0.5,
      sauce_warmer: 0.4,
      vending: 0.3,
    },
  },

  signals: {
    groupingBounces: 5.0,       // Major inefficiency: crossing kitchen areas
    stationBounces: 2.0,       // Minor inefficiency: returning to same station
    mergePointCount: 1.5,      // Each merge point adds coordination overhead
    deepMergeCount: 3.0,       // Deep merges (3+ inputs) are extra complex
    parallelEntryPoints: 0.5,  // Multiple entry points add parallelism complexity
    shortEquipmentSteps: 1.0,  // Short equipment steps may indicate inefficiency
    backToBackEquipment: 1.5,  // Adjacent equipment steps add transitions
    transferCount: 0.5,        // Each transfer adds movement overhead
    stationTransitions: 1.0,   // Each station change adds setup time
  },

  thresholds: {
    shortEquipmentSeconds: 45,
    ratings: {
      low: 20,
      medium: 45,
      high: 75,
      // Above 75 is "very_high"
    },
  },

  categoryMultipliers: {
    location: 1.0,
    technique: 1.0,
    packaging: 0.8,
    stationMovement: 1.2,
    taskCount: 0.5,
  },

  actionFamilyWeights: {
    HEAT: 2.0,
    PREP: 1.2,
    ASSEMBLE: 1.0,
    COMBINE: 1.0,
    PORTION: 0.8,
    PACKAGING: 0.6,
    CHECK: 0.4,
    TRANSFER: 0.3,
    OTHER: 1.0,
  },
};

// ============================================
// Config Helpers
// ============================================

/**
 * Get technique weight from config.
 */
export function getTechniqueWeight(
  config: ComplexityConfig,
  techniqueId: string | undefined
): number {
  if (!techniqueId) return config.technique.default;
  return config.technique.overrides[techniqueId] ?? config.technique.default;
}

/**
 * Get location weight from config.
 */
export function getLocationWeight(
  config: ComplexityConfig,
  side: keyof LocationWeights
): number {
  return config.location[side] ?? config.location.cold_side;
}

/**
 * Get equipment weight from config.
 */
export function getEquipmentWeight(
  config: ComplexityConfig,
  applianceId: string | undefined
): number {
  if (!applianceId) return 0;
  return config.equipment.overrides[applianceId] ?? config.equipment.default;
}

/**
 * Get signal weight from config.
 */
export function getSignalWeight(
  config: ComplexityConfig,
  signalName: SignalName
): number {
  return config.signals[signalName] ?? 0;
}

/**
 * Get action family weight from config.
 */
export function getActionFamilyWeight(
  config: ComplexityConfig,
  family: ActionFamily
): number {
  return config.actionFamilyWeights[family] ?? 1.0;
}

/**
 * Get complexity rating from score.
 */
export function getComplexityRating(
  config: ComplexityConfig,
  score: number
): "low" | "medium" | "high" | "very_high" {
  const { ratings } = config.thresholds;
  if (score <= ratings.low) return "low";
  if (score <= ratings.medium) return "medium";
  if (score <= ratings.high) return "high";
  return "very_high";
}
