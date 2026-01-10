---
type: prd
status: draft
project: line-build-redesign
created: 2025-12-29
updated: 2025-12-29
author: Brandon Galang
stakeholders: [Jen West, Shin Izumi, Chris Alley, Jason Liao, John Wilson, Evan Fox, Kyle Garino, CDT Team, Training Team]
priority: high
tags: [complexity-scoring, line-builds, data-management]
version: 1.0
---

# Line Build Redesign: Complexity Scoring & Data Management

## Overview

This document outlines the requirements for redesigning how we structure and manage line build data. The immediate priority is delivering a **complexity scoring system**, but multiple teams have related needs that depend on the same underlying data structure.

Our goal is to define a data model that:
1. **Solves complexity scoring** (primary goal, Q4 deliverable)
2. **Enables future capabilities** without requiring them upfront
3. **Doesn't block** other teams from solving their problems as they get aligned

This is a living document. We need input from all stakeholder groups to ensure the data structure serves everyone's needs.

---

## Problem Statement

### What We Have Today

Line builds today are **99.99% free text**. The structured data that does exist is limited:
- Activity type (COOK, GARNISH, COMPLETE, VEND) — 100% coverage
- Component reference (related_item_number) — only 10.6% populated
- Appliance config — 24% populated

### Why This Is a Problem

**For Complexity Scoring:**
Chefs manually break down line builds into granular steps in Excel spreadsheets. This captures data that doesn't exist in our systems:
- Phase (pre-cook, cook, post-cook)
- Location (cold storage, hot hold, in kit)
- Tool (tongs, spoodle, etc.)
- Technique (open pack, portion, stir)

This manual process is unsustainable. It cannot scale to portfolio-wide changes or new menu additions.

**For Other Teams:**
Multiple teams need structured line build data for their own purposes, but the current free-text approach blocks them from building on top of it.

---

## Design Principle

**Build a base framework that works with minimal required data, then add optional fields that unlock additional capabilities.**

- Core complexity scoring should work with a small set of required fields
- Additional fields (location, tool, technique, timing) are optional but enable richer analysis
- Architecture should support future needs without requiring all data upfront
- Teams can layer their specific needs on top as they align

---

## Stakeholder Groups & Job Stories

Each stakeholder group has different needs from line build data. The job stories below capture what each group is trying to accomplish. These need validation through stakeholder conversations.

---

### 1. Culinary Engineering (CE)

**Primary Users:** Jen West, Shin Izumi, CE Chefs

**Context:** CE creates and maintains line builds. They need complexity scoring to inform menu decisions and operational trade-offs.

#### Job Stories

**Complexity Scoring**
> When I'm evaluating a menu item, I want to see its complexity score broken down by contributing factors, so I can understand what makes it complex and identify simplification opportunities.

**Variant Comparison**
> When operations is considering changing how we execute a dish (e.g., waterbath → turbo, individual pack → bulk), I want to compare the complexity of different approaches, so I can show them the operational trade-offs.

**Data Entry**
> When I'm documenting a new dish or updating an existing one, I want a structured way to capture the steps that's faster than Excel, so I can maintain accurate data without spending hours on manual entry.

**Consistency**
> When multiple chefs are entering line build data, I want validation rules that catch inconsistencies, so we maintain data quality across the portfolio.

#### Open Questions
- What validation rules are most important?
- What's the minimum data needed for a useful complexity score?
- How should prep complexity (pre-service) relate to service complexity?

---

### 2. HDR Operations

**Primary Users:** Chris Alley, Operations Managers

**Context:** Ops uses complexity data to make decisions about menu optimization, labor planning, and pod configuration.

#### Job Stories

**Menu Optimization**
> When I'm reviewing the menu portfolio, I want to see complexity scores alongside revenue data, so I can identify high-complexity, low-revenue items to remove or simplify.

**Pod Balancing**
> When I'm analyzing throughput issues, I want to understand the hot vs. cold complexity distribution, so I can identify bottlenecks (1 hot pod feeds 3 cold pods).

**Labor Planning**
> When I'm planning staffing, I want to estimate labor requirements based on complexity and expected volume, so I can staff appropriately.

**Change Impact**
> When we're considering operational changes (equipment swaps, SKU changes), I want to see how it affects complexity across the portfolio, so I can make informed decisions.

