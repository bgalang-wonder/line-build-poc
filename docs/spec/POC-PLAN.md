# POC Plan: Claude Code + DAG Visualizer

> **Goal:** Enable agentic line build authoring via Claude Code, with a local DAG viewer for real-time visualization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE                              │
│  (Follows AI-AGENT-PROMPT.md interview loop)                    │
├─────────────────────────────────────────────────────────────────┤
│  lb read <id>      → stdout JSON                                │
│  lb write          → validate H1-H25 → block or save            │
│  lb validate <id>  → return { valid, errors[] }                 │
│  lb list           → all builds summary                         │
│  lb search         → query by equipment/action/phase            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ JSON files
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  data/line-builds/*.json   data/bom/*.json                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ file-watch (polling)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DAG VIEWER                                │
│  Vite + React • renders DAG • shows validation errors           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. CLI Tools (`scripts/cli/lb.ts`)

| Command | Description |
|---------|-------------|
| `lb read <id>` | Output build JSON to stdout |
| `lb write` | Read JSON from stdin, validate, write if valid |
| `lb validate <id>` | Return `{ valid, hardErrors[] }` |
| `lb list` | Table: id, itemId, status, stepCount |
| `lb search --equipment=<id>` | Find builds using appliance |
| `lb search --action=<family>` | Find builds with action type |

### 2. Validation Engine (`scripts/lib/validate.ts`)

Implements H1–H25 from [HARD-RULES.md](./HARD-RULES.md):
- **H1–H22:** Core schema and DAG invariants
- **H23:** BOM coverage (POC-only)
- **H24:** PORTION steps require quantity or notes
- **H25:** PREP steps require technique or notes

### 3. DAG Viewer (`apps/dag-viewer/`)

- **Stack:** Vite + React
- **Data source:** File-watch `data/line-builds/*.json`
- **Features:**
  - Rank-based DAG layout (work graph)
  - (Optional future) flow view based on consumes/produces artifacts
  - Validation error highlighting
  - Read-only (no editing)

### 4. Data Store

```
data/
├── line-builds/
│   └── <build-id>.json
└── bom/
    └── <item-id>.json
```

---

## Workflow

1. **User chats with Claude Code** describing a dish preparation.
2. **Claude Code** extracts steps, asks clarifying questions (per AI-AGENT-PROMPT.md).
3. **Claude Code** calls `lb write` with structured JSON.
4. **Validation engine** checks H1–H25. Blocks on errors, returns feedback.
5. **Claude Code** iterates until valid, then writes to `data/line-builds/`.
6. **DAG Viewer** detects file change, re-renders the DAG.

---

## Success Criteria

- [ ] `lb write` blocks invalid data with clear error messages.
- [ ] DAG Viewer updates within 2 seconds of file change.
- [ ] Agent can author a complete build in < 5 conversation turns.
- [ ] All H1–H25 rules have unit test coverage.

---

## References

- [SCHEMA-REFERENCE.md](./SCHEMA-REFERENCE.md) — Data model
- [HARD-RULES.md](./HARD-RULES.md) — Validation rules
- [AI-AGENT-PROMPT.md](./AI-AGENT-PROMPT.md) — Agent behavior
