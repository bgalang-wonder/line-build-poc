# Canonical Source of Truth

**Purpose:** A running tally of what's locked in vs. what's in flux, with audit trail.

**Updated:** 2026-01-30  
**Next Review:** As needed (document changes in Decision Log below)

---

## Legend

- ✅ **LOCKED IN** — Do not change without stakeholder discussion
- 🔶 **IN FLUX** — Being actively worked out
- ❓ **OPEN QUESTION** — Needs stakeholder input
- 📝 **DECISION LOG** — Audit trail of changes (at end of doc)

---

## Core Abstractions ✅

### Material Flow
| Concept | Canonical Term | Notes |
|---------|---------------|-------|
| Thing flowing through steps | **Assembly** | Was "Component" (DEC-006, Jan 10) |
| Step inputs | **input[]** (AssemblyRef) | With `from` location |
| Step outputs | **output[]** (AssemblyRef) | With `to` location |
| Cross-build references | **requiresBuilds** | Published build dependencies |
| Primary output | **primaryOutputAssemblyId** | Single default output per build |

### Locations
| Concept | Canonical Term | Notes |
|---------|---------------|-------|
| Kitchen area | **Station** | 11 stations (see below) |
| Spot within station | **workLocation** | Object with stationId + sublocation |
| Where items come from | **from** | On AssemblyRef |
| Where items go | **to** | On AssemblyRef |

### Time
| Concept | Canonical Term | Notes |
|---------|---------------|-------|
| Step duration | **time.durationSeconds** | Required for HEAT (H22) |
| Active vs passive | **time.isActive** | Boolean flag |
| Repetition count | **quantity.value** | Multiplier for technique complexity |

---

## Stations ✅ (11 Total)

### Hot Side Stations
| Station ID | Side | Equipment Notes |
|------------|------|-----------------|
| `fryer` | hot_side | Standalone |
| `waterbath` | hot_side | Standalone |
| `turbo` | hot_side | Standalone |
| `clamshell_grill` | hot_side | Hybrid pod; has toaster |
| `pizza` | hot_side | Standalone |
| `microwave` | hot_side | Standalone |

### Cold Side Stations
| Station ID | Side | Equipment Notes |
|------------|------|-----------------|
| `garnish` | cold_side | Has press, toaster, turbo equipment |
| `speed_line` | cold_side | Hybrid pod; speed line equipment |

### Other
| Station ID | Side | Notes |
|------------|------|-------|
| `vending` | vending | Pickup/drop-off |
| `expo` | cold_side | Final assembly/packaging |

### ❓ OPEN QUESTION: Press Station Status
**Question:** Is `press` a standalone station or equipment at `garnish`?

**Current State:** 
- PRD 10.2 lists "Press" as a station
- Transcript (Jan 26): Shin says "We've removed press station and toast[er]"
- But also: "clamshell has a toaster and the garnish has a toaster" (shared equipment)

**Interpretation:** Press and Toaster are **equipment**, not standalone stations. They live at Garnish (press) and potentially multiple stations (toaster).

**Status:** Need to confirm with Shin
**Action:** Follow up on whether Press/Toaster should appear as station IDs at all

---

## Equipment ✅

### Principles
- Equipment is **at** stations, not standalone
- Some equipment is **shared** across stations (toaster, hot_box)
- Equipment drives validation (H35-H37)

### Equipment List (Canonical)
| Equipment | Typical Station(s) | Validation Rules |
|-----------|-------------------|------------------|
| `fryer` | fryer | H35: Equipment/station compat |
| `waterbath` | waterbath | H35 |
| `turbo` | turbo, garnish | H35 |
| `clamshell` | clamshell_grill | H35 |
| `press` | garnish | H35 |
| `toaster` | garnish, clamshell_grill | H35 |
| `pizza_oven` | pizza | H35 |
| `microwave` | microwave | H35 |
| `hot_box` | any hot_side | H35 |
| `hot_well` | any hot_side | H35 |
| `cold_rail` | garnish, speed_line | Retrieve-only |
| `dry_rail` | garnish, speed_line | Retrieve-only |
| `packaging` | garnish, speed_line, expo | Target for PACKAGING steps |

---

## Action Families ✅ (8 Total)

