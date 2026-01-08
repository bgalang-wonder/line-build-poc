---
type: prd
status: draft
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
stakeholders: [Jen West, Shin Izumi, Michelle Schotter, Cookbook Eng, KDS]
priority: high
tags: [line-builds, maintenance, bulk-editing, structured-data, ai-assist, bom-usage]
related: [README.md, research-pain-points-constraints.md, analysis-current-state-v1.md, analysis-abstraction-context-v1.md, analysis-poc-context-v1.md, research-existing-initiatives.md]
version: 0.1
---

# Reference-First Line Builds — Product Spec (v0.1)

## Overview

We will evolve Line Builds from mostly free-text instructions into **reference-first, structured steps** that are easier to maintain at scale.

The product is designed around a simple principle:

- **Edit references, not instances.**

It supports **safe bulk edits** (tools, stations, equipment swaps, standardization) while still allowing chefs to work **bottom-up** (dish-by-dish) without needing perfect global rules up front.

This doc is intentionally a **product spec** (flows, data contracts, validations, and release phases). Maintenance and bulk editing are the primary win; complexity scoring becomes a natural output of the same structure.

## Background / Why now

- Current dataset scale is too large for manual consistency: \~486K step rows, \~850 items with line builds.

- Most semantic meaning lives in free text; structured reference coverage is low today (e.g., \~10.6% `related_item_number`).

- Operations changes quickly; our current tooling makes changes slow and risky.

- We have an active POC for complexity scoring, but production line build data is not structured enough to power it.

(See: `analysis-current-state-v1.md`, `research-pain-points-constraints.md`, `analysis-poc-context-v1.md`.)

## Problem statement

Line Builds are hard to maintain because the system treats them like “digital binders”:

- To change a tool, station, or equipment approach across many items, teams do repeated manual edits.

- BOM changes and line build meaning drift apart (historical “bacon incident” class of problems).

- Variant duplication (restaurant overrides, appliance differences) multiplies maintenance.

- We can’t reliably compute complexity or validate correctness at scale because instructions are mostly text.

## Goals

### Primary outcome

Make portfolio-wide operational changes (tools, equipment, stations, standard language) **fast, safe, and auditable**.

1. **Bulk editing is a first-class workflow** (not an afterthought).

2. Reduce “edit N line builds” into “edit 1 rule/reference + preview impact.”

3. Allow chefs to author dish-by-dish without needing a perfect taxonomy.

4. Maintain BOM integrity (inventory truth) while making line build steps operationally accurate.

5. Enable deterministic validations (rules) so missing steps and inconsistent patterns are caught early.

6. Support AI/agent assistance for inference, suggestions, and pattern discovery.

## Non-goals (for initial release)

- Building a full robot-executable instruction language.

- Perfect, MECE action ontology across all cuisines.

- Forcing all legacy line builds to be fully migrated immediately.

- Rebuilding core BOM semantics.

## Users / Personas

### Primary user journeys (what they’re trying to do)

1. **Edit one dish** (day-to-day authoring)

2. **Standardize a pattern across dishes** (bulk edit)

3. **Make an operational change** (equipment swaps, station changes)

4. **Validate and publish safely** (rules and previews)

5. **Learn from bottom-up chef behavior** (AI-assisted library growth)

- **CE (Culinary Engineering):** creates and maintains procedures; needs fast updates and standardization.

- **Ops / HDR Ops:** needs reliable complexity scores, throughput insights, and safe operational change.

- **Training:** needs consistent language and repeatable patterns.

- **KDS/Product:** needs stable downstream contract and fewer “content changes require code changes.”

## Key product idea (in plain language)

A step should not be “a sentence.” A step should be:

> **An action applied to a target reference**

…and the sentence displayed to cooks should be **generated** from that structure (plus optional notes).

## Core abstractions

This section defines the system’s “vocabulary.” The key to governance is **few concepts, clear ownership, clear precedence**.

### 1) Target = BOM usage reference (stable anchor)

Each component step targets a **BOM usage / BOM entry reference** for that menu item.

- Identity stays stable through SKU changes because BOM uses alias/interchangeability.

- Station/tool defaults can be inherited from the **menu item ↔ component usage** pairing.

