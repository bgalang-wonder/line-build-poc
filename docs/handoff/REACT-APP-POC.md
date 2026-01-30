# Handoff: React App POC - Line Build Authoring Tool

> **Purpose:** Documentation of the existing POC implementation for the Line Build Authoring Tool  
> **Created:** 2026-01-08  
> **Status:** POC Complete — Ready for iteration  
> **Based on:** Actual implemented code (v1.6 Stable DAG)

---

## 🎯 What This POC Demonstrates

This POC validates the core hypothesis: **structured line build data can be authored visually with real-time validation and BOM traceability.**

### Key Capabilities Proven

1. **BOM-First Authoring** — Steps link directly to BOM items; coverage is tracked and validated
2. **DAG Visualization** — Rank-based layout shows dependency flow with bezier curve edges
3. **Real-Time Validation** — Hard invariants block publish; quality metrics track completeness
4. **Implicit Usage Tracking** — Ingredients used implicitly (e.g., frying oil) can be captured without explicit steps

---

## 🏗️ Architecture Overview

### Three-Panel Resizable Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LINE BUILD AUTHORING TOOL                            │
│                     Chicken Milanese • V1.6 STABLE DAG                      │
├────────────────┬─────────────────────────────────┬──────────────────────────┤
│                │                                 │                          │
│  AUTHORING     │     LOGICAL EXECUTION GRAPH     │   WORKFLOW DEFINITION    │
│  AGENT         │                                 │                          │
│                │   ┌─────────┐                   │   ┌──────────────────┐   │
│  Chat-style    │   │  PREP   │───┐               │   │ BOM Coverage     │   │
│  interface     │   │ Chicken │   │               │   │ 85% ✅7 🔗2 ❌4  │   │
│  (placeholder) │   └─────────┘   │               │   └──────────────────┘   │
│                │        │        │               │                          │
│  Quick Add:    │        ▼        │               │   ┌──────────────────┐   │
│  [+HEAT]       │   ┌─────────┐   │               │   │ 01 PREP          │   │
│  [+ASSEMBLE]   │   │  HEAT   │   │               │   │ Chicken Cutlet   │   │
│  [+PACKAGING]  │   │ Chicken │───┤               │   ├──────────────────┤   │
│  [+PREP]       │   │ 240s 🔥 │   │               │   │ Asset: [BOM ▼]   │   │
│                │   └─────────┘   │               │   │ Action: [PREP ▼] │   │
│  ┌──────────┐  │        │        │               │   │ Dependencies:    │   │
│  │ Type...  │  │        ▼        ▼               │   │ [ST1] [ST2]      │   │
│  └──────────┘  │   ┌─────────┐  ┌─────────┐      │   │ Tags: [+ Add]    │   │
│                │   │ASSEMBLE │  │ PACKAGING │      │   └──────────────────┘   │
│                │   │ Arugula │─▶│ Dome Lid│      │                          │
│                │   └─────────┘  └─────────┘      │   [+ Add Step]           │
│                │                                 │                          │
│  ◀──resize──▶  │     [🔍- 100% 🔍+] [↻ Reset]    │  ◀──────resize────────▶  │
└────────────────┴─────────────────────────────────┴──────────────────────────┘
│ ● Real-time Engine │ BOM: 85% │ FAULTS: 0 │ COMPLEXITY: 4 │                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Panel Responsibilities

| Panel | Width | Purpose | Key Features |
|-------|-------|---------|--------------|
| **Left: Authoring Agent** | 25% (resizable) | Chat interface + quick actions | Quick add buttons, command input |
| **Center: DAG View** | Flexible | Visual dependency graph | Zoom/pan, bezier edges, rank layout |
| **Right: Workflow Definition** | 30% (resizable) | Step editor + BOM coverage | Expandable cards, dependency toggles |

---

## 📊 Core Data Model (As Implemented)

### Build Structure

```typescript
interface LineBuild {
  id: string;                    // "build-001"
  menuItemName: string;          // "Chicken Milanese"
  version: number;               // 1
  status: "draft" | "published";
  bom: BOMItem[];                // Bill of Materials for this menu item
  steps: Step[];                 // Ordered work units
  updatedAt: string;             // ISO timestamp
}

interface BOMItem {
  itemId: string;                // "4000415", "8807416", "9000680"
  name: string;                  // "Pine Nuts, Toasted"
  quantity: number;              // 21.02
  unit: string;                  // "g", "ea"
  type: "consumable" | "packaged_good" | "packaging";
}
```

