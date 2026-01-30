# Plan: Improve line-build-cli primitives for agentic authoring

This plan is written to enable another agent to implement CLI changes that support an interview-driven authoring workflow (CSV/notes → draft → validate early → ask questions in batches → patch efficiently → write once).

## North Star
Enable an agent to:
1) ingest messy inputs (CSV/notes),
2) iteratively validate drafts **without writing**,
3) generate a compact “interview agenda” of gaps,
4) patch many fields via one or two CLI calls,
5) only persist the build once it passes validation.

## Guiding principles (optimize for agent context windows)
1. **Small outputs by default**: Prefer summaries/tables/gap lists over full build JSON.
2. **Batchable operations**: Return *all* missing fields/issues grouped sensibly (rule → step) in one call.
3. **Draft-safe loop**: Support validating a candidate draft without persisting anything.
4. **Editing ergonomics**: Let the agent patch common authoring fields in bulk (no rewriting large JSON blobs).
5. **Determinism**: Stable ordering and predictable output so agents can compare across runs.

---

# Phase 0 — Baseline inventory (read-only)

## Task 0.1 — Inventory current command surface + payload sizes
**Files**
- `poc/line-build-cli/scripts/lb.ts` (command surface)
- `poc/line-build-cli/scripts/lib/query.ts`, `bulkUpdate.ts`, `searchNotes.ts` (batch primitives)
- `poc/line-build-cli/scripts/lib/validate.ts` (validation execution)
- `poc/line-build-cli/scripts/lib/schema.ts` (strict schema)

**Deliverable**
- Short note (PR description or implementation notes) listing:
  - Which commands dump full builds (large) vs summaries/snippets (small)
  - Which fields bulk-update can patch today
  - What the current “draft loop” requires (currently: write-or-nothing)

**Success criteria**
- Clear statement of current gaps: no validate-draft-without-writing; `read` is large; bulk-update whitelist is narrow.

Stop when you can confidently proceed.

---

# Phase 1 — Add highest leverage primitive: `validate-stdin` (draft-safe loop)

## Why
Today:
- `write` validates and writes only if valid
- `validate <buildId>` validates an on-disk build

Missing:
- “Validate this candidate draft JSON (possibly invalid) **without** persisting it.”

## Task 1.1 — Implement `validate-stdin`
**File**
- `poc/line-build-cli/scripts/lb.ts`

**Behavior**
- Read JSON from stdin
- Parse via `parseBuild`
- Validate via existing `validateBuildWithOptionalBom` helper
- Output validation result
- **Do not write build JSON**
- **Do not write validation output file** (keep pure/draft-safe)

**CLI signature**
- `validate-stdin` (no args)
- supports `--json`

**Output contract**
- Human: `valid=true|false` + hardErrors/warnings list
- JSON:
```json
{
  "ok": true,
  "valid": false,
  "bomFound": true,
  "validation": {
    "valid": false,
    "hardErrors": [],
    "warnings": [],
    "metrics": {}
  }
}
```

**Edge cases**
- invalid stdin JSON → exit code 2
- schema parse error (`BuildParseError`) → exit code 2; return issues in `--json`
- missing BOM file → `bomFound=false`, proceed

**Implementation notes**
- Reuse stdin + error handling patterns from `cmdWrite` to keep behavior identical.

**Acceptance tests**
- `cat data/line-builds/baked-potato-mainstay-v1.json | npx tsx scripts/lb.ts validate-stdin` → exit 0
- Pipe a deliberately broken draft (missing HEAT equipment) → includes H15, exit 2
- `--json` output is machine-readable

Stop once command works for valid + invalid + parse-failure.

---

# Phase 2 — Add “small read” primitives: summary/table outputs

## Why
`read <buildId>` prints full JSON, which is expensive for large builds. Agents usually need compact step tables.

## Task 2.1 — Extend `read` with `--summary` and `--steps`
**File**
- `poc/line-build-cli/scripts/lb.ts`

