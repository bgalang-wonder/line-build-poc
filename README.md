# Line Build Redesign

A structured line build authoring system that enables automatic complexity scoring and variant management using DAG (Directed Acyclic Graph) data models and AI-assisted authoring.

---

## 📋 Current Status

**Phase:** Active Development (CLI + Viewer + Complexity Scoring)  
**Last Updated:** 2026-01-30

The system is now a functional CLI tool with:
- 46 validation rules (H1-H46, C1-C3, S6-S45)
- Complexity scoring with HDR-aware mapping
- Next.js DAG viewer with dual graph layers
- 20+ sample line builds

---

## 📁 Repository Structure

```
line-build-redesign/
├── line-build-cli/          # Main codebase (was poc/line-build-cli)
│   ├── scripts/             # CLI commands (lb.ts + commands/)
│   ├── viewer/              # Next.js DAG visualization
│   ├── data/                # Builds, fixtures, validation reports
│   ├── config/              # Stations, techniques, tools
│   └── CLAUDE.md            # Agent persona & authoring instructions
│
├── docs/
│   ├── prd/PRD-FULL-v2.md   # Product requirements (source of truth)
│   ├── spec/                # Schema, validation rules, system design
│   │   ├── SCHEMA-REFERENCE.md
│   │   ├── HARD-RULES.md
│   │   └── SOURCES.md       # Requirements traceability matrix
│   └── legacy/              # Archived PRDs and specs
│
├── archive/
│   ├── benchtop-mvp/        # Historical reference (stripped)
│   └── releases/            # Distribution zips
│
├── prompts/                 # Agent prompts and interview guides
├── meeting-notes/           # Session notes
├── transcripts/             # Stakeholder interview transcripts
├── LOG.md                   # Active decisions & receipts
└── AGENTS.md                # Beads workflow for this repo
```

---

## 🔑 Key Documents

| Document | Purpose |
|----------|---------|
| **PRD** | [`docs/prd/PRD-FULL-v2.md`](./docs/prd/PRD-FULL-v2.md) — Vision and requirements |
| **Schema** | [`docs/spec/SCHEMA-REFERENCE.md`](./docs/spec/SCHEMA-REFERENCE.md) — Data model |
| **Rules** | [`docs/SOURCES.md`](./docs/SOURCES.md) — Validation rules mapped to code |
| **Decisions** | [`LOG.md`](./LOG.md) — Architecture decisions since Dec 2025 |
| **Agent Guide** | [`line-build-cli/CLAUDE.md`](./line-build-cli/CLAUDE.md) — Authoring instructions |

---

## 🚀 Quick Start

### CLI

```bash
cd line-build-cli
npm install

# List builds
npx tsx scripts/lb.ts list

# Validate a build
npx tsx scripts/lb.ts validate baked-potato-mainstay-v1

# See all commands
npx tsx scripts/lb.ts help
```

### Viewer

```bash
cd line-build-cli/viewer
npm install
npm run dev
# Open http://localhost:3000
```

---

## 👥 Primary Stakeholders

- **Culinary Engineering:** Shin Izumi (primary stakeholder)
- **Menu Strategy:** Jenna (complexity scoring use cases)
- **OpEx:** Amy, Kevin (expected users)

---

## 📝 Notes

- **Source of truth:** Local docs (`docs/prd/`, `docs/spec/`) are authoritative. Confluence is a reference only.
- **Active work:** Check [`LOG.md`](./LOG.md) for recent decisions and current focus.
- **Requirements traceability:** [`docs/SOURCES.md`](./docs/SOURCES.md) maps what's documented vs. implemented.
- **Distribution:** Zips for colleagues go in `archive/releases/` (gitignored).

---

## Development Workflow

This project uses **beads** for issue tracking:

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

See [`AGENTS.md`](./AGENTS.md) for full workflow.
