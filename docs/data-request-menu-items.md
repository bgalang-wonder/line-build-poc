# Data Request: Menu Items for Line Build Selection

## Purpose
We need sample menu item data to power the "Create New Build" flow in the Line Build Authoring MVP. Users will search/browse menu items to select which item they want to create a line build for.

## Required Data

### 1. Menu Items Table
The core data - individual menu items that can have line builds created for them.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `itemId` | string | Yes | Unique identifier (e.g., 7-digit ID) |
| `name` | string | Yes | Display name (e.g., "Chicken Parmesan") |
| `conceptId` | string | Yes | FK to concept/menu this item belongs to |
| `conceptName` | string | Yes | Denormalized concept name for display |
| `description` | string | No | Brief description of the item |
| `status` | string | No | Active/inactive/seasonal |
| `category` | string | No | Sub-category within concept (e.g., "Entrees", "Appetizers") |

**Sample size needed:** 50-100 menu items across multiple concepts

### 2. Concepts/Menus Table
The groupings that menu items belong to.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conceptId` | string | Yes | Unique identifier |
| `conceptName` | string | Yes | Display name (e.g., "Lunch Menu", "Catering", "Dinner") |
| `description` | string | No | Brief description |

**Sample size needed:** 5-10 concepts

## Example Output Format

### concepts.json
```json
[
  {
    "conceptId": "LUNCH",
    "conceptName": "Lunch Menu",
    "description": "Weekday lunch offerings"
  },
  {
    "conceptId": "DINNER",
    "conceptName": "Dinner Menu",
    "description": "Evening dining options"
  },
  {
    "conceptId": "CATERING",
    "conceptName": "Catering",
    "description": "Large-format catering items"
  }
]
```

### menuItems.json
```json
[
  {
    "itemId": "1234567",
    "name": "Chicken Parmesan",
    "conceptId": "DINNER",
    "conceptName": "Dinner Menu",
    "description": "Breaded chicken breast with marinara and mozzarella",
    "status": "active",
    "category": "Entrees"
  },
  {
    "itemId": "1234568",
    "name": "Caesar Salad",
    "conceptId": "LUNCH",
    "conceptName": "Lunch Menu",
    "description": "Romaine, croutons, parmesan, caesar dressing",
    "status": "active",
    "category": "Salads"
  }
]
```

## Where to Put the Data

Update the existing file:
```
apps/line-build-mvp/src/lib/model/data/mockBom.ts
```

This file already has `MENU_ITEMS` array with `itemId`, `name`, `type`. We need to:
1. Add `conceptId` and `conceptName` fields to existing items
2. Add a new `CONCEPTS` array

Alternatively, create new files alongside it:
```
apps/line-build-mvp/src/lib/model/data/
├── mockBom.ts          (existing)
├── concepts.ts         (new)
└── menuItems.ts        (new, or extend mockBom.ts)
```

## Usage Context

This data will be used for:
1. **Search**: User types "chicken" → show matching menu items
2. **Browse by Concept**: User selects "Lunch Menu" → show items in that concept
3. **Create Line Build**: User selects item → system creates a new LineBuild with `menuItemId` and `menuItemName` populated

## Questions for Data Pull

1. What's the actual source table/view in BigQuery for menu items?
2. Is there a concept/menu hierarchy, or are items flat?
3. Are there any items we should exclude (test items, inactive, etc.)?
4. Is there any BOM data associated with items we should include?
