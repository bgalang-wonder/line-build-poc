/**
 * Techniques configuration.
 *
 * Defines the controlled vocabulary for action.techniqueId values and their
 * relationships to action families and tools.
 *
 * NOTE: These technique names are aligned with training data and operational
 * terminology. Some may overlap with equipment names (e.g., "Clamshell Grill",
 * "Waterbath") - this is intentional for training consistency.
 */

import { ActionFamily } from "../scripts/lib/schema";

export interface TechniqueConfig {
  id: string;
  label: string;
  /** Which action family this technique belongs to */
  actionFamily: ActionFamily;
  /** Tools typically used with this technique */
  typicalTools?: string[];
  /** Aliases that should normalize to this technique */
  aliases?: string[];
  /** Description for help/autocomplete */
  description?: string;
}

/**
 * All techniques in the system.
 * Based on training-aligned operational terminology.
 */
export const TECHNIQUES: TechniqueConfig[] = [
  // ============================================
  // PREP — Preparation techniques
  // ============================================
  {
    id: "cut",
    label: "Cut",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["utility_knife"],
    description: "Cut or slice item",
  },
  {
    id: "drain",
    label: "Drain",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Drain liquid from item",
  },
  {
    id: "open_kit",
    label: "Open Kit",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand", "viper"],
    description: "Open kit packaging",
  },
  {
    id: "open_pack",
    label: "Open Pack",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand", "viper"],
    description: "Open package or pack",
  },
  {
    id: "open_pouch",
    label: "Open Pouch",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand", "viper"],
    description: "Open pouch packaging",
  },
  {
    id: "remove_foil",
    label: "Remove Foil",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Remove foil covering",
  },
  {
    id: "scrape",
    label: "Scrape",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["bench_scraper", "spatula"],
    description: "Scrape or clean surface",
  },
  {
    id: "smash_open",
    label: "Smash Open",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Smash or break open item",
  },
  {
    id: "split_bun",
    label: "Split Bun",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand", "utility_knife"],
    description: "Split bun or bread",
  },
  {
    id: "massage",
    label: "Massage",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Massage or work ingredient",
  },
  {
    id: "remove_lid",
    label: "Remove Lid",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Remove lid or cover",
  },
  {
    id: "squeeze",
    label: "Squeeze",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Squeeze item or packaging",
  },
  {
    id: "crush",
    label: "Crush",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Crush or break down item",
  },
  {
    id: "make_well",
    label: "Make Well",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand", "spoon"],
    description: "Create well or indentation in food",
  },
  {
    id: "peel",
    label: "Peel",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand", "utility_knife"],
    description: "Peel skin or outer layer",
  },
  {
    id: "pat_dry",
    label: "Pat Dry",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["hand"],
    description: "Pat item dry with towel",
  },
  {
    id: "flip",
    label: "Flip",
    actionFamily: ActionFamily.PREP,
    typicalTools: ["spatula", "tongs"],
    description: "Flip or turn item over",
  },

  // ============================================
  // HEAT — Cooking techniques
  // ============================================
  {
    id: "clamshell_grill",
    label: "Clamshell Grill",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["spatula", "tongs"],
    description: "Cook on clamshell grill (technique name, not equipment)",
  },
  {
    id: "fry",
    label: "Fry",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["fry_basket", "tongs"],
    description: "Cook in hot oil",
  },
  {
    id: "press",
    label: "Press",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["hand", "spatula"],
    description: "Cook in press or panini grill",
  },
  {
    id: "toast",
    label: "Toast",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["hand", "tongs"],
    description: "Toast in toaster or oven",
  },
  {
    id: "turbo",
    label: "Turbo",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["hand", "tongs"],
    description: "Cook in turbo oven (technique name, not equipment)",
  },
  {
    id: "waterbath",
    label: "Waterbath",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["tongs", "hand"],
    description: "Cook in waterbath/sous vide (technique name, not equipment)",
  },
  {
    id: "microwave",
    label: "Microwave",
    actionFamily: ActionFamily.HEAT,
    typicalTools: ["hand"],
    description: "Cook in microwave (technique name, not equipment)",
  },

  // ============================================
  // TRANSFER — Movement techniques
  // ============================================
  {
    id: "pass",
    label: "Pass",
    actionFamily: ActionFamily.TRANSFER,
    typicalTools: ["hand"],
    description: "Pass to another station or person",
  },
  {
    id: "place",
    label: "Place",
    actionFamily: ActionFamily.TRANSFER,
    typicalTools: ["hand", "tongs"],
    description: "Place item at destination",
  },
  {
    id: "lift_fold",
    label: "Lift/Fold",
    actionFamily: ActionFamily.TRANSFER,
    typicalTools: ["hand", "spatula"],
    description: "Lift and fold item (e.g., burrito)",
  },
  {
    id: "pizza_slide",
    label: "Pizza Slide",
    actionFamily: ActionFamily.TRANSFER,
    typicalTools: ["paddle"],
    description: "Slide pizza from peel to oven or plate",
  },
  {
    id: "remove_from_pan",
    label: "Remove from Pan",
    actionFamily: ActionFamily.TRANSFER,
    typicalTools: ["spatula", "tongs"],
    description: "Remove item from pan or cooking vessel",
  },

  // ============================================
  // COMBINE — Mixing techniques
  // ============================================
  {
    id: "fold",
    label: "Fold",
    actionFamily: ActionFamily.COMBINE,
    typicalTools: ["spatula", "spoon"],
    description: "Gently fold ingredients together",
  },
  {
    id: "shake",
    label: "Shake",
    actionFamily: ActionFamily.COMBINE,
    typicalTools: ["hand"],
    description: "Shake container to mix",
  },
  {
    id: "stir",
    label: "Stir",
    actionFamily: ActionFamily.COMBINE,
    typicalTools: ["spoon", "spatula"],
    description: "Stir ingredients together",
  },
  {
    id: "toss",
    label: "Toss",
    actionFamily: ActionFamily.COMBINE,
    typicalTools: ["tongs", "hand"],
    description: "Toss to combine",
  },
  {
    id: "mix",
    label: "Mix",
    actionFamily: ActionFamily.COMBINE,
    typicalTools: ["spoon", "whisk"],
    description: "Mix ingredients together",
  },

  // ============================================
  // ASSEMBLE — Construction techniques
  // ============================================
  {
    id: "roll",
    label: "Roll",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["hand"],
    description: "Roll item (e.g., burrito, wrap)",
  },
  {
    id: "spread",
    label: "Spread",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["spatula", "spoon"],
    description: "Spread ingredient on surface",
  },
  {
    id: "sprinkle",
    label: "Sprinkle",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["hand", "shaker"],
    description: "Sprinkle topping or seasoning",
  },
  {
    id: "tear_and_place",
    label: "Tear and Place",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["hand"],
    description: "Tear ingredient and place on item",
  },
  {
    id: "pizza_sprinkle",
    label: "Pizza Sprinkle",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["hand", "shaker"],
    description: "Sprinkle toppings on pizza",
  },
  {
    id: "shingle",
    label: "Shingle",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["hand", "tongs"],
    description: "Layer items in overlapping pattern (shingle arrangement)",
  },
  {
    id: "dots",
    label: "Dots",
    actionFamily: ActionFamily.ASSEMBLE,
    typicalTools: ["squeeze_bottle", "spoon"],
    description: "Apply in dot pattern",
  },

  // ============================================
  // PORTION — Measuring/dispensing
  // ============================================
  {
    id: "divide",
    label: "Divide",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["hand", "utility_knife"],
    description: "Divide or separate portions",
  },
  {
    id: "drizzle",
    label: "Drizzle",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["squeeze_bottle", "spoon"],
    description: "Drizzle liquid or sauce",
  },
  {
    id: "portion",
    label: "Portion",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["spoodle_2oz", "hand"],
    description: "Portion measured amount",
  },
  {
    id: "pour",
    label: "Pour",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["ladle", "squeeze_bottle"],
    description: "Pour liquid or sauce",
  },
  {
    id: "spray",
    label: "Spray",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["squeeze_bottle"],
    description: "Spray or mist ingredient",
  },
  {
    id: "pinch",
    label: "Pinch",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["hand"],
    description: "Add pinch amount",
  },
  {
    id: "fill",
    label: "Fill",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["ladle", "spoon"],
    description: "Fill container or vessel",
  },
  {
    id: "spiral_pour",
    label: "Spiral Pour",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["squeeze_bottle"],
    description: "Pour in spiral pattern",
  },
  {
    id: "line_pour",
    label: "Line Pour",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["squeeze_bottle"],
    description: "Pour in line pattern",
  },
  {
    id: "dollops",
    label: "Dollops",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["spoon"],
    description: "Add in dollop portions",
  },
  {
    id: "pizza_cut",
    label: "Pizza Cut",
    actionFamily: ActionFamily.PORTION,
    typicalTools: ["pizza_wheel"],
    description: "Cut pizza into portions",
  },

  // ============================================
  // PACKAGING — Closing/wrapping
  // ============================================
  {
    id: "cover",
    label: "Cover",
    actionFamily: ActionFamily.PACKAGING,
    typicalTools: ["hand"],
    description: "Cover item or container",
  },
  {
    id: "lid",
    label: "Lid",
    actionFamily: ActionFamily.PACKAGING,
    typicalTools: ["hand"],
    description: "Place lid on container",
  },
  {
    id: "sleeve",
    label: "Sleeve",
    actionFamily: ActionFamily.PACKAGING,
    typicalTools: ["hand"],
    description: "Place sleeve on item",
  },
  {
    id: "wrap",
    label: "Wrap",
    actionFamily: ActionFamily.PACKAGING,
    typicalTools: ["hand"],
    description: "Wrap item in foil, paper, or packaging",
  },
  {
    id: "sticker",
    label: "Sticker",
    actionFamily: ActionFamily.PACKAGING,
    typicalTools: ["hand"],
    description: "Apply sticker or label",
  },

  // ============================================
  // OTHER — Specialized or uncategorized
  // ============================================
  {
    id: "butter_wheel",
    label: "Butter Wheel",
    actionFamily: ActionFamily.OTHER,
    typicalTools: ["butter_wheel"],
    description: "Apply butter using butter wheel tool",
  },
  {
    id: "squeege",
    label: "Squeege",
    actionFamily: ActionFamily.OTHER,
    typicalTools: ["other"],
    description: "Use squeegee tool",
  },
  {
    id: "hot_held",
    label: "Hot Held",
    actionFamily: ActionFamily.OTHER,
    typicalTools: ["hand"],
    description: "Item in hot hold storage state",
  },
];