**CLI signatures**
- `read <buildId> --summary`
- `read <buildId> --steps`
- default `read <buildId>` remains full JSON

**Output content**
1) `--summary`
- build header: buildId, itemId, version, status, name, stepCount
- optionally first/last step labels

2) `--steps`
- compact per-step rows (human) or array (json)
- each row includes: orderIndex, stepId, family, stationId, toolId, equipment.applianceId, time.durationSeconds, time.isActive, and a short label (reuse `buildMatchLabel(step)`)

**JSON shape for `--steps`**
```json
{
  "ok": true,
  "buildId": "...",
  "steps": [
    {
      "orderIndex": 0,
      "stepId": "step-1",
      "family": "PREP",
      "stationId": "hot_side",
      "toolId": "hand",
      "applianceId": null,
      "durationSeconds": null,
      "isActive": null,
      "label": "Place Baked Potato..."
    }
  ]
}
```

**Determinism**
- Sort steps in a stable way (orderIndex, trackId, id) independent of file ordering.

**Acceptance tests**
- `read --summary` does not dump full build
- `read --steps --json` is small and stable

Stop once flags work; legacy read unchanged.

---

# Phase 3 — Expand bulk-update to cover interview-filled fields

## Why
Interview capture often sets: tool, active/passive, units, quantities, container name/size, instruction, notes. If bulk-update can’t patch these, agents will rewrite big JSON.

## Task 3.1 — Expand query whitelist
**File**
- `poc/line-build-cli/scripts/lib/query.ts` (`QUERY_FIELD_WHITELIST`)

**Add fields (proposal)**
Step-level:
- `step.toolId`
- `step.time.isActive`
- `step.quantity.value`
- `step.quantity.unit`
- `step.container.name`
- `step.container.size`
- `step.notes`
- `step.instruction`

Build-level (optional later)
- `build.name`

**Notes**
- Avoid array fields (dependsOn, consumes, produces) in PoC bulk-update unless you add array ops.

## Task 3.2 — Implement setters/getters for new fields
**File**
- `poc/line-build-cli/scripts/lib/bulkUpdate.ts`

**Work**
- Update `getSnapshot()` to read new fields.
- Update `setValue()` to write them with type checks.

**Type rules**
- `step.time.isActive` boolean
- `step.quantity.value` number (H10 will enforce >0)
- `step.quantity.unit` string
- Create missing objects when setting subfields (`time`, `quantity`, `container`)

**Acceptance tests**
- Dry-run: `bulk-update --where "step.action.family = HEAT" --set step.time.isActive=false`
- Apply: same with `--apply` + confirm validation success
- Verify with `read --steps --json`

Stop once these fields can be bulk-patched reliably.

---

# Phase 4 — Add “gap agenda” primitive: validation grouped for interview

## Why
Validation output exists, and templates exist, but nothing returns a compact, grouped list of “what to ask next.” Agents currently have to map errors → question batches manually.

## Task 4.1 — Add `gaps` command
**Files**
- `poc/line-build-cli/scripts/lb.ts`
- (Optional) helper module in `scripts/lib/` if needed; keep file count low

**CLI signature**
- `gaps <buildId>`
- optional: `gaps-stdin` (stdin variant, draft-safe)

**Behavior**
- Load build (or stdin)
- Validate (with optional BOM)
- If valid: `gaps=[]`
- If invalid: group issues

**Grouping logic**
- group by `ruleId`
- include per-step: stepId, orderIndex, label (`buildMatchLabel`), fieldPaths involved

**JSON output shape**
```json
{
  "ok": true,
  "buildId": "...",
  "valid": false,
  "bomFound": false,
  "gaps": [
    {
      "ruleId": "H15",
      "scope": "Step",
      "appliesTo": "HEAT steps",
      "message": "HEAT step requires equipment",
      "steps": [
        {
          "stepId": "step-2",
          "orderIndex": 1,
          "label": "Cook potato in Waterbath",
          "fieldPaths": ["equipment"]
        }
      ]
    }
  ]
}
```