### Step Structure

```typescript
interface Step {
  id: string;                    // "step-1"
  orderIndex: number;            // 1, 2, 3...
  
  // Required
  action: {
    family: ActionFamily;        // "PREP" | "HEAT" | "TRANSFER" | etc.
  };
  
  // BOM Linkage (strongly recommended)
  target?: {
    bomComponentId?: string;     // Links to BOM item ID
    bomUsageId?: string;         // Alternative BOM reference
    name?: string;               // Display name fallback
    type?: "packaging";          // For packaging targets
  };
  
  // Equipment (required for HEAT)
  equipment?: {
    applianceId: string;         // "fryer", "waterbath", "turbo"
  };
  
  // Time (required for HEAT)
  time?: {
    durationSeconds: number;     // Must be > 0
    isActive: boolean;           // true = hands-on, false = passive
  };
  
  // Context
  cookingPhase?: CookingPhase;   // "PRE_COOK" | "COOK" | "ASSEMBLY" | "PASS"
  container?: {
    type?: string;               // "lid", "tray"
    name?: string;               // "Tray, 52oz"
  };
  
  // Dependencies (DAG edges)
  dependsOn?: string[];          // Array of step IDs
  
  // Metadata
  notes?: string;                // Free text escape hatch
  tags?: string[];               // User-defined tags
  
  // BOM Coverage Tracking (internal)
  _bomPackagingUsed?: string[];  // Packaging item IDs used by this step
  _bomImplicitUsage?: string[];  // Ingredients used implicitly (e.g., oil)
}
```

### Action Types

```typescript
type ActionFamily = 
  | "PREP"      // Preparation (cutting, opening, pat dry)
  | "HEAT"      // Cooking (requires equipment + time)
  | "TRANSFER"  // Moving between containers
  | "COMBINE"   // Mixing ingredients
  | "ASSEMBLE"  // Building the dish
  | "PORTION"   // Dividing into servings
  | "CHECK"     // Quality checks
  | "PACKAGING" // Final packaging/serving
  | "OTHER";    // Escape hatch

// Visual styling per action
const ACTION_COLORS = {
  PREP: 'bg-blue-100 border-blue-300 text-blue-800',
  HEAT: 'bg-orange-100 border-orange-300 text-orange-800',
  TRANSFER: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  COMBINE: 'bg-purple-100 border-purple-300 text-purple-800',
  ASSEMBLE: 'bg-green-100 border-green-300 text-green-800',
  PORTION: 'bg-teal-100 border-teal-300 text-teal-800',
  CHECK: 'bg-gray-100 border-gray-300 text-gray-800',
  PACKAGING: 'bg-blue-200 border-blue-400 text-blue-900',
  OTHER: 'bg-white border-gray-200 text-gray-700'
};
```

---

## 📋 BOM Coverage System

### Concept

Every menu item has a Bill of Materials (BOM). The authoring tool tracks which BOM items are **covered** by steps in the line build.

### Coverage States

| State | Icon | Meaning | Example |
|-------|------|---------|---------|
| **Covered** | ✅ | Step explicitly references this BOM item via `target.bomComponentId` | Step targets "Chicken Cutlet" |
| **Implicit** | 🔗 | Step uses this item implicitly via `_bomImplicitUsage` | Frying oil used during HEAT step |
| **Uncovered** | ❌ | No step references this BOM item | Missing ingredient |

### Coverage Calculation

```typescript
function computeBOMCoverage(build, bom) {
  const coverage = bom.map(item => ({
    ...item,
    status: "uncovered",      // Default
    coveringStepIds: []       // Which steps cover this item
  }));

  build.steps.forEach(step => {
    // Explicit target reference
    const targetId = step.target?.bomComponentId || step.target?.bomUsageId;
    if (targetId) {
      const match = coverage.find(c => c.itemId === targetId);
      if (match) {
        match.status = "covered";
        match.coveringStepIds.push(step.id);
      }
    }

    // Explicit packaging reference
    if (step._bomPackagingUsed) {
      step._bomPackagingUsed.forEach(pkgId => {
        const match = coverage.find(c => c.itemId === pkgId);
        if (match) {
          match.status = "covered";
          match.coveringStepIds.push(step.id);
        }
      });
    }

    // Implicit usage (e.g., frying oil)
    if (step._bomImplicitUsage) {
      step._bomImplicitUsage.forEach(implId => {
        const match = coverage.find(c => c.itemId === implId);
        if (match) {
          match.status = "implicit";
          match.coveringStepIds.push(step.id);
        }
      });
    }

    // Container name matching (fuzzy)
    if (step.container?.name) {
      const match = coverage.find(c => 
        c.type === "packaging" && 
        step.container.name.toLowerCase().includes(c.name.toLowerCase().split(',')[0])
      );
      if (match && match.status === "uncovered") {
        match.status = "covered";
        match.coveringStepIds.push(step.id);
      }
    }
  });

  return {
    totalItems: bom.length,
    coveredCount: coverage.filter(c => c.status === "covered").length,
    implicitCount: coverage.filter(c => c.status === "implicit").length,
    uncoveredCount: coverage.filter(c => c.status === "uncovered").length,
    coveragePercent: ((coveredCount + implicitCount) / bom.length) * 100,
    items: coverage
  };
}
```

