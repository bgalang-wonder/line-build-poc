# Documentation

This directory contains project documentation for the Line Build Authoring System.

---

## 🚀 POC Quick Start (Reading Order)

New to this POC? Read these in order:

| # | Document | Purpose |
|---|----------|---------|
| 1 | [POC-PLAN.md](./spec/POC-PLAN.md) | **Start here.** Overview of the Claude Code + DAG Viewer POC. |
| 2 | [SCHEMA-REFERENCE.md](./spec/SCHEMA-REFERENCE.md) | Canonical data model (BenchTopLineBuild, Step, enums). |
| 3 | [HARD-RULES.md](./spec/HARD-RULES.md) | Validation invariants (H1–H25) that block invalid data. |
| 4 | [AI-AGENT-PROMPT.md](./spec/AI-AGENT-PROMPT.md) | Agent interview playbook and heuristics. |
| 5 | [PRD-FULL.md](./prd/PRD-FULL.md) | Full product requirements and business context. |

---

## 📁 Directory Structure

```
docs/
├── spec/           # ★ CANONICAL SOURCE OF TRUTH ★
│   ├── POC-PLAN.md
│   ├── SCHEMA-REFERENCE.md
│   ├── HARD-RULES.md
│   ├── AI-AGENT-PROMPT.md
│   └── INVARIANTS.md
│
├── prd/            # Product Requirements
│   ├── PRD-FULL.md
│   └── PRD-BUSINESS.md
│
├── research/       # Dec 2025 Discovery (immutable)
│
├── handoff/        # POC-specific onboarding
│   ├── QUICK-START.md
│   ├── REACT-APP-POC.md
│   └── CHAT-MVP.md
│
├── legacy/         # Superseded files (read-only)
│   ├── schema/     # Old TypeScript types
│   └── prd/        # Old PRD drafts
│
└── requests/       # Data requests / open questions
```

---

## 📝 Key Principles

- **`spec/` is the source of truth.** All other docs reference it.
- **`research/` is immutable.** Dec 2025 findings are preserved as-is.
- **`legacy/` is read-only.** Historical reference only.
