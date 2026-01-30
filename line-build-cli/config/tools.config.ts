/**
 * Tools configuration.
 *
 * Defines the controlled vocabulary for tools (ToolId) and their relationships
 * to stations and action families.
 */

import { ActionFamily } from "../scripts/lib/schema";
import type { StationSide } from "./stations.config";

export type ToolCategory = "hand" | "utensil" | "portioning" | "cutting" | "measurement" | "specialized";

export interface ToolConfig {
  id: string;
  label: string;
  category: ToolCategory;
  /** Station sides where this tool is typically available */
  typicalSides?: StationSide[];
  /** Action families this tool is commonly used with */
  typicalActionFamilies?: ActionFamily[];
  /** Description for help/autocomplete */
  description?: string;
}

/**
 * All tools in the system.
 */
export const TOOLS: ToolConfig[] = [
  // ============================================
  // HAND — No tool / bare hands
  // ============================================
  {
    id: "hand",
    label: "Hand",
    category: "hand",
    description: "No tool required, performed by hand",
  },

  // ============================================
  // UTENSILS — General manipulation
  // ============================================
  {
    id: "tongs",
    label: "Tongs",
    category: "utensil",
    typicalSides: ["hot_side", "cold_side"],
    typicalActionFamilies: [ActionFamily.HEAT, ActionFamily.TRANSFER, ActionFamily.ASSEMBLE],
    description: "Standard tongs for gripping and transferring",
  },
  {
    id: "mini_tong",
    label: "Mini Tongs",
    category: "utensil",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.ASSEMBLE, ActionFamily.PORTION],
    description: "Small tongs for garnishes and delicate items",
  },
  {
    id: "paddle",
    label: "Paddle",
    category: "utensil",
    typicalSides: ["hot_side"],
    typicalActionFamilies: [ActionFamily.HEAT],
    description: "Flat paddle for moving items in ovens",
  },
  {
    id: "spatula",
    label: "Spatula",
    category: "utensil",
    typicalSides: ["hot_side", "cold_side"],
    typicalActionFamilies: [ActionFamily.HEAT, ActionFamily.TRANSFER],
    description: "Flat spatula for flipping and transferring",
  },
  {
    id: "spoon",
    label: "Spoon",
    category: "utensil",
    typicalSides: ["hot_side", "cold_side"],
    typicalActionFamilies: [ActionFamily.COMBINE, ActionFamily.PORTION],
    description: "General purpose spoon",
  },
  {
    id: "whisk",
    label: "Whisk",
    category: "utensil",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.COMBINE, ActionFamily.PREP],
    description: "Wire whisk for mixing and aerating",
  },
  {
    id: "ladle",
    label: "Ladle",
    category: "utensil",
    typicalSides: ["hot_side", "cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION, ActionFamily.TRANSFER],
    description: "Deep ladle for liquids and sauces",
  },

  // ============================================
  // PORTIONING — Measured dispensing
  // ============================================
  {
    id: "spoodle_1oz",
    label: "Spoodle (1oz)",
    category: "portioning",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION],
    description: "1oz portion-control spoodle",
  },
  {
    id: "spoodle_2oz",
    label: "Spoodle (2oz)",
    category: "portioning",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION],
    description: "2oz portion-control spoodle",
  },
  {
    id: "spoodle_3oz",
    label: "Spoodle (3oz)",
    category: "portioning",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION],
    description: "3oz portion-control spoodle",
  },
  {
    id: "squeeze_bottle",
    label: "Squeeze Bottle",
    category: "portioning",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION, ActionFamily.ASSEMBLE],
    description: "Squeeze bottle for sauces and dressings",
  },
  {
    id: "shaker",
    label: "Shaker",
    category: "portioning",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION],
    description: "Shaker for dry seasonings",
  },

  // ============================================
  // CUTTING — Prep tools
  // ============================================
  {
    id: "utility_knife",
    label: "Utility Knife",
    category: "cutting",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PREP],
    description: "General purpose utility knife",
  },
  {
    id: "bench_scraper",
    label: "Bench Scraper",
    category: "cutting",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PREP, ActionFamily.TRANSFER],
    description: "Bench scraper for cutting and transferring",
  },

  // ============================================
  // MEASUREMENT
  // ============================================
  {
    id: "scale",
    label: "Scale",
    category: "measurement",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.PORTION, ActionFamily.CHECK],
    description: "Digital scale for precise portions",
  },

  // ============================================
  // SPECIALIZED — Equipment-specific
  // ============================================
  {
    id: "fry_basket",
    label: "Fry Basket",
    category: "specialized",
    typicalSides: ["hot_side"],
    typicalActionFamilies: [ActionFamily.HEAT],
    description: "Wire basket for deep frying",
  },
  {
    id: "viper",
    label: "Viper",
    category: "specialized",
    typicalSides: ["cold_side"],
    typicalActionFamilies: [ActionFamily.ASSEMBLE],
    description: "Viper tool for assembly",
  },

  // ============================================
  // FALLBACK
  // ============================================
  {
    id: "other",
    label: "Other",
    category: "utensil",
    description: "Other tool not in standard list",
  },
];

// ============================================
// Derived lookups
// ============================================

/** Map of toolId -> ToolConfig */
export const TOOL_BY_ID: Record<string, ToolConfig> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t])
);

/** All valid tool IDs */
export const ALL_TOOL_IDS: string[] = TOOLS.map((t) => t.id);

// ============================================
// Helper functions
// ============================================

/**
 * Get tools typically used for an action family.
 */
export function getToolsForActionFamily(family: ActionFamily): ToolConfig[] {
  return TOOLS.filter((t) => t.typicalActionFamilies?.includes(family));
}

/**
 * Get tools typically available on a station side.
 */
export function getToolsForSide(side: StationSide): ToolConfig[] {
  return TOOLS.filter((t) => !t.typicalSides || t.typicalSides.includes(side));
}

/**
 * Check if a tool is typical for a given action family.
 * Returns true if no typical families defined (tool is general purpose).
 */
export function isTypicalToolForAction(toolId: string, family: ActionFamily): boolean {
  const tool = TOOL_BY_ID[toolId];
  if (!tool) return false;
  if (!tool.typicalActionFamilies) return true; // general purpose
  return tool.typicalActionFamilies.includes(family);
}

/**
 * Check if a tool is typical for a station side.
 * Returns true if no typical sides defined (tool is available everywhere).
 */
export function isTypicalToolForSide(toolId: string, side: StationSide): boolean {
  const tool = TOOL_BY_ID[toolId];
  if (!tool) return false;
  if (!tool.typicalSides) return true; // available everywhere
  return tool.typicalSides.includes(side);
}
