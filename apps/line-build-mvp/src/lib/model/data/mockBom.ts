/**
 * Mock BOM (Bill of Materials) Dataset
 * Provides realistic 7-digit item IDs following Cookbook conventions
 * Used for autocomplete, validation, and testing
 */

// ============================================================================
// Item Interface
// ============================================================================

export interface BOMItem {
  itemId: string; // 7-digit ID
  name: string;
  type: "ingredient" | "consumable" | "menu_item" | "packaged_good" | "packaging";
}

export interface BOMRecipe {
  menuItemId: string; // 80* item
  components: Array<{
    componentId: string; // 40* item
    quantity: number;
    unit: string;
  }>;
}

// ============================================================================
// Menu Items (80* items)
// ============================================================================
// Menu items that have line builds, used in Spork for food production

export const MENU_ITEMS: BOMItem[] = [
  {
    itemId: "8001234",
    name: "Grilled Chicken Bowl",
    type: "menu_item",
  },
  {
    itemId: "8001235",
    name: "Crispy Fish Tacos",
    type: "menu_item",
  },
  {
    itemId: "8001236",
    name: "Spiced Vegetable Stir Fry",
    type: "menu_item",
  },
  {
    itemId: "8001237",
    name: "Herb-Roasted Salmon",
    type: "menu_item",
  },
  {
    itemId: "8001238",
    name: "Mediterranean Salad Bowl",
    type: "menu_item",
  },
  {
    itemId: "8001239",
    name: "Teriyaki Beef Noodles",
    type: "menu_item",
  },
  {
    itemId: "8001240",
    name: "Tofu Pad Thai",
    type: "menu_item",
  },
  {
    itemId: "8001241",
    name: "Pulled Pork Sandwich",
    type: "menu_item",
  },
];

// ============================================================================
// Consumable Items (40* items)
// ============================================================================
// Components used in menu item BOMs

export const CONSUMABLE_ITEMS: BOMItem[] = [
  // Proteins
  {
    itemId: "4001001",
    name: "Chicken Breast Fillet",
    type: "consumable",
  },
  {
    itemId: "4001002",
    name: "Atlantic Salmon Fillet",
    type: "consumable",
  },
  {
    itemId: "4001003",
    name: "Tofu Block (Extra Firm)",
    type: "consumable",
  },
  {
    itemId: "4001004",
    name: "Beef Tenderloin",
    type: "consumable",
  },
  {
    itemId: "4001005",
    name: "White Fish (Cod Fillet)",
    type: "consumable",
  },
  {
    itemId: "4001006",
    name: "Pork Shoulder",
    type: "consumable",
  },

  // Vegetables
  {
    itemId: "4002001",
    name: "Bell Pepper Mix",
    type: "consumable",
  },
  {
    itemId: "4002002",
    name: "Broccoli Crown",
    type: "consumable",
  },
  {
    itemId: "4002003",
    name: "Spinach (Fresh)",
    type: "consumable",
  },
  {
    itemId: "4002004",
    name: "Carrot Batons",
    type: "consumable",
  },
  {
    itemId: "4002005",
    name: "Cherry Tomatoes",
    type: "consumable",
  },
  {
    itemId: "4002006",
    name: "Cucumber Slices",
    type: "consumable",
  },

  // Rice & Noodles
  {
    itemId: "4003001",
    name: "Jasmine Rice",
    type: "consumable",
  },
  {
    itemId: "4003002",
    name: "Egg Noodles",
    type: "consumable",
  },
  {
    itemId: "4003003",
    name: "Rice Noodles",
    type: "consumable",
  },

  // Sauces & Condiments
  {
    itemId: "4004001",
    name: "Teriyaki Sauce",
    type: "consumable",
  },
  {
    itemId: "4004002",
    name: "Olive Oil (Extra Virgin)",
    type: "consumable",
  },
];

// ============================================================================
// Ingredient Items (5* items)
// ============================================================================
// Raw ingredients, lowest-level unit (reference only for BOM context)

export const INGREDIENT_ITEMS: BOMItem[] = [
  {
    itemId: "5001001",
    name: "Salt (Fine)",
    type: "ingredient",
  },
  {
    itemId: "5001002",
    name: "Black Pepper (Ground)",
    type: "ingredient",
  },
  {
    itemId: "5001003",
    name: "Garlic (Fresh)",
    type: "ingredient",
  },
  {
    itemId: "5001004",
    name: "Ginger (Fresh)",
    type: "ingredient",
  },
  {
    itemId: "5001005",
    name: "Lemon (Fresh)",
    type: "ingredient",
  },
  {
    itemId: "5001006",
    name: "Soy Sauce",
    type: "ingredient",
  },
];

// ============================================================================
// Packaged Goods (88* items)
// ============================================================================

export const PACKAGED_GOODS: BOMItem[] = [
  {
    itemId: "8801001",
    name: "Paper Lunch Box (Medium)",
    type: "packaged_good",
  },
  {
    itemId: "8801002",
    name: "Plastic Food Container (16oz)",
    type: "packaged_good",
  },
];

// ============================================================================
// Packaging Items (9* items)
// ============================================================================

export const PACKAGING_ITEMS: BOMItem[] = [
  {
    itemId: "9001001",
    name: "Napkin Paper (Standard)",
    type: "packaging",
  },
  {
    itemId: "9001002",
    name: "Plastic Fork",
    type: "packaging",
  },
  {
    itemId: "9001003",
    name: "Paper Bag (Brown)",
    type: "packaging",
  },
];