- This is the core mechanism that makes maintenance safe.

**Important nuance (supported by design):** the same BOM entry may be referenced by multiple steps. When that happens, the editor requires a quick confirmation.

### 2) Step kinds (supports real kitchen work)

We support step types that match real operations without forcing everything into ingredient-accounting:

1. **Component step** (default): action on one BOM target.

2. **Bundle / staging step**: workflow step that may not map to one component (e.g., “Open kit and stage contents”).

3. **Meta step**: workflow step that applies to the process itself (e.g., “Preheat turbo”, “Set up clamshell”).

**Repeat use** is not a separate step type; it is a behavior of component steps:

- If a user selects a target already used in another step, show:

  - “This component is already used in Step X. Add another use?”

This keeps the mental model simpler.

### 3) Actions: structured enough to edit, flexible enough to survive

Actions are the core “grammar” that makes bulk editing and scoring possible.

We store actions at two levels:

- **Action Family** (small, stable buckets): Heat, Transfer, Combine, Portion, Assemble, Package, Hold, Other.

- **Action Detail** (growing library): Open pouch, Sear, Shingle, Ladle 2oz, Drizzle, etc.

**Design rule:**

- Action Family is required for any step that will be scored/validated.

- Action Detail is optional, but when present it unlocks better bulk edits and better scoring.

**Chef-friendly behavior:**

- If detail is unknown, choose **Other** and add a short note.

- The system uses AI to suggest action detail; chef confirms or adjusts.

### 4) Defaults (inheritance) to keep authoring fast

Where possible, the UI auto-fills fields from existing menu item ↔ component usage metadata.

**Defaults from target (inherited):**

- station / pod

- default tool

- default storage/execution context (if available)

**Step-level overrides (explicit):**

- action family/detail

- duration/attention flags

- equipment used for this step

- phase

- notes

- overrides for tool/station when the default doesn’t match reality

**Precedence:** Step override &gt; target default &gt; system default.

### 5) Variants (maintenance-friendly, not a programming language)

We avoid cloning entire line builds.

Instead we support **step-level variants** using a bounded set of predicate types:

- equipment capability (has fryer vs turbo)

- restaurant/site (or site cluster)

- customization option

- service mode (if relevant)

**Deterministic resolution:**

- Each step has a base version (default) plus zero or more variants.

- Variants have a strict priority order (highest wins).

- The UI can always answer: “Why did this variant apply here?”

This keeps variants governable and reviewable.

## Product scope

### In scope for v1

- Step editor enhancements (action fields, inherited defaults, repeat-target confirm)

- Step variants (bounded predicates, deterministic resolution, explainability)

- Bulk edit tool (filter → preview → apply) for tools, equipment, and action standardization

- Validation (warn-first) + publish gating option

- Audit log for bulk edits

- AI assistance (suggestions + pattern mining), but never required to publish

### Out of scope for v1

- Full automation language for robotics

- Perfect action taxonomy

- Forcing all legacy data to be migrated before any value is delivered

## Requirements (functional)

### R1 — Step model supports reference-first structure

**Minimum required structured fields (for “publish” once enforcement begins):**

- Step kind

- Target reference (required for component steps)

- Action family

**Recommended fields (high ROI):**

- Action detail

- Phase (pre/cook/post/pass)

- Equipment used (if any)

- Duration estimate (seconds or bucket)

- Attention-required boolean

- Tool (inherited default, override allowed)

- Station/pod (inherited default, override allowed)

- A component step must point to a BOM usage reference.

- A step must have Action Family.

- Action Detail is optional but recommended.

- A step supports optional fields for time, attention, equipment, and notes.

### R2 — Quick confirmation on repeated target

**Goal:** allow flexible culinary reality while preventing accidental duplicates.

- If a user selects a target already referenced earlier, the UI prompts confirmation.

- The user can proceed or cancel.

### R3 — Bulk edit: filter → preview → apply

This is the critical feature for maintenance.

Bulk edits must follow a safe flow:

1. Define filter (what changes?)

2. Preview affected items/steps + score deltas

3. Apply change

4. Record an audit entry

### R4 — Bulk edit types supported (initial)

**Bulk edit must support two levels of targeting:**