#### Open Questions
- What complexity factors matter most for operational decisions?
- How should we weight hot pod complexity vs. cold pod complexity?
- What throughput data will be available and when?

---

### 3. Product Team (Cooking Groups)

**Primary Users:** Jason Liao, Product Managers

**Context:** Cooking groups determine how items are routed through the kitchen. Currently, cooking group decisions are arbitrary and managed manually.

#### Job Stories

**Cooking Group Framework**
> When I'm setting up cooking groups, I want a framework based on component and equipment data, so I can make principled decisions instead of arbitrary ones.

**Routing Logic**
> When a menu item needs to be assigned to a cooking group, I want to understand its equipment requirements and component dependencies, so I can route it correctly.

#### Open Questions
- What data is needed to make cooking group decisions?
- How much can be automated vs. requires manual judgment?
- Who should own cooking group assignments long-term?

---

### 4. NSO Team (New Store Openings)

**Primary Users:** John Wilson

**Context:** NSO currently handles cooking group routing assignments manually. This is an ad-hoc responsibility that doesn't scale.

#### Job Stories

**Routing Assignment**
> When a cooking group routing issue arises, I want clear data about where items should be routed, so I don't have to guess or rely on tribal knowledge.

**Scaling**
> When we're opening new stores, I want routing to be derived from the data rather than manually configured, so we can scale without bottlenecks.

#### Open Questions
- What's the current routing assignment workflow?
- What would make routing decisions more automatic?

---

### 5. Optimization Team

**Primary Users:** Evan Fox, Michael Collis

**Context:** The optimization team wants to improve kitchen sequencing and throughput. They need structured data to feed into optimization algorithms.

#### Job Stories

**Sequencing Optimization**
> When I'm optimizing kitchen sequencing, I want structured data about step dependencies and equipment requirements, so I can model the kitchen workflow accurately.

**Pod Configuration**
> When I'm analyzing pod configurations, I want to understand component flows and assembly dependencies, so I can optimize for throughput.

#### Open Questions
- What data structure would be most useful for optimization?
- How granular does component-level tracking need to be?
- What integration points are needed?

---

### 6. Waste & Inventory Team

**Primary Users:** Kyle Garino

**Context:** Waste tracking requires accurate yield data and understanding of how ingredients flow through prep and service.

#### Job Stories

**Yield Tracking**
> When I'm analyzing waste, I want accurate yield data for each prep and service step, so I can identify where losses occur.

**Inventory Accuracy**
> When I'm tracking inventory at the HDR, I want to understand how components are used and transformed, so inventory counts are accurate.

#### Open Questions
- What yield data needs to be captured?
- How does prep workflow connect to service workflow for waste tracking?
- What's causing current yield data accuracy issues?

---

### 7. Training Team

**Primary Users:** Training Managers

**Context:** Training creates prep cards (PDFs) that describe how to perform prep tasks. There's no systematic complexity scoring for prep.

#### Job Stories

**Prep Documentation**
> When I'm creating training materials, I want structured prep instructions that are consistent across items, so training is standardized.

**Prep Complexity**
> When I'm planning HDR workload, I want to understand prep complexity separate from service complexity, so I can account for pre-service labor.

#### Open Questions
- What format are prep cards currently in?
- How should prep complexity relate to service complexity?
- What would make prep instructions more consistent?

---

### 8. CDT (Cookbook Data Team)

**Primary Users:** CDT Team Members

**Context:** CDT manages line build data entry and maintenance. Current process is manual and lacks bulk editing capabilities.

#### Job Stories

**Bulk Editing**
> When a tool or equipment changes across the portfolio, I want to make the change in one place and have it apply everywhere, so I don't have to edit hundreds of line builds manually.

**Data Quality**
> When I'm entering line build data, I want validation that catches common mistakes, so data stays consistent.

**Efficiency**
> When I'm updating line builds, I want a faster workflow than the current tool, so I can keep up with the pace of changes.

#### Open Questions
- What bulk editing scenarios are most common?
- What validation rules would catch the most mistakes?
- What's the current workflow pain points?

---

## Functional Requirements

The requirements below are organized by priority. Primary requirements must be satisfied for the Q4 deliverable. Secondary requirements should be enabled by the architecture but can be delivered later.

