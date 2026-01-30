# Equipment Profile Variants (MVP Spec)

**Project:** Line Build CLI PoC
**Scope:** MVP for equipment swaps + per-HDR complexity scoring (static per run)
**Status:** Proposed
**Last updated:** 2026-01-29

## 0) Plain-English Summary

We need to support cases like:

- "This HDR has no turbo, so this item cooks in the fryer instead."
- When the method changes, step details change too (technique, time, station, tools, routing).

For MVP:

- We author **one build** that contains **multiple method variants**.
- We pick **exactly one equipment profile** when we want to score/view/run the build.
- We "materialize" a **single concrete plan** from the master build for that profile.

This spec defines:

- How to author variants safely in the schema you already have
- A join pattern that keeps downstream steps stable
- The materialization algorithm and expected outputs
- How to compute transfers + complexity for a chosen profile

## 1) Goals / Non-Goals

### Goals (MVP)

1. Represent "method swaps" (turbo -> fryer, waterbath -> microwave, etc.) in a way that is:
   - clear to author
   - validate-able
   - compatible with derived transfers + complexity scoring
2. Support **static** per-run selection:
   - pick exactly one equipment profile (per HDR) and produce a concrete DAG
3. Preserve an upgrade path to "live routing" later without throwing away authored work.

### Non-Goals (MVP)

- Live routing / dynamic selection at runtime based on queue/availability
- Automatic path selection from physical availability (pods, station load balancing)
- Rich overlay-based flow edits (changing input/output edges via overlays)

## 2) Definitions

### Equipment Profile

An **equipment profile** is a string ID that represents a kitchen capability context.

Examples:

- `eqp_has_turbo`
- `eqp_no_turbo_has_fryer`
- `eqp_has_waterbath`
- `eqp_no_waterbath_has_microwave`

In MVP, a run picks exactly one profile ID.

### Master Build vs Materialized Build

- **Master build:** authored JSON that includes all variants.
- **Materialized build:** derived JSON for a single equipment profile where only the
  relevant steps remain and dependencies are clean.

## 3) Data Model (How to author variants using current schema)

We rely on existing fields:

- `step.conditions.requiresEquipmentProfileIds?: string[]`
- `step.overlays[]` (for small tweaks only)

### 3.1 Authoring rule: "Real method swap" == separate steps

If the method changes (turbo -> fryer) you must model it as **two different steps**.

Why:

- overlays cannot change `action.techniqueId` today
- swapping method usually changes time, station, tools, etc.

So you create:

- `heat_protein_turbo` (requires `eqp_has_turbo`)
- `heat_protein_fryer` (requires `eqp_no_turbo_has_fryer`)

### 3.2 Authoring rule: each variant must output a unique assembly ID

The validator enforces "single producer per assembly" (H44).
So variant steps cannot both output the same assembly ID.

Example:

- turbo outputs `protein_cooked_turbo_v1`
- fryer outputs `protein_cooked_fryer_v1`

### 3.3 Join pattern (recommended): converge variants into a single canonical assembly

Downstream steps should not need to duplicate.
Instead, create a small "join" step that outputs one canonical assembly.

Conceptual flow:

Variant heat steps:

- `heat_protein_turbo` -> outputs `protein_cooked_turbo_v1`
- `heat_protein_fryer` -> outputs `protein_cooked_fryer_v1`

Join steps (two variants, but downstream stable):

- `select_cooked_protein_from_turbo` (requires `eqp_has_turbo`)
  - input: `protein_cooked_turbo_v1`
  - output: `protein_cooked_v1`

- `select_cooked_protein_from_fryer` (requires `eqp_no_turbo_has_fryer`)
  - input: `protein_cooked_fryer_v1`
  - output: `protein_cooked_v1`

Downstream steps always consume:

- input: `protein_cooked_v1`

Notes:

- The "join" step can be `COMBINE` or `ASSEMBLE` or `TRANSFER`-like work.
- Use `notes`/`instruction` to make it human-readable ("Use whichever cooked protein version applies").
- This join step is mostly for making the graph stable + valid.

### 3.4 Overlays are allowed only for small edits

Use overlays for:

- time tweaks
- station changes when the method is the same
- notes/tool/container adjustments

