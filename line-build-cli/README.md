# Line Build CLI & Viewer POC: AI-Assisted Culinary Operations

This Proof of Concept (POC) demonstrates a high-leverage workflow for authoring, validating, and visualizing culinary "line builds" (pre-service and service preparation workflows).

It combines **AI reasoning**, **deterministic CLI validation**, and **live DAG visualization** to turn loose culinary descriptions into actionable, valid workflow graphs.

---

## What is a Line Build?

A **Line Build** is a standardized cooking workflow represented as a Directed Acyclic Graph (DAG) of steps. It defines:

- **What** actions to perform (PREP, HEAT, ASSEMBLE, PORTION, etc.)
- **Where** each action happens (station, sublocation)
- **With what** tools and equipment
- **In what order** via explicit dependencies
- **How materials flow** through input/output components

**Purpose:** Standardize preparation instructions across restaurant locations so that any cook can produce consistent results by following the workflow.

---

## Interaction Model: Claude Code + CLI + Viewer

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           INTERACTION LOOP                                │
└──────────────────────────────────────────────────────────────────────────┘

  User (semantic language)
       │
       │ "Make me a line build for cheese fries"
       ▼
  ┌─────────────────┐
  │  Claude Code    │  Interprets intent, asks clarifying questions
  │  (Interviewer)  │  Uses CLAUDE.md persona + templates
  └────────┬────────┘
           │
           │ lb write, lb validate, lb edit
           ▼
  ┌─────────────────┐
  │   CLI Engine    │  parseBuild → normalizeBuild → validateBuild
  │   (lb.ts)       │  Deterministic validation (37+ rules)
  └────────┬────────┘
           │
           │ Writes to data/line-builds/
           ▼
  ┌─────────────────┐
  │   DAG Viewer    │  Polls data/ every 1.5s
  │ (localhost:3000)│  Visual feedback on structure + errors
  └────────┬────────┘
           │
           │ User sees graph, identifies issues
           ▼
  User reviews, provides feedback
           │
           └──────────────────────────────────────┐
                                                  │
                                (iterate until valid)
