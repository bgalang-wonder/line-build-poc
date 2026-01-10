---
type: plan
status: draft
project: line-build-redesign
created: 2026-01-10
updated: 2026-01-10
audience: coding-agent
scope: poc
---

# POC Implementation Plan (CLI-first + lightweight viewer)

## Goal
Build a **CLI that Claude Code can drive via bash** plus a **read-only viewer** that updates live from disk so SMEs can rapidly author, validate, inspect, and iterate on the schema.

This PoC is explicitly optimized to test:
- Schema expressivity (incl. prepared components + join points)
- Authoring workflow (validator-driven interview loop)
- Deterministic bulk ops on structured fields
- Safe agent-assisted ops on free text

## Success signal (objective)
In an SME session, we can:
1) Create or update a build for an itemId in <10 minutes.
2) Pass deterministic validation (hard rules) and see the DAG update in the viewer within 2 seconds.
3) Execute one structured bulk update with a dry-run diff + apply + receipt.
4) Visualize both:
   - Work graph edges (`dependsOn`)
   - Flow edges (`consumes/produces`) via a toggle

## Explicit non-goals (PoC)
- No editing in the viewer.
- No multi-user/concurrency.
- No production DB; disk JSON is the DB.
- No embeddings until structured search/bulk ops work.

---

# Architecture (PoC)

## Data
- `data/line-builds/<buildId>.json` — canonical persisted builds
- `data/bom/<itemId>.json` — BOM used for H23 (POC-only)
- `data/receipts/<timestamp>-<command>.json` — audit trail for writes/bulk updates

## Execution loop
1) Claude Code generates JSON → pipes into CLI.
2) CLI validates and writes to disk.
3) Viewer polls disk via an API route and re-renders.
4) SME reviews viewer and gives corrections.

---

# TASKS (discrete, executable)

> Notes for the coding agent:
> - Use **TypeScript + tsx** for the CLI: `npx tsx scripts/lb.ts …`.
> - Keep the CLI intentionally boring and deterministic.
> - Prefer small files, but don’t introduce a new “V2” file pattern; keep locality.

## Track 0 — Repo/Project plumbing

### T0.1 — Create PoC folders
**Work**
- Create directories (if absent):
  - `scripts/`
  - `scripts/lib/`
  - `scripts/cli/`
  - `data/line-builds/`
  - `data/bom/`
  - `data/receipts/`

**Acceptance**
- Directories exist and are empty or non-destructive.

### T0.2 — Add tsx-based CLI runner dependency (minimal)
**Work**
- Decide where dependencies live:
  - Option A (preferred): root-level `package.json` for CLI + shared libs.
  - Option B: keep everything inside `apps/line-build-mvp` and run `npx tsx` from there.

**Recommendation**
- Use **Option A** to keep CLI independent from the Next app.

**Acceptance**
- `npx tsx scripts/lb.ts --help` runs.

---

## Track 1 — Canonical schema types + runtime validation

### T1.1 — Implement canonical schema types (matching docs/spec/SCHEMA-REFERENCE.md)
**Work**
- Create `scripts/lib/schema.ts` containing:
  - TypeScript types/interfaces that match `BenchTopLineBuild` + `Step` (including new fields):
    - build: `itemId`, optional legacy `menuItemId`, `requiresBuilds`, `artifacts`, `primaryOutputArtifactId`
    - step: `action.family`, `equipment`, `time`, `container`, `prepType/storageLocation`, `dependsOn`, `consumes/produces`
  - Strongly prefer keeping names aligned with the docs.

**Acceptance**
- Types compile.

### T1.2 — Add Zod schemas for runtime validation
**Work**
- In `scripts/lib/schema.ts` (or `scripts/lib/zodSchema.ts`):
  - Implement Zod schemas for the canonical JSON structure.
  - Provide `parseBuild(json): BenchTopLineBuild` that throws a structured error list.

**Acceptance**
- Passing a valid build returns typed output.
- Invalid JSON returns a readable error list including paths.

---

## Track 2 — Deterministic hard-rule validator

### T2.1 — Implement hard rules H1–H25 (and composition/flow integrity)
**Work**
- Create `scripts/lib/validate.ts` implementing:
  - `validateBuild(build, { bom? }) => { valid: boolean; hardErrors: ValidationError[] }`
  - ValidationError shape should match `docs/spec/HARD-RULES.md` (ruleId, message, stepId?, fieldPath?)
- Implement:
  - H1, H2, H3, H4, H6–H22, H24, H25
  - H23 (POC-only) if BOM present
- Implement new composition/flow integrity checks (from docs/spec/INVARIANTS.md):
  - requiresBuilds unique + no self-dependency
  - external_build consumes must be declared in requiresBuilds
  - in_build artifact refs must exist
  - (Strong) primaryOutputArtifactId set when artifacts present (report as warning or as “soft-hard” in PoC)

**Acceptance**
- Unit tests (even minimal) exist for at least:
  - H15/H22 (HEAT requirements)
  - DAG cycle detection (H9)
  - external_build declared in requiresBuilds
  - artifact ref resolution

### T2.2 — DAG cycle detection and missing dependency checks
**Work**
- Implement `dependsOn` validation:
  - H8: referenced step IDs exist
  - H9: graph is acyclic

**Acceptance**
- A known cycle returns a hard error.

---

## Track 3 — File IO + receipts

### T3.1 — Implement data-store helpers
**Work**
- Create `scripts/lib/store.ts`:
  - `readBuild(buildId)`
  - `writeBuild(build)`
  - `listBuilds()` (basic metadata)
  - `readBom(itemId)` (optional)
  - Use atomic write pattern (write temp then rename) to avoid partial reads by the viewer.

**Acceptance**
- Writes are atomic.

