---
type: prd
status: draft
project: line-build-redesign
created: 2026-01-14
updated: 2026-01-14
author: Brandon Galang + AI Agent
priority: high
audience: product, culinary-engineering, ops-excellence, engineering
version: 2.0-draft
tags: [line-builds, schema, complexity-scoring, bom-flow, authoring, validation]
---

# PRD (Full) v2 — Line Build Redesign

## Why this PRD exists (v2 framing)

This PRD is a reset from first principles. It exists to align on:
- **What a line build is** (a canonical, minimum-viable instruction spec — not “free text steps”)
- **What it must be able to power** (complexity scoring, bulk operations, future routing/simulation overlays)
- **How we author it** (low-friction culinary input → engineering-grade spec)

Detailed **system design / interfaces / overlays** live in `docs/spec/SYSTEM-DESIGN.md`.

---

## 1) Problem statement

Current line builds are useful operational artifacts, but they are:
- **Fuzzy and inconsistent**: loose requirements, edge cases, and conflated concepts (station/equipment/location/packaging) that often fall back to string fields.
- **Under-specified for engineering use**: not constructed with intentional abstractions/standards, so they do not validate well and are hard to evolve safely.
- **Typically modeled as linear lists** even when the underlying work is a **DAG** (parallel work, merge points, waits, and dependencies).
- **Missing explicit dependency structure**:
  - Fewer than **10%** of steps have an explicit dependency edge.
  - Most line builds rely on **step number** (Step 1, Step 2, …) as the primary ordering mechanism.
- **Cumbersome to author and maintain**, which amplifies inconsistency and prevents systematic improvement.

Note: we *do* have structure today (dropdowns, some required fields, optional dependency edges). The issue is that **validation is low and adherence is even lower**. When the model doesn't cover a case or authoring is hard, teams fall back to notes and string fields.

As a result, we cannot reliably power:
- Complexity scoring without manual spreadsheets
- Cross-menu queries and bulk operations (“show all items using waterbath”, “swap ingredient across 100 items”)
- Safe evolution and validation (change something once, trust it everywhere)

---

## 1.1 What this project really is

1. **Validate the line build approach from first principles**, incorporating new learnings from CE/Ops.
2. **Create an authoring flow** that reduces friction turning culinary speak into engineering-grade specifications (with validation and change safety).
3. **Establish the foundation and interfaces** to derive fields when data becomes available and layer currently desired capabilities (component routing, simulation, scenario analysis) without rewriting the truth layer.

We are **not** fully supporting routing/simulation/sequencing in v2—these require significantly more chef input. Our goal is to **clear the way** so these become possible later without rework. If things go well, we can extend; for now, scope stays manageable until we have more certainty.

---

## 1.2 Why line builds stay unstructured (root causes)

Line builds drift toward free text for two reasons:

1) **We lack the right abstractions.** We have edge cases and conflated concepts (station vs equipment vs location vs packaging). When the model is wrong or incomplete, authors fall back to notes.\n
2) **Structured authoring is too hard.** When required fields are rigid or workflows are cumbersome, teams compromise: they loosen requirements and rely on step number and narrative text.

This project addresses both. We will define the right abstractions and build an authoring flow that makes structured capture the default.

---

## 2) Goals / non-goals

### Goals (v1/v2 scope)

- Validate the right structure from first principles, then run a **gap analysis** against current line build JSON so we build toward the correct vision (not incremental patches on a broken foundation).
- Evolve the **data contract and authoring flow**, not rebuild the entire line build stack:
  - Line builds already exist as **JSON** and are effectively **DAGs**.
  - The work is defining missing structure + constraints required for scoring, queries, and safe evolution.
- Define a stable schema that captures:
  - **Truth layer** (minimum viable instruction spec)
  - **Component flow traceability** across BOM components (BOM IDs as flow IDs)
  - **Movement/transfer representation** (so nothing “teleports”)
  - Enough structure to compute complexity scoring inputs
- Build an authoring workflow where users can:
  - paste/describe procedures and have AI + validation produce structured output
  - iterate safely (changes don’t silently break dependencies/flow)
- Provide an audit trail:
  - validation errors + overrides with reasons
  - source transcripts / provenance when possible

### Non-goals (explicit)

- Line builds do **not** model per-step inventory decrementing.
  - Inventory decrement happens post-facto at the order/served-item level elsewhere.
  - The line build’s job is to model **component flow and manipulation** using BOM IDs, so other systems can confidently decrement the right inputs once per item served.
- We do **not** need to model pods/screens perfectly in the truth layer.
  - Pods/KDS routing is an overlay we may add later.
