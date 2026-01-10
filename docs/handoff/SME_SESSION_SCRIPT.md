# SME Session Script — Line Build PoC (CLI + Viewer)

This script is a repeatable, end-to-end walkthrough for running the Line Build PoC:

- Create/seed builds using the **CLI**
- Validate and iterate until clean
- Review structure + validation in the **viewer** (read-only; consumes CLI output files)
- Demonstrate **bulk-update** (dry-run + apply)
- Demonstrate **search-notes**

## Prereqs

- You are in the repo root: `line-build-redesign/`
- Node + npm installed

## 0) Sanity: validate the fixture pack

Run:

```bash
npx tsx poc/line-build-cli/scripts/lb.ts validate-fixtures
```

Expected:
- `simple-linear.json` ✅
- `parallel-join.json` ✅
- `external-consume.json` ✅
- `cycle-error.json` ❌ (must include **H9** cycle)

## 1) Seed builds into the file-backed store

These commands write valid builds into `poc/line-build-cli/data/line-builds/` and generate:
- `poc/line-build-cli/data/validation/<buildId>.latest.json`
- `poc/line-build-cli/data/receipts/*.json`

Run:

```bash
npx tsx poc/line-build-cli/scripts/lb.ts write < "poc/line-build-cli/data/fixtures/simple-linear.json"
npx tsx poc/line-build-cli/scripts/lb.ts write < "poc/line-build-cli/data/fixtures/parallel-join.json"
npx tsx poc/line-build-cli/scripts/lb.ts write < "poc/line-build-cli/data/fixtures/external-consume.json"
```

Expected:
- Each command prints `wrote buildId=...` and file paths for build + validation + receipt

### Add one intentionally invalid build for viewer demo

`lb write` blocks invalid builds by design, so we copy the invalid fixture directly and then run `validate` to produce a validation output file.

Run:

```bash
cp "poc/line-build-cli/data/fixtures/cycle-error.json" "poc/line-build-cli/data/line-builds/fixture-cycle-error.json"
npx tsx poc/line-build-cli/scripts/lb.ts validate fixture-cycle-error || true
```

Expected:
- `validate` returns non-zero exit code (validation failed)
- It still writes `poc/line-build-cli/data/validation/fixture-cycle-error.latest.json`

## 2) Start the viewer (read-only)

In a second terminal:

```bash
cd apps/line-build-mvp
npm install
npm run dev
```

Open the viewer at `http://localhost:3000/viewer`.

What to observe:
- **Build list** populates from the file-backed store
- Selecting a build renders a graph
- Graph controls:
  - **Show Work Edges** (dependsOn)
  - **Show Flow Edges** (produces → consumes)
- Clicking any node opens the **Step Inspector**
- Validation:
  - Nodes with hard errors show a **red outline** + **error count**

### Viewer checks per seeded build

- **simple-linear**
  - Work edges show a simple chain
  - Clicking the HEAT step shows equipment + time in inspector

- **parallel-join**
  - Work edges show a join (a step depending on two earlier steps)
  - Flow edges show produced artifacts feeding the join step

- **external-consume**
  - With Flow Edges enabled, you should see a **synthetic external source node** (the required build) feeding the consuming step

- **cycle-error**
  - Graph shows an invalid dependency cycle
  - Inspector shows **H9** cycle error(s)

## 3) Authoring + validate loop (edit JSON files, then re-validate)

Pick a build file (example: `fixture-simple-linear`) and edit it in your editor:

File:
- `poc/line-build-cli/data/line-builds/fixture-simple-linear.json`

Suggested edit (make it invalid on purpose):
- On the HEAT step, delete `equipment`

Then run:

```bash
npx tsx poc/line-build-cli/scripts/lb.ts validate fixture-simple-linear || true
```

Expected:
- Validation output shows **H15** (HEAT requires equipment)
- Viewer updates within ~2 seconds and highlights the invalid node

Fix it:
- Restore `equipment` on that step
- Re-run `validate fixture-simple-linear`
- Viewer returns to “valid” styling

## 4) Bulk update demo (dry-run, then apply)

### Dry-run (no files written)

```bash
npx tsx poc/line-build-cli/scripts/lb.ts bulk-update --where "step.action.family = HEAT" --set step.time.durationSeconds=180
```

Expected:
- Output shows per-build diffs
- No changes written

### Apply (writes builds + receipts + validation outputs)

```bash
npx tsx poc/line-build-cli/scripts/lb.ts bulk-update --where "step.action.family = HEAT" --set step.time.durationSeconds=180 --apply
```

Expected:
- Builds are updated atomically
- Receipts are written
- Validation outputs are updated
- Viewer updates:
  - HEAT node labels reflect the new duration
  - Inspector shows updated `time.durationSeconds`

## 5) Notes/instruction search demo

Search across all builds’ `step.instruction` (fallback: `step.notes`) using regex.

Example:

```bash
npx tsx poc/line-build-cli/scripts/lb.ts search-notes golden
```

Expected:
- Match list includes the `simple-linear` HEAT instruction (mentions “golden”)