```

### Feedback Loop Stages

1. **Draft** → User describes recipe, Claude creates initial JSON
2. **Validate** → CLI runs rules, surfaces errors
3. **Fix** → Claude or user fixes issues incrementally
4. **Enrich** → Add equipment, times, tools, phases
5. **Publish** → When valid: 0 hard errors

---

### 1. The Interviewer (Claude Code)
Claude Code acts as a **culinary operations interviewer**. Driven by the instructions in `CLAUDE.md`, it:
- **Validates early**: Catches schema and kitchen logic violations *before* writing JSON.
- **Analyzes structure**: Identifies flow issues, dependencies, and parallel tracks *before* generation.
- **Enrich thoroughly**: Ensures every step has a station, phase, tool, and proper structure.
- **Uses templates**: Deterministically works through `templates/validation-checklist.md` for every build.

---

## Agent Intelligence: `CLAUDE.md`

The "brain" of the agent is `CLAUDE.md`. It defines the **"Culinary Operations Interviewer"** persona, shifting the AI from a simple code generator to a proactive workflow architect.

### Proactive Validation & Enrichment
`CLAUDE.md` prompts the agent to:
1.  **Never Guess**: If information is missing (equipment, units, times), the agent MUST ask.
2.  **Two-Phase Validation**: 
    - **Phase 1: Structural**: Checks the "big picture" (flow, dependencies, starts/ends).
    - **Phase 2: Schema**: Checks per-step details (required fields, enum values).
3.  **Checklist-Driven Workflow**: The agent creates and maintains a per-build checklist in `data/checklists/` to track validation progress.

### "Dependencies ARE the Instruction"
`CLAUDE.md` enforces a strict philosophy: **A line build without dependencies is just a list, not an instruction.**
-   **Graph Connectivity (Rule H26)**: The agent aims for >75% of steps with `dependsOn` links (soft warning if lower).
-   **Parallel Track Detection**: The agent identifies independent work streams and proactively asks how they coordinate or merge at expo.
-   **Entry Point Heuristic**: The agent flags builds with too many starting points, ensuring that only legitimate retrievals or independent prep steps lack dependencies.

---

## Getting Started (Agent-First)

The most effective way to use this POC is to let **Claude Code** handle the orchestration.

1.  **Open Claude Code** from the repository root.
2.  **Initialize**: Ask Claude to get things running:
    > "Initialize the viewer and show me the health of existing builds."
3.  **Author**: Provide a description or CSV:
    > "Author a new build for a Baked Potato from this CSV..."
4.  **Visualize**: Claude will automatically validate your input and open the viewer to show you the result.

---

## The Three-Pillar Architecture

### 1. The Interviewer (Claude Code)
(See above)

### 2. The Engine (CLI)
A TypeScript CLI (`scripts/lb.ts`) provides the "source of truth" for validation and data management:
- **Strict Validation**: Enforces rules (H1-H42) covering schema, flow, and kitchen logic.
- **Data Store**: Manages file-backed JSON builds, validation reports, and audit receipts.
- **Control Interface**: Allows Claude to "jump" the viewer to specific builds or steps via the `view` command.

### 3. The Viewer (Next.js)
A live-polling React application (`viewer/`) that visualizes the build as a Directed Acyclic Graph (DAG):
- **Live Updates**: Automatically reflects changes made by Claude or the CLI within 1.5 seconds.
- **Validation Overlay**: Highlights steps with errors or warnings directly on the graph.
- **Interactive Inspection**: Allows deep-diving into step details, dependencies, and rule violations.

---

## Core Workflows

### The "Interview" Workflow
1. **Input**: User provides a CSV, a rough description, or a recipe.
2. **Analysis**: Claude parses the input and runs `validate-stdin` to identify "gaps" (missing fields or logic errors).
3. **Clarification**: Claude uses the `AskUserQuestion` tool to batch-interview the user about equipment, units, and track coordination.
4. **Generation**: Once all gaps are resolved, Claude writes the build using the CLI.
5. **Visualization**: The CLI automatically triggers the viewer to jump to the new build.

### The "Structural Validation" Workflow
The system doesn't just check fields; it checks the **Graph**:
- **Entry Points**: Flags if >25% of steps lack dependencies (ensures a connected workflow).
- **Parallel Tracks**: Identifies independent work streams (e.g., a "salsa track" vs a "main track") and asks how they merge.
- **Station Flow**: Detects unusual transitions (e.g., moving from a hot side to a cold side without a transfer step).

---

## Quick Start

### 1. Setup
```bash
# Install root dependencies (CLI)
npm install