// ============================================
// Derived lookups
// ============================================

/** Map of techniqueId -> TechniqueConfig */
export const TECHNIQUE_BY_ID: Record<string, TechniqueConfig> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t])
);

/** Map of alias -> canonical techniqueId */
export const TECHNIQUE_ALIAS_MAP: Record<string, string> = Object.fromEntries(
  TECHNIQUES.flatMap((t) => (t.aliases ?? []).map((alias) => [alias, t.id]))
);

/** All valid technique IDs */
export const ALL_TECHNIQUE_IDS: string[] = TECHNIQUES.map((t) => t.id);

/** All technique IDs and aliases (for matching) */
export const ALL_TECHNIQUE_TERMS: string[] = [
  ...ALL_TECHNIQUE_IDS,
  ...Object.keys(TECHNIQUE_ALIAS_MAP),
];

// ============================================
// Helper functions
// ============================================

/**
 * Get the canonical technique ID for a term (handles aliases).
 * Returns undefined if not a known technique.
 */
export function normalizeTechnique(term: string): string | undefined {
  const lower = term.toLowerCase();
  if (TECHNIQUE_BY_ID[lower]) return lower;
  return TECHNIQUE_ALIAS_MAP[lower];
}

/**
 * Check if a technique ID is known (canonical or alias).
 */
export function isKnownTechnique(techniqueId: string): boolean {
  return normalizeTechnique(techniqueId) !== undefined;
}

/**
 * Get techniques for an action family.
 */
export function getTechniquesForActionFamily(family: ActionFamily): TechniqueConfig[] {
  return TECHNIQUES.filter((t) => t.actionFamily === family);
}

/**
 * Get the expected action family for a technique.
 * Returns undefined if technique is not known.
 */
export function getTechniqueActionFamily(techniqueId: string): ActionFamily | undefined {
  const canonical = normalizeTechnique(techniqueId);
  if (!canonical) return undefined;
  return TECHNIQUE_BY_ID[canonical]?.actionFamily;
}

/**
 * Check if a technique matches the expected action family.
 */
export function isTechniqueForActionFamily(techniqueId: string, family: ActionFamily): boolean {
  const techFamily = getTechniqueActionFamily(techniqueId);
  return techFamily === family;
}

/**
 * Get typical tools for a technique.
 */
export function getTypicalToolsForTechnique(techniqueId: string): string[] {
  const canonical = normalizeTechnique(techniqueId);
  if (!canonical) return [];
  return TECHNIQUE_BY_ID[canonical]?.typicalTools ?? [];
}
