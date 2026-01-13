# Line Build CLI & Viewer POC: AI-Assisted Culinary Operations

This Proof of Concept (POC) demonstrates a high-leverage workflow for authoring, validating, and visualizing culinary "line builds" (pre-service and service preparation workflows). 

It combines **AI reasoning**, **deterministic CLI validation**, and **live DAG visualization** to turn loose culinary descriptions into actionable, valid workflow graphs.

## The Three-Pillar Architecture

### 1. The Interviewer (Claude Code)
Claude Code acts as a **culinary operations interviewer**. Instead of just generating JSON, it:
- **Validates early**: Catches schema and kitchen logic violations *before* writing.
- **Analyzes structure**: Detects parallel tracks, merge points, and missing dependencies.
- **Enriches data**: Proactively asks about station assignments, tool IDs, and active vs. passive cooking times.
- **Uses templates**: Follows `templates/validation-checklist.md` to ensure every build passes rigorous standards.

### 2. The Engine (CLI)
A TypeScript CLI (`scripts/lb.ts`) provides the "source of truth" for validation and data management:
- **Strict Validation**: Enforces 26+ rules (H1-H26) covering schema, connectivity, and kitchen logic.
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
Simply ask Claude to:
- "Find all builds for item X"
- "Author a new build for a Baked Potato from this CSV..."
- "Show me the health of the Beef Barbacoa build"

---

## Technical Reference

### CLI Commands
- `find [query]` / `list <itemId>`: Discover builds.
- `read <buildId> [--steps]`: Inspect builds in terminal.
- `write`: Validate and persist a build + receipt.
- `validate <buildId>`: Refresh validation report for a build.
- `view <buildId>`: Jump the viewer to a specific build.
- `bulk-update --where <dsl> --set <field>=<value>`: Patch multiple steps at once.

### Data Layout
- `data/line-builds/`: Source JSON for builds.
- `data/validation/`: Latest validation reports.
- `data/receipts/`: Audit trail of all write operations.
- `data/checklists/`: Per-build progress tracking.
- `scripts/lib/rules.ts`: The "Golden Rules" (H1-H26).

### Rules Highlight
- **H15/H22**: HEAT steps require equipment and time (active/passive).
- **H16**: VEND steps require a container or target.
- **H26**: Graph Connectivity (Connected DAG).
- **C1-C3**: Culinary logic (e.g., HEAT should happen before ASSEMBLE).
