---
type: analysis
status: current
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
priority: high
tags: [line-builds, abstraction-design, data-model, architecture]
related: [research-discovery-overview.md, research-existing-initiatives.md]
version: 1
confidence: medium
data_sources: [bigquery-analysis, confluence-research, slack-research, colleague-analysis]
analysis_date: 2025-12-16
data_freshness: current
staleness_trigger: "New abstraction requirements or design decisions"
open_questions: [What mental model do ops use?, How granular should interchangeability be?, Who defines interchangeability?, How do we handle failure modes?]
---

# Abstraction Design Context

## Overview

This document synthesizes discovery findings into context for designing new line build abstractions. It includes candidate approaches from collaborative analysis, design considerations, and open questions that need resolution before implementation.

---

## The Core Design Challenge

### Current State

Line builds are **human-readable instructions** encoded as free text with minimal structure.

### Desired State

Line builds should be **machine-queryable data** that enables:

1. Programmatic complexity scoring

2. Bulk operations across portfolio

3. Component-level traceability

4. Robot/automation translation

### The Gap

Moving from human-readable to machine-queryable requires **new abstractions** that:

- Capture the semantic meaning currently in free text

- Maintain compatibility with existing workflows

- Enable the operations we want to support

---

## Candidate Abstractions

The following abstractions were identified through collaborative analysis as potential approaches. Each addresses different aspects of the problem.

### 1. Item Archetypes

**Concept:** Cluster menu items by preparation pattern (e.g., "Turbo Fire + Garnish", "Double Turbo + Cold Finish", "Fryer Only").

**What It Captures:**

- Cooking method (appliance sequence)

- Station flow (hot → cold → expo)

- Operational category

**Data Evidence:**

- 16 distinct appliance types in system

- Activity types (COOK, GARNISH, COMPLETE, VEND) are 100% populated

- Existing "Cooking Groups" tag with 530 items

- Existing "Dish Category" tag with 211 items (Entrees, Sides, etc.)

**Strengths:**

- Aligns with existing CE mental model

- Partial infrastructure exists (tags, archetype SOP)

- Good for training program organization

**Weaknesses:**

- Doesn't capture component-level detail

- Doesn't address BOM ↔ Line Build disconnect

- Current definition doesn't handle parallel cooking

**Open Questions:**

- What is the right granularity? (Too few = not useful, too many = not groupable)

- How do we handle items that span archetypes (e.g., pizza with both turbo and conveyor)?

---

### 2. Interchangeability Groups

**Concept:** Define which components can substitute for each other in line builds (e.g., "any 25g sauce cup" or "any grilled protein").

**What It Captures:**

- Substitution logic for component swaps

- Bulk edit scope

- Operational equivalence

**Data Evidence:**

- `related_item_number` field exists but only 10.6% populated

- Customization option mappings exist (53.7% coverage)

- BOM component structure defines hierarchy

**Strengths:**

- Directly addresses BOM ↔ Line Build disconnect

- Enables bulk swap to propagate through system

- Maps to ops concept of "interchangeable ingredients"

**Weaknesses:**

- Who defines interchangeability? (CE? Ops? System inference?)

- Granularity unclear (item level? category level? attribute level?)

- Risk of over-grouping (losing important distinctions)

**Open Questions:**

- Is interchangeability symmetric? (If A can substitute B, can B substitute A?)

- How do we handle conditional interchangeability? (Same sauce, different form factor)

- What happens when interchangeability breaks? (Different cook time, different technique)

---

### 3. Slot Roles

**Concept:** Define abstract "slots" in a line build (e.g., "Protein Slot", "Sauce Slot", "Garnish Slot") that can be filled by specific items.

**What It Captures:**

- Structural position in assembly

- Required vs. optional components

- Customization attachment points

**Data Evidence:**

- Line build procedures have ordered steps

- Customization options already map to steps

- BOM defines component structure by function

**Strengths:**

- Enables template-based line builds

- Customization becomes "fill this slot with X"

- Reduces duplication (slot definition shared across items)

**Weaknesses:**

- Not how ops currently thinks about builds

- May oversimplify items with non-standard structures

- Requires significant mental model shift

**Open Questions:**

- How many standard slots exist? (Is this a manageable set?)

- How do we handle items that don't fit slot templates?

- Who maintains slot definitions?

---

### 4. Hybrid Approach

**Concept:** Combine multiple abstractions for different purposes:

- **Archetypes** for high-level categorization and training

- **Interchangeability Groups** for bulk operations

- **Structured Step Attributes** for complexity scoring

**What It Captures:**

- Multiple dimensions of the problem

- Different stakeholder needs with appropriate granularity

**Potential Architecture:**

```
Item
```

`├── Archetype: "Turbo Fire + Cold Garnish"`\
`├── Complexity Score: 245 (calculated)`\
`└── Line Build`\
`└── Steps[]`\
`├── Activity: COOK`\
`├── Technique: "sear" (new structured field)`\
`├── Tool: "flat_griddle" (new structured field)`\
`├── Component: 4000123 (interchangeability group: "25g_sauce_cup")`\
`├── Step Time: 45s (ops-informed)`\
`└── Free Text: "Sear protein on flat griddle" (legacy support)`

**Strengths:**

- Addresses multiple pain points

- Incremental adoption possible

- Preserves flexibility while adding structure

**Weaknesses:**

- More complex to implement

- Multiple systems to maintain

- Potential for inconsistency between layers

---

## Design Considerations

### 1. Ops Mental Model Alignment

**Question:** What mental model do ops/CE actually use when thinking about line builds?