- We do not attempt to model “direct person-to-person handoff” as a first-class entity unless needed.
  - Operationally, most transfers are staged pickup (window/shelf).

---

## 2.1 Solution approach (standards + AI)

We will combine:
- a **standardized process model** (so the data is consistent), and
- an **agentic authoring flow** (so creating consistent data is easy).

We already have parts of this in place today (JSON line builds, implicit DAG behavior, and some structured fields). The work in this project is to **lean harder into intentional definitions** and to create **explicit contracts** (schema + invariants + validation outputs) so the system is reliable, evolvable, and scalable.

### A) ISA-88: a consistent "recipe" structure for kitchen work

We will model a line build like a recipe/procedure tree (ISA-88 style). In plain terms:
- A line build is a **recipe** (how to produce the item).
- A recipe is composed of **steps** with clear semantics.
- Steps form a **DAG** (parallel work + merge points), not a linear list.

**Action families (8 finalized)**:

| Family | Physical action | Examples |
|--------|-----------------|----------|
| PREP | Manipulate/prepare | Open pack, cut, unwrap, split bun |
| HEAT | Apply temperature | Fry, turbo, waterbath, microwave |
| TRANSFER | Move between locations | Pass, place (staging), retrieve (pickup) |
| COMBINE | Mix together | Stir, toss, mix |
| ASSEMBLE | Layer/place components | Place tortilla, add filling, garnish (as technique) |
| PORTION | Measure/dispense | Sprinkle cheese, portion sauce, count shrimp |
| CHECK | Verify/QA | Check temp, verify doneness |
| PACKAGING | Containerize/seal | Add lid, sleeve, wrap, place in container |

**Removed from action families**:
- ~~VEND~~ → **Station** (`stationId: "vending"`) + TRANSFER; VEND describes "where," not "what"
- ~~COMPLETE~~ → **Derived from DAG** (terminal nodes with no dependents)
- ~~GARNISH~~ → **Technique** under ASSEMBLE/PORTION; "garnish" describes method, not action type

This gives us a stable vocabulary for:
- work types (what kind of work is happening),
- component flow (what is being manipulated), and
- dependencies (what must happen before what).

### B) ISA-95: separate “truth” from site-specific execution routing

We separate:
- **the truth layer** (canonical line build), from
- **execution routing / display** (how a specific restaurant layout routes and displays the work).

This matches ISA-95’s core idea: the definition of “what to do” should survive changes in “where/how it runs.”

Result:
- We do **not** rebuild pods/KDS in this project.
- We design interfaces so future systems (HDR portal data, routing, simulation) can map the truth layer into site-specific execution.

### C) Agentic AI: convert culinary speak into engineering-grade specs at scale

We will use an LLM as an authoring agent, but not as the source of truth.
The agent will operate through deterministic tools (parse/validate/edit/query) so output is consistent and reviewable.

Clarification: “agentic” does not mean “a chatbot that writes JSON once.”
It means the system can **take actions** (tool calls) in a loop: generate → validate → ask targeted questions → apply edits → revalidate → audit.
If needed, we can split responsibilities:
- an **authoring agent** (proposes structure and asks questions), and
- an independent **validation agent** (reviews outputs and flags operational issues),
while keeping deterministic validators as the final gate.

Core loop:
1. **Ingest** raw input (Excel/CSV, legacy JSON, free text, interview notes).
2. **Propose** a structured line build (DAG + structured step fields).
3. **Validate** against hard rules (block publish; allow overrides with reasons).
4. **Interview for gaps** (only ask targeted questions that unblock validity or improve scoreability).
5. **Apply edits** via tool calls (bulk updates, refactors, consistent renames).
6. **Audit** changes (diffs, validation output, override reasons, provenance).

This is how we avoid the historical trap:
- "we needed free text because structure didn't cover edge cases," and
- "we needed free text because structured authoring was too hard."

**Rule evolution**: The agent can propose candidate rules based on patterns (e.g., "assemble should never precede cook"); CE validates whether rules are correct. Even without hard-coded rules, LLMs can provide reasoning on whether a line build makes operational sense—this is already a huge step up from no guardrails at all.

---

## 3) Definitions (core abstractions)

### BOM IDs (flow identity)

- The BOM is a list of material/component IDs required to serve an item.
- In the line build, BOM IDs represent **components moving through the kitchen**. They answer: “Where does this component get used, transformed, or combined?”
- BOM IDs are **not inventory transactions**. They are identifiers we use to model flow.
- Inventory decrement happens elsewhere (post-facto at the served-item level). Practically:
  - if a component appears in the line build flow, it is eligible to be decremented once per served item by downstream systems.
- The goal is “coverage”: BOM components are **accounted for** in the flow model. We do not decrement inventory step-by-step inside the line build.

