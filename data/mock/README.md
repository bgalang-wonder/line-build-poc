# Mock Data

This directory contains mock data extracted from the `line-build-mvp` app before it was removed.

## Files

- **`mockBom.ts`** - Real menu item and BOM data pulled from BigQuery (concepts, menu items, ingredients, recipes)
- **`fixtures.ts`** - Sample line build fixtures for testing (Grilled Chicken Bowl, Fish Tacos, Buddha Bowl, Simple Sandwich)
- **`equipmentProfiles.ts`** - Kitchen equipment profiles and customization values (Waterbath, Turbo, Full Service, Satellite)

## Types

The domain types referenced by these files are preserved in `docs/schema/types-benchtop.ts`.

## Usage

These files are preserved as reference data. When using them in a new implementation:

1. Update imports to reference `docs/schema/types-benchtop.ts` for type definitions
2. The mock BOM data contains real production data from BigQuery (pulled 2026-01-08)
3. Fixtures and equipment profiles are example/test data
