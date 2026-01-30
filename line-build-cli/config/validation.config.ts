/**
 * Validation configuration.
 *
 * Externalizes validation thresholds and magic numbers that were previously
 * hardcoded in validate.ts.
 */

export interface EquipmentTimeRange {
  /** Minimum typical cook time in seconds */
  minSeconds: number;
  /** Maximum typical cook time in seconds */
  maxSeconds: number;
  /** Description of the range (for warnings) */
  description?: string;
}

export interface ValidationConfig {
  /**
   * H26: Minimum ratio of steps that should have dependencies.
   * Entry points (steps with no dependencies) should be rare.
   * Default: 0.75 (at least 75% of steps should have dependsOn)
   */
  graphConnectivityThreshold: number;

  /**
   * Equipment cook time ranges for sanity checks.
   * Keys are applianceIds. Used for soft warnings when times seem unusual.
   */
  equipmentTimeRanges: Record<string, EquipmentTimeRange>;

  /**
   * BOM types that require coverage validation (H23).
   * Items with these types must be referenced by at least one step.
   */
  bomCoverageRequiredTypes: string[];
}

/**
 * Default validation configuration.
 * Can be overridden per-restaurant or per-build-type in the future.
 */
export const VALIDATION_CONFIG: ValidationConfig = {
  // H26: At least 75% of steps should have dependencies
  // Entry points are retrieval steps and parallel track starts
  graphConnectivityThreshold: 0.75,

  // Equipment time ranges (for sanity warnings, not hard errors)
  // These are typical ranges — actual times outside these trigger soft warnings
  equipmentTimeRanges: {
    turbo: {
      minSeconds: 30,
      maxSeconds: 120,
      description: "Turbo oven: typically 30s-2min",
    },
    toaster: {
      minSeconds: 15,
      maxSeconds: 60,
      description: "Toaster: typically 15s-1min",
    },
    fryer: {
      minSeconds: 120,
      maxSeconds: 300,
      description: "Fryer: typically 2-5min",
    },
    waterbath: {
      minSeconds: 180,
      maxSeconds: 1200,
      description: "Waterbath/sous vide: typically 3-20min",
    },
    salamander: {
      minSeconds: 30,
      maxSeconds: 90,
      description: "Salamander: typically 30s-90s",
    },
    clamshell_grill: {
      minSeconds: 60,
      maxSeconds: 180,
      description: "Clamshell grill: typically 1-3min",
    },
    press: {
      minSeconds: 60,
      maxSeconds: 180,
      description: "Press: typically 1-3min",
    },
    induction: {
      minSeconds: 60,
      maxSeconds: 600,
      description: "Induction: typically 1-10min",
    },
    conveyor: {
      minSeconds: 60,
      maxSeconds: 300,
      description: "Conveyor oven: typically 1-5min",
    },
    pizza_oven: {
      minSeconds: 180,
      maxSeconds: 600,
      description: "Pizza oven: typically 3-10min",
    },
    pizza_conveyor_oven: {
      minSeconds: 180,
      maxSeconds: 480,
      description: "Pizza conveyor: typically 3-8min",
    },
    rice_cooker: {
      minSeconds: 600,
      maxSeconds: 1800,
      description: "Rice cooker: typically 10-30min",
    },
    pasta_cooker: {
      minSeconds: 120,
      maxSeconds: 600,
      description: "Pasta cooker: typically 2-10min",
    },
    steam_well: {
      minSeconds: 60,
      maxSeconds: 300,
      description: "Steam well: typically 1-5min",
    },
    hot_box: {
      minSeconds: 60,
      maxSeconds: 3600,
      description: "Hot box (holding): typically 1min-1hr",
    },
    hot_well: {
      minSeconds: 60,
      maxSeconds: 3600,
      description: "Hot well (holding): typically 1min-1hr",
    },
    sauce_warmer: {
      minSeconds: 60,
      maxSeconds: 3600,
      description: "Sauce warmer (holding): typically 1min-1hr",
    },
  },

  // H23: BOM types that must be covered by steps
  bomCoverageRequiredTypes: ["consumable", "packaged_good"],
};

// ============================================
// Helper functions
// ============================================

/**
 * Get the time range for a piece of equipment.
 * Returns undefined if no range is defined.
 */
export function getEquipmentTimeRange(applianceId: string): EquipmentTimeRange | undefined {
  return VALIDATION_CONFIG.equipmentTimeRanges[applianceId];
}

/**
 * Check if a cook time is within the typical range for equipment.
 * Returns null if no range defined, true if in range, false if outside.
 */
export function isTimeInTypicalRange(
  applianceId: string,
  durationSeconds: number
): boolean | null {
  const range = getEquipmentTimeRange(applianceId);
  if (!range) return null;
  return durationSeconds >= range.minSeconds && durationSeconds <= range.maxSeconds;
}

/**
 * Get a warning message for time outside typical range.
 * Returns undefined if time is in range or no range is defined.
 */
export function getTimeRangeWarning(
  applianceId: string,
  durationSeconds: number
): string | undefined {
  const range = getEquipmentTimeRange(applianceId);
  if (!range) return undefined;

  if (durationSeconds < range.minSeconds) {
    return `Time ${durationSeconds}s seems short for ${applianceId} (typical: ${range.minSeconds}-${range.maxSeconds}s)`;
  }
  if (durationSeconds > range.maxSeconds) {
    return `Time ${durationSeconds}s seems long for ${applianceId} (typical: ${range.minSeconds}-${range.maxSeconds}s)`;
  }
  return undefined;
}
