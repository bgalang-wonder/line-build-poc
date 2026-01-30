---
type: prd
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
priority: high
tags: [schema, line-builds, complexity-scoring, q1-2026]
audience: business-stakeholders
version: 0.1
---

# Line Build Schema v1: Business Requirements

> **Audience:** Jen (Ops), Shin (CE), Michelle (KDS), Leadership\
> \*\***Purpose:** Define what information we capture about line builds and why

---

## What Are We Building?

A **standard way to describe line builds** that lets us:

1. **Compute complexity scores automatically** — No more spreadsheets

2. **Make bulk changes reliably** — Swap ingredients across 100 items at once

3. **Support future automation** — KDS sequencing, robot translation, etc.

Think of it as creating a **common language** for how we describe cooking instructions.

---

## The Core Idea: Every Step Has Structure

Today, line builds are mostly free text:

> "Open pouch, place chicken in waterbath for 5 min, transfer to AMBER pan"

We're adding structure so computers can understand:

| What We Capture | Example | Why It Matters |
| --- | --- | --- |
| **Action** | Heat, Transfer, Assemble | Know what type of work is happening |
| **Target** | Chicken Breast (150g) | Track which ingredient we're working with |
| **Equipment** | Waterbath, Fryer, Turbo | Calculate equipment-based complexity |
| **Time** | 5 minutes (passive) | Distinguish active work from waiting |
| **Container** | AMBER Pan, 32oz Bowl | Track packaging complexity |
| **Phase** | Pre-cook, Cook, Post-cook | Understand workflow sequence |

**The free text stays.** We're adding structure alongside it, not replacing it.

---

## What Does a Structured Step Look Like?

### Before (Free Text Only)

```
"Open pouch, place chicken in waterbath for 5 min"
```

### After (Structured + Free Text)

| Field | Value |
| --- | --- |
| **Action** | HEAT |
| **Target** | Chicken Breast (150g) |
| **Equipment** | Waterbath |
| **Time** | 5 minutes (passive) |
| **Phase** | Cook |
| **Notes** | "Open pouch, place chicken in waterbath for 5 min" |

The notes field preserves the original text. The structured fields let us compute things.

---

## The Nine Action Types

Every step falls into one of these categories:

| Action | What It Means | Examples |
| --- | --- | --- |
| **PREP** | Get ingredient ready | Open pouch, unwrap, stage |
| **HEAT** | Apply heat | Fry, turbo, waterbath, toast |
| **TRANSFER** | Move between locations | Place in pan, move to station |
| **COMBINE** | Mix ingredients | Add sauce, stir, mix |
| **ASSEMBLE** | Build the final product | Stack, wrap, layer |
| **PORTION** | Measure quantity | Scoop 2oz, weigh 150g |
| **CHECK** | Quality verification | Temp check, visual QA |
| **PACKAGING** | Package and hand off | Bag, label, pass to runner |
| **OTHER** | Doesn't fit above | Special instructions |

**Goal:** Less than 10% of steps should need "OTHER"

---

## How This Enables Complexity Scoring

With structured data, we can automatically calculate:

### Step-Based Metrics

- **Total step count** — More steps = more complex

- **Equipment variety** — Using 5 appliances vs 2 = more complex

- **Short appliance steps** — Steps under 45 seconds require more attention

### Time-Based Metrics

- **Total cook time** — Sum of all HEAT step durations

- **Active vs passive time** — Chef working vs waiting

- **Back-to-back turbo** — Consecutive turbo steps = bottleneck risk

### Workflow Metrics

- **Hot/cold ratio** — What % of work is on hot line vs assembly?

- **Cold-to-hot rotation** — Switching between stations = complexity

- **Packaging complexity** — Number of container/vend steps

### Example Calculation

| Menu Item | Steps | Equipment Types | Hot Ratio | Complexity Score |
| --- | --- | --- | --- | --- |
| Simple Salad | 8 | 1 (none) | 0% | Low |
| Chicken Sandwich | 15 | 3 (turbo, fryer, toaster) | 45% | Medium |
| Surf & Turf | 28 | 5 (waterbath, fryer, turbo, salamander, induction) | 65% | High |

---

## What's In vs Out of Scope

### In Scope (v1)

