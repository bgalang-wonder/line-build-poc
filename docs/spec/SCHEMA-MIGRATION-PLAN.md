---
type: specification
status: draft
project: line-build-redesign
created: 2026-01-15
updated: 2026-01-15
tags: [schema, migration, gap-analysis, vocabulary, sublocation]
---

# Schema Migration Plan: v1 → v2

## Purpose

Document the changes needed to align the current schema (`SCHEMA-REFERENCE.md` v1) with the new PRD and system design specs.

Related docs:
- `docs/prd/PRD-FULL-v2.md` — requirements + controlled vocabularies
- `docs/spec/SYSTEM-DESIGN.md` — architecture + how pieces connect
- `docs/spec/SCHEMA-REFERENCE.md` — current canonical types

---

## Summary of changes

| Area | Change | Breaking? |
|------|--------|-----------|
| Stations | Replace enum (8 → 11) | Yes (old values invalid) |
| Sublocations | Add new field to Step | No (additive) |
| Tools | Expand enum (18 → 30+) | No (additive) |
| Techniques | Expand enum (15 → 60+) | No (additive) |
| Equipment | Minor expansion + clarify sublocation relationship | No |
| Validation | Update H-rules for new fields | N/A |

---

## 1. Stations — REPLACE

### Current (v1)

```ts
export type StationId =
  | "hot_side"
  | "cold_side"
  | "prep"
  | "garnish"
  | "expo"
  | "vending"
  | "pass"
  | "other";
```

### New (v2)

Replace with Shin's specific station list:

```ts
export type StationId =
  | "frying_station"
  | "garnish_station"
  | "waterbath_station"
  | "vending_station"
  | "press_station"
  | "turbo_station"
  | "toaster_station"
  | "clamshell_station"
  | "pizza_station"
  | "microwave_station"
  | "speed_line_station"
  | "other";
```

### Migration notes

- This is a **breaking change** — old values will fail validation.
- Existing builds must be migrated:
  - `hot_side` → one of: `frying_station`, `turbo_station`, `waterbath_station`, `clamshell_station`, `microwave_station`
  - `cold_side` → `speed_line_station` or context-dependent
  - `garnish` → `garnish_station`
  - `expo` → keep as concept or map to `vending_station`?
  - `vending` → `vending_station`
  - `prep` → context-dependent (garnish? speed_line?)
  - `pass` → derived concept (transfer step to window), not a station?

**Open question**: Do we need `expo_station` as distinct from `vending_station`?

### Files to update

- `poc/line-build-cli/scripts/lib/schema.ts` — StationId type
- `docs/spec/SCHEMA-REFERENCE.md` — StationId documentation
- `poc/line-build-cli/CLAUDE.md` — valid StationId values
- Existing line build JSON files in `poc/line-build-cli/data/line-builds/`

---

## 2. Sublocations — ADD

### Current (v1)

No sublocation field on Step. Related but separate:
- `stationId` — where the step happens (zone)
- `storageLocation` — where pre-service prep is stored (for `prepType: "pre_service"`)

### New (v2)

Add `sublocation` to Step to capture "where within the station":

```ts
export type SublocationCategory =
  | "work_surface"      // default; where you do work
  | "cold_rail"         // visible cold storage rail
  | "dry_rail"          // visible dry storage rail
  | "cold_storage"      // undercounter / lowboy (station-local)
  | "packaging"         // packaging storage area
  | "kit_storage"       // kit bin (station-local)
  | "window"            // staging / pickup area (pass window / shelf)
  | "equipment";        // work location that is an appliance

export interface Sublocation {
  category: SublocationCategory;
  equipmentId?: ApplianceId;  // required when category = "equipment"
  detail?: string;            // optional clarification
}

// In Step:
export interface Step {
  // ... existing fields ...
  sublocation?: Sublocation;  // NEW: where within the station
}
```

### Migration notes

- This is **additive** — existing builds still valid (field is optional).
- For new builds, sublocation should be captured where it affects work/scoring.
- Movement steps (RETRIEVE/PLACE) should have sublocation to model "from" and "to".

### Validation rules to add

- **H-new-1**: If `sublocation.category === "equipment"`, then `sublocation.equipmentId` is required.
- **H-new-2**: If step has `equipment` field (appliance settings), consider whether sublocation should also be `equipment`.

### Files to update

- `poc/line-build-cli/scripts/lib/schema.ts` — add Sublocation type + field to Step
- `docs/spec/SCHEMA-REFERENCE.md` — document Sublocation
- `poc/line-build-cli/scripts/lib/validate.ts` — add validation rules
- `poc/line-build-cli/viewer/src/components/visualization/StepInspector.tsx` — display sublocation
- `poc/line-build-cli/CLAUDE.md` — valid sublocation values + guidance

---

## 3. Tools — EXPAND

### Current (v1)