### Primary Requirements (Complexity Scoring)

#### R1: Automated Complexity Scoring
Calculate complexity scores automatically from structured step data. Scores should be comparable across the portfolio and break down into understandable components.

**Needs validation:** What scoring formula best reflects operational reality?

#### R2: Variant Comparison
Compare complexity between different configurations of the same dish (equipment variants, pack size changes, etc.).

**Needs validation:** What comparisons are most valuable?

#### R3: Hot/Cold Pod Analysis
Break down complexity by hot pod vs. cold pod to identify throughput bottlenecks (1 hot pod feeds 3 cold pods).

**Needs validation:** How should hot vs. cold complexity be weighted?

#### R4: Data Entry Interface
Provide structured data entry that's faster and more consistent than the current Excel approach.

**Needs validation:** What fields are required vs. optional?

### Secondary Requirements (Enable, Don't Block)

#### R5: Bulk Editing
Support portfolio-wide changes (tool swaps, equipment changes) without manual re-entry.

#### R6: Validation Rules
Catch inconsistencies and common mistakes during data entry.

#### R7: AI Assistance
Use AI to suggest structured fields from free text and identify patterns across the portfolio.

#### R8: Prep Complexity (Future)
Separate complexity scoring for prep/pre-service tasks.

#### R9: Component-Level Routing (Future)
Track component assembly states for routing optimization.

#### R10: Throughput Integration (Future)
Combine complexity with sales/waste data for optimization.

---

## Data Model (Draft)

The data model should support all stakeholder needs without requiring all fields upfront. This is a draft for discussion.

### Required Fields (For Basic Scoring)
- Step reference (which step in the sequence)
- Target (what component/item this step acts on)
- Action family (high-level category: HEAT, TRANSFER, ASSEMBLE, etc.)

### Optional Fields (Unlock Additional Capabilities)
- Phase (PRE_COOK, COOK, POST_COOK, PASS)
- Station (where the step happens)
- Location (where the component comes from)
- Tool (what tool is used)
- Technique (specific action detail)
- Timing (duration, active vs. passive attention)
- Equipment (appliance and settings)

### Scoring Components (Draft)
Current thinking based on Shin's spreadsheet methodology:
- Component complexity (where things come from) — ~30%
- Technique complexity (how things are done) — ~40%
- Packaging complexity (final assembly) — ~15%
- Task count (number of steps) — ~5%

**Needs validation:** Does this weighting reflect operational reality?

---

## Open Questions (For Stakeholder Conversations)

### Complexity Scoring
1. What factors contribute most to operational complexity?
2. How should we weight hot pod vs. cold pod work?
3. What's the minimum data needed for a useful score?
4. How do we validate that scores match operational reality?

### Data Structure
5. What fields are truly required vs. nice-to-have?
6. How should prep complexity relate to service complexity?
7. What validation rules would catch the most common mistakes?

### Integration
8. What data does the optimization team need?
9. When will throughput data be available?
10. What KDS changes would be needed to use new data?

### Process
11. Who should own cooking group assignments?
12. What's the routing assignment workflow today?
13. How do prep cards get created and maintained?

---

## Next Steps

1. **Stakeholder Conversations**
   - CE (Jen, Shin): Validate complexity scoring approach
   - Ops (Chris): Validate operational requirements
   - Product (Jason): Understand cooking group needs
   - Optimization (Evan): Understand data requirements
   - Waste (Kyle): Understand yield data needs

2. **Prototype Iteration**
   - Build scoring engine with draft methodology
   - Test with real menu items
   - Iterate based on stakeholder feedback

3. **Data Migration Planning**
   - Assess AI inference accuracy for existing data
   - Plan human validation workflow
   - Identify gap-filling priorities

---

## Appendix: Related Documents

- `prd-reference-first-line-builds.md` — Earlier PRD on reference-first structure
- `analysis-current-state-v1.md` — Current line build data analysis
- `analysis-poc-context-v1.md` — POC context and scoring methodology
- `research-pain-points-constraints.md` — Stakeholder pain points
- Meeting transcripts (Dec 5, Dec 29)

---

*Document Version: 1.0*
*Last Updated: 2025-12-29*
*Status: Draft — Needs Stakeholder Input*