### Canonical line build (“truth layer”)

The truth layer is the minimum viable instruction spec for producing the item.
- It is designed to be robust to layout changes.
- It should be sufficient for: “given typical station capabilities, produce the dish.”
- It may omit layout-specific optimizations (e.g., exact pod grouping) and allow overlay later.

### Component

A component is “a thing that flows” through the build.
- Prefer to identify components by BOM ID.
- Some intermediate components may not exist in the BOM; those can be represented as build-local intermediates as needed.

### Joined unit (operational unit)

Sometimes the workflow combines two components into one operational unit (e.g., food + packaging).
- Example: cooked fries (food component) + clamshell (packaging component) become “fries-in-clamshell.”
- The joined unit is what flows to downstream steps, while maintaining traceability to the original BOM IDs.

### Station (physical execution zone)

A station is a physical zone in the restaurant. In practice, a station bundles:
- a work surface
- rails (cold rail, dry rail)
- cold storage (e.g., lowboy / undercounter)
- packaging access
- equipment (optional; some stations include appliances, some are primarily assembly/surface)

Important nuance: “station” is not strictly equivalent to “equipment.”
- Example: a station may include multiple equipment, or equipment grouping can change by HDR layout.

### Equipment

Equipment is the appliance used during a step (e.g., fryer, turbo, waterbath).

In the model, equipment is also a **sublocation type**: it is a “place within a station where work happens.”
- Example: “put fries into the fryer” means the component moves to an **equipment sublocation** with `equipmentId = fryer`.
- This preserves the intuition that “equipment is a location,” while keeping station as the higher-level physical zone that contains many sublocations.

### Sublocations (within a station)

Sublocations describe *where within the station* a component is (storage vs rail vs surface vs staging vs equipment slot). These are especially important for movement steps and transfer complexity.

Within a station, example sublocations include:
- work_surface
- cold_rail
- dry_rail
- cold_storage (lowboy / undercounter)
- packaging
- equipment (the appliance/work location; identified by equipmentId, e.g. fryer)
- window/shelf (staging / pickup area)

### Equipment & component registry (canonical)

We assume there is a canonical registry of:
- equipment types (fryer, turbo, waterbath, microwave, press, toaster, …)
- components/materials (BOM items)

The line build schema references these registries, rather than inventing parallel IDs.

---

## 4) System model (how the pieces fit together)

### 4.1 What we store (truth)

We store a line build as a **DAG of steps** with enough structure to model **work** and **flow**.

Each step records:
- **What work happens**: action family + technique
- **What component is manipulated**: prefer BOM ID references (targets/flow refs)
- **Where it happens**: station + sublocation (surface/rail/storage/equipment/window)
- **How it fits in the workflow**: explicit dependency edges (`dependsOn`)
- **Human intent**: instruction/notes (free text stays; structure makes it computable)

Key rule: **`orderIndex` is display ordering; dependencies encode the workflow.** We will keep deterministic ordering for UI, but we lean on the DAG for “what can run in parallel” and “what must happen before what.”

### 4.2 Movement: store explicitly via TRANSFER steps

Chefs will naturally describe "from/to." Internally, we make movement explicit so components do not teleport and "who moved it?" is unambiguous.

We represent movement using **TRANSFER** (the action family) with **techniques** that describe the method:

| Technique | Meaning | Use case |
|-----------|---------|----------|
| `place` | Put down in staging area | Station A finishes, places in window/shelf |
| `retrieve` | Pick up from staging area | Station B gets item from window/shelf |
| `pass` | Direct handoff (synchronous) | When busy, less common |
| `handoff` | Give to another person | Explicit person-to-person |

**Staging workflow** (typical HDR behavior):

```
Station A (Frying):
  - Step: TRANSFER / place
  - sublocation.to: window/shelf

Station B (Garnish):
  - Step: TRANSFER / retrieve
  - sublocation.from: window/shelf
```

This matches kitchen reality:
- Most transfers are **staged pickup** (window/shelf). One station PLACEs to the window; the next station RETRIEVEs from the window when ready.
- These are **two separate steps** with **different actors** (placer vs retriever).
- Movement steps are where transfer complexity lives (e.g., station boundaries, "find the item," queueing friction).

This ensures:
- we can answer "how did it get there?" without teleportation
- we can attribute transfer complexity based on movement technique + station boundaries
- we can derive effective from/to for non-movement steps if needed

**Validation rules for TRANSFER techniques**:
- `TRANSFER/place` must have a `to` sublocation
- `TRANSFER/retrieve` must have a `from` sublocation
- `TRANSFER/pass` can omit staging sublocations (synchronous handoff)

