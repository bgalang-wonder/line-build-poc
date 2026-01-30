---
type: specification
status: draft
project: line-build-redesign
created: 2026-01-14
updated: 2026-01-14
tags: [schema, invariants, validation, vocabulary, complexity-scoring]
---

## Purpose

Capture **all confirmed updates, proposed updates, and open clarification questions** surfaced from the Jan 14 stakeholder session (Shin) so we can safely rework schema + tooling to match the “new state” **before committing code changes**.

This doc is intentionally explicit about:
- **What we decided**
- **What we think we should change**
- **What we must confirm with Shin** to avoid building the wrong schema

---

## Executive summary (what’s changing)

- **Station vs Equipment are separate concepts**:
  - **Station**: where the worker is standing / the pod/work area.
  - **Equipment**: the appliance used in the step (may be co-located with a station).
- We will treat “from/to” as **authoring language**, but store movement in a **MECE internal model** that can answer “who moved it?” without ambiguity.
- **Movement becomes explicit** via **RETRIEVE** and **PLACE** steps (and optionally HANDOFF later).
  - This ensures station/location changes are never “teleportation.”
- **Techniques are not re-litigated here**: if it’s in Shin’s technique list / official training spec, we keep it as technique vocabulary (e.g. `hot_held` remains a technique).
- **Containers** likely should be derivable from item master data long-term, but we keep a `container` concept for now as a practical field.
- We have replaced action-family `VEND` with `PACKAGING`. `VEND` is now treated as a **station**, not an action family.

---

## Confirmed decisions (locked)

### Station naming

We will keep **one station per station in Shin’s sheet**, but rename to be semantically distinct from equipment (avoid “Fryer” being both station and equipment).

Source sheet stations:
- Fryer
- Garnish
- Waterbath
- Vending
- Press
- Turbo
- Toaster
- Clamshell Grill
- Pizza
- Microwave
- Speed Line

Normalized station names (proposed):
- Fryer -> **Frying Station**
- Garnish -> **Garnish Station**
- Waterbath -> **Waterbath Station**
- Vending -> **Vending Station**
- Press -> **Press Station**
- Turbo -> **Turbo Station**
- Toaster -> **Toaster Station**
- Clamshell Grill -> **Clamshell Station**
- Pizza -> **Pizza Station**
- Microwave -> **Microwave Station**
- Speed Line -> **Speed Line Station**

### Station and equipment are separate fields

- **Station** is always present on every step.
- **Equipment** is a separate (optional) field on steps.
- We may add validation later like “Station X allows Equipment Y,” but we must confirm the mapping first.

### Technique vocabulary

- **If Shin has it in technique / official specification, we keep it as technique** (no reclassification right now).
- Example: `hot_held` is a technique (if it appears in the official technique list).

### Locations: global vs station-local

We split locations into:
- **Global**: shared in the restaurant; retrieval usually implies walking.
- **Station-local**: exists per station/pod; retrieval usually implies reaching.

This supports scoring (“walk” vs “reach”) without forcing premature assumptions about restaurant layout.

---

## Proposed internal model (MECE)

### Why: Chef UX vs correct modeling

Chefs find it easiest to describe work as:
- “What are you doing?”
- “Where are you taking it from?”
- “Where are you putting it?”

We can keep that as the interview UX while storing a more MECE model that:
- avoids ambiguous duplication (same fact stored in two places)
- can answer “who moved it?” explicitly
- supports scoring + validation deterministically

### Proposal: model movement as explicit steps

Instead of putting `from/to` on every step, movement is represented by explicit step types:

- **RETRIEVE**: bring something from inventory/staging into active work.
- **PLACE**: position/stage/move something to a new location.
- **HANDOFF**: optional later; can often be modeled as PLACE to staging + RETRIEVE from staging.

This means:
- If something moved, there is a step representing that move.
- “Who moved it?” is the actor implied by the step (we don’t model people yet; the step itself is the responsibility unit).

### Practical consequence

- **Movement steps** have required endpoints:
  - `from` location
  - `to` location
- **Transform steps** (HEAT/PREP/PORTION/ASSEMBLE/COMBINE/CHECK/…) may omit endpoints; their “effective from/to” can be derived from prior movement steps.

---

## Vocabulary proposal (draft lists)

### Stations (canonical list for vNext)

We will support these stations (string names TBD; shown here as normalized labels):
- Frying Station (podType: Hot)
- Turbo Station (Hot)
- Waterbath Station (Hot)
- Clamshell Station (Hot)
- Pizza Station (Hot)
- Microwave Station (Hot)
- Garnish Station (Cold)
- Speed Line Station (Cold)
- Press Station (Cold)
- Toaster Station (Cold)
- Vending Station (Vending)

### Equipment (draft list)

Equipment is separate from Station. Draft equipment list (subject to validation):
- Fryer
- Turbo
- Waterbath
- Clamshell Grill
- Press
- Toaster
- Microwave
- Salamander
- Conveyor
- Induction
- Hot Box
- Hot Well / Steam Well
- Sauce Warmer

