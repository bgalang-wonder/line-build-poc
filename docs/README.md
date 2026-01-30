# Documentation

This directory contains project documentation for the Line Build Authoring System.

---

## Current Focus: CLI + DAG Viewer POC

The active MVP is in `poc/line-build-cli/`:
- **CLI** (`scripts/lb.ts`) - Command-line tool for querying/editing line builds
- **DAG Viewer** (`viewer/`) - Next.js app for visualizing builds as dependency graphs

---

## Reading Order

| # | Document | Purpose |
|---|----------|---------|
| 1 | [PRD-FULL-v2.md](./prd/PRD-FULL-v2.md) | **Canonical PRD** - Business context and requirements |
| 2 | [SCHEMA-REFERENCE.md](./spec/SCHEMA-REFERENCE.md) | Canonical data model (BenchTopLineBuild, Step, enums) |
| 3 | [HARD-RULES.md](./spec/HARD-RULES.md) | Validation invariants (H1–H28) |
| 4 | [TIME-RESOLUTION.md](./spec/TIME-RESOLUTION.md) | Duration inheritance hierarchy |
| 5 | [SYSTEM-DESIGN.md](./spec/SYSTEM-DESIGN.md) | Architecture and component design |

### Additional Specs

| Document | Status | Purpose |
|----------|--------|---------|
| [INVARIANTS.md](./spec/INVARIANTS.md) | Canonical | Detailed rule definitions |
| [AI-AGENT-PROMPT.md](./spec/AI-AGENT-PROMPT.md) | Canonical | Agent interview playbook |
| [BULK-OPERATIONS.md](./spec/BULK-OPERATIONS.md) | Canonical | Bulk edit patterns |
| [POC-PLAN.md](./spec/POC-PLAN.md) | Reference | Original POC planning |
| [SCHEMA-REDESIGN-PROPOSAL.md](./spec/SCHEMA-REDESIGN-PROPOSAL.md) | Proposal | Schema evolution ideas |
| [SCHEMA-MIGRATION-PLAN.md](./spec/SCHEMA-MIGRATION-PLAN.md) | Proposal | Migration strategy |

---

## Directory Structure

```
docs/
├── spec/               # ★ CANONICAL SOURCE OF TRUTH ★
│   ├── SCHEMA-REFERENCE.md    # Data model
│   ├── HARD-RULES.md          # Validation rules
│   ├── INVARIANTS.md          # Rule details
│   ├── TIME-RESOLUTION.md     # Duration hierarchy
│   ├── SYSTEM-DESIGN.md       # Architecture
│   ├── AI-AGENT-PROMPT.md     # Agent playbook
│   ├── BULK-OPERATIONS.md     # Bulk patterns
│   ├── POC-PLAN.md            # POC planning
│   └── SCHEMA-*.md            # Proposals (not yet canonical)
│
├── prd/                # Product Requirements
│   ├── PRD-FULL-v2.md         # ★ CANONICAL PRD ★
│   └── PRD-BUSINESS.md        # Business context summary
│
├── research/           # Dec 2025 Discovery (immutable)
│   ├── research-discovery-overview.md
│   ├── research-existing-initiatives.md
│   └── research-pain-points-constraints.md
│
├── handoff/            # POC onboarding docs
│   ├── QUICK-START.md
│   ├── SME_SESSION_SCRIPT.md
│   └── ...
│
├── legacy/             # Archived (read-only reference)
│   ├── prd/            # Old PRD versions
│   ├── schema/         # Old TypeScript types
│   └── analysis/       # Dec 2025 analysis
│
└── requests/           # Data requests / open questions
```

---

## Project Code Structure

```
poc/
└── line-build-cli/     # ★ ACTIVE MVP ★
    ├── scripts/        # CLI (lb.ts)
    ├── viewer/         # DAG Viewer (Next.js)
    └── data/           # Fixtures & line builds

apps/
├── archive-copilotkit-mvp/   # Archived: CopilotKit approach
└── archive-benchtop-mvp/     # Archived: Initial scaffold
```

---

## Key Principles

- **`spec/` is the source of truth.** All other docs reference it.
- **`research/` is immutable.** Dec 2025 findings preserved as-is.
- **`legacy/` is read-only.** Historical reference only.
- **PRD-FULL-v2.md is canonical** but may need updates as we iterate.