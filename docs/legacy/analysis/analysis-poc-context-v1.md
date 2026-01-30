---
type: analysis
status: current
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
priority: high
tags: [line-builds, poc, complexity-scoring, ai-copilot, implementation, stakeholder-feedback]
related: [research-existing-initiatives.md, analysis-abstraction-context-v1.md]
version: 1
confidence: high
data_sources: [LineBuildPOC codebase, SPEC.md, real_menu_items.json, meeting-dec-5-transcript, meeting-dec-8-transcript]
analysis_date: 2025-12-16
data_freshness: current
staleness_trigger: "POC implementation changes or new features"
open_questions: [How does POC scoring compare to Confluence methodology?, What gaps exist between POC and production needs?, How to handle prep step complexity?]
---

# LineBuildPOC Context Analysis

## Overview

The LineBuildPOC (`/Documents/LineBuildPOC`) is a Next.js application that implements the spreadsheet-based complexity scoring methodology as an interactive web tool. This document captures the POC's architecture, scoring implementation, stakeholder context from meetings, and how it connects to the broader line build redesign effort.

---

## POC Purpose

**Problem Addressed:** The complexity scoring methodology documented in Confluence is currently executed in spreadsheets, requiring manual exports and calculations.

**Solution:** A web application that:
1. Loads line build data directly
2. Calculates complexity scores automatically
3. Enables scenario modeling ("what if we change this step?")
4. Provides AI-assisted analysis via copilot

**Business Driver:** Q4 deliverable - stakeholders need validated complexity scores by end of year to inform menu optimization and operational decisions.

---

## Stakeholder Context (from Dec 5 & Dec 8 Meetings)

### The Manual Process Today

Chefs manually break down line builds into granular steps in Excel:
- Every step becomes a row
- Each row captures: station, phase, item_name, location, tool, technique, qty, equipment, cook_time
- **Manual data entry** - no automated pull from Cookbook
- **Consistency is the hardest part** - different chefs enter data differently

> "I'm auditing it, and then when I feel it's close enough, I'll move it over. That's why it's not sustainable." — Shin

### Data Completeness Gap

The spreadsheet captures data that **does not exist in current line builds**:

| Field | In Spreadsheet | In Cookbook Line Build |
|-------|----------------|------------------------|
| Pre-cook / Post-cook phase | Yes | No |
| Location (cold storage, hot hold) | Yes | Partial (not in line build steps) |
| Tool (spoodle, tongs) | Yes | No |
| Technique (open pack, portion) | Yes | No |
| Component ID | Yes | 10.6% populated |

> "The line build doesn't have is to know what you're doing before you cook and what you're doing after you cook." — Shin

### Validation Rules Needed

Key insight from meetings: stakeholders want **deterministic validation rules**, not just AI inference:

> "If it's looking at all 500 line builds... I'm going through and reading all these line builds and being like, oh, you're missing this step. I always have a past step after this." — Shin

Requested validation patterns:
- "If you have a turbo step, you always need a cooking vessel"
- "If you have a cook step, you need pre-cook and post-cook phases"
- "Every fryer item needs these standard steps"

### Comparison & Scenario Analysis

Stakeholders want to compare line build variants:

> "If we can compare two kinds of line builds for a single dish, that would be cool. So that the chefs can then show operations like, here are your options." — Jen

Use cases:
- Compare variant A vs variant B complexity
- See impact of changing a component (e.g., individual pack to bulk)
- Evaluate equipment substitution (fryer vs turbo)

---

## Hot/Cold Pod Architecture (Critical Business Context)

### Throughput Constraint

**1 Hot Pod feeds 3 Cold Pods**

This ratio drives all complexity scoring:
- If hot pod has too much complexity → bottleneck, cold pods starve
- If cold pod has too much complexity → queue builds up at cold stations
- Items with high `hotRatio` create systemic bottlenecks

### Station Classification

**Hot Pod Stations:**
- Fryer
- Waterbath
- Turbo
- Press
- Toaster
- Clamshell

**Cold Pod Stations:**
- Garnish
- Vending

### Scoring Philosophy

> "There's one feeling when we were talking about scores, there was like, well, hot is harder. So we should make the complexity higher. But the problem with that is then, like, what happens when I move that task?" — Shin

Resolution: Weight by **inherent task difficulty**, not station location. This allows:
- Moving tasks between hot/cold without changing weights
- Comparing variants that shift work between stations
- Analyzing throughput impact separately from task complexity

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| AI Integration | CopilotKit (Claude API) |
| Data | JSON files (real menu items) |

---

## Data Model

### Current Data Scale

