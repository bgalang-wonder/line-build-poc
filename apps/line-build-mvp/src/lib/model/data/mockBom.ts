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
// TODO: Populate from BigQuery

export const CONCEPTS: Concept[] = [
  // Placeholder - replace with real data
  { conceptId: 'LUNCH', conceptName: 'Lunch Menu', description: 'Weekday lunch offerings' },
  { conceptId: 'DINNER', conceptName: 'Dinner Menu', description: 'Evening dining options' },
  { conceptId: 'CATERING', conceptName: 'Catering', description: 'Large-format catering items' },
];

// ============================================================================
// Menu Items (80* items)
// ============================================================================
// TODO: Populate from BigQuery

export const MENU_ITEMS: BOMItem[] = [
  // Placeholder items - replace with real data
  {
    itemId: '8001234',
    name: 'Grilled Chicken Bowl',
    type: 'menu_item',
    conceptId: 'LUNCH',
    conceptName: 'Lunch Menu',
    category: 'Bowls',
    status: 'active',
  },
  {
    itemId: '8001235',
    name: 'Crispy Fish Tacos',
    type: 'menu_item',
    conceptId: 'LUNCH',
    conceptName: 'Lunch Menu',
    category: 'Tacos',
    status: 'active',
  },
  {
    itemId: '8001236',
    name: 'Herb-Roasted Salmon',
    type: 'menu_item',
    conceptId: 'DINNER',
    conceptName: 'Dinner Menu',
    category: 'Entrees',
    status: 'active',
  },
  {
    itemId: '8001237',
    name: 'Caesar Salad',
    type: 'menu_item',
    conceptId: 'LUNCH',
    conceptName: 'Lunch Menu',
    category: 'Salads',
    status: 'active',
  },
  {
    itemId: '8001238',
    name: 'Beef Brisket Platter',
    type: 'menu_item',
    conceptId: 'CATERING',
    conceptName: 'Catering',
    category: 'Platters',
    status: 'active',
  },
];

// ============================================================================
// Ingredients / Components (40* items)
// ============================================================================
// TODO: Populate from BigQuery if needed

export const INGREDIENTS: BOMItem[] = [
  { itemId: '4001001', name: 'Chicken Breast, Raw', type: 'ingredient' },
  { itemId: '4001002', name: 'Salmon Fillet, Raw', type: 'ingredient' },
  { itemId: '4001003', name: 'Romaine Lettuce', type: 'ingredient' },
  { itemId: '4001004', name: 'Flour Tortilla 8"', type: 'ingredient' },
  { itemId: '4001005', name: 'Rice, White Cooked', type: 'ingredient' },
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
  if (itemId.startsWith('40')) return 'ingredient';
  if (itemId.startsWith('50')) return 'consumable';
  if (itemId.startsWith('60')) return 'packaged_good';
  if (itemId.startsWith('70')) return 'packaging';
  return 'unknown';
}