| Family | Requires | Notes |
|--------|----------|-------|
| `PREP` | techniqueId OR notes (H25) | Manual preparation |
| `HEAT` | equipment (H15) + time OR notes (H22) | Cooking with appliance |
| `TRANSFER` | techniqueId ("transfer" or "pass") | Derived, never authored (H38) |
| `ASSEMBLE` | input[] with multiple assemblies | Joining paths |
| `PORTION` | quantity OR notes (H24) | Dividing/serving |
| `PACKAGE` | container OR packaging target (H16) | Final packaging |
| `HOLD` | (no special requirements) | Waiting/plating |
| `QUALITY_CHECK` | (no special requirements) | Verification |

**Removed:** `GARNISH` (folded into PREP)

---

## Sublocations ✅

### Principles
- Sublocations are **reference points**, not storage
- Some are **source-only** (one-way streets)
- `work_surface` is the default for most operations

### Canonical Sublocations by Station

| Sublocation | Type | Usage |
|-------------|------|-------|
| `work_surface` | work | Default for PREP, ASSEMBLE |
| `equipment` | work | For HEAT steps (at equipment location) |
| `cold_rail` | source | Retrieve only — one-way street |
| `dry_rail` | source | Retrieve only — one-way street |
| `cold_storage` | source | Retrieve only — one-way street |
| `freezer` | source | Retrieve only — one-way street |
| `packaging` | target | For PACKAGE steps |
| `kit_storage` | source | Retrieve only — one-way street |

### Rules
- HEAT steps: sublocation = `equipment` (at appliance location)
- PREP steps: default = `work_surface`
- RETRIEVE: from storage sublocation → work_surface
- PLACE: from work_surface → packaging/equipment

---

## Complexity Scoring Methodology ✅

### Principles
- **Absolute scores** (not normalized to 100)
- Can exceed 100; normalize only if needed for reporting
- Default layout: **D3** (14th St NW)
- Most complex reference: **D5** (Westfield)

### Formula (High Level)
```
Complexity = Σ (technique_weight × quantity_multiplier × category_multiplier) 
           + structural_signals 
           + transfer_complexity
```

### Components

| Component | Source | Notes |
|-----------|--------|-------|
| **Technique weights** | Database per technique | Shin's spreadsheet |
| **Quantity multiplier** | step.quantity.value | Default = 1; multiplies technique |
| **Category multiplier** | Hot/cold/speed/vending | Per-pod weighting |
| **Structural signals** | Back-to-back equipment, station bounces | Derived from step sequence |
| **Transfer complexity** | 4 tiers (see below) | Weighted by transfer type |

### Transfer Complexity Tiers
| Tier | Type | Complexity | Example |
|------|------|------------|---------|
| 1 | Same station, sublocation→sublocation | Low | work_surface → equipment |
| 2 | Station→station, same pod | Medium | fryer → waterbath |
| 3 | Pod→pod (hot→hot, cold→cold) | High | hot_side → cold_side |
| 4 | Hot→cold or hot→vending | Highest | waterbath → garnish |

**Note:** Intra-cold transfers (garnish→garnish) exist in data but weight = 0 for complexity.

---

## HDR (High-Density Restaurant) Configurations 🔶

### Known Layouts
| ID | Description | Status |
|----|-------------|--------|
| D1 | (unknown) | 🔶 Need data |
| D2 | (unknown) | 🔶 Need data |
| **D3** | 14th St NW — "bread and butter" | ✅ Default reference |
| D4 | (unknown) | 🔶 Need data |
| **D5** | Westfield — most complex | ✅ Complexity reference |

### Open Items
- Exact station lists per HDR layout
- Super pod A/B configurations
- Equipment assignments per station per layout
- Garnish → cold pod mapping rules

---

## Validation Rules ✅ (46 Hard Rules + Composition + Soft)

### Implemented & Documented (35 rules)
H1-H10, H15-H22, H24-H26, H32-H33, H35-H42, C1-C3

### Implemented but NOT Documented ❓
| Rule | What it checks | Need to document? |
|------|----------------|-------------------|
| H43 | No orphan assemblies | ✅ Yes |
| H44 | Single primary output | ✅ Yes |
| H46 | Valid technique vocabulary | ✅ Yes |

### Documented but NOT Implemented ❓
| Rule | What it checks | Need to implement? |
|------|----------------|--------------------|
| H11 | Overlay priority is numeric | 🔶 Defer? |
| H12 | Customization group IDs unique | 🔶 Defer? |
| H13 | Override reasons required | 🔶 Defer? |
| H14 | Overlay predicates not empty | 🔶 Defer? |

### Deprecated ✅
- H27, H28, H39 — removed from schema (from/to on steps)

---

## Technique Database ✅