### 4.3 Prepared components (prep recipes) as builds

Prepared components have their own builds. Menu items may reference them as preassembled components.

We should support:
- “requiresBuilds” references to prepared components
- marking pre-prepped steps / pre-service prep so we can derive full operational load

### 4.4 Derivations and overlays (later)

We design the truth layer so additional systems can derive overlays when available:
- **Routing/display overlays** (pods/screens) from HDR portal data
- **Transfer friction estimates** updated from site-specific layouts (without rewriting the truth layer)
- **Simulation/scenario analysis** built on the same DAG + component flow model
- **Output projections** for different consumers (e.g., “on-screen KDS view” vs “sticky dupe print view”) without changing the canonical build

### 4.5 Where we use estimations and simple configs (Q1-friendly)

We should assume we will not have perfect canonical data in v2, because legacy workflows often rely on shortcuts that hide open problems.
Instead of pushing all complexity into the truth layer immediately, we separate:

- **Truth layer (canonical build)**:
  - What work happens, what flows, and what depends on what.
  - Must be stable and MECE.

- **Derived views (deterministic transforms)**:
  - Computed representations derived from the truth layer (e.g., “effective from/to,” station-grouped views, KDS-like projections).
  - Should be reproducible and versioned.

- **Estimation/config overlays (simple knobs)**:
  - Small, explicit configuration objects that stand in for missing site data or unknowns.
  - Used to keep authoring tractable and support early “good enough” outputs.
  - Later, these can be replaced by HDR portal data or richer registries without changing the truth layer.

Examples of estimation/config overlays we can support in Q1:

- **Station capability defaults**:
  - Default assumptions like: “every station has work_surface, cold_rail, dry_rail, packaging, cold_storage.”
  - Exceptions can be recorded explicitly instead of forcing schema changes.

- **Station ↔ equipment affinity defaults**:
  - Default mappings like “Frying Station usually uses fryer equipment.”
  - Validation can warn when something is unexpected, without blocking authoring.

- **Transfer semantics defaults**:
  - Simple rules like:
    - station change implies staged pickup via window/shelf (PLACE to window/shelf → RETRIEVE from window/shelf).
    - press/toaster adjacency to garnish may imply “transfer friction = ~0” unless proven otherwise.
  - These are inputs to derived views and later scoring, not hard-coded truth.

- **Location interpretation defaults**:
  - Clarify ambiguous terms (e.g., `cold_storage` means station-local lowboy; optional `walk_in_cold_storage` is distinct).

- **Output projection toggles**:
  - “Show/hide” or “group by station/equipment” settings for derived execution views.

Design rule: if a rule is an assumption about the restaurant layout or operational practice (as opposed to the recipe truth), it should live in an overlay/config—not in the canonical build.

---

## 5) User personas / stakeholders

- Culinary Engineering (Shin): canonical definitions, technique/station/equipment modeling, spreadsheet replacement
- Ops Excellence / Training: authoring, validation, bulk updates, audit trail
- KDS/Systems (Michelle/others): routing/overlay compatibility, future-proofing for layout differences
- Product (PM): measurable outcomes, adoption, cross-menu insights, change safety

### What each persona needs (plain language)

- Culinary Engineering:
  - A line build that matches how food actually flows through stations/equipment.
  - Complexity scoring inputs without a spreadsheet.
  - Clear vocabulary governance (stations, techniques, tools, equipment, sublocations).

- Ops Excellence / Training:
  - Fast authoring and review loops (minimal SME time).
  - Hard validation with override + reason (so data quality improves over time).
  - Bulk edits across many items (ingredient swaps, technique normalization).

- KDS/Systems:
  - A truth layer that is stable even when pods/screens/layout change.
  - Clear interfaces for deriving routing/display overlays later.

- Product:
  - A clear definition of “done” (adoption + measurable reduction in manual work).
  - A system that scales: new items and menu changes don’t create data debt.

---

## 6) User workflows (authoring + validation)

### 6.1 Authoring inputs (what users provide)

- Existing line build / CSV / Excel (legacy structured-ish)
- Natural language descriptions / SME interview transcripts
- Rules and clarifications (e.g., "press↔garnish transfer is effectively zero in cold pod")

The tool is a **chat agent** that accepts arbitrary input. Raw input is preserved as provenance alongside the structured output.

### 6.2 Authoring experience (how users think)

We ask chefs questions in intuitive terms:
- “What are you doing?”
- “Where are you taking it from?”
- “Where are you putting it?”

But the tool stores the MECE model (movement steps + flow identities).

### 6.3 Change safety

We need strong safeguards because edits can break flow:
- splitting/merging steps must revalidate dependencies
- reordering steps must maintain acyclic graph and completeness invariants
- overrides must be tracked with reasons

