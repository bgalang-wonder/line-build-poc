---
type: specification
status: draft
project: line-build-redesign
created: 2026-01-15
updated: 2026-01-15
tags: [system-design, schema, interfaces, overlays, customizations, hdr-layout]
---

## Purpose

Firm up **how all the pieces connect** so we can safely layer on additions (customizations, HDR/layout overlays, derived execution views) without changing the foundation.

This doc is the detailed system design companion to:
- `docs/prd/PRD-FULL-v2.md` (product framing + goals + requirements)
- `docs/spec/SCHEMA-REFERENCE.md` (current canonical v1 schema reference)
- `docs/spec/SCHEMA-REDESIGN-PROPOSAL.md` (Shin-driven vocabulary + modeling decisions)

---

## Architecture (conceptual map)

Canonical truth is a stable DAG. Everything else is derived from it using explicit context + explicit configs.

```
Inputs (legacy JSON / Excel / transcripts / notes)
        │
        ▼
Authoring agent (ingest → propose → validate → interview → apply → audit)
        │
        ▼
Canonical truth (BenchTopLineBuild; superset DAG; stable vocab refs)
        │
        ├───────────────┬───────────────────────────┐
        │               │                           │
        ▼               ▼                           ▼
Validation report   Derived views              Effective build resolver
 (deterministic)     (deterministic)            (truth + order context)
        │               │                           │
        └───────────────┴───────────────┬───────────┘
                                        ▼
                                 Consumer outputs
                          (viewer / debug / future KDS)
```

Key idea:
- **Truth layer is not “what KDS shows.”** It’s the recipe truth.
- **Routing/scoring/display** are derived, and depend on context (equipment profile, HDR layout, order customizations).

---

## Data layers (what is stored vs computed)

### Canonical truth (stored)

**Definition**: a **superset DAG** of steps for a menu item.

Stored in `BenchTopLineBuild` (see `docs/spec/SCHEMA-REFERENCE.md`):
- `steps[]` (work graph; `dependsOn` encodes precedence)
- optional `artifacts[]` (material/flow graph; consumptions/productions)
- `customizationGroups[]` (IDs that drive step conditions/overlays)

In the truth layer:
- **Stations + sublocations** capture “where work happens.”
- **Equipment** is modeled as a sublocation type (`equipmentId`) + optional step equipment settings.
- **BOM IDs** are referenced for “what flows.”

The truth layer should remain stable even if:
- HDR layout changes (stations grouped into pods/screens differently)
- KDS routing rules change
- we refine estimation defaults

### Derived views (computed; deterministic)

Derived views are *functions* over inputs:

```
DerivedView = f(CanonicalTruth, Context, Config)
```

Examples:
- Station-grouped view (collapse consecutive steps by station or station+sublocation)
- Debug DAG view (work graph) and flow view (artifact graph)
- “KDS-like” projection (future): grouping + routing decisions based on HDR layout overlay
- Complexity/scoring breakdown inputs (future): computed metrics, not necessarily final weights

Design contract:
- Derived views must be **reproducible** given the same inputs.
- Derived views should be **versioned** if the rules change (so we can explain diffs).

### Config / overlays (inputs; not derived from truth)

Configs/overlays are **parallel inputs** that change how we interpret/derive outputs.

They do **not** mutate the canonical build. They are applied “between truth and derived views.”

We differentiate two categories:

- **Q1 configs (estimation defaults)**:
  - Simple knobs that stand in for missing canonical site data.
  - Example: “every station has these sublocations,” “press↔garnish transfer friction is ~0.”

- **HDR layout overlays (future; from portal)**:
  - Site-specific layout/routing facts (pod grouping, distances, actual equipment placement).
  - These should replace estimation defaults when available.

---

## Core execution contexts (what varies at runtime)

We compute outputs using explicit context inputs.

### Order context (known at order time)

- **Customization selections**: which customization value IDs apply to this order
- **Equipment profile selection**: which equipment profile the order is routed to (turbo vs fryer path, etc.)

We assume equipment profile is known at order time (HDR config + availability today; customer choice may be a future input).

### HDR context (site/layout context)

- HDR/layout profile ID (e.g., which station groupings are in the same pod/screen)
- Optional distance/transfer model

---

## Customizations and equipment variants (how we model “superset build + filter”)

### Model intent

Current behavior: we store the superset of possible steps and KDS “pulls in” only the steps relevant for the order.

