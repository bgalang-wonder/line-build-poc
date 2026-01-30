# Line Build Redesign: Complexity Scoring & Data Management PRD

> **Source:** Confluence - Last synced Jan 7, 2026

---

## Problem Statement

Line builds today don't meet minimum viable data quality to support downstream use cases.

They work well enough to run a kitchen, but:

* Can't power complexity scoring (requires manual spreadsheet work)
* Can't power cross-menu queries ("show me all dishes using waterbath")
* Can't power variant management (equipment changes mean full rewrites)
    * Leads to confusion in the context behind separate line builds that roll up to a single item
* Can't validate completeness and alignment across line builds
* Maintenance is manual, operationally intensive, and error-prone

---

## Goal

Build a new line build system that:

* Defines data with sufficient structure to drive complexity scoring and time trials
* Is usable by Training + OpEx
* Enables scenario analysis ("what-if") comparing change X vs change Y
* Bulk update and validation capabilities within a single and across several line builds
* Implement a v1 that allows for expansion to support future use cases (i.e., sequencing, routing, simulation)

---

## Hypotheses

**H1: AI can extract structured data from unstructured input**
* Chefs describe processes in natural language; AI reliably converts to tagged DAG nodes
* Validation: 99.2% automated migration in trial run

**H2: Structured data enables automatic complexity scoring**
* If we capture action types, equipment, timing, and dependencies, we can compute scores without manual spreadsheets
* Validation: Scores match Shin's spreadsheet within tolerance

**H3: Hard validation + override beats soft warnings**
* Chefs will comply with hard blocks if there's an escape hatch (override with reason)
* Override patterns inform rule evolution rather than being ignored (like Cookbook warnings)

**H4: DAG structure unlocks future use cases**
* Sequencing, simulation, and routing all become possible once we have dependency-aware data
* We don't need to build these now — just not block them

---

## Approach

### Two Pillars

**1. Directed Acyclic Graph (DAG) as data model**
* A line build is a directed acyclic graph of tagged work units
* Nodes = work units (prep this, heat that, assemble)
* Edges = order constraints (A must happen before B)
* Tags = properties on nodes (action type, equipment, time, phase, station, etc.)

**2. AI as authoring assistant**
* Reduces friction at every step of the authoring process

### Why DAG

A linear list forces one ordering. But many dishes have parallelizable prep. The DAG captures:

* **Hard dependencies** — can't heat chicken until you open the pouch
* **Flexible ordering** — sauce prep and chicken prep can happen in either order
* **Batch sync** — multiple things must complete before the next step (implicit in graph structure)

---

## Solution Overview

### The Interface (Three Panels)

```
┌────────────────────────────────────────────────────────────────────────┐
│                     LINE BUILD AUTHORING TOOL                          │
├──────────────────┬─────────────────────────────────────────────────────┤
│                  │                     │                               │
│   CHAT           │   DAG/GANTT         │   STRUCTURED FORM/PREVIEW     │
│                  │                     │                               │
│  "Open chicken   │  [Visual graph or   │   ┌─────────────────────┐     │
│   pouch, cook    │   timeline view]    │   │ Node: Heat Chicken  │     │
│   in waterbath   │                     │   ├─────────────────────┤     │
│   5 min, put     │                     │   │ action: HEAT        │     │
│   in bowl with   │                     │   │ target: chicken     │     │
│   sauce"         │                     │   │ equipment: waterbath│     │
│                  │                     │   │ time: 5 min         │     │
│                  │                     │   │ phase: COOK         │     │
│                  │                     │   └─────────────────────┘     │
│                  │                     │                               │
│                  │  ⚠ Missing: station │   [✓] Action type             │
│                  │                     │   [✓] Equipment               │
│                  │ ───────────────────│   [✓] Time                    │
│                  │  VALIDATIONS/RULES  │   [ ] Station                 │
│                  │                     │                               │
└──────────────────┴─────────────────────┴───────────────────────────────┘
     Free-form           React to              Review & edit
       entry            suggestions              directly
```