// ============================================================================
// BOM Recipes
// ============================================================================
// Menu items (80*) and their component items (40*)

export const BOM_RECIPES: BOMRecipe[] = [
  {
    menuItemId: "8001234", // Grilled Chicken Bowl
    components: [
      { componentId: "4001001", quantity: 200, unit: "g" }, // Chicken Breast Fillet
      { componentId: "4003001", quantity: 150, unit: "g" }, // Jasmine Rice
      { componentId: "4002001", quantity: 100, unit: "g" }, // Bell Pepper Mix
      { componentId: "4002002", quantity: 50, unit: "g" }, // Broccoli Crown
    ],
  },
  {
    menuItemId: "8001235", // Crispy Fish Tacos
    components: [
      { componentId: "4001005", quantity: 150, unit: "g" }, // White Fish (Cod Fillet)
      { componentId: "4002001", quantity: 80, unit: "g" }, // Bell Pepper Mix
      { componentId: "4004002", quantity: 15, unit: "ml" }, // Olive Oil
    ],
  },
  {
    menuItemId: "8001236", // Spiced Vegetable Stir Fry
    components: [
      { componentId: "4002002", quantity: 150, unit: "g" }, // Broccoli Crown
      { componentId: "4002001", quantity: 100, unit: "g" }, // Bell Pepper Mix
      { componentId: "4002004", quantity: 80, unit: "g" }, // Carrot Batons
      { componentId: "4003001", quantity: 120, unit: "g" }, // Jasmine Rice
    ],
  },
  {
    menuItemId: "8001237", // Herb-Roasted Salmon
    components: [
      { componentId: "4001002", quantity: 180, unit: "g" }, // Atlantic Salmon Fillet
      { componentId: "4002003", quantity: 100, unit: "g" }, // Spinach (Fresh)
      { componentId: "4002005", quantity: 80, unit: "g" }, // Cherry Tomatoes
    ],
  },
  {
    menuItemId: "8001238", // Mediterranean Salad Bowl
    components: [
      { componentId: "4002003", quantity: 120, unit: "g" }, // Spinach (Fresh)
      { componentId: "4002005", quantity: 100, unit: "g" }, // Cherry Tomatoes
      { componentId: "4002006", quantity: 80, unit: "g" }, // Cucumber Slices
      { componentId: "4004002", quantity: 20, unit: "ml" }, // Olive Oil
    ],
  },
  {
    menuItemId: "8001239", // Teriyaki Beef Noodles
    components: [
      { componentId: "4001004", quantity: 150, unit: "g" }, // Beef Tenderloin
      { componentId: "4003002", quantity: 150, unit: "g" }, // Egg Noodles
      { componentId: "4002002", quantity: 100, unit: "g" }, // Broccoli Crown
      { componentId: "4004001", quantity: 30, unit: "ml" }, // Teriyaki Sauce
    ],
  },
  {
    menuItemId: "8001240", // Tofu Pad Thai
    components: [
      { componentId: "4001003", quantity: 200, unit: "g" }, // Tofu Block (Extra Firm)
      { componentId: "4003003", quantity: 150, unit: "g" }, // Rice Noodles
      { componentId: "4002004", quantity: 80, unit: "g" }, // Carrot Batons
      { componentId: "4004001", quantity: 25, unit: "ml" }, // Teriyaki Sauce
    ],
  },
  {
    menuItemId: "8001241", // Pulled Pork Sandwich
    components: [
      { componentId: "4001006", quantity: 250, unit: "g" }, // Pork Shoulder
      { componentId: "4004001", quantity: 40, unit: "ml" }, // Teriyaki Sauce
    ],
  },
];

// ============================================================================
// Aggregated Catalog
// ============================================================================

export const MOCK_BOM_CATALOG = {
  menuItems: MENU_ITEMS,
  consumables: CONSUMABLE_ITEMS,
  ingredients: INGREDIENT_ITEMS,
  packagedGoods: PACKAGED_GOODS,
  packaging: PACKAGING_ITEMS,
  recipes: BOM_RECIPES,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all items flattened for autocomplete
 */
export function getAllBOMItems(): BOMItem[] {
  return [
    ...MENU_ITEMS,
    ...CONSUMABLE_ITEMS,
    ...INGREDIENT_ITEMS,
    ...PACKAGED_GOODS,
    ...PACKAGING_ITEMS,
  ];
}

/**
 * Find item by ID
 */
export function findBOMItem(itemId: string): BOMItem | undefined {
  return getAllBOMItems().find((item) => item.itemId === itemId);
}

/**
 * Get BOM recipe for a menu item
 */
export function getBOMRecipe(menuItemId: string): BOMRecipe | undefined {
  return BOM_RECIPES.find((recipe) => recipe.menuItemId === menuItemId);
}

/**
 * Get item type from ID prefix
 */
export function getItemTypeFromId(itemId: string): string | null {
  if (itemId.startsWith("5")) return "ingredient";
  if (itemId.startsWith("3")) return "benchtop_recipe";
  if (itemId.startsWith("40")) return "consumable";
  if (itemId.startsWith("80")) return "menu_item";
  if (itemId.startsWith("88")) return "packaged_good";
  if (itemId.startsWith("9")) return "guest_packaging";
  return null;
}
