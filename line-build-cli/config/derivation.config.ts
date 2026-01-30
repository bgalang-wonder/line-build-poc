/**
 * Derivation rules configuration.
 *
 * Maps Tier 1 inputs (action family, technique, station) to Tier 2 derived values
 * (sublocation, output destination). These rules minimize agent decision-making
 * by codifying kitchen workflow patterns.
 *
 * Tier 1 (explicit): station, technique, tool, equipment
 * Tier 2 (derived): sublocation, output destination
 * Tier 3 (inferred): requires human judgment
 */

import { ActionFamily } from "../scripts/lib/schema";
import type { SublocationId } from "./stations.config";

// ============================================
// Sublocation derivation rules
// ============================================

export interface SublocationRule {
  /** Default sublocation for this action family when at a station */
  default: SublocationId;
  /** If true, sublocation should be "equipment" when step has equipment */
  requiresEquipment?: boolean;
  /** Techniques that should use storage sublocations (cold_storage, cold_rail, etc.) */
  storageActions?: string[];
}

/**
 * Action family → default sublocation mapping.
 *
 * Logic:
 * - HEAT: happens at equipment (fryer, oven, etc.)
 * - PREP: usually at work_surface, except "get" which comes from storage
 * - TRANSFER: at work_surface (handoff point)
 * - ASSEMBLE: at work_surface
 * - COMBINE: at work_surface
 * - PORTION: at work_surface
 * - CHECK: at work_surface
 * - PACKAGING: at packaging sublocation
 */
export const ACTION_SUBLOCATION_RULES: Record<ActionFamily, SublocationRule> = {
  [ActionFamily.HEAT]: {
    default: "equipment",
    requiresEquipment: true,
  },
  [ActionFamily.PREP]: {
    default: "work_surface",
    storageActions: ["get", "retrieve", "open_pack"],
  },
  [ActionFamily.TRANSFER]: {
    default: "work_surface",
  },
  [ActionFamily.ASSEMBLE]: {
    default: "work_surface",
  },
  [ActionFamily.COMBINE]: {
    default: "work_surface",
  },
  [ActionFamily.PORTION]: {
    default: "work_surface",
  },
  [ActionFamily.CHECK]: {
    default: "work_surface",
  },
  [ActionFamily.PACKAGING]: {
    default: "packaging",
  },
  [ActionFamily.OTHER]: {
    default: "work_surface",
  },
};

// ============================================
// Output destination derivation rules
// ============================================

export type OutputDestinationRule =
  | "inherit" // stays where it is (same station/sublocation)
  | "handoff_point" // to work_surface for pickup by next step
  | "equipment" // stays at equipment until transfer
  | "expo"; // final step goes to expo

export interface OutputDestinationConfig {
  /** When next step is at same station */
  sameStationNextStep: OutputDestinationRule;
  /** When next step is at different station */
  crossStationNextStep: OutputDestinationRule;
  /** When this is a HEAT action */
  heatAction: OutputDestinationRule;
  /** When this is the final step (no next step) */
  finalStep: OutputDestinationRule;
}

export const OUTPUT_DESTINATION_RULES: OutputDestinationConfig = {
  sameStationNextStep: "inherit",
  crossStationNextStep: "handoff_point",
  heatAction: "equipment",
  finalStep: "expo",
};

// ============================================
// Input source derivation rules
// ============================================

/**
 * Storage type hierarchy for "get" actions.
 * When retrieving items, infer storage location based on item type.
 */
export const STORAGE_HIERARCHY: SublocationId[] = [
  "cold_storage", // refrigerated items
  "cold_rail", // cold rail items
  "dry_rail", // dry items
  "kit_storage", // kitted components
  "packaging", // packaging materials
];

/**
 * Default storage sublocation for different item categories.
 * Used when deriving input.from for retrieval steps.
 */
export const ITEM_STORAGE_DEFAULTS: Record<string, SublocationId> = {
  // Patterns for item names/categories
  refrigerated: "cold_storage",
  cold: "cold_storage",
  frozen: "cold_storage", // or freezer at fryer station
  sauce: "cold_rail",
  cheese: "cold_rail",
  produce: "cold_rail",
  dry: "dry_rail",
  seasoning: "dry_rail",
  container: "packaging",
  lid: "packaging",
  foil: "packaging",
  bag: "packaging",
};

// ============================================
// Helper functions
// ============================================

/**
 * Get the default sublocation for an action family.
 */
export function getDefaultSublocationForAction(family: ActionFamily): SublocationId {
  return ACTION_SUBLOCATION_RULES[family]?.default ?? "work_surface";
}

/**
 * Check if an action family typically uses equipment sublocation.
 */
export function actionRequiresEquipment(family: ActionFamily): boolean {
  return ACTION_SUBLOCATION_RULES[family]?.requiresEquipment ?? false;
}

/**
 * Check if a technique is a storage retrieval action.
 */
export function isStorageRetrievalTechnique(techniqueId: string | undefined): boolean {
  if (!techniqueId) return false;
  const prepRules = ACTION_SUBLOCATION_RULES[ActionFamily.PREP];
  return prepRules.storageActions?.includes(techniqueId) ?? false;
}