We keep that model, but make it explicit and validate it:

- The canonical build contains all steps for all variants.
- Each variant path must resolve to a valid DAG.
- At runtime, we resolve an **effective build** by filtering steps using order context.

### Mechanisms available in canonical v1 schema

From `docs/spec/SCHEMA-REFERENCE.md`:

- `step.conditions` (existence gating; AND semantics)
  - `requiresEquipmentProfileIds`
  - `requiresCustomizationValueIds`
- `step.overlays[]` (mutation; field overrides under a predicate)
  - override fields include `time`, `equipment`, `quantity`, `notes`, etc.
- `customizationGroups[]` (declares the allowable customization value IDs)

### Recommended modeling approach

Use two different primitives:

- **StepCondition**: “does this step exist for this order?”
  - Use for: skip-step, add-extra-as-additional-step, equipment-path branching.

- **StepOverlay**: “the step exists, but values change under a scenario”
  - Use for: doneness time change (cook longer), quantity multipliers, tool changes.

### Effective build resolver (core function)

Inputs:
- Canonical build `B`
- Context `C`:
  - `equipmentProfileId`
  - `customizationValueIds[]`
- Optional config `K` (for defaults; not needed for existence)

Algorithm (conceptual):
1. **Filter steps by conditions**:
   - Keep step if:
     - `requiresEquipmentProfileIds` is empty/absent OR contains `equipmentProfileId`, AND
     - `requiresCustomizationValueIds` is empty/absent OR all are in `customizationValueIds`
2. **Apply overlays** (priority order) to the remaining steps
3. **Validate the resulting work graph** (acyclic; dependencies satisfied)
4. Output: `EffectiveBuild(B, C)`

### Validation requirement (variants)

We validate:
- “default” path (baseline equipment profile + no customizations)
- each equipment profile path (turbo path valid, fryer path valid)
- customization variants that are modeled as step conditions/overlays

Practical approach:
- validate per-equipment-profile by resolving an effective build for that profile with default customization values
- validate customization groups by sampling:
  - baseline (no values)
  - each single value
  - minimal multi-value combos where groups allow multiple (AND semantics)

Note: exhaustive validation of all combinations may be too expensive; define a policy that is strong enough for Q1.

---

## BOM IDs and component flow (how they connect)

### Canonical rule

- BOM IDs are global for the menu item (superset of all components that could be used).
- Customizations determine which subset is used on a per-order basis.

### Where BOM lives

BOM is treated as an external registry:
- Canonical build references BOM IDs
- Derived views can resolve BOM details (names, categories) at runtime

### How steps reference BOM

We support (and prefer) direct BOM identity:
- `target` references BOM ID(s)
- optional `consumes/produces` via `ArtifactRef[]` can represent parallel flow and joins

Open design choice (not required for Q1):
- whether to represent transformed/intermediate states as build-local artifacts linked back to BOM IDs.

---

## Stations, sublocations, equipment (where configs plug in first)

### Canonical truth

Truth records “where” at the level we can author consistently:
- `stationId` (physical zone)
- `sublocation` (where within station: rail/storage/surface/window/equipment)
- `equipmentId` when the sublocation is equipment

### Q1: configs for capabilities + availability

We use configs first to avoid blocking authoring:

- station capability defaults:
  - “every station has work_surface, cold_rail, dry_rail, packaging, cold_storage”
- station tool availability defaults:
  - “these tools are available everywhere; these are station-specific”
- station↔equipment affinity defaults:
  - “Frying Station usually uses fryer equipment” (warn if not)

These configs:
- drive validation warnings (not publish-blocking initially)
- drive derived views and later scoring inputs

### Future: HDR overlay replaces configs

HDR portal data can provide:
- actual pod/screen grouping
- actual equipment placement and counts
- site-specific transfer/queueing model

This replaces estimation defaults without changing canonical truth.

---

## Tools and technique registry (governance + usage)

### Tools

Tools are not canonical “truth” in the same sense as station/equipment; today they behave like an enum used for consistency.

We treat tools as:
- a controlled vocabulary (enum)
- optionally enhanced later by a “registry” that contains metadata (display name, aliasing, deprecations)

Station tool availability is a config/overlay concern:
- Q1 config: defaults + station-specific exceptions
- future HDR overlay: actual placement (if needed)

### Techniques