# Setup Viewer
cd viewer
npm install
```

### 2. Run the Viewer
```bash
cd viewer
npm run dev
# Open http://localhost:3000
```

### 3. Interact via Claude Code
Simply open Claude Code in the repository root and ask it to get started:
- "Initialize the viewer and show me the health of existing builds"
- "Find all builds for item X"
- "Author a new build for a Baked Potato from this CSV..."
- "Show me the health of the Beef Barbacoa build"

---

## Schema Overview

The data model centers on **BenchTopLineBuild** containing **Steps** that process **Components**.

### BenchTopLineBuild (Top-Level Container)

```typescript
{
  id: "build-123",           // Unique build ID
  itemId: "80123456",        // Menu item this build is for
  version: 1,                // Build version
  status: "draft",           // draft | published | archived
  steps: [...],              // Array of Step objects
  components: [...],         // Materials that flow through steps
  bom: [...],                // Bill of Materials entries
  customizationGroups: [...], // Optional customizations
  createdAt, updatedAt       // Timestamps
}
```

### Step (Individual Action)

```typescript
{
  id: "step-1",
  orderIndex: 0,              // Position in workflow
  action: {
    family: "HEAT",           // PREP | HEAT | TRANSFER | ASSEMBLE | PORTION | PACKAGING | ...
    techniqueId: "fry"        // Specific technique from vocabulary
  },
  stationId: "fryer",         // Where this happens
  equipment: { applianceId: "fryer" },
  time: { durationSeconds: 180, isActive: true },
  toolId: "fry_basket",
  dependsOn: ["step-0"],      // What must complete first
  input: [...],               // Components consumed
  output: [...],              // Components produced
  from: { stationId, sublocation },  // Where inputs come from
  to: { stationId, sublocation }     // Where outputs go
}
```

### Component (Material in the Build)

```typescript
{
  id: "cheese-fries-v1",
  name: "Cheese Fries Assembly",
  type: "intermediate",       // intermediate | final | bom_usage
  lineage: {
    evolvesFrom: "fries-v1"   // For 1:1 transformations
  }
}
```

### Key Fields Explained

| Field | Purpose |
|-------|---------|
| `action.family` | Categorizes the action (HEAT requires equipment, PORTION requires quantity) |
| `stationId` | Kitchen location (fryer, garnish, expo, etc.) |
| `dependsOn` | Creates the DAG structure (what must finish before this starts) |
| `input/output` | Material flow (what components are consumed/produced) |
| `from/to` | Location flow (where materials move between steps) |

---

## Authoring Contract (PoC)

These are the **minimum required inputs** for agents to author. Everything else can be derived.

- **Always author `output[]`** for every step (at least 1 output per step).
- **Author `input[]`** when the step consumes a prior assembly (material flow).  
- **Always author `from` + `to`** on the step with a **sublocation**.
- **Always author `input[].from` + `output[].to`** with a **sublocation**.
- **`stationId` is optional** unless the location is ambiguous (e.g., work_surface could be garnish or speed_line).  
  When ambiguous, **stationId is required**.
- **Never author TRANSFER steps** — transfers are derived from `output[].to` → `input[].from`.

Example (minimal, explicit flow):

```typescript
{
  id: "step-5",
  action: { family: "PREP", techniqueId: "open_pack" },
  stationId: "garnish", // optional if unambiguous
  from: { stationId: "garnish", sublocation: { type: "work_surface" } },
  to: { stationId: "garnish", sublocation: { type: "work_surface" } },
  input: [
    {
      source: { type: "in_build", assemblyId: "potato_cooked" },
      from: { stationId: "garnish", sublocation: { type: "work_surface" } }
    }
  ],
  output: [
    {
      source: { type: "in_build", assemblyId: "potato_opened" },
      to: { stationId: "garnish", sublocation: { type: "work_surface" } }
    }
  ]
}
```

## Key Concepts

### Dependencies Form the DAG

Steps link via `dependsOn` to form a Directed Acyclic Graph:

```
step-1 (retrieve fries) ─────────────┐
                                     ▼
step-2 (retrieve bowl) ──────────► step-3 (fry) ──► step-4 (portion) ──► step-5 (pass)
```

**Rule H26**: >75% of steps should have `dependsOn` (soft warning; entry points can be parallel starts).

### Material Flow

Components track how materials move through the build:

```
fries_raw (from cold storage)
    │
    ▼ step-1 (retrieve)
fries_raw (at fryer)
    │
    ▼ step-3 (fry)
fries_cooked (at fryer)
    │
    ▼ step-4 (portion)
