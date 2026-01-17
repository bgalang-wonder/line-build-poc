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