| Panel | Purpose | User Action |
| --- | --- | --- |
| **Left: Chat** | Chef types/pastes/speaks notes | Free-form entry |
| **Middle: DAG/Gantt** | Visual graph + validation status | View dependencies, see warnings |
| **Right: Structured Form** | Live view of filled fields | Review, direct edit, see validation status |

**Edit modes:**
* **Guided mode** — Chat panel drives; chef answers questions
* **Direct mode** — Form panel drives; chef edits directly
* **Hybrid** — Both active; changes sync

### The Data Model

```typescript
WorkUnit (Node) {
  id: string
  tags: {
    action: ActionType        // PREP, HEAT, TRANSFER, ASSEMBLE, etc.
    target: ItemReference     // BOM ID preferred, name fallback
    equipment?: EquipmentRef  // waterbath, turbo, fryer, etc.
    time?: Duration           // { value, unit, active/passive }
    phase?: Phase             // PRE_COOK, COOK, POST_COOK, ASSEMBLY
    station?: StationRef      // hot-side, cold-side, expo, etc.
    ...extensible
  }
  dependsOn: DependencyEdge[]
}

LineBuild {
  id: string
  menuItemId: string
  menuItemVersionId: string
  workUnits: WorkUnit[]
  metadata: { author, version, status, ... }
  
  // Audit trail
  sourceConversations?: string[]  // Chat transcripts preserved
  overrides?: Override[]          // Validation overrides with reasons
}

Override {
  ruleId: string                  // Which validation rule was overridden
  reason: string                  // User-provided explanation
  reviewedBy?: string
  reviewedAt?: Date
  approved?: boolean
}
```

### Validation Philosophy

**Approach: Hard block with override**

* **Hard block by default** — Missing required fields or rule violations prevent publish
* **Override with reason** — User can override by providing an explanation
* **Exceptions flagged for review** — Overrides go to a review queue

---

## Functional Requirements

### P1 — Must-Have (v1 Success Criteria)

| ID | Job to Be Done | Acceptance Criteria |
| --- | --- | --- |
| **P1.1** | Capture work types in a computable way | Categorize into bounded action types; query across menu; count per dish; required for publish |
| **P1.2** | Identify what's being acted on | Link to BOM ID (40\*, 41\*, 88\* codes); fall back to name; distinguish ingredient from container/tool |
| **P1.3** | Capture equipment + duration | Query by equipment; count equipment variety; warn if HEAT missing equipment/time; distinguish active vs passive time |
| **P1.4** | Capture "when" in the process | Group by phase (pre-cook, cook, post-cook, pass); queryable, not buried in text |
| **P1.5** | Calculate complexity without manual entry | Auto-score from captured data; accounts for work variety, equipment variety, station changes, time breakdown |
| **P1.6** | Handle variations without duplication | Conditional logic for equipment/location; base changes propagate; no separate copies |
| **P1.7** | Author from natural language | User doesn't need to know schema; system asks questions; consistent output |
| **P1.8** | Migrate existing data | 95%+ auto-converts; <5% needs review |
| **P1.9** | Capture pre-service prep separately | Distinguish pre-service prep from order execution; capture storage location; capture bulk prep pattern; filter complexity by: include prep, exclude prep, prep-only |

### P2 — Should-Have (Operational Completeness)

| ID | Job to Be Done | Acceptance Criteria |
| --- | --- | --- |
| **P2.1** | Benchtop vs Production separation | Production is derived via transforms, not cloned |
| **P2.2** | Order-in / Sandbag vs Hot-hold clarity | Distinguish cook timing (à la minute vs sandbag) |
| **P2.3** | Kitchen reality constraints | Document KDS behavioral quirks |
| **P2.4** | Scenario preview | Preview resolved output for different equipment profiles |

---

## Pre-Service Prep Details

### What is Pre-Service Prep?

**Pre-service prep** = work done BEFORE the kitchen opens / before orders start.

This is morning prep work — opening cases, portioning ingredients, staging things.

### The Three Storage Locations

| Location | What it means | Examples |
| --- | --- | --- |
| **Cold Storage** | Walk-in or reach-in fridge | Large batch items, backup stock |
| **Cold Rail** | The cold line/rail at station | Ready-to-use proteins, prepped veg |
| **Dry Rail** | Dry storage at the station | Dry goods, shelf-stable items |