✅ Define the standard structure for line build steps\
✅ Enable complexity scoring from structured data\
✅ Support bulk operations (ingredient swaps, equipment changes)\
✅ Track data quality (what's structured vs free text)\
✅ Design for future KDS/automation needs

### Out of Scope (v1)

❌ Changing KDS or how instructions display\
❌ Building the scoring algorithm (that's a separate project)\
❌ Migrating all existing line builds (that's a backfill project)\
❌ AI-generated line builds\
❌ Equipment-based line build selection

---

## What We Need From You

### Jen (Ops)

- [ ] **Validate scoring factors** — Can you compute what you need from these fields?

- [ ] **Review hot/cold classification** — Which equipment is "hot line" vs "cold"?

- [ ] **Confirm complexity formula** — Does this match your spreadsheet methodology?

### Shin (CE)

- [ ] **Validate action types** — Do these 9 categories cover your line builds?

- [ ] **Review container field** — Is this how you think about packaging?

- [ ] **Test with real items** — Pick 5 complex items and walk through the structure

### Michelle (KDS)

- [ ] **Confirm extension points** — Does this design support future sequencing?

- [ ] **Review phase model** — Pre-cook/Cook/Post-cook/Pass — does this work?

- [ ] **Flag blocking concerns** — Anything that would prevent KDS integration?

---

## Timeline

| Week | Milestone |
| --- | --- |
| 1-2 | Schema definition + stakeholder review |
| 3-4 | Golden set validation (20-50 items) |
| 5-6 | Scoring derivation testing |
| 7-8 | Documentation + handoff |

---

## Success Criteria

1. **Jen can compute complexity scores** from structured data (no spreadsheets)

2. **Shin can author line builds** with clear, consistent structure

3. **Michelle confirms** the schema doesn't block future KDS work

4. **95%+ of steps** can be represented without using "OTHER"

---

## Questions?

This document explains the "what" and "why." For technical implementation details (data types, validation rules, API contracts), see the [Technical Specification](./SPEC-TECHNICAL.md).

---

## Appendix: Visual Example

### A Complete Line Build (Chicken Sandwich)

```
┌─────────────────────────────────────────────────────────────┐
```

`│ MENU ITEM: Crispy Chicken Sandwich │`\
`│ COMPLEXITY: Medium (Score: 42) │`\
`├─────────────────────────────────────────────────────────────┤`\
`│ │`\
`│ HOT LINE (Steps 1-4) │`\
`│ ───────────────────── │`\
`│ │`\
`│ Step 1: PREP │`\
`│ Target: Chicken Breast (150g) │`\
`│ Phase: Pre-cook │`\
`│ Notes: "Open pouch, stage for fryer" │`\
`│ │`\
`│ Step 2: HEAT │`\
`│ Target: Chicken Breast (150g) │`\
`│ Equipment: Fryer │`\
`│ Time: 4 min (passive) │`\
`│ Phase: Cook │`\
`│ Notes: "Fry until golden, 165°F internal" │`\
`│ │`\
`│ Step 3: TRANSFER │`\
`│ Container: AMBER Pan │`\
`│ Phase: Post-cook │`\
`│ Notes: "Rest in holding pan" │`\
`│ │`\
`│ Step 4: HEAT │`\
`│ Target: Brioche Bun │`\
`│ Equipment: Toaster │`\
`│ Time: 30 sec (passive) │`\
`│ Phase: Cook │`\
`│ Notes: "Toast cut-side down" │`\
`│ │`\
`├─────────────────────────────────────────────────────────────┤`\
`│ │`\
`│ ASSEMBLY (Steps 5-8) │`\
`│ ──────────────────── │`\
`│ │`\
`│ Step 5: ASSEMBLE │`\
`│ Target: Brioche Bun (bottom) │`\
`│ Notes: "Place on wrapper" │`\
`│ │`\
`│ Step 6: COMBINE │`\
`│ Target: Spicy Mayo (1oz) │`\
`│ Notes: "Spread on bottom bun" │`\
`│ │`\
`│ Step 7: ASSEMBLE │`\
`│ Target: Chicken Breast │`\
`│ Notes: "Place chicken, add pickles, top bun" │`\
`│ │`\
`│ Step 8: PACKAGING │`\
`│ Container: Foil Wrapper + Delivery Bag │`\
`│ Notes: "Wrap, bag, pass to runner" │`\
`│ │`\
`└─────────────────────────────────────────────────────────────┘`

`COMPLEXITY BREAKDOWN:`\
`├── Step Count: 8 steps`\
`├── Equipment: 2 types (Fryer, Toaster)`\
`├── Hot Ratio: 50% (4 hot line steps)`\
`├── Active Time: 2 min`\
`├── Passive Time: 4.5 min`\
`└── Packaging: 2 items (wrapper + bag)`

---

## Appendix: Field Reference (Plain English)

| Field | What It Is | When to Use It |
| --- | --- | --- |
| **Action** | The type of work (PREP, HEAT, etc.) | Every step — required |
| **Target** | The ingredient or item being worked on | Most steps — strongly recommended |
| **Equipment** | The appliance used | HEAT steps — required |
| **Time** | How long the step takes | When timing matters |
| **Container** | The vessel or packaging | TRANSFER and PACKAGING steps |
| **Phase** | When in cooking process | HEAT steps — recommended |
| **Exclude** | "Do NOT include this" | "No onions" type instructions |
| **Notes** | Free text for anything else | Always allowed |