### 6.4 End-to-end workflow (happy path)

This is the default lifecycle we want the tool to support.

1) **Ingest**
- Input: Excel/CSV + optional legacy JSON + notes.
- Output: parsed step candidates + extracted component references (prefer BOM IDs).

2) **Propose a draft canonical line build**
- Output: a draft DAG with:
  - steps typed (action family + technique),
  - station + sublocation (including equipment-as-sublocation),
  - movement expressed explicitly (RETRIEVE/PLACE),
  - targets linked to BOM IDs where possible,
  - initial dependencies.

3) **Validate (hard rules first)**
- Output: deterministic validation report:
  - publish-blocking errors
  - warnings/metrics
  - suggested fixes

4) **Interview only for missing or ambiguous data**
- The agent asks targeted questions to unblock validity and scoreability:
  - missing station/equipment/sublocation
  - missing technique selection when required
  - unclear flow joins (joined unit creation)
  - missing/ambiguous dependencies

5) **Resolve and publish**
- Output: published build (or draft with tracked overrides).
- Audit trail includes:
  - validation output
  - overrides with reasons (if any)
  - provenance links to source inputs/transcripts

### 6.5 Bulk change workflow (operating at scale)

We need to support "change once, trust everywhere."

1) **Query**: find all builds/steps matching a predicate (equipment, technique, BOM ID, station).
2) **Plan**: preview the impact (counts + example diffs).
3) **Apply**: perform edits via tool calls (rename technique, swap component, adjust station/sublocation, refactor movement steps).
4) **Revalidate**: run deterministic validation for all touched builds.
5) **Review + audit**: record why the bulk change happened and link to tickets/approvals.

### 6.6 Legacy compatibility + transition strategy (TBD)

How we transition depends on the gap between canonical and legacy line build formats.

**If the gap is small**:
- The canonical schema is close enough that we can produce "legacy-equivalent" output.
- We transition current builds over time without a translation layer.
- "Dry run" means: preview what the KDS/production system would see.

**If the gap is large**:
- We need a deterministic translation layer from canonical → legacy.
- Some existing human review processes may remain until legacy is retired.

**Possible P2 direction**:
- Install a tool-calling agent to manage *legacy* line builds using the same authoring experience we build for canonical.
- This lets us improve authoring quality now, even before full schema migration.

This is still TBD—we'll decide after the gap analysis.

---

## 7) Requirements

### 7.1 Schema requirements (data contract)

These define what must be representable in the canonical line build.

**P0 — Must**
- Every step has a clear “type” and required fields.
  - Meaning: we can tell if a step is “heat” vs “move” vs “assemble,” and we know what data must be present for that step type.
- Data quality rules block publishing, with an explicit exception path.
  - Meaning: if required structure is missing, the build can’t be published unless someone overrides with a written reason.
- Station and equipment are modeled separately.
  - Meaning: “station” is the physical zone; “equipment” is a work location inside a station (a sublocation) and also names the appliance (fryer/turbo/etc.).
- Movement can be represented explicitly.
  - Meaning: components don’t “teleport.” We can record retrieves and places (including moving into/out of equipment or a window/shelf).
- BOM IDs are first-class references for flow.
  - Meaning: components in the build are identified by their BOM IDs so we can trace “what got used where.”
- Prepared components can be composed.
  - Meaning: a pre-prep recipe can be its own build and referenced by menu-item builds (i.e., HDR recipes)

**P1 — Should**
- Joined units are representable.
  - Meaning: we can represent “food + packaging becomes one operational unit” while still keeping traceability to the original BOM IDs.
- Sublocation is captured wherever it affects work.
  - Meaning: we can distinguish rail vs storage vs surface vs window vs equipment, because it changes retrieval/transfer friction.

### 7.2 Capability requirements (what the system can do)

These define system behaviors built on top of the schema.

**P0 — Must**
- Validation output is consistent and reviewable.
  - Meaning: given the same build, the system always produces the same errors/warnings and points to what to fix.
- Bulk operations are possible.
  - Meaning: we can query for “all steps like X” (by equipment/technique/station/BOM) and apply a change safely at scale.
- Configurable assumptions are supported without rewriting builds.
  - Meaning: we can apply an explicit “defaults/overlays” config (e.g., station capability defaults, transfer semantics defaults) to derive outputs, and we can change those assumptions without modifying the canonical recipe truth.

**P1 — Should**
- Complexity scoring inputs are computable from the data.
  - Meaning: we can compute the inputs/metrics needed for scoring without manually maintaining spreadsheets (weights can live elsewhere).
