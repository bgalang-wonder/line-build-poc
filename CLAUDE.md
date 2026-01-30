# Claude Code Agent Reference

This repository contains the **line-build-cli** — a CLI tool and DAG viewer for authoring, validating, and visualizing culinary line builds.

## Quick Start for Agents

1. **Main codebase:** `line-build-cli/`
2. **Full agent instructions:** `line-build-cli/CLAUDE.md` (94KB detailed persona)
3. **Requirements traceability:** `docs/SOURCES.md`
4. **Active decisions log:** `LOG.md` (this file's sibling)

## Key Commands

```bash
cd line-build-cli

# View all builds
npx tsx scripts/lb.ts list

# Validate a build
npx tsx scripts/lb.ts validate <buildId>

# Run the viewer
cd viewer && npm run dev
```

## Source of Truth

| What | Where |
|------|-------|
| PRD (vision) | `docs/prd/PRD-FULL-v2.md` |
| Schema | `docs/spec/SCHEMA-REFERENCE.md` + `line-build-cli/scripts/lib/schema/` |
| Validation rules | `docs/SOURCES.md` (maps rules → code) |
| Current work | `LOG.md` (decisions since Dec 2025) |

**Note:** Confluence is no longer the source of truth. Local git-tracked docs are authoritative.

## Repository Layout

```
line-build-redesign/
├── line-build-cli/          # Main codebase (CLI + viewer)
│   ├── scripts/             # CLI commands
│   ├── viewer/              # Next.js DAG visualization
│   ├── data/                # Builds, fixtures, validation
│   └── CLAUDE.md            # Full agent persona (94KB)
├── docs/
│   ├── prd/PRD-FULL-v2.md   # Product requirements
│   ├── spec/                # Schema, rules, design
│   └── SOURCES.md           # Requirements traceability
├── archive/                 # Old MVPs, releases
│   ├── benchtop-mvp/        # Historical reference
│   └── releases/            # Distribution zips
└── LOG.md                   # Decisions & receipts
```

## When This File Updates

Update this file when:
- Source of truth location changes
- Repository structure changes
- Key commands change

Do NOT duplicate content from `line-build-cli/CLAUDE.md` — this is a lightweight pointer.
