---
type: research
status: current
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
priority: high
tags: [line-builds, archetypes, complexity-scoring, ai-inference, prior-art]
related: [research-discovery-overview.md, analysis-current-state-v1.md]
data_sources: [confluence:Complexity Analysis of Line Builds, confluence:Line build & Archetype PRD, confluence:Gemini Inference Plan, confluence:Line Builds 2.0 PRD, confluence:Reducing Line Build Configuration]
---

# Existing Initiatives & Prior Art

## Overview

Multiple initiatives have attempted to address line build complexity, standardization, and scoring. This document summarizes each approach, its current status, what it solves, and what gaps remain.

---

## 1. Complexity Scoring Methodology

**Source:** [Complexity Analysis of Line Builds](https://wonder.atlassian.net/wiki/spaces/RT/pages/2780070052)
**Owner:** HDR Ops / Product
**Status:** Implemented (spreadsheet-based)

### Purpose

Create complexity scores for menu items based on their line builds to:
1. Tie complexity to revenue data
2. Eliminate high-complexity items with low revenue contribution
3. Inform menu optimization decisions

### Methodology

Weighted factor scoring with total = sum of (factor × weight):

| Factor | Impact | Weight | Rationale |
|--------|--------|--------|-----------|
| Short appliance steps (<45 sec) | High | 100 per step | Chef must attend closely, cannot multitask |
| Cold-to-hot station rotation | High | 100 | Against natural flow (hot→cold→expo) |
| Back-to-back turbo oven | High | 100 | Double turbo with dependency breaks flow |
| Total cook time (seconds) | Medium-High | 0.01 | Duration-based complexity |
| Total step time (seconds) | Medium-High | 0.01 | Includes movement, kit opening |
| Total number of steps | Low | 1 | Step count indicator |
| Total equipment steps | Low | 1 | Appliance usage count |
| Different equipment count | Low | 1 | Equipment variety |
| Water bath usage | Low | 1 | Already captured in step time |

### Current Implementation

- Executed in **spreadsheet** (Excel export from BigQuery)
- Manual calculation of weighted scores
- Output tied to revenue data for prioritization

### Gaps

1. **Not integrated** into Cookbook or KDS
2. **Static analysis** - doesn't update with line build changes
3. **Missing factors:**
   - Parallel cooking paths (not captured)
   - Technique complexity (not encoded)
   - Customization variant impact (not weighted)
4. **No automation** - requires manual export/calculation cycle

---

## 2. Archetype Standardization

**Source:** [Line build & Archetype PRD](https://wonder.atlassian.net/wiki/spaces/~6363e9b913f37118d728a576/pages/3024158922)
**Owner:** CE (Shin Izumi), Product
**Status:** In Progress (partial)

### Purpose

Standardize line build texts and information to:
1. Optimize training programs by grouping dishes by procedure complexity
2. Enable pre-service station setup based on component/tool requirements
3. Limit dish complexity in R&D process

### Archetype Definition

Line build archetypes identify:
- **Cooking method** (heating appliance used)
- **Operational flow** (station sequence)
- **Garnish pattern**
- **Expo routing**

### Deliverables Planned

| Deliverable | Status |
|-------------|--------|
| Archetype definition | Partial |
| Standardized action verbs | In progress |
| Standardized service tools | In progress |
| BOM component tagging at every step | Not started |
| Station/rail location indicators | Not started |
| Complexity score integration | Not started |

### Standard Operating Procedure (from Confluence)

**Archetype SOP** defines process for:
1. Approving new archetypes
2. Rejecting archetypes that add operational complexity
3. Cross-functional review (CE, Product, Food Science)

### Gaps

1. **Doesn't capture parallel cooking** - Current definition assumes sequential flow
2. **No tool integration** - Archetypes defined in documentation, not in Cookbook
3. **Incomplete standardization** - Action/tool lists exist but not enforced
4. **No validation** - Free text still allows non-standard entries

---

## 3. Gemini AI Inference

**Source:** [Gemini Inference Plan for KDS T-Shirt Sizing](https://wonder.atlassian.net/wiki/spaces/~712020735951bb19ca4030aef4f98504f0b3da/pages/4150624762)
**Owner:** Brandon Galang, KDS Team
**Status:** Planned / POC

### Purpose

Use Gemini 2.0/2.5 Flash to:
1. Infer t-shirt sizes (XS/S/M/L/XL) for parking spot optimization
2. Backfill packaging ID mappings in line build steps

### Approach

**Task 1: T-Shirt Size Inference**
```
Input:  item_name (string)
Output: tshirt_size ("XS" | "S" | "M" | "L" | "XL")
```

Few-shot prompting with examples:
```
"Small Sauce Cup" → "XS"
"8oz Coffee Cup" → "S"
"Medium Bowl" → "M"
"Large Salad Bowl" → "L"
"Pizza Box" → "L"
"Family Platter" → "XL"
```

**Task 2: Packaging ID Mapping Backfill**
```
Input:  line_build_free_text + bom_components + available_packaging
Output: task_id → packaging_id mapping
```

Dual input strategy:
1. Parse packaging from line build free text (if mentioned)
2. Fall back to BOM components when free text is ambiguous

### Implementation Plan

**Phase 1:** Size all vending/packaging items via Gemini
- Backfill t-shirt size attribute
- Add to item attributes in Cookbook

**Phase 2:** Map packaging IDs to complete steps
- Parse free text + BOM
- Add packaging_id to complete step structure

**Phase 3:** API integration
- KDS retrieves t-shirt size via Cookbook attribute API
- Daily sync (not real-time) for updated attributes

### Applicability to Broader Problem

This approach demonstrates that **structured attributes can be derived from free text at scale**. The pattern could extend to:

| Inference Target | Input | Output |
|------------------|-------|--------|
| Technique classification | Step free text | Action enum (stir, flip, press, etc.) |
| Tool inference | Step free text | Tool ID (spoodle, tongs, ladle) |
| Component reference | Free text + BOM | related_item_number |
| Station assignment | Activity + appliance | Station enum |

### Gaps

1. **Scope limited** to t-shirt sizing and packaging mapping
2. **No technique inference** planned
3. **One-time backfill** - doesn't address ongoing data entry
4. **Validation unclear** - how to verify inference accuracy at scale

---

## 4. Line Builds 2.0 (Step Variants)

**Source:** [Line Builds 2.0 PRD](https://wonder.atlassian.net/wiki/spaces/~712020735951bb19ca4030aef4f98504f0b3da/pages/3424583764)
**Owner:** Product (Brandon Galang)
**Status:** Proposed

### Purpose

Reduce line build variant proliferation by allowing **step-level variations** within a single line build, rather than creating separate line builds per variant.

### Current Problem

Today, a single item can have multiple line builds that differ by only one step:
- Fryer vs. turbo oven cooking
- Runner vs. vending pod routing
- Different cook times for customizations

This creates massive data duplication.

### Proposed Solution

**Single Line Build with Step Variants:**
```
Line Build for Item X
├── Step 1: Prep (common)
├── Step 2: Cook
│   ├── Variant A: Fryer (for Restaurant 1, 2, 3)
│   └── Variant B: Turbo Oven (for Restaurant 4, 5)
├── Step 3: Garnish (common)
└── Step 4: Complete (common)
```

**Selection Logic:**
- Step variants tied to conditions (restaurant, customization, equipment)
- KDS resolves applicable variant at order time

### Key Features Proposed

| Priority | Feature |
|----------|---------|
| P1 | Step variant configuration |
| P1 | Conditional selection (restaurant, customization) |
| P2 | Bulk editing across steps |
| P2 | Dynamic updates when BOM changes |
| P3 | Find and replace for text |

### Gaps

1. **Doesn't address free text** - Consolidation doesn't fix data quality
2. **Still restaurant-based selection** - Variant mechanism maintained, just relocated
3. **No complexity scoring** - Doesn't add scoring infrastructure
4. **KDS dependency** - Requires KDS changes to support variant resolution

---

## 5. Reducing Line Build Configuration

**Source:** [Reducing Line Build Configuration](https://wonder.atlassian.net/wiki/spaces/TECHXIAMEN/pages/3460825156)
**Owner:** Tech/Product/CE/Ops
**Status:** Partial progress

### Purpose

Reduce duplicate data by minimizing cases where multiple line builds are required.

### Opportunities Identified

| Opportunity | Target | Status |
|-------------|--------|--------|
| Alternate appliances in single step | Restaurant-based selection | Proposed |
| Pod-based routing for vending | Vending task routing | ✅ Completed |
| Optional steps for direct-to-expo | Site-specific flows | Proposed |
| Single line build for customizations | Customization-based selection | Proposed |

### Pod-Based Routing (Completed)

Instead of using restaurant-based selection for vending task routing:
- Require only `Package` steps (not `Package` vs. `Bag`)
- Route based on presence/absence of vending pod at HDR
- Reduces line build variants for vending routing

### Constraints Identified

- **Cannot remove restaurant-based selection entirely** - Needed for A/B testing and incremental rollouts
- **UI complexity** - Single line build with many variants may be hard to visualize

---

## 6. Ops-Informed Step Times

**Source:** [Ops-Informed Line Build Step Times for Sequencing](https://wonder.atlassian.net/wiki/spaces/RT/pages/4146954722)
**Owner:** KDS/Ops
**Status:** Proposed

### Purpose

Replace static culinary-defined step times with dynamic, operationally-informed times.

### Problem

> "While line build suggests a production time of 0.8 minutes (48 seconds) for human time when we have all components hot-held, field observations indicate actual times closer to 2-3 minutes"

### Proposed Solution

Multi-phase approach:
1. **Phase 1:** Collect operational timing data
2. **Phase 2:** ML model to predict actual step times
3. **Phase 3:** Contextual awareness (kitchen load, staff level)
4. **Phase 4:** ML inference with real-time context
5. **Phase 5:** Computer vision for validation

### Relevance to Abstraction Design

- Step times are a **component of complexity scoring**
- Accurate times improve sequencing and throughput
- Demonstrates need for **operationally-grounded data** vs. culinary estimates

---

## 7. LineBuildPOC - Complexity Scoring App

**Source:** `/Documents/LineBuildPOC`, Dec 5 & Dec 8 meeting transcripts
**Owner:** Brandon Galang (POC), CE/Ops (methodology)
**Status:** In Development (Phase 1)

### Purpose

Turn the spreadsheet-based complexity scoring methodology into an interactive web application that:
1. Automatically calculates complexity scores from step data
2. Enables scenario modeling ("what if we change this step?")
3. Compares line build variants side-by-side
4. Provides AI-assisted analysis via copilot

### Implementation

**Tech Stack:** Next.js 14, shadcn/ui, Zustand, CopilotKit (Claude)

**Scoring Formula:**
- Hot/Cold Component: 30% (location-based weights)
- Technique: 40% (action-based weights)
- Packaging: 15%
- Task Count: 5%

**Key Concept:** `hotRatio` = Hot Pod Complexity / Total Complexity
- 1 Hot Pod feeds 3 Cold Pods
- High hotRatio items create throughput bottlenecks

### Current Data

- 100 real menu items with 1,787 steps
- Pre-structured JSON (not from BigQuery)
- Full location, technique, tool coverage

### Gaps

1. **Data source mismatch** - POC uses structured JSON; BigQuery has 99.99% free text
2. **Missing Confluence factors** - No cold-to-hot rotation, short appliance step detection
3. **Validation rules** - Stakeholders want deterministic checks, not just AI inference

### Relevance to Broader Initiative

The POC validates the UI pattern (Portfolio → Detail → Scenario) and scoring approach, but exposes the fundamental data gap: production line builds lack the structure the POC assumes exists.

---

## 8. Bulk Edit Functionality

**Source:** [Bulk Edit BOM Usages](https://wonder.atlassian.net/wiki/spaces/RT/pages/4187947209), related Jira tickets
**Owner:** Cookbook Product
**Status:** Implemented (BOM path only)

### Current Capability

Bulk swap works for:
- ✅ BOM component usages
- ✅ Component usages in recipes
- ⚠️ Customization usages (paused due to edge cases)
- ❌ Line build step mappings

### Gap

When bulk swapping a component:
1. BOM updates successfully
2. Customization mappings may break (paused feature)
3. **Line build step mappings require manual update**

This is the root cause of the "bacon incident" - bulk swap doesn't flow through to line builds.

---

## Summary: What's Solved vs. What Remains

### Solved or In Progress

| Problem | Initiative | Status |
|---------|------------|--------|
| Vending task routing variants | Pod-based routing | ✅ Complete |
| BOM component bulk swap | Bulk Edit BOM | ✅ Complete |
| Complexity scoring methodology | Spreadsheet analysis | ✅ Methodology defined |
| Complexity scoring tool | LineBuildPOC | 🔄 Phase 1 in progress |
| T-shirt size inference | Gemini AI | 🔄 In progress |
| Archetype definitions | Archetype SOP | 🔄 Partial |

### Unsolved

| Problem | Gap |
|---------|-----|
| Free text reliance | No initiative addresses 99.99% free text |
| BOM ↔ Line Build disconnect | Bulk swap doesn't propagate to line builds |
| Complexity scoring integration | Still spreadsheet-based, not in tool |
| Technique standardization | Defined but not enforced in tool |
| Parallel cooking capture | Not addressed by any initiative |
| Restaurant override proliferation | Still requires variant line builds |
| Machine-readable instructions | Blocked by free text architecture |

---

## Implications for New Abstraction Design

### Build On
1. **Complexity scoring methodology** - Validated factors, just needs integration
2. **LineBuildPOC UI patterns** - Portfolio → Detail → Scenario flow validated
3. **Gemini inference pattern** - Proven approach for deriving structure from text
4. **Archetype definitions** - CE has defined categories, needs tool support
5. **Step variant concept** - Good consolidation model, extend to other dimensions
6. **Bench-top line build concept** - CE-owned detailed builds vs. operationalized KDS builds

### Address
1. **Free text problem** - Either enforce structure or infer it at scale
2. **BOM synchronization** - New abstraction must maintain bidirectional mapping
3. **Technique encoding** - Add structured field for action/technique type
4. **Parallel cooking** - Dependency graph, not just sequential steps
5. **Operational grounding** - Step times from ops, not culinary estimates
