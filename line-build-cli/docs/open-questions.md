# Open Questions: CSV to Schema Mapping

This document records mapping decisions made during line build generation from `Test Items(Data).csv`.

## Tool Mappings

### Direct Mappings (no notes needed)

| CSV Value | Schema `toolId` |
|-----------|----------------|
| Hand, hand | `hand` |
| Tongs | `tongs` |
| Mini Tong | `mini_tong` |
| Paddle | `paddle` |
| Spatula, spatula | `spatula` |
| spoon, Spoon | `spoon` |
| Viper, viper | `viper` |
| Fry Basket, Basket | `fry_basket` |
| Rose Shaker, Shaker - Rose | `shaker` |
| Scale | `scale` |
| Bench Scraper | `bench_scraper` |
| Whisk | `whisk` |

### Mapped with Notes (preserve original in `step.notes`)

| CSV Value | Schema `toolId` | Notes |
|-----------|----------------|-------|
| 1 oz Spoodle | `spoodle_1oz` | Direct match |
| 2 oz Spoodle, 2oz spoodle | `spoodle_2oz` | Direct match |
| 3 oz Spoodle | `spoodle_3oz` | Direct match |
| 5 oz Spoodle | `other` | Tool: 5 oz Spoodle |
| 6 oz Spoodle | `other` | Tool: 6 oz Spoodle |
| 8 oz Spoodle | `other` | Tool: 8 oz Spoodle |
| 1.5 oz Spoodle | `other` | Tool: 1.5 oz Spoodle |
| 4 oz Slotted Spoodle | `other` | Tool: 4 oz Slotted Spoodle |
| 3 oz Slotted Spoodle | `other` | Tool: 3 oz Slotted Spoodle |
| 6 oz Slotted Spoodle | `other` | Tool: 6 oz Slotted Spoodle |
| 2 oz Slotted Spoodle | `other` | Tool: 2 oz Slotted Spoodle |
| Pizza Wheel | `other` | Tool: Pizza Wheel |
| Portion Cup | `other` | Tool: Portion Cup |
| Pan Grabber + Spatula | `spatula` | Tool: Pan Grabber + Spatula |
| Scissor | `other` | Tool: Scissor |
| Avocado Knife | `utility_knife` | Tool: Avocado Knife |
| Bread Knife | `utility_knife` | Tool: Bread Knife |
| 1 Tbsp | `other` | Tool: 1 Tbsp measuring spoon |
| 1 tsp | `other` | Tool: 1 tsp measuring spoon |
| Tri Tip Bottle | `squeeze_bottle` | Tool: Tri Tip Bottle |
| white bottle, White Squeeze | `squeeze_bottle` | Tool: White Squeeze Bottle |
| yellow Squeeze, yellow squeeze | `squeeze_bottle` | Tool: Yellow Squeeze Bottle |
| Squeeze Bottle | `squeeze_bottle` | Direct match |
| 2 oz Laddle, 1.5 oz Laddle | `ladle` | Original size in notes |
| Red Disher | `other` | Tool: Red Disher |
| 2oz Soufle Cup | `other` | Tool: 2oz Souffle Cup |

---

## Station Mappings

### Direct Mappings

| CSV Value | Schema `stationId` |
|-----------|-------------------|
| Waterbath | `waterbath` |
| Garnish | `garnish` |
| Fryer | `fryer` |
| Turbo | `turbo` |
| Press | `press` |
| Toaster | `toaster` |
| Vending | `vending` |
| Speed Line | `speed_line` |
| Sauce Warmer | `sauce_warmer` |

### Mapped with Notes

| CSV Value | Schema `stationId` | Notes |
|-----------|-------------------|-------|
| Pizza | `turbo` | Station: Pizza (uses turbo for cooking) |

**Note on Pizza station:** The CSV uses "Pizza" as a station, but actual cooking happens in the turbo oven. We map to `turbo` for the cook step but preserve the original station name in notes for readability.

---

## Missing or Inferred Cook Times

The following items have missing cook times in the CSV that need confirmation:

| Item | Step | Equipment | Cook Time | Status |
|------|------|-----------|-----------|--------|
| Cheese Fries (8009068) | Cheese Sauce Waterbath | Waterbath | Missing | **Needs user input** |
| Mushroom Bruschetta (8006357) | Pass to Garnish (step 6) | Turbo | Missing (step 6) | Inferred from step 5 |
| Mushroom Bruschetta (8006357) | Pass to Garnish (step 12) | Turbo | Missing (step 12) | Inferred from step 11 |
| Chicken Parmigiana (8006886) | Pass to Garnish (step 12) | Turbo | Missing | Inferred from prior step |

### Default Cook Time Assumptions

When cook time is missing but equipment is specified:
- **Waterbath (reheat):** 300-360s (5-6 min) passive - typical for pouched sauces
- **Waterbath (full cook):** 600-1200s (10-20 min) passive - for proteins/rice
- **Turbo (pass step):** No additional time (0s) - just a transfer, not a cook

