# Repository Structure

This document describes the organization of the line-build-redesign repository.

---

## 📁 Directory Structure

```
line-build-redesign/
├── README.md                    # Project overview (start here)
├── LOG.md                       # Active project log (decisions & receipts)
├── STRUCTURE.md                 # This file
├── CLAUDE.md                    # Agent quick-reference
├── AGENTS.md                    # Beads workflow
│
├── line-build-cli/              # Main codebase (CLI + DAG viewer)
│   ├── scripts/                 # CLI commands (lb.ts, commands/)
│   ├── viewer/                  # Next.js visualization app
│   ├── data/                    # Builds, fixtures, validation reports
│   ├── config/                  # Stations, techniques, tools, HDR
│   ├── scripts/lib/             # Core logic (schema, validate, etc.)
│   ├── archive/migrations/      # Historical migration/fix scripts
│   └── CLAUDE.md                # Full agent persona (94KB)
│
├── docs/                        # Documentation (source of truth)
│   ├── prd/                     # Product Requirements
│   │   └── PRD-FULL-v2.md       # Canonical PRD
│   ├── spec/                    # Technical Specifications
│   │   ├── SCHEMA-REFERENCE.md  # Data model
│   │   ├── HARD-RULES.md        # Validation rules (H1-H41 documented)
│   │   ├── INVARIANTS.md        # Composition & strong invariants
│   │   ├── SYSTEM-DESIGN.md     # Architecture
│   │   └── SOURCES.md           # Requirements traceability
│   ├── legacy/                  # Archived PRDs and specs
│   └── handoff/                 # POC onboarding docs
│
├── archive/                     # Archives (not actively developed)
│   ├── benchtop-mvp/            # Historical MVP reference
│   └── releases/                # Distribution zips (gitignored)
│
├── prompts/                     # Agent prompts and interview guides
├── meeting-notes/               # Session notes
├── transcripts/                 # Stakeholder interview transcripts
├── data/                        # Data files and analysis results
├── validation/                  # Validation documentation
└── comms/                       # Communication templates
```

---

## 🔑 Key Principles

1. **Local docs are source of truth** — `docs/prd/` and `docs/spec/` are authoritative (not Confluence)
2. **Git-tracked requirements** — PRD changes go through git, enabling versioned review
3. **Clear separation** — Active code in `line-build-cli/`, archives in `archive/`
4. **Traceability** — `docs/SOURCES.md` maps requirements to implementation

---

## 📋 Document Locations

| Document Type | Location |
|---------------|----------|
| **Current PRD** | `docs/prd/PRD-FULL-v2.md` |
| **Schema** | `docs/spec/SCHEMA-REFERENCE.md` |
| **Validation Rules** | `docs/spec/HARD-RULES.md` + `docs/SOURCES.md` |
| **Decisions Log** | `LOG.md` |
| **Agent Instructions** | `line-build-cli/CLAUDE.md` |
| **Meeting Notes** | `meeting-notes/` |
| **Transcripts** | `transcripts/` |
| **Prompts** | `prompts/` |

---

## 🔄 How to Update

- **PRD changes:** Edit `docs/prd/PRD-FULL-v2.md`, commit with rationale
- **Schema docs:** Edit `docs/spec/`, update `docs/SOURCES.md` if rules change
- **Decisions:** Add to `LOG.md` with date and reasoning
- **Meeting notes:** Add to `meeting-notes/` with date prefix
- **Archive:** Move superseded docs to `docs/legacy/`

---

## Terminology

| Term | Meaning |
|------|---------|
| **Line Build** | DAG of steps representing a cooking workflow |
| **Assembly** | Material flowing through steps (was "Component") |
| **Step** | Individual action with action.family, station, equipment |
| **Validation Rule** | H* = Hard (blocking), C* = Composition, S* = Soft warning |
| **HDR** | High-Density Restaurant (kitchen configuration) |

---

## Navigation

- **New to the project?** Start with `README.md`
- **Authoring builds?** See `line-build-cli/CLAUDE.md`
- **Understanding requirements?** Read `docs/prd/PRD-FULL-v2.md`
- **Tracing implementation?** Check `docs/SOURCES.md`
- **Recent changes?** Review `LOG.md`