| Metric | Value |
|--------|-------|
| Menu Items | 100 (real items) |
| Total Steps | 1,787 |
| Avg Steps/Item | ~18 |

### Core Interfaces

```typescript
interface MenuItem {
  item_number: string;
  item_name: string;
  steps: Step[];
  computed?: ComputedScores;
}

interface Step {
  step: number;
  station: string;
  phase: string;          // PRE_COOK | COOK | POST_COOK | PASS
  item_name: string | null;
  location: string | null; // Cold Storage | Hot Hold | Fryer | etc.
  tool: string | null;     // Tongs | Spoodle | etc.
  technique: string | null; // Open Pack | Portion | Stir | etc.
  qty: number;
  equipment: string | null;
  cook_time: number | null;
}

interface ComputedScores {
  raw: RawScores;
  weighted: WeightedScores;
  total: number;
  hotRatio: number;  // Hot Pod Complexity / Total Complexity
}
```

---

## Scoring Implementation

### Formula Components

| Component | Weight | What It Measures |
|-----------|--------|------------------|
| Hot/Cold Component | 30% | Where ingredients come from (station complexity) |
| Technique | 40% | How steps are executed (action complexity) |
| Packaging | 15% | Final assembly requirements |
| Task Count | 5% | Number of discrete steps |

**Note:** Hot Component (30%) + Cold Component (30%) = 60% total. The split allows analyzing hot vs cold separately while maintaining a unified score.

### Location Weights

| Location | Weight | Rationale |
|----------|--------|-----------|
| Cold Storage | 1.25 | Requires retrieval from cold |
| Hot Hold | 1.0 | Already prepared, ready to use |
| Grab | 1.0 | Simple retrieval |
| Turbo | 2.0 | Equipment contention |
| Waterbath | 2.0 | Equipment contention |
| Fryer | 2.0 | Equipment contention |
| In Kit | 0.5 | Already accessible in opened kit |
| None | 0.8 | No location complexity |

### Technique Weights

| Technique | Weight | Rationale |
|-----------|--------|-----------|
| Open Pouch | 2.0 | Manual dexterity required |
| Clamshell | 4.0 | Multi-step assembly |
| Hand | 1.0 | Basic manipulation |
| Tongs | 1.5 | Tool coordination |
| Squeeze | 1.0 | Simple application |
| Stir | 1.5 | Active attention required |
| Fry | 1.0 | Equipment-driven |
| Place | 1.0 | Simple placement |
| Pass | 1.0 | Transfer action |
| (None) | 0.5 | No technique complexity |

---

## UI Architecture

### Three Core Views

1. **Portfolio View** - All items with sortable scores, filters by complexity tier
2. **Item Detail View** - Step-by-step breakdown with scoring attribution
3. **Scenario Builder** - Modify steps, see score impact in real-time

### Planned AI Copilot Features

| Tool | Purpose |
|------|---------|
| `get_item_details` | Retrieve full item data |
| `update_step` | Modify step attributes |
| `compare_scenarios` | Diff two configurations |
| `suggest_simplification` | Recommend complexity reductions |

### AI Use Cases from Stakeholder Feedback

1. **Pattern Detection**: "Find any variations on this. Is this a valid variation?"
2. **Bulk Cleanup**: "As I'm doing that bulk change, it will take notice and be like, hey, I think this is what you're doing. Do you just want me to do that for you?"
3. **Validation Rules**: "Can you make any rules that to look out for when I do the next one?"

---

## Connection to Discovery Findings

### Pain Point Addressed: Spreadsheet-Based Scoring

**From Confluence (Complexity Analysis of Line Builds):**
> "Executed in spreadsheet (Excel export from BigQuery), manual calculation of weighted scores"

**POC Solution:**
- Scoring calculated automatically from loaded data
- Real-time updates when steps change
- No manual export/import cycle

### Gap Identified: Missing Factors

The POC implements a **simplified scoring model** compared to the Confluence methodology:

| Factor | Confluence Methodology | POC Implementation |
|--------|------------------------|---------------------|
| Short appliance steps (<45s) | Weight: 100 | Not implemented |
| Cold-to-hot rotation | Weight: 100 | Not implemented |
| Back-to-back turbo | Weight: 100 | Not implemented |
| Total cook time | Weight: 0.01 | Partial (cook_time field) |
| Step count | Weight: 1 | Task count component |
| Equipment variety | Weight: 1 | Via station weights |
| Technique complexity | Not explicit | Technique weights |
| Location complexity | Not explicit | Location weights |

**Implication:** The POC introduces new factors (technique, location weights) not in the original Confluence methodology, while omitting critical operational factors (cold-to-hot rotation, short appliance steps).

### Gap Identified: Data Quality