- **Reference-level edits** (preferred): edit a shared reference/default so many steps change “for free.”

- **Step-level edits** (fallback): directly update a filtered set of steps.

The UI should make it obvious which level you are editing.

1. **Tool swap** across a filtered set of steps.

2. **Equipment swap** (e.g., Waterbath → Turbo) across steps or variants.

3. **Station/pod changes** (if not fully inheritable).

4. **Action standardization** (e.g., map “Spoon” → “Spoodle_2oz”).

### R5 — Deterministic validation rules (warn-first)

Validations are the “linting” layer that keeps the system governable as it scales.

Provide rules that can run before publish:

- “Heated step shorter than 45s → requires attention flag” (or at least a warning)

- “Turbo step should have vessel/tool where relevant”

- “Cold-to-hot rotation detected” (for scoring + operational review)

- “Repeated target used” (intent confirmation already handled)

Start with warnings; move to enforcement later.

### R6 — AI/agent assistance (suggest, don’t block)

- For legacy text steps, AI suggests Action Family/Detail + tool + attention/time flags.

- In the editor, AI can suggest structured fields as the chef edits.

- System stores “inferred vs confirmed” state and confidence.

## Requirements (non-functional)

- **Explainability:** The system can explain why a variant applied and why a step was flagged.

- **Auditability:** Bulk edits produce a change record (who/when/what filter/what changed).

- **Safety:** Bulk edits are preview-first; no silent global changes.

## Success metrics

Maintenance / bulk edit outcomes:

- Time to apply a portfolio-wide change (e.g., tool swap) decreases from hours/days to minutes.

- Reduction in duplicated line build variants per item (especially equipment/restaurant driven).

- Decrease in steps with “free text only meaning” over time.

Quality outcomes:

- Reduction in production incidents caused by mismatch between BOM changes and line build meaning.

- Validation warnings trend downward over time.

Scoring outcomes (secondary but expected):

- % of items with computable complexity score increases steadily.

- Score stability: changes in score can be traced to specific edits.

## Walkthrough: key editing flows

### Flow A — Bulk tool swap (Spoodle change for salsa)

This flow shows **step-level bulk edits**. In many cases, we may prefer a reference-level change (update the default tool on the menu item ↔ component usage pairing), but the system should support both.

**Scenario:** We want to switch from “spoodle 1oz” to “spoodle 2oz” for salsa applications across the portfolio (or across a cuisine set).

**Decision point:** should this be done as:

- **Reference-level change** (update default tool for the salsa component usage in each relevant dish), or

- **Step-level change** (update tool overrides on steps that currently specify a spoodle)

The bulk edit UI should let the user choose which strategy they’re applying and show impact accordingly.

**How the user does it**

1. Open Bulk Edit → “Tools”

2. Filter:

   - Target = salsa components (by tag/category, or by component attribute)

   - AND tool = Spoodle_1oz

   - (optional) AND station = Garnish

3. Preview:

   - Show list of affected menu items and steps

   - Show score delta summary (median, range)

   - Show any validation warnings introduced

4. Apply:

   - Update tool on the selected set

   - Write audit record

5. Optional agent assist:

   - “Suggest other steps that look like salsa but are labeled differently” (AI expands the filter candidates with confidence, user approves)

**Why this is safe**

- Filter is explicit

- Preview shows impact

- Audit log exists

### Flow B — Equipment change (Waterbath → Turbo for a component)

This flow must support both “global policy change” and “site-conditional change.”

**Scenario:** Operational change: we want to move a component’s cook from waterbath to turbo.

There are two common cases:

**Case 1: Pure substitution (no site differences)**

1. Bulk Edit → “Equipment”

2. Filter:

   - equipment = Waterbath

   - AND target = that component usage type/category

3. Change:

   - equipment = Turbo

   - optionally adjust: time/attention flag defaults

4. Preview:

   - show affected items

   - show score deltas

   - show “short heated step” warnings if time drops under 45s

**Case 2: Some sites still require Waterbath (variants)**

1. Edit the relevant cook step

2. Add a step variant:

   - Variant A: If site has waterbath-only constraint → Waterbath

   - Variant B: Otherwise → Turbo

3. Preview explains variant selection.