Techniques are stable and training-governed:
- we plug into what exists for buy-in and consistency
- new techniques can be added as edge cases are discovered (governed process)

Technique metadata (optional):
- mapping of technique → allowable action families
- optional tool/equipment requirements

---

## HDR layout overlays (what they change vs what they don't)

HDR layout overlays:
- change **transfer interpretation** and **routing/display** derivations
- do **not** change which steps exist (that's order context + step conditions)

Examples:
- turbo + microwave in same pod → transfer friction ~0
- turbo and microwave separate pods → transfer friction higher, queueing more complex

Canonical truth remains "station to station (and sublocation)" regardless.

---

## Legacy compatibility (what we need to bridge)

### Legacy step types vs new action families

| Legacy (`procedures_activity`) | Count | New mapping |
|--------------------------------|-------|-------------|
| GARNISH | 328k | → Multiple: ASSEMBLE, PORTION, PREP (station-centric, not action-centric) |
| COOK | 150k | → HEAT |
| COMPLETE | 70k | → Derived from DAG (terminal nodes) |
| VEND | 25k | → Station + TRANSFER |

**Key insight**: Legacy step types are **station/workflow markers** (GARNISH = work at garnish station), not **action semantics**. Our new model separates these concerns:
- **stationId**: where work happens
- **action.family**: what kind of work
- **action.techniqueId**: how the work is done

### Legacy cooking phases

| Legacy (`procedures_cooking_phase`) | New mapping |
|-------------------------------------|-------------|
| COOKING | cook (phase) |
| POST_COOKING | post_cook (phase) |
| PRE_COOKING | pre_cook (phase) |
| PRE_ROUTE_PREP | → prepType: "pre_service" |
| PRE_ORDER_PREP | → prepType: "pre_service" |

### Legacy appliances → new equipment

Most map directly. Exceptions:
- **Brand names** (PITCO, CARTER_HOFFMAN, ALTO_SHAAM) → normalize to generic (fryer, hot_box)
- **Missing** in current schema: RICE_COOKER, PASTA_COOKER, PIZZA_OVEN → add to equipment registry

### Translation strategy (TBD)

Options:
- **A) Translate on import**: normalize legacy → new during ingestion
- **B) Dual-write**: keep both, derive new from legacy where possible
- **C) Fresh authoring**: don't import legacy, author new from scratch

Recommend starting with (C) for POC validation, then evaluate (A) or (B) for scale.

---

## Action families (finalized)

Action families describe **what physically happens**. We have 8 finalized families:

| Family | Physical action | Techniques (examples) |
|--------|-----------------|----------------------|
| PREP | Manipulate/prepare | open_pack, cut, unwrap, split_bun, peel |
| HEAT | Apply temperature | fry, turbo, waterbath, microwave, toast |
| TRANSFER | Move between locations | place, retrieve, pass, handoff |
| COMBINE | Mix together | stir, toss, mix |
| ASSEMBLE | Layer/place components | place, garnish, spread, fold |
| PORTION | Measure/dispense | sprinkle, portion, pour, drizzle, count |
| CHECK | Verify/QA | check_temp, verify_doneness |
| PACKAGING | Containerize/seal | lid, sleeve, wrap, cover |

**Key decisions**:
- **VEND** → Station (`stationId: "vending"`), not an action family. Use TRANSFER to move to vend station.
- **COMPLETE** → Derived from DAG (terminal nodes), not an action family.
- **GARNISH** → Technique under ASSEMBLE/PORTION, not its own family. Captures the "finishing touches" semantic via technique, not family.

**Staging workflow (place/retrieve)**:
- Typical HDR behavior: Person A places in window/shelf, Person B retrieves when ready
- Modeled as two TRANSFER steps with techniques `place` and `retrieve`
- Captures "who moved it" unambiguously

---

## Open questions (to keep explicit)

- Window/shelf vs pass_window:
  - are these the same staging concept or distinct?
- "Global walk-in cold storage" vs station-local lowboy:
  - if needed, represent as `walk_in_cold_storage` distinct from station `cold_storage`.
- Validation policy for combination explosion:
  - what sampling strategy is sufficient for Q1 confidence?
- Legacy step type mapping:
  - Legacy uses GARNISH, COOK, COMPLETE, VEND (KDS workflow markers)
  - We use semantic action families (PREP, HEAT, TRANSFER, etc.)
  - Need to define translation layer or dual-write strategy