### Why This Matters

- **Validation (H23):** Uncovered consumables/packaged goods block publish
- **Quality Score:** BOM coverage is 50% of the weighted quality score
- **Traceability:** Every ingredient in the dish should be accounted for in the line build

---

## ✅ Validation System

### Two-Tier Validation

1. **Step Validators** — Run on each step individually
2. **Build Validators** — Run on the entire build

### Step Validators (Implemented)

| ID | Rule | Validation Logic |
|----|------|------------------|
| **H1** | Action family required | `!!step.action?.family` |
| **H3** | Time fields consistency | `!step.time \|\| (step.time.durationSeconds > 0 && typeof step.time.isActive === 'boolean')` |
| **H15** | HEAT requires equipment | `step.action?.family !== "HEAT" \|\| !!step.equipment?.applianceId` |
| **H16** | PACKAGING requires container | `step.action?.family !== "PACKAGING" \|\| (!!step.container \|\| step.target?.type === 'packaging')` |

### Build Validators (Implemented)

| ID | Rule | Validation Logic |
|----|------|------------------|
| **H2** | Unique orderIndex | `new Set(steps.map(s => s.orderIndex)).size === steps.length` |
| **H6** | Published builds have steps | `status !== "published" \|\| steps.length > 0` |
| **H9** | No dependency cycles | Topological sort succeeds (DFS cycle detection) |
| **H23** | BOM coverage | All consumables/packaged goods have coverage status != "uncovered" |

### Validation Result Structure

```typescript
interface ValidationResult {
  canPublish: boolean;           // All validators pass
  stepErrors: StepError[];       // Per-step failures
  buildErrors: BuildError[];     // Build-level failures
  totalErrors: number;           // stepErrors.length + buildErrors.length
}

interface StepError {
  stepId: string;
  ruleId: string;                // "H1", "H15", etc.
  message: string;               // "HEAT requires equipment"
}

interface BuildError {
  ruleId: string;
  message: string;
}
```

---

## 📈 Quality Scoring System

### Concept

Quality Score ≠ Validation. A build can **pass validation** but have a **low quality score**.

- **Validation:** Binary pass/fail — blocks publish
- **Quality Score:** Weighted metric — measures completeness

### Score Calculation

```typescript
const metrics = [
  { 
    label: "BOM Reference Rate", 
    value: coveragePercent,           // 0-100
    target: 100, 
    weight: 0.5                       // 50% of total score
  },
  { 
    label: "HEAT Specification", 
    value: heatStepsWithTime / totalHeatSteps * 100,
    target: 100, 
    weight: 0.3                       // 30% of total score
  },
  { 
    label: "Phase Accuracy", 
    value: stepsWithPhase / totalSteps * 100,
    target: 80, 
    weight: 0.2                       // 20% of total score
  }
];

const totalScore = metrics.reduce((acc, m) => acc + (m.value * m.weight), 0);
// Score is 0-100
```

### Audit Console

The "Audit Build" button opens a modal showing:

1. **Quality Score** — Weighted average with breakdown
2. **BOM Mismatch Count** — Uncovered items
3. **Hard Failures** — Validation errors
4. **Validation Matrix** — Pass/fail status for all rules

---

## 🔀 DAG Layout Algorithm

### Rank-Based Layout

Steps are organized into **ranks** (columns) based on dependency depth.