- Component coverage reporting exists.
  - Meaning: we can show which BOM components are accounted for in the flow model (or flag what’s missing/unclear).

**P2 — Later**
- “Dry run” preview exists for execution views.
  - Meaning: we can preview a derived execution output (e.g., KDS-like view) to catch “graph is valid but operationally weird” issues before publish.
- Support scenarios/overlays for layout differences (pods/screens) without rewriting the truth layer.
  - Meaning: we can map the same canonical build into different site layouts (routing/display/transfer assumptions) without changing the underlying recipe truth.
- Support expanding prepared component builds into full operational load views.
  - Meaning: we can “expand” referenced prep builds to estimate total work/time/complexity, while still keeping the menu-item build readable at the top level.

### 7.3 UX requirements (authoring experience)

These define the user experience contract so structured authoring is the default.

**P0 — Must**
- Users can author in culinary language.
  - Meaning: users can paste notes/transcripts/spreadsheets; the agent asks a small number of targeted questions to fill missing structure.
- Publishing enforces minimum structure.
  - Meaning: publish is blocked when required data is missing; overrides require a reason and are stored.
- Edits are safe by default.
  - Meaning: splitting/merging/reordering steps triggers revalidation (and dependency checks) so changes don’t silently break the workflow.

**P1 — Should**
- Bulk-change preview exists.
  - Meaning: before applying a bulk edit, users can see counts and example diffs.
- Provenance is visible.
  - Meaning: users can link structured output back to source inputs/transcripts when available.
- DAG view is collapsible and treated as a debug tool.
  - Meaning: the graph/timeline view does not need to occupy permanent screen real estate; users can hide it unless they’re debugging structure.
- The difference between “form” and “graph” is clear.
  - Meaning: the form edits the selected step’s fields; the graph shows relationships and parallelism (dependencies), which the form alone can’t explain.
- “Chat” vs “notes” is explicit.
  - Meaning: the tool supports free-form notes saved with the build, and optionally a chat-style interview; both feed the same structured output.

---

## 8) Open questions (must answer before committing schema changes)

This section is intentionally short; detailed open questions live in `docs/spec/SCHEMA-REDESIGN-PROPOSAL.md`.

- Station/equipment mapping: what equipment is allowed at which stations (defaults + exceptions)
- Station sublocation assumptions: confirm "every station has cold storage, cold rail, dry rail, packaging, work surface"
- Transfer complexity approximation rules until HDR portal layout is available
- ~~Confirm packaging action family semantics (VEND vs PACKAGING vs TRANSFER+technique)~~ **RESOLVED**: VEND is a station; PACKAGING is an action family; movement is TRANSFER+technique
- Confirm technique list governance and any "must-have" technique constraints per family
- Define “pre-cook / cook / post-cook” in plain terms (or explicitly remove from the truth layer and treat as a derived view).
- Clarify what is “already true today” vs “new”:
  - Which parts of current line builds are truly free text vs dropdown-structured?
  - Can we reliably recover a DAG from existing “dependency numbers,” given that <10% of steps have explicit dependencies today?
- Infinite Kitchens alignment:
  - IK goes live in **June 2025**.
  - Wonder contact: **Garrett Backer**. IK tech lead: **Charles Renwick**.
  - Our commitment: keep the truth layer derivable so IK format can be generated.
  - Open: confirm IK required format + checkpoints for cross-team alignment.
- HDR variance:
  - When do we need multiple builds vs one canonical build + overlays?
  - How do we baseline location/accessibility scoring across HDRs today, and how do we later override with portal layout data?
- Window/shelf vs pass_window:
  - Are these the same staging concept with different names, or distinct (e.g., intra-line staging vs expo/pass handoff)?
- Output projections:
  - What is the minimal “sticky dupe print view” we need to support without overloading the core schema?

---

## 9) Success metrics

- 0 spreadsheets required for complexity scoring inputs (Shin stops manual sheet work)
- >95% of steps can be represented without “OTHER”
- Coverage: all BOM components are accounted for (or explicitly explained) in the build’s flow model
- Authoring time: new build produced with acceptable completeness within target time (TBD)
- Complexity score calibration: documented example ranges after we validate the model on representative builds.
- Canonical + overlays reduces duplication.
  - Meaning: we target “one canonical build per item” plus overlays for HDR/layout differences, rather than proliferating copies.

---

## 10) Appendix

### 10.1 Action families (finalized)