### Flow C — Standardize action language (bottom-up to top-down)

**Scenario:** Chefs have been writing “Scoop” vs “Portion” vs “Ladle.”

1. Bulk Edit → “Actions”

2. Filter:

   - action_detail in \[Scoop, Ladle\]

3. Change:

   - action_detail → Portion

4. Optional agent assist:

   - AI suggests synonyms found in notes/free text; user approves mapping.

## Product design details

### Editor: step row (what the user sees)

Each step row includes:

- Step kind (component / bundle / meta)

- Target picker (for component steps)

- Action family (required)

- Action detail (optional)

- Tool + station (auto-filled, overrides allowed)

- Phase

- Equipment used (if any)

- Duration estimate + attention required

- Notes

- Variant control (add/edit variants)

### Bulk edit builder: filter → preview → apply

**Filter builder (inputs):**

- Step fields: action family/detail, equipment, phase, station, tool, attention, duration bucket

- Target fields: ingredient/component tags (e.g., “salsa”), component category, allergen class, packaging type

- Context fields: restaurant/site cluster, equipment capability

**Preview (outputs):**

- affected menu items count

- affected steps count

- before/after diff summary (field-level)

- warnings that will be introduced/removed

- optional score delta summary (median/range, outliers)

**Apply (outputs):**

- changes applied

- audit record created

- optional “create review task” for CE lead if change scope is large

### Audit log

Every bulk edit creates a record:

- actor

- timestamp

- filter definition

- change definition

- counts affected

- warning deltas

- optional score deltas

## Sample implementation (high-level, not code)

### Data components

Below is a conceptual contract (not code). This is what downstream systems can rely on.

- **Step**: one procedure step; may reference a target (component step) or not (meta step)

- **Target reference**: BOM usage reference (stable identity)

- **Target defaults**: tool/station at menu item ↔ component usage level

- **Action library**: action families + optional action detail definitions (including display wording defaults)

- **Variant rules**: bounded predicate set; deterministic resolution order

- **Bulk edit audit log**: stores filter, change, actor, timestamp, impact summary

- **Inference metadata**: for each inferred field, store confidence + inferred/confirmed status

### Editor UX components

- Step row with:

  - target picker (BOM usage)

  - action family/detail

  - tool/station (auto-filled, editable)

  - notes

- “Repeated target” confirmation modal.

- Bulk edit builder:

  - filters + preview table

  - impact summary (score deltas + warnings)

### Agent/LLM components

- **Inference agent**: suggests structure from legacy text.

- **Pattern mining agent**: finds new recurring “Other” actions and proposes library additions.

- **Bulk edit assist agent**: suggests candidate steps that match a filter but are labeled inconsistently.

## Rollout plan (phased)

This sequence is designed to deliver value before full migration.

### Phase 0 — Foundations (1–2 sprints)

- Define action families (small set) + initial action detail library (seeded from POC + top text patterns)

- Add inference metadata fields (inferred/confirmed + confidence)

- Add repeat-target confirmation behavior

### Phase 1 — Shadow structure + preview-first bulk edits (2–4 sprints)

- Add action family/detail as optional fields on steps

- Add duration bucket + attention required as optional

- Run AI inference to backfill suggestions for existing steps

- Release bulk edit tool with preview + audit log

- Keep publish permissive (warn-first)

### Phase 2 — Confirm-as-you-edit (ongoing)

- In editor, show AI suggestions + confidence

- Provide one-click “Confirm suggested fields”

- Track confirmation rate and unknown/Other rate

- Add “pattern mining” dashboard for CE governance

### Phase 3 — Validation + enforcement (after adoption)

- Expand deterministic validations

- Move from warn-first → enforce for new/edited steps

- Add publish gating rules (configurable per org readiness)

## Open questions

These are the remaining product decisions to finalize before engineering starts.

- Where should “station/tool defaults” live long-term (component usage vs step vs both) given real exceptions?

- What is the minimal action family set stakeholders agree on?

- What is the acceptance threshold for AI inference (e.g., 90% right with review queue)?

## Appendix: why maintenance-first enables scoring

Once steps have stable targets, actions, and timing/attention signals, complexity scoring is “just math” over the same fields.