```typescript
function getLayoutRanks(steps) {
  const stepMap = new Map(steps.map(s => [s.id, s]));
  const rankMap = new Map();
  
  // Recursive rank calculation
  const getRank = (id, visited = new Set()) => {
    if (rankMap.has(id)) return rankMap.get(id);
    if (visited.has(id)) return 0; // Cycle protection
    
    const step = stepMap.get(id);
    if (!step || !step.dependsOn || step.dependsOn.length === 0) {
      rankMap.set(id, 0);  // Root nodes are rank 0
      return 0;
    }
    
    visited.add(id);
    const parentRanks = step.dependsOn.map(pid => getRank(pid, new Set(visited)));
    const rank = Math.max(...parentRanks) + 1;  // One more than deepest parent
    rankMap.set(id, rank);
    return rank;
  };
  
  steps.forEach(s => getRank(s.id));
  
  // Group steps by rank
  const ranks = [];
  rankMap.forEach((rank, id) => {
    if (!ranks[rank]) ranks[rank] = [];
    ranks[rank].push(stepMap.get(id));
  });

  // Sort within ranks by orderIndex for visual stability
  return ranks.filter(Boolean).map(column => 
    column.sort((a, b) => a.orderIndex - b.orderIndex)
  );
}
```

### Visual Layout

- **Horizontal:** Ranks flow left-to-right
- **Vertical:** Steps within a rank are stacked vertically
- **Spacing:** 128px between ranks, 48px between steps in a rank
- **Edges:** Bezier curves connect dependent nodes

### Edge Rendering