| Family | Physical action | Example techniques |
|--------|-----------------|-------------------|
| PREP | Manipulate/prepare | open_pack, cut, unwrap, split_bun, peel |
| HEAT | Apply temperature | fry, turbo, waterbath, microwave, toast |
| TRANSFER | Move between locations | place, retrieve, pass, handoff |
| COMBINE | Mix together | stir, toss, mix |
| ASSEMBLE | Layer/place components | place, garnish, spread, fold |
| PORTION | Measure/dispense | sprinkle, portion, pour, drizzle |
| CHECK | Verify/QA | (check_temp, verify_doneness) |
| PACKAGING | Containerize/seal | lid, sleeve, wrap, cover |

**Key decisions**:
- **VEND** is a **station**, not an action family. Steps that "send to vend" are TRANSFER steps to the vending station.
- **COMPLETE** is **derived from DAG structure** (terminal nodes), not an action family.
- **GARNISH** is a **technique** under ASSEMBLE/PORTION, not its own family. The "garnish station" is `stationId: "garnish"`.

**Legacy mapping**:

| Legacy step type | New mapping |
|------------------|-------------|
| GARNISH (328k) | → stationId: garnish + action families (ASSEMBLE, PORTION, PREP) |
| COOK (150k) | → HEAT |
| COMPLETE (70k) | → Derived from DAG (terminal nodes) |
| VEND (25k) | → stationId: vending + TRANSFER |

---

### 10.2 Controlled vocabularies (from Shin)

This is the current working vocabulary derived from Shin’s station/equipment/tool conventions (Jan 2026). It is intentionally explicit because these lists are the “contract surface” for validation and authoring UX.

#### Stations (raw, as provided)

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

#### Stations (normalized display names)

- Frying Station
- Garnish Station
- Waterbath Station
- Vending Station
- Press Station
- Turbo Station
- Toaster Station
- Clamshell Station
- Pizza Station
- Microwave Station
- Speed Line Station

#### Sublocations (within a station)

- work_surface
- cold_rail
- dry_rail
- cold_storage (undercounter / lowboy)
- packaging
- equipment (identified by `equipmentId`, e.g. fryer/turbo/waterbath)
- window/shelf (staging / pickup area)

#### Equipment (appliance IDs)

Raw (as provided):
- n/a
- Fryer
- Waterbath
- Press
- Turbo
- Toaster
- Clamshell Grill
- Hot Box
- Microwave
- Wheel

Normalized (proposed IDs; deduped + legacy additions):
- fryer
- waterbath
- press
- turbo
- toaster
- clamshell_grill
- hot_box
- microwave
- wheel
- rice_cooker (from legacy; 6k uses)
- pasta_cooker (from legacy; 115 uses)
- pizza_conveyor_oven (from legacy; 1.3k uses)
- pizza_oven (from legacy; 6 uses)
- sauce_warmer
- steam_well
- induction
- conveyor
- hot_well
- salamander

Note: Legacy brand names (PITCO → fryer, CARTER_HOFFMAN → hot_box, ALTO_SHAAM → hot_box) are normalized to generic equipment types.

#### Locations (global vs station-local)

Raw (as provided):
- Cold Storage
- n/a
- Fryer
- Dry Rail
- packaging
- From Fryer Station
- Waterbath
- From Waterbath Station
- Cold Rail
- Press
- Kit
- Turbo
- Toaster
- From Turbo Station
- Clamshell Grill
- From Press Station
- Hot Box
- Sauce Warmer
- Microwave
- from Microwave
- Steam Well

Parsing guidance (proposed):

- **Work surface (implicit)**:
  - Even if not explicitly listed in the spreadsheet, assume every station has a work surface.
  - Default rule: if a step happens “at a station” and no more specific sublocation is given, treat it as `sublocation = work_surface`.

- **Stations (not locations)**:
  - “From Fryer Station”, “From Waterbath Station”, “From Turbo Station”, “From Press Station”, “from Microwave”
  - Meaning: spreadsheet shorthand for station context. In the canonical model these become `stationId = …` (not a location string).

- **Equipment-as-location (sublocation type = equipment)**:
  - Fryer → `sublocation = equipment`, `equipmentId = fryer`
  - Waterbath → `sublocation = equipment`, `equipmentId = waterbath`
  - Press → `sublocation = equipment`, `equipmentId = press`
  - Turbo → `sublocation = equipment`, `equipmentId = turbo`
  - Toaster → `sublocation = equipment`, `equipmentId = toaster`
  - Clamshell Grill → `sublocation = equipment`, `equipmentId = clamshell_grill`
  - Microwave → `sublocation = equipment`, `equipmentId = microwave`

- **Station sublocations (non-equipment)**:
  - Cold Rail → `sublocation = cold_rail`
  - Dry Rail → `sublocation = dry_rail`
  - packaging → `sublocation = packaging`
  - Kit → `sublocation = kit_storage` (or a station-local kit bin; confirm)
  - Hot Box / Sauce Warmer / Steam Well → likely `sublocation = equipment` (holding equipment), with `equipmentId = hot_box | sauce_warmer | steam_well`