**Status:** LOCKED IN — 561 lines in `config/techniques.config.ts`

**Structure:**
```typescript
interface TechniqueConfig {
  id: string;                    // Canonical ID
  label: string;                 // Display name
  actionFamily: ActionFamily;    // Which family it belongs to
  typicalTools?: string[];       // Tools typically used
  aliases?: string[];            // Alternative names
  description?: string;          // Help text
}
```

**Categories:**
- PREP techniques (cut, drain, open_kit, open_pack, etc.)
- HEAT techniques (fry, grill, press, bake, etc.)
- TRANSFER techniques (pass, retrieve, place, move)
- ASSEMBLE techniques (combine, layer, stack)
- PORTION techniques (scoop, ladle, weigh)
- PACKAGE techniques (wrap, box, bag)
- HOLD techniques (rest, stage)
- QUALITY_CHECK techniques (temp, visual_check)

**Key Properties:**
- **Controlled vocabulary** — H33 validates techniqueId is in this list
- **Action family binding** — Each technique belongs to exactly one family
- **Tool associations** — Typical tools for validation warnings
- **Aliases** — Normalization support (e.g., "deep_fry" → "fry")

**Complexity Weights:**
- Technique weights drive complexity scoring
- Weights stored in complexity config, not technique config
- Shin's spreadsheet has the weights; mapped in `config/complexity.config.ts`

**Governance:**
- New techniques require schema update + complexity weight assignment
- Aliases can be added without schema changes

---

## Customization / Branch Modeling 🔶

**Status:** Not yet built

**Transcript Quote (Jan 29):**
> "We haven't built the customization function into this yet"

**Requirements:**
- Branching paths based on options (doneness, protein choice)
- Parallel cooking tracks
- Conditional step inclusion

---

## Decision Log 📝

| Date | Decision | Rationale | Reference |
|------|----------|-----------|-----------|
| 2026-01-10 | Assembly replaces Component | Better semantic fit | DEC-006, LOG.md |
| 2026-01-10 | Remove from/to from Step | Moved to AssemblyRef | LOG.md |
| 2026-01-10 | Add `requiresBuilds` | Prepared components support | DEC-006, LOG.md |
| 2026-01-23 | TRANSFER steps are derived-only | Never authored directly | H38, transcript Jan 23 |
| 2026-01-26 | Press/Toaster removed as stations | Equipment at Garnish | Transcript Jan 26 (⚠️ need confirm) |
| 2026-01-28 | D3 = default, D5 = most complex | HDR layout defaults | Transcript Jan 26 |
| 2026-01-28 | Quantity = technique multiplier | Not BOM quantity | Transcript Jan 26 |
| 2026-01-30 | Local docs > Confluence | Rapid iteration needs | DEC-007, LOG.md |

---

## Open Questions Summary ❓

| Question | Stakeholder | Urgency | Notes |
|----------|-------------|---------|-------|
| Confirm Press/Toaster station removal | Shin | High | Transcript says removed, PRD still lists them |
| HDR D1-D2-D4 exact layouts | Shin/Portal | Medium | Need station/equipment lists |
| HDR D1-D5 exact layouts | Shin/Portal | Medium | Need station/equipment lists |
| Customization/branch modeling | Jenna/Shin | Medium | Future feature, need spec |
| H11-H14 implementation priority | Engineering | Low | Overlay validation — defer? |
| Cook vs prep vs focus time | Jen | Low | Time study data integration |

---

## References

### Key Transcripts
- `2026-01-26-Complexity-score-line-build-refinement-Shon.md` — Station model, technique weights
- `2026-01-23-HDR-line-build-complexity-mapping.md` — HDR layouts, transfer complexity
- `2026-01-28-Complexity-scoring-prototype-review-Jen.md` — Complexity methodology, D3/D5
- `2026-01-28-Material-flow-sublocation-modeling.md` — Sublocation semantics, transfer rules
- `2026-01-29-Line-builds-complexity-scoring.md` — Customization, IK integration

### Documents
- `PRD-FULL-v2.md` — Vision and requirements
- `SCHEMA-REFERENCE.md` — Data model
- `HARD-RULES.md` — Validation rules (H1-H42)
- `SOURCES.md` — Requirements traceability
- `LOG.md` — Decision history

---

## Change Process

To modify this document:
1. Add entry to Decision Log with date and rationale
2. Update relevant section (mark as 🔶 if in flux)
3. Reference transcript or stakeholder input
4. For LOCKED IN items (✅), get stakeholder approval first
