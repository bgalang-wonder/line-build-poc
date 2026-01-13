# Line Build CLI & Viewer (PoC)

Prototype for authoring and validating cooking line-build workflows. Two parts:
- CLI (`scripts/lb.ts`) for read/write/validate/query/builds
- Viewer (`viewer/`) for DAG visualization + validation overlay

## Quick Start
```bash
# From repo root
npm install                             # installs CLI deps in poc/line-build-cli
npx tsx poc/line-build-cli/scripts/lb.ts --help

# Viewer (Next.js)
cd poc/line-build-cli/viewer
npm install
npm run dev    # http://localhost:3000
```

## Data Layout (default)
- Builds: `data/line-builds/<buildId>.json`
- Validation outputs: `data/validation/<buildId>.latest.json`
- Receipts/audit: `data/receipts/*.json`
- Checklists/prompts: `templates/validation-checklist.md`, `templates/rule-questions.md`
- Fixtures (input examples): `data/fixtures/*.json`

Use `LINE_BUILD_POC_DATA_DIR=/abs/path/to/data` to point CLI + viewer elsewhere.

## CLI Commands (high value)
- `find [query]` / `list <itemId>` – discover builds
- `read <buildId> [--summary|--steps]` – inspect builds
- `validate <buildId>` / `validate-stdin` – run validators (H/C/S rules)
- `gaps <buildId>` / `gaps-stdin` – grouped interview gaps
- `write` – read build JSON from stdin, validate, write build + validation + receipt
- `query --where <dsl>` – DSL over whitelisted fields (`step.*`, `build.*`)
- `bulk-update --where ... --set field=value [--apply]` – dry-run by default
- `search-notes <pattern>` – regex on notes/instruction
- `view <buildId>` – request viewer to jump to build (writes selection control file)

Help: `npx tsx scripts/lb.ts --help`

## Viewer
- Auto-polls builds + validation every 1.5s
- Views: Graph (dependsOn + flow), Steps table, Rules panel
- URL params: `?buildId=...&stepId=...`
- Selection control: `npx tsx scripts/lb.ts view <buildId>` writes `data/viewer/selection.json`
- Code entry: `viewer/src/app/page.tsx`; DAG: `viewer/src/components/visualization/DAGVisualization.tsx`

## Validation & Schema
- Schema + Zod: `scripts/lib/schema.ts`
- Rules catalog: `scripts/lib/rules.ts`
- Validator impl: `scripts/lib/validate.ts`
- Tests: `scripts/lib/validate.test.ts`
- Fixtures: `data/fixtures/*.json`, run `npx tsx scripts/lb.ts validate-fixtures`

## Output Model (examples)
- Builds: `data/line-builds/*.json` (BenchTopLineBuild)
- Validation results: `data/validation/*.latest.json` (valid + errors/warnings)
- Receipts: `data/receipts/*.json` (audit of write/bulk-update/validate)

## Dev Notes (PoC)
- File-backed, atomic writes (temp + rename)
- Query/bulk-update use whitelisted fields only
- Polling-based viewer (no DB, no server state)

## Handy Paths
- CLI entry: `scripts/lb.ts`
- Query DSL: `scripts/lib/query.ts`
- Bulk update planner: `scripts/lib/bulkUpdate.ts`
- Store IO (atomic writes): `scripts/lib/store.ts`
- Viewer data paths util: `viewer/src/lib/dataPaths.ts`
