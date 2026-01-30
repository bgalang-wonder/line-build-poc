/**
 * BOM (Bill of Materials) and Menu Item Data
 *
 * This file provides menu items and concepts for the Line Build MVP.
 * Data should be populated from BigQuery - see docs/data-request-menu-items.md
 *
 * Previous mock data archived at: _archive/mockBom.ts.bak
 */

// ============================================================================
// Interfaces
// ============================================================================

export interface Concept {
  conceptId: string;
  conceptName: string;
  description?: string;
}

export interface BOMItem {
  itemId: string;        // 7-digit ID (80* for menu items, 40* for components)
  name: string;
  type: 'ingredient' | 'consumable' | 'menu_item' | 'packaged_good' | 'packaging';
  conceptId?: string;    // FK to concept (for menu items)
  conceptName?: string;  // Denormalized for display
  description?: string;
  category?: string;     // Sub-category within concept
  status?: 'active' | 'inactive' | 'seasonal';
}

export interface BOMRecipe {
  menuItemId: string;
  components: Array<{
    componentId: string;
    quantity: number;
    unit: string;
  }>;
}

// ============================================================================
// Concepts / Menus
// ============================================================================
// Source: wonder-recipe-prod.mongo_batch_recipe_v2.concepts
// Pulled: 2026-01-08

export const CONCEPTS: Concept[] = [
  { conceptId: '4e781bdb-eca1-4c51-9371-783736b5596b', conceptName: 'Alanza', description: 'Italian-American classics' },
  { conceptId: 'Y29uY2VwdDo2Nzc=', conceptName: 'Bankside', description: 'Seafood and Southern' },
  { conceptId: '34d7ac58-9427-4928-b7d8-c10d715d88dc', conceptName: 'Bellies', description: 'Kids menu' },
  { conceptId: 'df4c141a-857f-46d0-a9c6-9c3f84f618a0', conceptName: 'Limesalt', description: 'Mexican-inspired' },
];

// ============================================================================
// Menu Items (80* items)
// ============================================================================
// Source: secure-recipe-prod.recipe_v2.item_versions (object_type='MENU', effective=true, item_status='ACTIVE')
// Pulled: 2026-01-08

export const MENU_ITEMS: BOMItem[] = [
  // Alanza
  { itemId: '8009870', name: 'Burrata Caponata, Alanza 3.0', type: 'menu_item', conceptId: '4e781bdb-eca1-4c51-9371-783736b5596b', conceptName: 'Alanza', status: 'active' },
  { itemId: '8006885', name: 'Chicken Milanese, Alanza 3.0', type: 'menu_item', conceptId: '4e781bdb-eca1-4c51-9371-783736b5596b', conceptName: 'Alanza', status: 'active' },
  { itemId: '8006886', name: 'Chicken Parmigiana, Alanza 3.0', type: 'menu_item', conceptId: '4e781bdb-eca1-4c51-9371-783736b5596b', conceptName: 'Alanza', status: 'active' },
  // Bankside
  { itemId: '8002223', name: 'Beet & Citrus Salad, Bankside', type: 'menu_item', conceptId: 'Y29uY2VwdDo2Nzc=', conceptName: 'Bankside', status: 'active' },
  { itemId: '8001650', name: 'Brown Butter Corn, Bankside', type: 'menu_item', conceptId: 'Y29uY2VwdDo2Nzc=', conceptName: 'Bankside', status: 'active' },
  { itemId: '8009409', name: 'Cabbage Slaw Side, Bankside', type: 'menu_item', conceptId: 'Y29uY2VwdDo2Nzc=', conceptName: 'Bankside', status: 'active' },
  // Bellies
  { itemId: '8010096', name: "Annie's Organic Cheddar Bunnies, Bellies", type: 'menu_item', conceptId: '34d7ac58-9427-4928-b7d8-c10d715d88dc', conceptName: 'Bellies', status: 'active' },
  { itemId: '8010105', name: 'Applesauce Pouch, Bellies', type: 'menu_item', conceptId: '34d7ac58-9427-4928-b7d8-c10d715d88dc', conceptName: 'Bellies', status: 'active' },
  { itemId: '8009943', name: 'Caesar Salad, Bellies', type: 'menu_item', conceptId: '34d7ac58-9427-4928-b7d8-c10d715d88dc', conceptName: 'Bellies', status: 'active' },
  // Limesalt
  { itemId: '8010760', name: 'Black Beans Side, Limesalt', type: 'menu_item', conceptId: 'df4c141a-857f-46d0-a9c6-9c3f84f618a0', conceptName: 'Limesalt', status: 'active' },
  { itemId: '8004968', name: 'Chips Add On, Limesalt', type: 'menu_item', conceptId: 'df4c141a-857f-46d0-a9c6-9c3f84f618a0', conceptName: 'Limesalt', status: 'active' },
  { itemId: '8005114', name: 'Guacamole Side, Limesalt', type: 'menu_item', conceptId: 'df4c141a-857f-46d0-a9c6-9c3f84f618a0', conceptName: 'Limesalt', status: 'active' },
];