The POC uses **pre-structured JSON data**, not the raw BigQuery data with 99.99% free text reliance.

**Data fields in POC** (all populated):
- `station` (string)
- `location` (string)
- `technique` (string)
- `tool` (string)
- `equipment` (string)

**Data fields in BigQuery** (mostly missing):
- `activity_type` (100% populated)
- `appliance_config_id` (24% populated)
- `related_item_number` (10.6% populated)
- `sub_steps_title` (99.99% free text)

**Implication:** The POC assumes structured data exists. Production implementation requires either:
1. AI inference to derive structure from free text (Gemini approach)
2. Schema changes to require structured input
3. Backfill initiative to populate missing fields

---

## Future Vision: Wonder Create / Infinite Kitchen

From Dec 5 meeting, this work is **prerequisite for robot automation**:

> "There's no way our line builds today are enough granularity to drive a robot actually doing real steps. You would have to get to at least the granularity you're showing here. If not more." — Brandon

**Implication:** The granularity captured in the spreadsheet (and POC) is the minimum viable structure for robot instruction generation.

---

## Future Vision: Labor Modeling

Stakeholders envision complexity scores driving workforce planning:

> "I really want the complexity score as a labor model. The order, expected order volume to decide where everything actually should be sent and picked up. And like, analyze, okay, hey, this HDR was really busy today, but you look at the complexity score, they processed a thousand points." — Shin

---

## Bench-Top Line Build Concept

From Dec 5 meeting, stakeholders proposed separating ownership:

> "CE should own the bench top line build, training or ops should take those bench top line builds and turn them into what is displayed. Like, commercializing, operationalizing the line build." — Shin

**Two-layer architecture:**
1. **Bench-top line build** (CE-owned): Full granularity, all steps, technique details
2. **Operational line build** (Ops/Training-owned): Simplified for KDS display, optimized for execution

This addresses the tension between:
- CE needing full detail for complexity scoring and robot translation
- Ops needing simplified instructions for line cooks

---

## Build Phases

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Foundation (data loading, scoring, basic UI) | In Progress |
| Phase 2 | Scenario Builder (what-if modeling) | Planned |
| Phase 3 | AI Copilot (CopilotKit integration) | Planned |
| Phase 4 | Polish (export, sharing, advanced filters) | Planned |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/data/real_menu_items.json` | 100 production items, 1,787 steps |
| `/lib/scoring.ts` | Scoring formula implementation |
| `/lib/types.ts` | TypeScript interfaces |
| `/lib/stores/menu-store.ts` | Zustand state management |
| `/SPEC.md` | Full product specification |
| `/AGENTS.md` | Developer handoff guide |

---

## Recommendations

### For POC Development

1. **Align scoring with Confluence methodology** - Add cold-to-hot rotation, short appliance step detection
2. **Add data quality indicators** - Show which fields came from structured data vs. inference
3. **Build validation rules engine** - Deterministic checks like "turbo step requires cooking vessel"
4. **Enable variant comparison** - Side-by-side view of two line build configurations

### For Production Roadmap

1. **POC validates the UI pattern** - Portfolio → Detail → Scenario flow works
2. **POC exposes data gap** - Production data is 99.99% free text; POC assumes structure
3. **Bridge required** - Need AI inference or schema enforcement before POC approach can scale
4. **Bench-top line build concept** - Consider separating CE-owned detailed builds from operationalized KDS builds

### Stakeholder Quote on Vision

> "If you got this to the point where I could just feed you data and this thing could fix it, like, that would be amazing, because I have about 20 more menus to go through and try to format in the correct way." — Shin

---

## Appendix: Sample Data Structure

```json
{
  "item_number": "3100001",
  "item_name": "Grilled Chicken Bowl",
  "steps": [
    {
      "step": 1,
      "station": "Waterbath",
      "phase": "COOK",
      "item_name": "Chicken Breast",
      "location": "Cold Storage",
      "tool": "Tongs",
      "technique": "Open Pouch",
      "qty": 1,
      "equipment": "Waterbath",
      "cook_time": 120
    },
    {
      "step": 2,
      "station": "Waterbath",
      "phase": "POST_COOK",
      "item_name": "Chicken Breast",
      "location": "Waterbath",
      "tool": "Tongs",
      "technique": "Place",
      "qty": 1,
      "equipment": null,
      "cook_time": null
    },
    {
      "step": 3,
      "station": "Garnish",
      "phase": "GARNISH",
      "item_name": "Rice Base",
      "location": "Hot Hold",
      "tool": "Spoodle",
      "technique": null,
      "qty": 1,
      "equipment": null,
      "cook_time": null
    }
  ]
}
```
