/**
 * Complexity config loader with validation.
 *
 * Supports both TypeScript config (default) and JSON config (runtime-editable).
 * JSON config takes precedence when present.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

import {
  type ComplexityConfig,
  type SignalName,
  DEFAULT_COMPLEXITY_CONFIG,
} from "../../../config/complexity.config";

// ============================================
// Zod Schemas for Validation
// ============================================

const SignalNameSchema = z.enum([
  "groupingBounces",
  "stationBounces",
  "mergePointCount",
  "deepMergeCount",
  "parallelEntryPoints",
  "shortEquipmentSteps",
  "backToBackEquipment",
  "transferCount",
  "stationTransitions",
]);

const TechniqueWeightsSchema = z.object({
  default: z.number().min(0),
  overrides: z.record(z.string(), z.number().min(0)),
});

const LocationWeightsSchema = z.object({
  hot_side: z.number().min(0),
  cold_side: z.number().min(0),
  expo: z.number().min(0),
  vending: z.number().min(0),
});

const EquipmentWeightsSchema = z.object({
  default: z.number().min(0),
  overrides: z.record(z.string(), z.number().min(0)),
});

const RatingThresholdsSchema = z.object({
  low: z.number().min(0),
  medium: z.number().min(0),
  high: z.number().min(0),
});

const CategoryMultipliersSchema = z.object({
  location: z.number().min(0),
  technique: z.number().min(0),
  packaging: z.number().min(0),
  stationMovement: z.number().min(0),
  taskCount: z.number().min(0),
});

const ComplexityConfigSchema = z.object({
  version: z.string(),
  technique: TechniqueWeightsSchema,
  location: LocationWeightsSchema,
  equipment: EquipmentWeightsSchema,
  signals: z.record(SignalNameSchema, z.number()),
  thresholds: z.object({
    shortEquipmentSeconds: z.number().min(0),
    ratings: RatingThresholdsSchema,
  }),
  categoryMultipliers: CategoryMultipliersSchema,
  actionFamilyWeights: z.record(z.string(), z.number().min(0)).optional(),
});

export { ComplexityConfigSchema };

// ============================================
// Config File Paths
// ============================================

const CONFIG_DIR = path.resolve(__dirname, "../../../config");
const JSON_CONFIG_PATH = path.join(CONFIG_DIR, "complexity.config.json");

// ============================================
// Config Loading
// ============================================

let cachedConfig: ComplexityConfig | null = null;
let cachedConfigMtime: number | null = null;

/**
 * Load complexity config.
 *
 * Priority:
 * 1. JSON config file (if exists and valid)
 * 2. TypeScript default config
 *
 * Uses file mtime for cache invalidation.
 */
export function loadComplexityConfig(): ComplexityConfig {
  // Check for JSON config file
  try {
    const stat = fs.statSync(JSON_CONFIG_PATH);
    const mtime = stat.mtimeMs;

    // Return cached if still valid
    if (cachedConfig && cachedConfigMtime === mtime) {
      return cachedConfig;
    }

    // Load and validate JSON config
    const raw = fs.readFileSync(JSON_CONFIG_PATH, "utf8");
    const json = JSON.parse(raw);
    const result = ComplexityConfigSchema.safeParse(json);

    if (result.success) {
      // Merge with defaults to ensure all fields present
      cachedConfig = mergeWithDefaults(result.data);
      cachedConfigMtime = mtime;
      return cachedConfig;
    }

    // JSON config invalid - log warning and fall through to defaults
    console.warn(
      `Invalid complexity config JSON, using defaults:`,
      result.error.issues
    );
  } catch (err) {
    // JSON config doesn't exist or can't be read - use defaults
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Error reading complexity config:`, err);
    }
  }

  // Return TypeScript defaults
  return DEFAULT_COMPLEXITY_CONFIG;
}

/**
 * Save complexity config to JSON file.
 * Used by viewer weight management UI.
 */
export function saveComplexityConfig(config: ComplexityConfig): void {
  const result = ComplexityConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid config: ${JSON.stringify(result.error.issues)}`);
  }

  fs.writeFileSync(
    JSON_CONFIG_PATH,
    JSON.stringify(config, null, 2) + "\n",
    "utf8"
  );

  // Invalidate cache
  cachedConfig = null;
  cachedConfigMtime = null;
}

/**
 * Reset config to TypeScript defaults (deletes JSON override).
 */
export function resetComplexityConfig(): void {
  try {
    fs.unlinkSync(JSON_CONFIG_PATH);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  // Invalidate cache
  cachedConfig = null;
  cachedConfigMtime = null;
}

/**
 * Check if JSON config override exists.
 */
export function hasJsonConfigOverride(): boolean {
  try {
    fs.accessSync(JSON_CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the JSON config file path.
 */
export function getJsonConfigPath(): string {
  return JSON_CONFIG_PATH;
}

// ============================================
// Helpers
// ============================================

/**
 * Merge partial config with defaults to ensure all fields present.
 */
function mergeWithDefaults(partial: z.infer<typeof ComplexityConfigSchema>): ComplexityConfig {
  return {
    version: partial.version,
    technique: {
      default: partial.technique.default,
      overrides: {
        ...DEFAULT_COMPLEXITY_CONFIG.technique.overrides,
        ...partial.technique.overrides,
      },
    },
    location: {
      ...DEFAULT_COMPLEXITY_CONFIG.location,
      ...partial.location,
    },
    equipment: {
      default: partial.equipment.default,
      overrides: {
        ...DEFAULT_COMPLEXITY_CONFIG.equipment.overrides,
        ...partial.equipment.overrides,
      },
    },
    signals: {
      ...DEFAULT_COMPLEXITY_CONFIG.signals,
      ...(partial.signals as Record<SignalName, number>),
    },
    thresholds: {
      shortEquipmentSeconds: partial.thresholds.shortEquipmentSeconds,
      ratings: {
        ...DEFAULT_COMPLEXITY_CONFIG.thresholds.ratings,
        ...partial.thresholds.ratings,
      },
    },
    categoryMultipliers: {
      ...DEFAULT_COMPLEXITY_CONFIG.categoryMultipliers,
      ...partial.categoryMultipliers,
    },
    actionFamilyWeights: {
      ...DEFAULT_COMPLEXITY_CONFIG.actionFamilyWeights,
      ...partial.actionFamilyWeights,
    },
  };
}

/**
 * Force reload of config (clears cache).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedConfigMtime = null;
}