**Evidence from Research:**

- CE thinks in **archetypes** (cooking method + flow)

- Training thinks in **techniques and tools** (action verbs, smallware)

- Ops thinks in **station setup** (what components at which station)

- KDS thinks in **task timing** (when to fire, dependencies)

**Implication:** Different abstractions may serve different stakeholders. Hybrid approach may be necessary.

---

### 2. Cardinality and Granularity

**Question:** How granular should groupings be?

| Granularity | Example | Count | Use Case |
| --- | --- | --- | --- |
| Very coarse | Dish Category | 6 values | Reporting, menu structure |
| Coarse | Archetype | \~15-30 | Training programs |
| Medium | Cooking Group | 530 items | Station assignment |
| Fine | Component | \~2000+ | BOM management |
| Very fine | Step | \~486K rows | Line build detail |

**Implication:** Different operations require different granularity. Scoring needs fine-grained data; training needs coarse groupings.

---

### 3. Ownership and Maintenance

**Question:** Who defines and maintains these abstractions?

| Abstraction | Natural Owner | Risk |
| --- | --- | --- |
| Archetypes | CE | Proliferation over time |
| Interchangeability | CE + Procurement | Disagreement on equivalence |
| Slot Roles | Product | Doesn't match ops reality |
| Structured Attributes | System (AI inference) | Accuracy, edge cases |

**Implication:** Consider AI inference + human validation workflow (like T-shirt sizing approach).

---

### 4. Failure Mode Handling

**Question:** What happens when abstractions break down?

**Scenario Examples:**

1. New item doesn't fit any archetype → Create new archetype? Force into existing?

2. Interchangeable item has different cook time → Override at step level? Block substitution?

3. Slot template doesn't match item structure → Custom build? Template extension?

**Implication:** Need clear escalation path and exception handling mechanism.

---

### 5. Migration Strategy

**Question:** How do we get from current state to new abstractions?

**Options:**

| Strategy | Approach | Risk |
| --- | --- | --- |
| Big Bang | Define all abstractions, migrate all data | High risk, long timeline |
| AI Backfill | Infer structure from free text, validate | Accuracy dependent |
| Incremental | Add optional structured fields, populate over time | Slow adoption |
| New Items Only | Require structure for new items, legacy remains free text | Dual maintenance |

**Recommendation:** AI backfill (Gemini approach) with human validation, similar to T-shirt sizing initiative.

---

## Scoring Model Integration

### Existing Complexity Factors (from Confluence)

| Factor | Weight | Data Source |
| --- | --- | --- |
| Short appliance steps (&lt;45s) | 100 | Step time + appliance config |
| Cold-to-hot rotation | 100 | Activity sequence analysis |
| Back-to-back turbo | 100 | Appliance config + step dependency |
| Total cook time | 0.01 | Step time aggregation |
| Total step time | 0.01 | Step time aggregation |
| Step count | 1 | Line build structure |
| Equipment step count | 1 | Activity type = COOK |
| Equipment variety | 1 | Distinct appliance configs |

### Additional Factors to Consider

| Factor | Rationale | Data Requirement |
| --- | --- | --- |
| Parallel cooking paths | Items with split/merge flows | Dependency graph |
| Customization complexity | More options = more training | Option count |
| Restaurant override count | More variants = more maintenance | Line build count per item |
| Technique variety | More techniques = harder to learn | Structured technique field |
| Tool variety | More tools = more station setup | Structured tool field |

### POC Scope Question

For the immediate POC, should we:

1. **Implement existing methodology in tool** (factors already defined)

2. **Expand methodology first** (add parallel cooking, technique)

3. **Start with AI inference** (derive factors from free text)

---

## Open Questions for Resolution

### Operational Questions

1. **What mental model do ops use?**

   - How do cooks and managers actually think about line build complexity?

   - Do they think in archetypes, components, techniques, or something else?

2. **How do we validate interchangeability?**

   - Who is the authority on "these two items are interchangeable"?

   - What happens when CE says yes but ops says no?

3. **What's the acceptable error rate for AI inference?**

   - If Gemini gets 95% right, is that good enough?

   - How do we catch and fix the 5% errors?

### Technical Questions

4. **How do we handle parallel cooking?**

   - Current schema is sequential (procedures → steps)

   - Do we need a dependency graph structure?

5. **How do we maintain BOM ↔ Line Build sync?**

   - Should line build steps auto-update when BOM changes?

   - What's the trigger and validation mechanism?

6. **What's the KDS contract?**

   - What data does KDS need from line builds?

   - Can KDS handle new structured fields?

### Prioritization Questions

7. **What's the highest-value problem to solve first?**

   - Complexity scoring integration?

   - Bulk operations?

   - BOM disconnect?

   - Standardization?

8. **What's the minimum viable abstraction?**

   - Can we start with structured attributes only (no new groupings)?

   - What's the smallest change that unlocks the most value?

---

## Recommended Next Steps

1. **Validate scoring factors with ops**

   - Confirm the complexity methodology matches operational reality

   - Identify missing factors (parallel cooking, technique)

2. **Prototype AI inference for technique/tool**

   - Extend Gemini approach from T-shirt sizing

   - Test accuracy on sample of line build free text

3. **Define minimum viable structure**

   - Identify smallest set of structured fields that enable scoring

   - Design migration path for existing data

4. **Align with KDS on data contract**

   - Ensure new structure is consumable by downstream systems

   - Identify any KDS changes required

5. **Build POC for scoring integration**

   - Calculate complexity scores from structured data

   - Compare to spreadsheet methodology for validation