fries_portioned (at garnish)
```

**Rule H29**: Merge steps (2+ inputs) require `role: "base"` on one input.

### Validation Rules

| Prefix | Severity | Example |
|--------|----------|---------|
| **H*** | Hard (blocks publish) | H15: HEAT requires equipment |
| **C*** | Composition | C3: Component refs must resolve |
| **S*** | Soft/Strong (warning) | S16: Station bouncing detected |

Run `lb rules` to see the full catalog.

---

## Technical Reference

### CLI Commands
- `lb list [--query <q>] [--item <itemId>]`: Discover builds.
- `lb get <buildId> [--format full|summary|steps|gaps]`: Read builds in various views.
- `lb write`: Create/replace a build from stdin (validates first).
- `lb edit <buildId> --op <json>`: Incremental structural or field edits.
- `lb validate <buildId> [--gaps]`: Run validation and write report.
- `lb search [--where <dsl>] [--notes <regex>]`: Find steps or notes.
- `lb rules [ruleId]`: Reference the validation rule catalog.
- `lb techniques [--family <ActionFamily>]`: List valid techniqueIds (by action family).
- `lb view <buildId>`: Jump the viewer to a specific build.

### Data Layout
- `data/line-builds/`: Source JSON for builds.
- `data/validation/`: Latest validation reports.
- `data/receipts/`: Audit trail of all write operations.
- `data/checklists/`: Per-build progress tracking.
- `scripts/lib/rules.ts`: The "Golden Rules" (H1-H42).

### Rules Highlight
- **H15/H22**: HEAT steps require equipment and time (active/passive).
- **H16**: PACKAGING steps require a container or packaging target.
- **H26**: Graph Connectivity (soft warning).
- **H32**: Sublocation must be valid for the station (config-driven).
- **H33**: TechniqueId must be in controlled vocabulary and match action family.
- **C1-C3**: Culinary logic (e.g., HEAT should happen before ASSEMBLE).

---

## Codebase Structure

```
poc/line-build-cli/
├── scripts/
│   ├── lb.ts                    # CLI entry point (thin dispatcher)
│   ├── commands/                # Modular command handlers
│   │   ├── list.ts              # `lb list` - discover builds
│   │   ├── get.ts               # `lb get` - read build details
│   │   ├── write.ts             # `lb write` - create/replace builds
│   │   ├── edit.ts              # `lb edit` - incremental edits
│   │   ├── validate.ts          # `lb validate` - run validation
│   │   ├── search.ts            # `lb search` - find steps/notes
│   │   ├── view.ts              # `lb view` - control viewer selection
│   │   ├── rules.ts             # `lb rules` - show validation rules
│   │   └── techniques.ts        # `lb techniques` - technique vocabulary
│   └── lib/
│       ├── schema/              # Modular data model
│       │   ├── index.ts         # Re-exports + parseBuild()
│       │   ├── enums.ts         # ActionFamily, StationId, etc.
│       │   ├── step.ts          # Step schema + related types
│       │   ├── component.ts     # Component, ComponentRef, sources
│       │   └── build.ts         # BenchTopLineBuild + overlays
│       ├── validate/            # Modular validation engine
│       │   ├── index.ts         # validateBuild() orchestration
│       │   ├── helpers.ts       # Shared utilities
│       │   ├── hard-rules.ts    # H1-H18 (core structural)
│       │   ├── hard-rules-advanced.ts  # H19-H37 (station, transfer)
│       │   ├── composition-rules.ts    # C1-C3 (build composition)
│       │   └── soft-rules.ts    # S6-S19 (warnings)
│       ├── schema.ts            # Re-export from schema/
│       ├── validate.ts          # Re-export from validate/
│       ├── store.ts             # File-based build storage
│       ├── normalize.ts         # Write-time normalization
│       ├── rules.ts             # Rule catalog definitions
│       ├── query.ts             # Query DSL for search
│       ├── edit.ts              # Edit operation handlers
│       └── fixtures.ts          # Test fixture utilities
├── config/
│   ├── stations.config.ts       # Station definitions & sublocations
│   ├── tools.config.ts          # Tool categories
│   ├── techniques.config.ts     # Technique vocabulary
│   ├── validation.config.ts     # Validation thresholds
│   └── index.ts                 # Config re-exports
├── data/
│   ├── line-builds/             # Build JSON files
│   ├── validation/              # Validation reports
│   ├── receipts/                # Audit trail
│   ├── checklists/              # Progress tracking
│   └── fixtures/                # Test fixtures
├── templates/
│   ├── validation-checklist.md  # Agent checklist template
│   └── rule-questions.md        # SME interview questions
├── viewer/                      # Next.js visualization app
│   └── (see viewer/README.md)
├── CLAUDE.md                    # Agent persona & instructions
├── ARCHITECTURE.md              # Code map & module relationships
└── README.md                    # This file
```

> **For detailed module relationships and adding new rules/fields, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

### Architecture Overview

```
┌─────────────────┐     CLI Commands      ┌─────────────────┐
│   Claude Code   │ ─────────────────────▶│    lb.ts        │
│   (Interviewer) │                       │   (Dispatcher)  │
└─────────────────┘                       └────────┬────────┘
        │                                          │
        │ Validates & Writes                       ▼
        │                                 ┌─────────────────┐
        │                                 │   commands/*    │
        │                                 │  (Modular CLI)  │
        │                                 └────────┬────────┘
        │                                          │
        ▼                                          ▼
┌─────────────────┐                       ┌─────────────────┐
│   data/*.json   │◀──────────────────────│     lib/*       │
│  (File Store)   │                       │ (Core Logic)    │
└────────┬────────┘                       └─────────────────┘
         │
         │ Polls (1.5s)
         ▼
┌─────────────────┐
│     Viewer      │
│   (Next.js)     │
└─────────────────┘
```

---

## Configuration System

Domain constraints are externalized into `config/` files, enabling:
1. **Single source of truth** — No duplication between types and Zod schemas
2. **Per-restaurant overrides** — Future support for derived configs
3. **Validation warnings** — Detect incompatible combinations

### Config Files

| File | Purpose |
|------|---------|
| `stations.config.ts` | 11 stations with sublocation mappings and "side" (hot/cold/vending) |
| `tools.config.ts` | Tool categories and typical station/action family associations |
| `techniques.config.ts` | Controlled vocabulary for techniqueId with action family mappings |
| `validation.config.ts` | Validation thresholds (H26 connectivity, equipment time ranges) |
| `index.ts` | Re-exports all configs for convenient imports |

### Stations (11 real stations + fallback)

| Station | Side | Equipment? |
|---------|------|------------|
| `fryer` | hot_side | Yes |
| `waterbath` | hot_side | Yes |
| `turbo` | hot_side | Yes |
| `toaster` | hot_side | Yes |
| `clamshell_grill` | hot_side | Yes |
| `press` | hot_side | Yes |
| `pizza` | hot_side | Yes |
| `microwave` | hot_side | Yes |
| `garnish` | cold_side | No |
| `speed_line` | cold_side | No |
| `vending` | vending | Yes |
| `other` | cold_side | - |

### Station Configuration Example

```typescript
// config/stations.config.ts
{
  id: "garnish",
  label: "Garnish",
  side: "cold_side",
  sublocations: ["work_surface", "cold_rail", "dry_rail", "cold_storage", "packaging", "kit_storage"],
}
```

**Validation:** H32 checks that `step.sublocation` is valid for `step.stationId`.

### Techniques Configuration Example

```typescript
// config/techniques.config.ts
{
  id: "fry",
  label: "Fry",
  actionFamily: ActionFamily.HEAT,
  typicalTools: ["fry_basket", "tongs"],
  aliases: ["deep_fry"],
}
```

**Validation:** H33 checks that `action.techniqueId` is in the vocabulary and matches the step's action family.

### Key Simplifications

- **No `storageLocation`** — Use `step.to.sublocation` for pre_service steps to indicate where prepped items go
- **Artifact → Component** — All flow references now use `componentId` instead of `artifactId`
- **11 stations** — Simplified from 25+ to match real kitchen layout

### Helper Functions

```typescript
import {
  isValidSublocationForStation,  // H32 validation
  getStationSide,                // hot_side, cold_side, vending
  isKnownTechnique,              // H33 vocabulary check
  getTechniqueActionFamily,      // technique → expected family
  normalizeTechnique,            // alias → canonical ID
} from "./config";
```

### Adding New Stations/Techniques

1. Add to the appropriate config file
2. Run `npm test` to verify validation still passes
3. The types and Zod schemas automatically pick up the changes