// ============================================================================
// Components (40* consumables, 88* packaged, 90* packaging)
// ============================================================================
// Source: secure-recipe-prod.recipe_v2.bom_lines joined with item_versions
// Pulled: 2026-01-08

export const INGREDIENTS: BOMItem[] = [
  // HDR_CONSUMABLE_ITEM (40*)
  { itemId: '4000104', name: 'Beets, Cooked, Ready to Eat, Diced Large 3/4" HC', type: 'consumable' },
  { itemId: '4000111', name: 'Dressing, Caesar (Buyout) HC', type: 'consumable' },
  { itemId: '4000122', name: 'Pan de Cristal Prep (Jose Andres) HC', type: 'consumable' },
  { itemId: '4000130', name: 'Cheese, Burrata, 4oz pieces HC', type: 'consumable' },
  { itemId: '4000134', name: 'Olives, Greek, Pitted, Marinated, Drained HC', type: 'consumable' },
  { itemId: '4000246', name: 'Applesauce Pouch (Kids) HC', type: 'consumable' },
  { itemId: '4000256', name: "Annie's Organic Cheddar Bunnies .75oz (Kids) HC", type: 'consumable' },
  { itemId: '4000261', name: 'Peri Cashews (Cooked) HC', type: 'consumable' },
  { itemId: '4000291', name: 'Cabbage Slaw Blend (Mixed) HC', type: 'consumable' },
  { itemId: '4000394', name: 'Marinara for Pouching (Cooked) HC', type: 'consumable' },
  { itemId: '4000415', name: 'Nuts, Pine, Toasted (Buyout) HC', type: 'consumable' },
  { itemId: '4000430', name: 'Onion, Green Chopped 1/8" (Buyout) HC', type: 'consumable' },
  { itemId: '4000431', name: 'Croutons, Home Style HC', type: 'consumable' },
  { itemId: '4000474', name: 'Lettuce, Romaine, Chopped HC', type: 'consumable' },
  { itemId: '4000489', name: 'Pisto Manchego (Cooked) HC', type: 'consumable' },
  { itemId: '4000500', name: 'Oil, Olive, Extra Virgin HC', type: 'consumable' },
  { itemId: '4000504', name: 'Basil, Fresh (HDR) HC', type: 'consumable' },
  { itemId: '4000506', name: 'Cheese, Parmesan, Grated HC', type: 'consumable' },
  { itemId: '4000516', name: 'Capers, Nonpareil HC', type: 'consumable' },
  { itemId: '4000521', name: 'Salt, Kosher, Diamond Crystal HC', type: 'consumable' },
  { itemId: '4000522', name: 'Oil, Canola, Frying HC', type: 'consumable' },
  { itemId: '4000550', name: 'Spread, Guacamole (Buyout) HC', type: 'consumable' },
  // PACKAGED (88*)
  { itemId: '8803540', name: 'Black Beans (FC Mexican) [Pouch, 1200g]', type: 'packaged_good' },
  { itemId: '8805001', name: 'Arugula Fennel Mix (Alanza) [Bag, 85g]', type: 'packaged_good' },
  { itemId: '8805578', name: 'Watercress, Red [Bag, 12g]', type: 'packaged_good' },
  { itemId: '8805836', name: 'Beet & Citrus Salad [Kit]', type: 'packaged_good' },
  { itemId: '8806265', name: 'Tortilla Chips 4oz Buyout (Singles)', type: 'packaged_good' },
  { itemId: '8806321', name: 'Brown Butter Corn [Pouch, 224g]', type: 'packaged_good' },
  { itemId: '8807262', name: 'Lemon Vinaigrette with Shallot Dressing [Pack, 1Gal]', type: 'packaged_good' },
  { itemId: '8807329', name: 'Tomato, Grape (Pint)', type: 'packaged_good' },
  { itemId: '8807416', name: 'Chicken Cutlet [Bag, 2x]', type: 'packaged_good' },
  { itemId: '8807437', name: 'Parsley, Chopped, 1/8", No Stems [Pack, 4oz]', type: 'packaged_good' },
  { itemId: '8807442', name: 'Cheese, Mozzarella Provolone Blend Diced [Pack, 5LB]', type: 'packaged_good' },
  // NON_FOOD / Packaging (90*)
  { itemId: '9000039', name: 'Container, 6.25x6.25", 16oz, Natural, Square, Pulp', type: 'packaging' },
  { itemId: '9000040', name: 'Lid, Container, 6.5x6.5", 16oz, Clear, Square, PP Plastic', type: 'packaging' },
  { itemId: '9000061', name: 'Bowl, 32oz, Natural, Round, Pulp', type: 'packaging' },
  { itemId: '9000680', name: 'Tray, 52oz, Medium Entrée, Black-Gold, Rectangle, Aluminum', type: 'packaging' },
  { itemId: '9000681', name: 'Lid, Tray, 52oz, Clear, Rectangle, Dome, Plastic', type: 'packaging' },
  { itemId: '9000831', name: 'Cup & Lid, 8oz, Soup, Kraft', type: 'packaging' },
  { itemId: '9001249', name: 'Bag, 5.25x3.5x12", Insulated, White, Foil', type: 'packaging' },
  { itemId: '9001495', name: 'Sleeve, Alanza, 52 oz Black & Gold', type: 'packaging' },
  { itemId: '9001727', name: 'Lid, 32 & 48oz Pulp Bowl, PET, Dome', type: 'packaging' },
  { itemId: '9001810', name: 'Sleeve, Alanza, 16oz Pulp Square & 28 oz Pulp Rectangle', type: 'packaging' },
  { itemId: '9001903', name: 'Cup & Lid, White, 8oz, PP Lid', type: 'packaging' },
  { itemId: '9001961', name: 'Bag, White, Paper, 1#, Window', type: 'packaging' },
  { itemId: '9002138', name: 'Souffle Cup, 2oz, PP', type: 'packaging' },
  { itemId: '9002139', name: 'Lid, 2oz Souffle Cup, PET', type: 'packaging' },
  { itemId: '9002140', name: 'Souffle Cup, 4oz, PP', type: 'packaging' },
  { itemId: '9002141', name: 'Lid, 4oz Souffle Cup, PET', type: 'packaging' },
  { itemId: '9002425', name: 'Label, Bankside, Tamper Evident, 1x3', type: 'packaging' },
  { itemId: '9002624', name: 'Bowl, 16oz, Bellies', type: 'packaging' },
  { itemId: '9002626', name: 'Lid, 16 Oz, Bowl, Bellies', type: 'packaging' },
];