```typescript
// SVG path for dependency edge
const x1 = startNode.offsetLeft + startNode.offsetWidth;
const y1 = startNode.offsetTop + (startNode.offsetHeight / 2);
const x2 = endNode.offsetLeft;
const y2 = endNode.offsetTop + (endNode.offsetHeight / 2);

// Cubic bezier curve
const path = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`;
```

---

## 🖱️ Interaction Patterns

### Panel Resizing

- Drag the 6px dividers between panels
- Left panel: 15-40% width
- Right panel: 20-50% width
- Center panel: fills remaining space

### DAG Pan/Zoom

- **Pan:** Click and drag on the canvas
- **Zoom:** Use +/- buttons (0.5x to 2.0x)
- **Reset:** Click reset button to restore defaults

### Step Selection

- Click a DAG node → selects step
- Click a step card → selects step
- Selection syncs between DAG and right panel
- Selected step expands in right panel

### Dependency Management

1. Expand a step card in the right panel
2. Find "Sequence Dependencies" section
3. Click "ST X" buttons to toggle dependencies
4. DAG reflows automatically based on new dependencies

### Tag Management

1. Expand a step card
2. Type in the "Add tag..." input
3. Press Enter or click "+"
4. Tags appear as removable chips

---

## 🧪 Sample Data (Chicken Milanese)

### BOM Items

```typescript
const CHICKEN_MILANESE_BOM = [
  // Consumables
  { itemId: "4000415", name: "Pine Nuts, Toasted", quantity: 21.02, unit: "g", type: "consumable" },
  { itemId: "4000504", name: "Basil, Fresh", quantity: 3.0, unit: "g", type: "consumable" },
  { itemId: "4000506", name: "Parmesan, Grated", quantity: 7.5, unit: "g", type: "consumable" },
  { itemId: "4000522", name: "Canola Oil, Frying", quantity: 17.46, unit: "g", type: "consumable" },
  
  // Packaged Goods
  { itemId: "8805001", name: "Arugula Fennel Mix", quantity: 0.17, unit: "ea", type: "packaged_good" },
  { itemId: "8807262", name: "Lemon Vinaigrette Dressing", quantity: 0.014, unit: "ea", type: "packaged_good" },
  { itemId: "8807329", name: "Grape Tomatoes", quantity: 0.19, unit: "ea", type: "packaged_good" },
  { itemId: "8807416", name: "Chicken Cutlet", quantity: 0.5, unit: "ea", type: "packaged_good" },
  
  // Packaging
  { itemId: "9000680", name: "Tray, 52oz, Black-Gold", quantity: 1, unit: "ea", type: "packaging" },
  { itemId: "9000681", name: "Lid, 52oz, Dome", quantity: 1, unit: "ea", type: "packaging" },
  { itemId: "9001495", name: "Sleeve, Alanza 52oz", quantity: 1, unit: "ea", type: "packaging" },
  { itemId: "9002138", name: "Souffle Cup, 2oz", quantity: 1, unit: "ea", type: "packaging" },
  { itemId: "9002139", name: "Lid, 2oz Souffle", quantity: 1, unit: "ea", type: "packaging" },
];
```

### Initial Steps

```typescript
const initialSteps = [
  { 
    id: "step-1", 
    orderIndex: 1, 
    action: { family: "PREP" }, 
    target: { bomComponentId: "8807416", name: "Chicken Cutlet" }, 
    cookingPhase: "PRE_COOK", 
    notes: "Pat dry", 
    tags: ["Raw Meat Handling"] 
  },
  { 
    id: "step-2", 
    orderIndex: 2, 
    action: { family: "HEAT" }, 
    target: { bomComponentId: "8807416", name: "Chicken Cutlet" }, 
    equipment: { applianceId: "fryer" }, 
    time: { durationSeconds: 240, isActive: false }, 
    cookingPhase: "COOK", 
    dependsOn: ["step-1"], 
    _bomImplicitUsage: ["4000522"]  // Frying oil
  },
  { 
    id: "step-3", 
    orderIndex: 3, 
    action: { family: "ASSEMBLE" }, 
    target: { bomComponentId: "8805001", name: "Arugula Mix" }, 
    container: { name: "Tray, 52oz" }, 
    cookingPhase: "ASSEMBLY", 
    dependsOn: ["step-2"], 
    _bomPackagingUsed: ["9000680"]  // Tray
  },
  { 
    id: "step-4", 
    orderIndex: 4, 
    action: { family: "PACKAGING" }, 
    container: { type: "lid", name: "Dome Lid" }, 
    cookingPhase: "PASS", 
    dependsOn: ["step-3"], 
    _bomPackagingUsed: ["9000681"]  // Lid
  }
];
```

---

## 🚀 What's Built vs. PRD Requirements

### Implemented (P1 Requirements)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| **P1.1** | Capture work types | ✅ Complete | 9 action families |
| **P1.2** | Identify targets | ✅ Complete | BOM ID linking with fallback |
| **P1.3** | Equipment + duration | ✅ Complete | applianceId + durationSeconds/isActive |
| **P1.4** | Capture "when" | ✅ Complete | cookingPhase field |
| **P1.7** | Natural language | ⚠️ Placeholder | Chat panel exists but not wired to AI |

### Not Yet Implemented

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| **P1.5** | Complexity scoring | ❌ Not built | Quality score != complexity score |
| **P1.6** | Variant management | ❌ Not built | No overlays/conditions |
| **P1.8** | Migrate existing | ❌ Not built | No import/export |
| **P1.9** | Pre-service prep | ❌ Not built | No prepType/storageLocation |
| **P1.10** | Customization branching | ❌ Not built | No customizationGroups |

### Beyond PRD (POC Additions)

| Feature | Notes |
|---------|-------|
| **BOM Coverage Tracking** | Not in PRD — valuable for traceability |
| **Implicit Usage Pattern** | `_bomImplicitUsage` for indirect ingredients |
| **Quality Score** | Weighted metric (50/30/20 split) |
| **Visual DAG Editor** | Full pan/zoom/select implementation |
| **Tag System** | User-defined tags on steps |

---

## 🔄 Next Steps

### Immediate (P1 Completion)

1. **Wire chat to AI** — Connect left panel to extraction logic
2. **Add pre-service prep fields** — `prepType`, `storageLocation`, `bulkPrep`
3. **Add complexity scoring** — Formula from PRD (work variety, equipment variety, etc.)
4. **Add overlays/conditions** — Equipment-based step filtering

### Future (P2+)

1. **Customization branching** — MANDATORY_CHOICE forks
2. **Import/export** — JSON export, legacy migration
3. **Gantt view** — Timeline visualization (read-only)
4. **Validation overrides** — Override with reason + audit trail

---

## 📁 File Structure

```
apps/line-build-mvp/
├── src/
│   └── App.tsx                # Single-file POC (current)
├── package.json
└── README.md

# Future structure (after POC graduation):
apps/line-build-mvp/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx
│   │   ├── DAGView.tsx
│   │   ├── StepEditor.tsx
│   │   ├── BOMCoveragePanel.tsx
│   │   └── ValidationModal.tsx
│   ├── hooks/
│   │   ├── useValidation.ts
│   │   └── useBOMCoverage.ts
│   ├── utils/
│   │   ├── dagLayout.ts
│   │   └── validators.ts
│   ├── types/
│   │   └── schema.ts
│   └── App.tsx
```

---

## 📚 Reference

- **PRD:** `docs/PRD-FULL.md`
- **Technical Spec:** `docs/schema/SPEC-TECHNICAL.md`
- **Invariants:** `docs/schema/INVARIANTS.md`
- **Mock Data:** `data/mock/`

---

**This POC proves the core authoring model works. Next: wire up AI extraction and complete P1 requirements. 🚀**
