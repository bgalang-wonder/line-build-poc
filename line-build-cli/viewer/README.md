# Line Build DAG Viewer

A minimal Next.js app for visualizing line builds as directed acyclic graphs (DAGs).

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

## What It Does

- Reads builds from `../data/line-builds/` (same data the CLI uses)
- Displays builds as interactive DAGs with work edges (dependsOn) and flow edges (output→input)
- Shows validation errors from `../data/validation/`
- Updates automatically when builds change (polls every 1.5 seconds)

## Features

- **Dual Edge Layers**: Toggle between work edges (gray) and flow edges (cyan)
- **Step Inspector**: Click any step node to see details and validation messages
- **Validation Highlighting**: Steps with errors are highlighted in red

---

## Codebase Structure

```
viewer/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main viewer page
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── builds/           # Build list & detail endpoints
│   │       ├── validation/       # Validation data endpoints
│   │       └── control/          # Viewer selection control
│   ├── components/
│   │   ├── visualization/
│   │   │   ├── DAGVisualization.tsx    # Main graph component
│   │   │   ├── GraphLayerToggles.tsx   # Mode & view controls
│   │   │   ├── DetailPanel.tsx         # Step/artifact inspector
│   │   │   ├── constants.ts            # Colors, dimensions, groupings
│   │   │   ├── nodes/                  # Node label renderers
│   │   │   │   ├── StepNode.tsx        # Work order step nodes
│   │   │   │   ├── ArtifactNode.tsx    # Material flow artifact nodes
│   │   │   │   └── VisitNode.tsx       # Station timeline visit nodes
│   │   │   ├── edges/
│   │   │   │   └── edgeStyles.ts       # Edge styling constants
│   │   │   └── layouts/                # Graph layout generators
│   │   │       ├── dagreLayout.ts      # Dagre layout utility
│   │   │       ├── workOrderFlow.ts    # Work order mode nodes/edges
│   │   │       ├── materialFlow.ts     # Material flow mode nodes/edges
│   │   │       └── visitTimeline.ts    # Station handoffs mode
│   │   └── layout/
│   │       └── RightSidebar.tsx        # Sidebar container
│   ├── lib/
│   │   ├── dataPaths.ts          # File path utilities
│   │   ├── validationModel.ts    # Validation data helpers
│   │   ├── graphMetrics.ts       # Critical path calculation
│   │   ├── componentColors.ts    # Group color mapping
│   │   └── visitTimeline.ts      # Visit grouping logic
│   └── types/
│       └── index.ts              # Shared TypeScript types
└── README.md
```

### Visualization Modes

| Mode | Description | Key Files |
|------|-------------|-----------|
| **Work Order** | Step-by-step dependency graph | `workOrderFlow.ts`, `StepNode.tsx` |
| **Material Flow** | Artifact transformation graph | `materialFlow.ts`, `ArtifactNode.tsx` |
| **Station Handoffs** | Timeline by station visits | `visitTimeline.ts`, `VisitNode.tsx` |

### Key Design Decisions

- **Modular layouts**: Each visualization mode has its own layout generator in `layouts/`
- **Centralized constants**: All colors, dimensions, and groupings in `constants.ts`
- **Separated concerns**: Node rendering (`nodes/`), edge styling (`edges/`), and layout logic (`layouts/`) are independent
- **Live polling**: 1.5s interval for dev workflow with Claude Code (acceptable for POC)