---

## Location Mappings

### Storage/Source Locations

| CSV Location | Schema `sublocation.type` |
|--------------|---------------------------|
| Cold Storage | `cold_storage` |
| Cold Rail | `cold_rail` |
| Dry Rail | `dry_rail` |
| Freezer | `freezer` |
| Hot Box | `hot_hold_well` |
| Steam Well | `hot_hold_well` |
| Sauce Warmer | `equipment` with `equipmentId: sauce_warmer` |
| Kit | `kit` |
| packaging | `packaging` |
| From Waterbath Station | `equipment` with `equipmentId: waterbath` |
| From Turbo Station | `equipment` with `equipmentId: turbo` |
| From Fryer Station | `equipment` with `equipmentId: fryer` |
| From Press Station | `equipment` with `equipmentId: press` |
| n/a | Omit (no specific location) |

---

## Technique Mappings

### Action Family Inference from CSV "Technique" Column

| CSV Technique | Action Family | `techniqueId` |
|---------------|--------------|---------------|
| Place | TRANSFER | `place` |
| Pass | TRANSFER | `pass` |
| Open Pack, Open Pouch, Open Kit | PREP | `open_pack` |
| Portion | PORTION | - |
| Fry | HEAT | - |
| Waterbath | HEAT | - |
| Turbo | HEAT | - |
| Toast | HEAT | - |
| Press | HEAT | - |
| Sprinkle, Pizza Sprinkle | PORTION | - |
| Drizzle | PORTION | - |
| Pour, Spiral Pour, Line Pour | PORTION | - |
| Spread | ASSEMBLE | - |
| Divide | PORTION | - |
| Place | ASSEMBLE | - (when adding to build) |
| Lid | PACKAGING | - |
| Sticker | PACKAGING | - |
| Sleeve | PACKAGING | - |
| Wrap | PACKAGING | - |
| Cut, Pizza cut, Pizza Cut | PREP | `cut` |
| Tear and Place | PREP | `tear` |
| Fold | ASSEMBLE | - |
| Toss | COMBINE | - |
| Shake | PORTION | - |
| Smash Open | PREP | - (use notes) |
| Remove from pan | TRANSFER | `retrieve` |
| Pizza Slide | TRANSFER | `place` |
| Remove Foil | PREP | - (use notes) |
| Cover | PREP | - (use notes) |
| Massage | PREP | - (use notes) |
| Butter Wheel | ASSEMBLE | - (use notes) |
| Split Bun | PREP | `cut` |
| Stir | COMBINE | - |
| Scrape | TRANSFER | - (use notes) |
| Lift/Fold | ASSEMBLE | - (use notes) |
| Drain | PREP | - (use notes) |
| Fill | PORTION | - |

---

## Phase Mappings

| CSV Phase | Schema `cookingPhase` |
|-----------|----------------------|
| Pre Cook | `PRE_COOK` |
| Cook | `COOK` |
| Post Cook | `POST_COOK` |
| Build, build | `ASSEMBLY` |
| Package | `PASS` |
| PrePackage | `PASS` |
| Pass to expo, Pass to Expo | `PASS` |
| Pass to Garnish | `POST_COOK` |
| Pass to Turbo | `POST_COOK` |
| Vending | `ASSEMBLY` (vending context) |

---

## BYO Items - Customization Patterns

The following items use Build-Your-Own patterns with customization:

| Item | ID | Customization Pattern |
|------|-----|----------------------|
| Burrito (BYO), Limesalt | 8004637 | Rice/protein/toppings selection |
| BYO Spicy Poke Bowl, Hanu Poke | 8010500 | Protein/toppings selection |
| Quesadilla (BYO), Limesalt | 8005007 | Protein/toppings selection |
| Sandwich (BYO), Yasas | 8007402 | Protein/toppings selection |
| Taco (BYO), Limesalt | 8005005 | Shell/rice/protein/toppings selection |

**Modeling approach:** Use `customizationGroups` at the build level and `conditions.requiresCustomizationValueIds` on optional steps. See CLAUDE.md for the tributary model pattern.

---

## Decisions Log

### 2026-01-24: Initial mapping decisions

1. **Pizza station → turbo**: Pizza items cook in turbo ovens, not dedicated pizza ovens in this kitchen setup.

2. **Slotted spoodles → other**: The schema has specific spoodle sizes (1oz, 2oz, 3oz) but not slotted variants. Map to `other` and preserve original in notes.

3. **Missing waterbath times**: For cheese sauce reheats, assume 300s passive unless user specifies otherwise.

4. **Tool case normalization**: CSV has mixed case (Hand/hand, Viper/viper). Normalize to schema enum values.

5. **Squeeze bottle variants**: All squeeze bottles (tri-tip, white, yellow) map to `squeeze_bottle`. Color/type preserved in notes for human readability.