```ts
export type ToolId =
  | "hand" | "tongs" | "mini_tong" | "paddle" | "spatula"
  | "spoon" | "spoodle_1oz" | "spoodle_2oz" | "spoodle_3oz"
  | "fry_basket" | "squeeze_bottle" | "shaker" | "viper"
  | "scale" | "bench_scraper" | "utility_knife" | "whisk"
  | "ladle" | "other";
```

### New (v2)

Expand to include Shin's full tool list:

```ts
export type ToolId =
  // Existing
  | "hand"
  | "tongs"
  | "tong_mini"           // renamed from mini_tong for consistency
  | "paddle"
  | "spatula"
  | "spatula_burger"      // NEW
  | "spoon"
  | "spoodle_1oz"
  | "spoodle_1_5oz"       // NEW
  | "spoodle_2oz"
  | "spoodle_3oz"
  | "fry_basket"
  | "squeeze_bottle"
  | "bottle_squeeze_white" // NEW (differentiate by color)
  | "bottle_tri_tip"       // NEW
  | "shaker"
  | "shaker_white"         // NEW
  | "shaker_rose"          // NEW
  | "viper"
  | "scale"
  | "scraper"              // renamed from bench_scraper
  | "bread_knife"          // NEW
  | "utility_knife"
  | "whisk"
  | "ladle"
  | "pizza_wheel"          // NEW
  | "portion_cup"          // NEW (tool vs container TBD)
  | "basket"               // NEW
  | "other";
```

### Migration notes

- **Additive** — no breaking changes.
- Some renames for consistency (`mini_tong` → `tong_mini`, `bench_scraper` → `scraper`).
  - Decision: keep old as aliases, or migrate existing data?

### Files to update

- `poc/line-build-cli/scripts/lib/schema.ts` — ToolId type
- `docs/spec/SCHEMA-REFERENCE.md` — ToolId documentation
- `poc/line-build-cli/CLAUDE.md` — valid ToolId values

---

## 4. Techniques — EXPAND

### Current (v1)

```ts
export type TechniqueId =
  | "portion" | "weigh" | "open_pack" | "seal" | "label"
  | "wash" | "cut_diced" | "cut_sliced" | "cut_julienne"
  | "stir" | "fold" | "whisk" | "scoop" | "wipe" | "other";
```

### New (v2)

Expand to include Shin's full technique list (~60+ techniques):

```ts
export type TechniqueId =
  // Movement
  | "place"
  | "pass"
  // Portioning
  | "portion"
  | "sprinkle"
  | "drizzle"
  | "pour"
  | "squeeze"
  | "shake"
  | "dots"
  | "spiral_pour"
  | "line_pour"
  // Prep
  | "open_pack"
  | "open_pouch"
  | "open_kit"
  | "cut"
  | "divide"
  | "smash_open"
  | "split_bun"
  | "peel"
  | "crush"
  | "massage"
  | "mix"
  | "stir"
  | "make_well"
  // Cooking
  | "fry"
  | "turbo"
  | "waterbath"
  | "toast"
  | "press"
  | "microwave"
  | "clamshell"
  // Assembly
  | "fold"
  | "wrap"
  | "roll"
  | "spread"
  | "shingle"
  | "pat_dry"
  | "toss"
  | "lift_fold"
  // Packaging
  | "lid"
  | "sleeve"
  | "sticker"
  | "cover"
  // Transfer
  | "drain"
  | "scrape"
  | "squeege"
  | "remove_foil"
  | "remove_lid"
  | "remove_from_pan"
  | "flip"
  | "tear_and_place"
  | "pizza_slide"
  | "pizza_cut"
  | "pizza_sprinkle"
  // Holding
  | "hot_held"
  | "fill"
  // Other
  | "spray"
  | "butter_wheel"
  | "pinch"
  | "dollops"
  | "other";
```

### Migration notes

- **Additive** — no breaking changes.
- Techniques map to action families; we may want to document which techniques are valid for which families.

### Equipment-as-technique decision

**Decision**: Keep equipment names as techniques (turbo, waterbath, microwave, fry, toast, press, clamshell_grill).

**Rationale**:
- Training uses this vocabulary — changing it creates friction
- The overlap with equipment.applianceId is redundant but not conflicting
- Training buy-in > schema purity