Do not use overlays for:

- changing technique/method
- changing assembly graph (input/output)

## 4) MVP Materialization: picking a profile and producing a concrete build

### 4.1 Inputs

- `masterBuild: BenchTopLineBuild`
- `equipmentProfileId: string` (exactly one)

### 4.2 Step inclusion rules (MVP)

For each step:

1. If `step.exclude === true`, remove it.
2. If `step.conditions.requiresEquipmentProfileIds` is missing or empty:
   - include the step
3. If it exists:
   - include the step only if it contains the chosen `equipmentProfileId`

This is intentionally simple and deterministic.

### 4.3 Dependency cleanup rules

After filtering steps:

- Remove any `dependsOn` references to steps that were removed.
- Then re-run normalization dependency derivation from material flow.

Important:

- If a downstream step now has missing required inputs because its producing variant was removed,
  the build should fail validation (this is good; it means the variant set is incomplete).

### 4.4 Output

A materialized build should be:

- valid under the schema
- have a clean step list (no dead branches)
- ready for:
  - transfer derivation (from assembly locations + work locations)
  - complexity scoring

### 4.5 Proposed CLI command shape (MVP)

This is a suggestion; not required by MVP schema authoring.

- `lb materialize --build <id> --equipment-profile <profileId> --out data/materialized/<id>.<profileId>.json`

## 5) Transfers + Complexity Scoring (per profile)

MVP scoring flow:

1. Load master build
2. Materialize for chosen equipment profile
3. Normalize (derive station IDs when possible, fill missing material locations, derive deps)
4. Derive transfers (including pod assignment if HDR config present)
5. Score complexity (features + signals + transfers)

### 5.1 HDR config and caching

Transfers depend on HDR pod config (active HDR).

MVP rule:

- Treat derived transfers as computed from:
  - materialized build content
  - the active HDR config ID (or an explicit hdrConfigId passed in)

If using a cache:

- cache key must include `equipmentProfileId` and `hdrConfigId` (or active HDR id).

## 6) Validation Expectations (MVP)

The existing validator already enforces key invariants needed for this approach:

- single producer per assembly (H44)
- assembly ref locations present (H40)
- dependencies exist/no cycles (H8/H9)
- workLocation present (H46)

MVP additionally relies on a "human convention":

- For each method swap, there must be a matching join step per profile so downstream steps
  remain consistent.

Future (not MVP) could add a hard rule like:

- "If two steps are alternative producers for a canonical join output, ensure exactly one is active per profile"

## 7) Concrete Example (turbo -> fryer)

Chosen equipment profiles:

- `eqp_has_turbo`
- `eqp_no_turbo_has_fryer`

Steps:

1. `heat_protein_turbo`
   - conditions: requires `eqp_has_turbo`
   - action.family: `HEAT`
   - action.techniqueId: `turbo`
   - equipment.applianceId: `turbo`
   - output: `protein_cooked_turbo_v1`

2. `heat_protein_fryer`
   - conditions: requires `eqp_no_turbo_has_fryer`
   - action.family: `HEAT`
   - action.techniqueId: `fry`
   - equipment.applianceId: `fryer`
   - output: `protein_cooked_fryer_v1`

3. `select_cooked_protein_from_turbo`
   - conditions: requires `eqp_has_turbo`
   - input: `protein_cooked_turbo_v1`
   - output: `protein_cooked_v1`

4. `select_cooked_protein_from_fryer`
   - conditions: requires `eqp_no_turbo_has_fryer`
   - input: `protein_cooked_fryer_v1`
   - output: `protein_cooked_v1`

5. Downstream step(s)
   - input: `protein_cooked_v1`

Materialization result:

- If profile = `eqp_has_turbo`: include steps 1, 3, 5...
- If profile = `eqp_no_turbo_has_fryer`: include steps 2, 4, 5...

## 8) Future extensions (kept compatible with MVP)

Later you can add:

- "capability sets" derived from HDR inventory (instead of manual profile IDs)
- profile inference ("if turbo missing, pick fryer fallback")
- live routing (multiple allowable methods + selection policy)
- overlay enhancements to allow changing techniqueId (optional)
- OR-input support (instead of join-step duplication) if desired