- **Global vs station-local storage**:
  - Shin stated every station has cold storage (undercounter / lowboy). So by default:
    - Cold Storage → `sublocation = cold_storage` (station-local)
  - Open question: do we also need a distinct “global walk-in” concept (separate from station cold storage)? If yes, define it explicitly (e.g., `globalLocation = walk_in_cold_storage`) to avoid conflating the two.
  - n/a → explicit sentinel for “not specified / not applicable” (should be avoided in published builds).

Normalized (proposed IDs; consistent with the schema):
- Global locations (shared): `walk_in_cold_storage` (if used), `freezer`, `dry_storage`, `packaging_storage`, `pass_window`
- Station sublocations: `work_surface`, `cold_rail`, `dry_rail`, `cold_storage`, `packaging`, `kit_storage`, `window/shelf`, `equipment(equipmentId=...)`

#### Tools (hand implements)

Raw (as provided):
- Hand
- Fry Basket
- White Shaker
- viper
- 2 oz Spoodle
- 1 oz Spoodle
- 1 Tbsp
- 3oz Spoodle
- mini Tong
- Pizza Wheel
- Paddle
- Shaker - Rose
- Spatula
- Portion Cup
- Rose Shaker
- yellow squeeze
- spoon
- Bread Knife
- Basket
- white bottle
- squeeze bottle
- Tongs
- Burger Spatula
- Scraper
- 1 tsp
- Tri Tip Bottle
- White Squeeze
- 1.5oz spoodle

Normalized (proposed IDs; deduped):
- hand
- fry_basket
- shaker_white
- shaker_rose
- viper
- spoodle_1oz
- spoodle_1_5oz
- spoodle_2oz
- spoodle_3oz
- spoon
- paddle
- tongs
- tong_mini
- spatula
- spatula_burger
- scraper
- pizza_wheel
- bread_knife
- portion_cup
- bottle_squeeze
- bottle_squeeze_white
- bottle_tri_tip
- squeeze_yellow
- measure_1_tbsp
- measure_1_tsp
- basket

Notes:
- Some “tools” above are measurement tools (`measure_*`) or container-adjacent (`portion_cup`, `basket`). Classification can be refined later.

#### Techniques

Raw (as provided; casing preserved):
- Butter Wheel
- Clamshell Grill
- Cover
- Cut
- divide
- Drain
- drizzle
- Fold
- Fry
- Lid
- Lift/Fold
- Open Kit
- Open Pack
- Open Pouch
- Pass
- Place
- Portion
- Pour
- Press
- Remove Foil
- Roll
- Scrape
- Shake
- Sleeve
- Smash Open
- Split Bun
- Spray
- Spread
- Sprinkle
- Squeege
- Sticker
- stir
- Toast
- Toss
- Turbo
- Waterbath
- Wrap
- pinch
- hot held
- Massage
- Squeeze
- remove lid
- mix
- Fill
- Pizza Sprinkle
- Tear and Place
- Pizza Slide
- Pizza cut
- Spiral Pour
- Crush
- make well
- Peel
- Dots
- Shingle
- Pat Dry
- Remove from pan
- Line Pour
- Microwave
- flip
- dollops

Normalized (proposed IDs; deduped):
- butter_wheel
- clamshell_grill
- cover
- cut
- divide
- drain
- drizzle
- fold
- fry
- lid
- lift_fold
- open_kit
- open_pack
- open_pouch
- pass
- place
- portion
- pour
- press
- remove_foil
- roll
- scrape
- shake
- sleeve
- smash_open
- split_bun
- spray
- spread
- sprinkle
- squeegee
- sticker
- stir
- toast
- toss
- turbo
- waterbath
- wrap
- pinch
- hot_held
- massage
- squeeze
- remove_lid
- mix
- fill
- pizza_sprinkle
- tear_and_place
- pizza_slide
- pizza_cut
- spiral_pour
- crush
- make_well
- peel
- dots
- shingle
- pat_dry
- remove_from_pan
- line_pour
- microwave
- flip
- dollops

Notes:
- This list is treated as Shin-owned vocabulary. If we later add technique → action-family constraints, we can group these by action family.

### 10.3 Principles to preserve

- **Truth first**: the canonical line build describes “what must happen,” not “how KDS currently displays it.”
- **MECE storage**: avoid storing the same semantic fact in two different ways.
- **Evidence before rigidity**: keep techniques as-is; promote new hard rules only after seeing patterns.
- **Separation of concerns**: schema truth vs HDR layout routing/overlays vs inventory transactions.