### Schema for Prep

```typescript
// A pre-service prep step
{
  action: "PORTION",
  target: { bomId: "40-12345", name: "chicken breast" },
  prepType: "pre_service",      // ← done before orders
  storageLocation: "cold_rail", // ← where it goes after
  bulkPrep: true                // ← bulk pattern (open/portion/store)
}
```

---

## Schema Reference (Working Draft)

### WorkUnit Tags

| Tag | Type | Required | Possible Values |
| --- | --- | --- | --- |
| `action` | ActionType | ✅ Yes | `PREP`, `HEAT`, `TRANSFER`, `COMBINE`, `ASSEMBLE`, `PORTION`, `CHECK`, `PACKAGING`, `OTHER` |

> Note: Canonical action vocabulary lives in `docs/spec/SCHEMA-REFERENCE.md` (`ActionFamily`). Legacy terms like PLATE/FINISH should be represented via `PACKAGING` + `CookingPhase.PASS` and/or `ASSEMBLE` with appropriate notes.
| `target` | ItemReference | ✅ Yes | BOM ID (e.g., `40-12345`) or name fallback |
| `equipment` | EquipmentRef | ⚠️ If HEAT | `waterbath`, `turbo`, `fryer`, `microwave`, `grill`, `oven`, `stovetop`, `salamander` |
| `time` | Duration | ⚠️ If HEAT | `{ value, unit: "sec"/"min", type: "active"/"passive" }` |
| `phase` | Phase | Optional | `PRE_COOK`, `COOK`, `POST_COOK`, `ASSEMBLY`, `PASS` |
| `station` | StationRef | Optional | `hot-side`, `cold-side`, `expo`, `prep`, `pass` |
| `prepType` | PrepType | Optional | `pre_service`, `order_execution` |
| `storageLocation` | StorageLoc | Optional | `cold_storage`, `cold_rail`, `dry_rail`, `freezer`, `ambient`, `hot_hold_well` |
| `bulkPrep` | boolean | Optional | `true` / `false` |

### Equipment Utilization Rules

| Equipment | Commingling Rule |
| --- | --- |
| `turbo` | Yes — multiple items OK |
| `fryer` | Same type only |
| `microwave` | One at a time |
| `waterbath` | Yes — multiple items OK |

---

## Success Metrics

| Job | Metric | Target |
| --- | --- | --- |
| Calculate complexity | Score computable for 100% of items | 100% |
| Handle variations | Number of duplicate builds reduced to 1 per item | 1 build/item |
| Author from natural language | New dish authored in < 15 minutes | < 15 min |
| Migrate existing | < 5% of legacy items need manual review | < 5% |
| Eliminate spreadsheet | Shin stops using complexity spreadsheet | 0 usage |

---

## Definition of Done

**v1 is complete when:**

- [ ] Schema is documented and stable
- [ ] Authoring tool supports conversational input → structured output
- [ ] Complexity scores match legacy spreadsheet within tolerance
- [ ] Overlays work for equipment profile and customization scenarios
- [ ] Cooking phases are structured data, not text
- [ ] Pre-service prep captured separately with storage locations
- [ ] Complexity can be filtered: include prep, exclude prep, prep-only
- [ ] Validation overrides tracked with reasons
- [ ] Source conversations preserved for audit trail
- [ ] Gantt/timeline visualization available (read-only)
- [ ] 50+ items successfully migrated as validation
- [ ] Shin can author a new dish without spreadsheet
- [ ] Jen can pull complexity scores without manual data entry

---

## Item ID Conventions (Domain Knowledge)

| Prefix | Type | Description |
| --- | --- | --- |
| **5*** | Ingredients | Raw ingredients (lowest-level, procured) |
| **3*** | Benchtop recipes | R&D reference only |
| **40*** | Consumable Items | BOM components for menu items |
| **80*** | Menu Items | Have line builds, used in production |
| **88*** | Packaged Goods | Produced items |
| **9*** | Guest Packaging | Non-food packaging items |

**BOM Rules:**
- Menu items (80*) have BOMs containing consumable items (40*)
- All items except 5* and 9* have a BOM
- Items cannot be published if their BOM has draft records