**Notes**
- Do not generate AskUserQuestion payloads inside CLI (keep CLI decoupled from UI schema). Return a compact agenda the agent can map to templates.

**Acceptance tests**
- Valid build → empty gaps
- Broken draft → gaps contains expected rule IDs and step metadata

Stop once outputs are stable and useful.

---

# Phase 5 — (Optional) Ingestion/scaffolding primitives for CSV/notes

This is optional but high leverage if you want the CLI itself to help with CSV paste workflows.

## Task 5.1 (Optional) — `init-build`
- Output minimal build header skeleton to stdout (required fields: id, itemId, version, status, createdAt, updatedAt, steps=[])
- Optional `--write` if you want persistence.

## Task 5.2 (Optional) — `ingest-csv`
- stdin CSV → draft build skeleton
- Very constrained column mapping; no “kitchen understanding,” just mapping
- Use `notes` placeholders for missing info
- Pair with `validate-stdin`/`gaps-stdin` to drive interview

Stop if scope expands beyond PoC.

---

# Phase 6 — Documentation + template alignment

## Task 6.1 — Update agent instructions
**File**
- `poc/line-build-cli/CLAUDE.md`

**Update**
- Recommend loop:
  1) draft skeleton
  2) `validate-stdin` / `gaps-stdin`
  3) AskUserQuestion batches
  4) bulk-update patches
  5) repeat until valid
  6) `write` once

- Document new `read --steps/--summary` usage to avoid full JSON dumps.

## Task 6.2 — Fix template drift
**File**
- `poc/line-build-cli/templates/rule-questions.md`

**Fix**
- Remove invalid `box` container option (schema ContainerType does not include it). Use `other` and store “box” in `container.name`.

## Task 6.3 — Update CLI help text
**File**
- `poc/line-build-cli/scripts/lb.ts` `printHelp()`

Add new commands/flags: `validate-stdin`, `gaps`, `read --summary`, `read --steps`.

Stop once docs and help reflect actual surface.

---

# Phase 7 — Quality gates: fixtures for interview failure modes

You already have `validate-fixtures` (see `scripts/lib/fixtures.ts`). Extend fixtures to cover “common incomplete interview drafts.”

## Task 7.1 — Add fixtures + expectations
**Files**
- `poc/line-build-cli/data/fixtures/*.json`
- `poc/line-build-cli/scripts/lib/fixtures.ts` EXPECTATIONS

**Add fixtures**
- missing HEAT equipment → must include H15
- missing HEAT time and notes → H22
- PORTION missing quantity and notes → H24
- PREP missing techniqueId and notes → H25
- quantity.value = 0 → H10
- container-like `target.name` without `container`/packaging target → H4

**Acceptance test**
- `npx tsx scripts/lb.ts validate-fixtures` passes

Stop once fixture suite covers common authoring failures.

---

# Recommended execution order (min risk, max incremental value)
1) Phase 1: `validate-stdin`
2) Phase 2: `read --summary` + `read --steps`
3) Phase 3: expand bulk-update whitelist + setters
4) Phase 4: `gaps` (and optionally `gaps-stdin`)
5) Phase 6: docs/templates/help alignment
6) Phase 7: fixtures for common gaps
7) Phase 5 optional: init-build / ingest-csv

---

# System-level definition of done
An agent can complete a CSV/notes authoring session with minimal tool calls:
1) Create draft skeleton (manual or ingest)
2) `validate-stdin` or `gaps-stdin` once → compact interview agenda
3) Ask user batched questions (UI tool)
4) One `bulk-update` dry-run + apply (or regenerate draft)
5) `validate-stdin` passes
6) `write` once to persist build + receipts

And:
- Agents can avoid full-build reads by using `read --steps`.
- Bulk updates can patch tool/time/quantity/container/instruction/notes without rewriting entire JSON.
