# Repository Structure

This document describes the organization of the line-build-redesign repository.

---

## 📁 Directory Structure

```
/
├── README.md                    # Project overview + link to Confluence PRD
├── LOG.md                       # Active project log (decisions & receipts)
├── STRUCTURE.md                 # This file
│
├── docs/                        # Documentation
│   ├── PRD.md                  # Reference to Confluence PRD (source of truth)
│   ├── README.md               # Documentation index
│   ├── research/               # Research documents
│   ├── analysis/               # Analysis documents
│   ├── schema/                 # Technical schema documentation
│   └── archive/                # Superseded PRD versions and old docs
│
├── prompts/                    # Agent prompts and interview guides
├── meeting-notes/              # Meeting notes and session notes
│
├── apps/                       # Application code
│   └── benchtop-mvp/          # Authoring tool MVP
│
├── data/                       # Data files and analysis results
├── validation/                 # Validation documentation
└── comms/                      # Communication templates
```

---

## 🔑 Key Principles

1. **Confluence is the source of truth** for the PRD
2. **Local repo** contains working documents, research, and archive
3. **Clear separation** between current docs and archive
4. **Easy navigation** with README files in each directory

---

## 📋 Current PRD Location

🔗 **[Confluence PRD](https://wonder.atlassian.net/wiki/spaces/~712020735951bb19ca4030aef4f98504f0b3da/pages/4628054070/Line+Build+Redesign+Complexity+Scoring+Data+Management+PRD)**

Local reference: [`docs/PRD.md`](./docs/PRD.md)

---

## 📚 Document Locations

| Document Type | Location |
|---------------|----------|
| **Current PRD** | Confluence (see link above) |
| **PRD Reference** | `docs/PRD.md` |
| **Old PRD Versions** | `docs/archive/` |
| **Schema Docs** | `docs/schema/` |
| **Research** | `docs/research/` |
| **Analysis** | `docs/analysis/` |
| **Meeting Notes** | `meeting-notes/` |
| **Prompts** | `prompts/` |
| **Project Log** | `LOG.md` (root) |

---

## 🔄 How to Update

- **PRD changes:** Edit in Confluence
- **Schema docs:** Edit in `docs/schema/`
- **Research/Analysis:** Add to respective directories
- **Meeting notes:** Add to `meeting-notes/` with date prefix
- **Archive:** Move superseded docs to `docs/archive/`