// ============================================================================
// Recipes (BOM linkage)
// ============================================================================
// Source: secure-recipe-prod.recipe_v2.bom_headers + bom_lines
// Pulled: 2026-01-08

export const RECIPES: BOMRecipe[] = [
  {
    menuItemId: '8009870', // Burrata Caponata, Alanza 3.0
    components: [
      { componentId: '4000122', quantity: 106.0212, unit: 'g' },
      { componentId: '4000130', quantity: 1.0, unit: 'ea' },
      { componentId: '4000134', quantity: 20.9682, unit: 'g' },
      { componentId: '4000489', quantity: 150.0, unit: 'g' },
      { componentId: '4000500', quantity: 4.74, unit: 'g' },
      { componentId: '4000504', quantity: 2.9975, unit: 'g' },
      { componentId: '4000516', quantity: 8.382, unit: 'g' },
      { componentId: '4000521', quantity: 0.272, unit: 'g' },
      { componentId: '9000039', quantity: 1.0, unit: 'ea' },
      { componentId: '9000040', quantity: 1.0, unit: 'ea' },
      { componentId: '9001249', quantity: 1.0, unit: 'ea' },
      { componentId: '9001810', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8006885', // Chicken Milanese, Alanza 3.0
    components: [
      { componentId: '4000415', quantity: 21.0202, unit: 'g' },
      { componentId: '4000504', quantity: 2.9975, unit: 'g' },
      { componentId: '4000506', quantity: 7.5, unit: 'g' },
      { componentId: '4000522', quantity: 17.4633, unit: 'g' },
      { componentId: '8805001', quantity: 0.1667, unit: 'ea' },
      { componentId: '8807262', quantity: 0.0138, unit: 'ea' },
      { componentId: '8807329', quantity: 0.1929, unit: 'ea' },
      { componentId: '8807416', quantity: 0.5, unit: 'ea' },
      { componentId: '9000680', quantity: 1.0, unit: 'ea' },
      { componentId: '9000681', quantity: 1.0, unit: 'ea' },
      { componentId: '9001495', quantity: 1.0, unit: 'ea' },
      { componentId: '9002138', quantity: 1.0, unit: 'ea' },
      { componentId: '9002139', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8006886', // Chicken Parmigiana, Alanza 3.0
    components: [
      { componentId: '4000394', quantity: 250.0, unit: 'g' },
      { componentId: '4000500', quantity: 11.85, unit: 'g' },
      { componentId: '4000506', quantity: 7.5, unit: 'g' },
      { componentId: '4000522', quantity: 34.9265, unit: 'g' },
      { componentId: '8807416', quantity: 1.0, unit: 'ea' },
      { componentId: '8807442', quantity: 0.0749, unit: 'ea' },
      { componentId: '9000680', quantity: 1.0, unit: 'ea' },
      { componentId: '9000681', quantity: 1.0, unit: 'ea' },
      { componentId: '9001495', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8002223', // Beet & Citrus Salad, Bankside
    components: [
      { componentId: '4000104', quantity: 169.98, unit: 'g' },
      { componentId: '4000261', quantity: 20.0, unit: 'g' },
      { componentId: '8805578', quantity: 0.5, unit: 'ea' },
      { componentId: '8805836', quantity: 1.0, unit: 'ea' },
      { componentId: '9000061', quantity: 1.0, unit: 'ea' },
      { componentId: '9001727', quantity: 1.0, unit: 'ea' },
      { componentId: '9002425', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8001650', // Brown Butter Corn, Bankside
    components: [
      { componentId: '4000430', quantity: 4.9885, unit: 'g' },
      { componentId: '4000521', quantity: 0.272, unit: 'g' },
      { componentId: '8806321', quantity: 1.0, unit: 'ea' },
      { componentId: '8807437', quantity: 0.0088, unit: 'ea' },
      { componentId: '9001903', quantity: 1.0, unit: 'ea' },
      { componentId: '9002425', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8009409', // Cabbage Slaw Side, Bankside
    components: [
      { componentId: '4000291', quantity: 224.9947, unit: 'g' },
      { componentId: '9001903', quantity: 1.0, unit: 'ea' },
      { componentId: '9002425', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8010096', // Annie's Organic Cheddar Bunnies, Bellies
    components: [
      { componentId: '4000256', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8010105', // Applesauce Pouch, Bellies
    components: [
      { componentId: '4000246', quantity: 0.999, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8009943', // Caesar Salad, Bellies
    components: [
      { componentId: '4000111', quantity: 49.9844, unit: 'g' },
      { componentId: '4000431', quantity: 14.9688, unit: 'g' },
      { componentId: '4000474', quantity: 39.96, unit: 'g' },
      { componentId: '4000506', quantity: 16.0, unit: 'g' },
      { componentId: '9002138', quantity: 1.0, unit: 'ea' },
      { componentId: '9002139', quantity: 1.0, unit: 'ea' },
      { componentId: '9002624', quantity: 1.0, unit: 'ea' },
      { componentId: '9002626', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8010760', // Black Beans Side, Limesalt
    components: [
      { componentId: '8803540', quantity: 0.25, unit: 'ea' },
      { componentId: '9000831', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8004968', // Chips Add On, Limesalt
    components: [
      { componentId: '8806265', quantity: 0.0833, unit: 'ea' },
      { componentId: '9001961', quantity: 1.0, unit: 'ea' },
    ],
  },
  {
    menuItemId: '8005114', // Guacamole Side, Limesalt
    components: [
      { componentId: '4000550', quantity: 100.0421, unit: 'g' },
      { componentId: '9002140', quantity: 1.0, unit: 'ea' },
      { componentId: '9002141', quantity: 1.0, unit: 'ea' },
    ],
  },
];

// ============================================================================
// Combined Catalog
// ============================================================================

export const MOCK_BOM_CATALOG: BOMItem[] = [...MENU_ITEMS, ...INGREDIENTS];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all BOM items (menu items + ingredients)
 */
export function getAllBOMItems(): BOMItem[] {
  return MOCK_BOM_CATALOG;
}

/**
 * Get only menu items
 */
export function getMenuItems(): BOMItem[] {
  return MENU_ITEMS;
}

/**
 * Get all concepts
 */
export function getConcepts(): Concept[] {
  return CONCEPTS;
}

/**
 * Get menu items by concept
 */
export function getMenuItemsByConcept(conceptId: string): BOMItem[] {
  return MENU_ITEMS.filter(item => item.conceptId === conceptId);
}

/**
 * Search menu items by name
 */
export function searchMenuItems(query: string): BOMItem[] {
  const lowerQuery = query.toLowerCase();
  return MENU_ITEMS.filter(item =>
    item.name.toLowerCase().includes(lowerQuery) ||
    item.itemId.includes(query)
  );
}

/**
 * Find a specific BOM item by ID
 */
export function findBOMItem(itemId: string): BOMItem | undefined {
  return MOCK_BOM_CATALOG.find(item => item.itemId === itemId);
}

/**
 * Find a menu item by ID
 */
export function findMenuItem(itemId: string): BOMItem | undefined {
  return MENU_ITEMS.find(item => item.itemId === itemId);
}

/**
 * Determine item type from ID prefix
 */
export function getItemTypeFromId(itemId: string): BOMItem['type'] | 'unknown' {
  if (itemId.startsWith('80')) return 'menu_item';
  if (itemId.startsWith('40')) return 'consumable';      // HDR_CONSUMABLE_ITEM
  if (itemId.startsWith('88')) return 'packaged_good';   // PACKAGED
  if (itemId.startsWith('90')) return 'packaging';       // NON_FOOD
  if (itemId.startsWith('5')) return 'ingredient';       // Raw ingredients
  return 'unknown';
}

/**
 * Get all recipes
 */
export function getRecipes(): BOMRecipe[] {
  return RECIPES;
}

/**
 * Get recipe for a specific menu item
 */
export function getRecipeForMenuItem(menuItemId: string): BOMRecipe | undefined {
  return RECIPES.find(recipe => recipe.menuItemId === menuItemId);
}

/**
 * Get components for a menu item (resolved with full item details)
 */
export function getComponentsForMenuItem(menuItemId: string): Array<BOMItem & { quantity: number; unit: string }> {
  const recipe = getRecipeForMenuItem(menuItemId);
  if (!recipe) return [];

  return recipe.components
    .map(comp => {
      const item = INGREDIENTS.find(i => i.itemId === comp.componentId);
      if (!item) return null;
      return { ...item, quantity: comp.quantity, unit: comp.unit };
    })
    .filter((item): item is BOMItem & { quantity: number; unit: string } => item !== null);
}