**Soft validation rule to add**:
> If technique ∈ {turbo, waterbath, microwave, fry, toast, press, clamshell_grill}, check that equipment.applianceId matches (warn if mismatch, don't block).

### Files to update

- `poc/line-build-cli/scripts/lib/schema.ts` — TechniqueId type
- `docs/spec/SCHEMA-REFERENCE.md` — TechniqueId documentation
- `poc/line-build-cli/CLAUDE.md` — valid TechniqueId values + technique→family mapping

---

## 5. Equipment — MINOR EXPANSION

### Current (v1)

```ts
export type ApplianceId =
  | "turbo" | "fryer" | "waterbath" | "toaster" | "salamander"
  | "clamshell_grill" | "press" | "induction" | "conveyor"
  | "hot_box" | "hot_well" | "other";
```

### New (v2)

Add a few from Shin's list:

```ts
export type ApplianceId =
  // Existing
  | "turbo"
  | "fryer"
  | "waterbath"
  | "toaster"
  | "salamander"
  | "clamshell_grill"
  | "press"
  | "induction"
  | "conveyor"
  | "hot_box"
  | "hot_well"
  // New
  | "microwave"        // NEW
  | "sauce_warmer"     // NEW
  | "steam_well"       // NEW
  | "wheel"            // NEW (butter wheel? clarify)
  | "other";
```

### Migration notes

- **Additive** — no breaking changes.
- Note: equipment is ALSO a sublocation type. `sublocation.category = "equipment"` + `sublocation.equipmentId` captures "where"; `step.equipment` captures "appliance settings."

### Files to update

- `poc/line-build-cli/scripts/lib/schema.ts` — ApplianceId type
- `docs/spec/SCHEMA-REFERENCE.md` — ApplianceId documentation

---

## 6. Validation Rules — UPDATES

### Existing rules to review

| Rule | Current | Change needed? |
|------|---------|----------------|
| H1 | `action.family` required | No change |
| H15 | HEAT requires `equipment.applianceId` | No change |
| H16 | PACKAGING requires `container` or packaging target | Updated for PACKAGING |
| H17 | `prepType: "pre_service"` requires `storageLocation` | No change |

### New rules to add

| Rule | Description |
|------|-------------|
| H-new-1 | If `sublocation.category === "equipment"`, then `sublocation.equipmentId` is required |
| H-new-2 | (Soft) If step has `equipment` field, consider logging if `sublocation` is not `equipment` |
| H-new-3 | StationId must be valid enum value (new station list) |
| H-new-4 | TechniqueId should be valid enum value (warn if not, since list is growing) |
| H-new-5 | ToolId should be valid enum value |

### Files to update

- `poc/line-build-cli/scripts/lib/validate.ts` — add new validation functions
- `docs/spec/HARD-RULES.md` — document new rules
- `docs/spec/INVARIANTS.md` — update if rule tiers change

---

## 7. Viewer Updates

### Changes needed

| Component | Change |
|-----------|--------|
| `StepInspector.tsx` | Display sublocation (category + equipmentId if applicable) |
| `StepInspector.tsx` | Format new station IDs nicely |
| Graph view | Consider coloring by station or sublocation |

### Files to update

- `poc/line-build-cli/viewer/src/components/visualization/StepInspector.tsx`

---

## 8. Agent Instructions (CLAUDE.md)

### Sections to update

| Section | Change |
|---------|--------|
| Valid enum values | Update StationId, ToolId, TechniqueId lists |
| Station inference heuristics | Update for new station names |
| Sublocation guidance | Add new section for capturing sublocation |
| Pre-flight checklist | Add sublocation to checklist |

### Files to update

- `poc/line-build-cli/CLAUDE.md`

---

## Migration order (recommended)

### Phase 1: Vocabulary expansion (safe)

1. Expand `TechniqueId` enum
2. Expand `ToolId` enum
3. Expand `ApplianceId` enum
4. Update CLAUDE.md with new valid values
5. Update SCHEMA-REFERENCE.md

**Test**: Existing builds still pass validation.

### Phase 2: Add sublocation (additive)

1. Add `Sublocation` type to schema.ts
2. Add `sublocation` field to Step interface
3. Add H-new-1 validation rule
4. Update viewer to display sublocation
5. Update CLAUDE.md with sublocation guidance

**Test**: Existing builds still pass; new builds can use sublocation.

### Phase 3: Replace stations (breaking)

1. Replace `StationId` enum with new values
2. **Migrate existing line build JSON files** to new station values
3. Update validation
4. Update viewer formatting
5. Update CLAUDE.md station heuristics

**Test**: All builds pass with new station values.

### Phase 4: Validation hardening

1. Add technique→family validation (soft warnings)
2. Add station→equipment affinity validation (soft warnings)
3. Document in HARD-RULES.md

---

## Open questions (before starting)

1. **Expo vs Vending**: Do we need `expo_station` separate from `vending_station`?
2. **Pass station**: Is `pass` a station or just a step concept (TRANSFER to window)?
3. **Tool aliases**: Keep `mini_tong` as alias for `tong_mini`, or migrate data?
4. **Technique validation**: Enforce technique→family mapping, or just warn?
5. **Sublocation required**: For which step types should sublocation be required vs optional?

---

## Estimated effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1 (vocab expansion) | 2-3 hours | Low |
| Phase 2 (sublocation) | 3-4 hours | Low |
| Phase 3 (stations) | 4-6 hours | Medium (migration) |
| Phase 4 (validation) | 2-3 hours | Low |

**Total**: ~12-16 hours of focused work.

---

## Next steps

1. Review this plan and answer open questions
2. Create branch for migration work
3. Execute phases in order
4. Test thoroughly between phases