### Locations (draft list, with scope)

#### Global locations (shared)
- cold_storage (walk-in / shared fridge)
- freezer
- dry_storage
- kit_storage (or stored within cold_storage)
- packaging_storage
- pass_window (staging/handoff zone)

#### Station-local locations (scoped to a Station)
- cold_rail
- dry_rail
- work_surface

Note: We may introduce additional station-local “storage” concepts later (e.g., undercounter fridge) once validated.

### Tools (draft list)

Tools are hand implements. Draft list (subject to validation):
- hand
- tongs
- mini_tong
- fry_basket
- spatula
- burger_spatula
- paddle
- spoon
- ladle
- whisk
- utility_knife
- bread_knife
- bench_scraper
- scraper
- scale
- viper
- spoodle_1oz
- spoodle_2oz
- spoodle_3oz
- squeeze_bottle
- shaker
- pizza_wheel
- portion_cup (classification TBD: tool vs container)

### Techniques (keep as-is)

We will **not** reclassify techniques in this cycle. If it’s in the official technique list, it remains a technique (including `hot_held`).

### Containers (keep as-is for now)

We expect containers should eventually be derivable from item master data, but we keep a `container` concept for now:
- bowl, tray, clamshell, bag, foil, cup, ramekin, deli_cup, hotel_pan, lexan, lid, …

---

## Action families (proposed changes; not locked)

### Current problem statement

Shin called out confusion where:
- “Vending” is a **station**, not a semantic action family.
- Packaging actions (lid/sleeve/sticker/seal) should be represented consistently and scoreably.

### Proposed direction (pending validation)

- Decision: replace action family `VEND` with `PACKAGING` and treat `vending` as a station.
- Keep station `Vending Station`.
- Model “pass to expo / handoff” as `TRANSFER` + technique `pass`.

**Important:** we will not change action families until Shin confirms the intended taxonomy.

---

## Open questions to validate with Shin (before committing)

### 1) Station ↔ equipment mapping

For each station, confirm:
- Does it have dedicated equipment?
- Is the equipment required/allowed on that station?
- Does the station have only a work surface?

Examples to confirm:
- Is “Garnish Station” strictly no cooking equipment?
- Do “Press Station” and “Toaster Station” exist as separate pods, or are those appliances co-located with another station in practice?

### 2) Location scope (global vs station-local)

Confirm which are truly global vs per-station:
- Is `cold_storage` always global, or does each station have local cold holding (undercounter)?
- Do all stations have `cold_rail` and `dry_rail`?
- Is `packaging_storage` global or station-local (or both)?
- Where does `pass_window` live? Is it conceptually part of Vending/Expo or neutral?
- Are Hot Box / Steam Well / Sauce Warmer “equipment” or “locations” (storage/holding)?

### 3) Tool classification and granularity

Clarify:
- Is `portion_cup` a **tool** or **container**?
- Should spoodles and shakers be represented as a single tool + attributes (size/color), or as distinct tool IDs?
- Are squeeze bottles differentiated by color/contents or treated generically?

### 4) Movement step policy

Confirm the movement modeling rules:
- Are we aligned that movement is explicit via **RETRIEVE** and **PLACE** steps (no implicit station teleportation)?
- Do we need an explicit **HANDOFF** step type, or is staging-based handoff sufficient (PLACE to pass_window + RETRIEVE from pass_window)?
- For cooking equipment steps: do we model “load into fryer” and “unload from fryer” as explicit PLACE steps, or treat as part of HEAT?

### 5) Action family taxonomy (PACKAGING finalized)

Confirm:
- Resolved: remove action family `VEND` and replace with `PACKAGING`.
- What family covers “pass to expo” and “handoff” steps?
- Are RETRIEVE and PLACE separate action families, or techniques under TRANSFER? (Either can work; choose based on how we want to query/score.)

### 6) Scoring drivers (not weights yet)

Confirm what dimensions should drive complexity (weights can come later):
- station changes
- retrieval from global storage vs station-local rail
- technique difficulty (especially Place vs Portion vs Count)
- tool precision requirements
- equipment usage
- packaging steps

---

## Next implementation targets (after validation)

Once questions above are answered, the next concrete changes likely include:
- Update documentation references:
  - `docs/spec/SCHEMA-REFERENCE.md`
  - `docs/spec/HARD-RULES.md`
  - `docs/spec/INVARIANTS.md`
- Update PoC types + runtime schema:
  - `poc/line-build-cli/scripts/lib/schema.ts`
- Update validation to enforce movement step requirements and station/equipment constraints:
  - `poc/line-build-cli/scripts/lib/validate.ts`
- Update viewer to surface station, technique, movement endpoints:
  - `poc/line-build-cli/viewer/src/components/visualization/StepInspector.tsx`