### T3.2 — Implement receipts
**Work**
- Add `scripts/lib/receipts.ts`:
  - `writeReceipt({ command, timestamp, inputs, outputs, touchedFiles })`

**Acceptance**
- Every `lb write` success creates a receipt file.

---

## Track 4 — CLI implementation (Claude Code tool surface)

### T4.1 — CLI skeleton + help
**Work**
- Create `scripts/lb.ts` using a small CLI library (or manual parsing). Keep it stable.
- Commands (minimum):
  - `lb read <buildId>`
  - `lb write` (stdin)
  - `lb validate <buildId>`
  - `lb list`
  - `lb search --equipment=<applianceId>`
  - `lb search --action=<ActionFamily>`

**Acceptance**
- Each command works end-to-end.

### T4.2 — Add `lb query` (structured-only selection)
**Work**
- Implement a minimal predicate language:
  - Keep it intentionally small for PoC.
  - Example: `--where 'step.action.family=HEAT AND step.equipment.applianceId=waterbath'`
- Output: list of matches with:
  - buildId, itemId, stepId, orderIndex, minimal snippet

**Acceptance**
- SME can run “find all waterbath steps” with deterministic output.

### T4.3 — Add `lb bulk-update` (structured-only patch)
**Work**
- CLI flags:
  - `--where '<predicate>'`
  - `--set '<fieldPath>=<value>'` (allow multiple)
  - `--dry-run` (default) vs `--apply`
- Behavior:
  - Dry-run prints:
    - number of builds + steps affected
    - a per-build diff summary (at least: stepId + field changes)
  - Apply:
    - writes updated builds atomically
    - writes a receipt with predicate + patch + affected IDs

**Acceptance**
- A dry-run shows intended changes without writing.
- Apply updates files + viewer reflects changes.

### T4.4 — Add `lb search-notes` (regex scan of instruction/notes)
**Work**
- Implement a deterministic scan over `step.instruction` (if introduced) and/or `step.notes`.

**Acceptance**
- Can surface candidates for “165°F” or “golden brown” patterns.

---

## Track 5 — Viewer: read-only DAG with dual layers (work + flow)

> The viewer can live in `apps/line-build-mvp` for speed, but it currently uses legacy types (`LineBuild`, `WorkUnit`, old ActionType vocab). For PoC, the viewer must switch to reading **canonical builds** from `data/line-builds` and rendering **Step**.

### T5.1 — Create viewer API routes for file-backed builds
**Work**
- In the Next app, add:
  - `GET /api/builds` → list build summaries from `data/line-builds/*.json`
  - `GET /api/builds/[buildId]` → return full build JSON
- Server reads directly from filesystem.

**Acceptance**
- Curling the endpoints returns build JSON.

### T5.2 — Polling + update loop
**Work**
- Client polls `/api/builds` every ~1–2 seconds.
- When a build’s `updatedAt` changes, the viewer refetches that build.

**Acceptance**
- Running `lb write` updates viewer within 2 seconds.

### T5.3 — DAG rendering: two edge layers with toggle
**Work**
- Update DAG visualization component to accept canonical `BenchTopLineBuild`.
- Build nodes from `build.steps`.
- Compute two edge sets:
  1) **Work edges**: from `step.dependsOn[]` (directed)
  2) **Flow edges**: from `step.produces[]` → future step(s) that `consume[]` that artifact
     - For external_build consumes, show an “external source” node (synthetic node) when flow layer enabled.
- Add UI toggles:
  - [x] Work graph
  - [x] Flow graph

**Acceptance**
- Toggling each layer shows/hides edges without reloading.

### T5.4 — Edge styling + arrowheads
**Work**
- Work edges: neutral gray.
- Flow edges: blue/green.
- Add arrowheads so direction is unmistakable.

**Acceptance**
- Users can immediately distinguish edge types.

### T5.5 — Layout
**Work**
- Implement deterministic DAG layout for work graph:
  - Use `dagre` (or ELK) for topological layout.
  - Layout based on work edges when work layer enabled; otherwise fall back to orderIndex row layout.
- Keep node positions stable across refresh when IDs unchanged.

**Acceptance**
- Graph is readable for ~30–50 steps.

### T5.6 — Node label tags + inspector panel
**Work**
- Node label shows:
  - action.family
  - target name
  - equipment + time (if present)
  - small badges for prepType/cookingPhase
- On click, open an inspector panel:
  - show all structured fields
  - show instruction/notes
  - show consumes/produces
  - show validation errors (from CLI output if saved alongside build, or recompute in viewer)

**Acceptance**
- SME can audit execution details from viewer without opening raw JSON.

---

## Track 6 — LLM-driven quality checks (optional PoC add-on)

### T6.1 — Define a “quality lint” output format
**Work**
- Create `scripts/lib/quality.ts` scaffolding:
  - placeholder interface for LLM checks
  - output saved as non-blocking warnings

**Acceptance**
- Lint can run without blocking writes.

---

# Sequencing / critical path

1) Track 1 (types + zod) → Track 2 (validator) → Track 3 (store + receipts) → Track 4 (CLI)
2) Track 5 (viewer API + polling) → DAG dual layers
3) Only then: bulk-update + receipts + SME sessions

---

# SME Session Script (how to use the PoC)

1) Start viewer.
2) Claude: draft build JSON.
3) `lb write` (iterate until valid).
4) SME: review DAG + inspector.
5) Perform one structured bulk update via `lb bulk-update`.
6) Perform one notes scan via `lb search-notes`.
7) Log outcomes + schema kinks.

---

# Deliverables
- CLI runnable via `npx tsx scripts/lb.ts …`
- Deterministic validator implementing hard rules
- File-backed viewer with dual edge layers + toggles
- Receipts for writes and bulk updates
