---
type: research
status: current
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
priority: high
tags: [line-builds, discovery, research-index]
related: [README.md, analysis-current-state-v1.md, research-pain-points-constraints.md]
---

# Line Build Redesign: Discovery Overview

## Discovery Scope

This research synthesizes findings from three sources to understand the line build problem space:

1. **BigQuery Data Analysis** - Direct examination of `item_line_builds` table structure and coverage
2. **Slack Discussions** - Real-time pain points from CE, Ops, KDS, and Product teams
3. **Confluence Documentation** - PRDs, meeting notes, and prior initiative documentation

## Key Discovery Findings

### The Fundamental Problem

> "Existing Line Builds are 'directional' and task-based for humans, not structured for machines. They do not contain precise ID/sequence logic."
> — System & Data Considerations: Wonder Create x Infinite Kitchen

Line builds evolved as human-readable cooking instructions. The system lacks:
- Structured component references (only 10.6% of steps have `related_item_number`)
- Machine-parseable action/technique encoding
- Bidirectional BOM synchronization
- Bulk operation support

### Data Reality (from BigQuery)

| Metric | Value | Implication |
|--------|-------|-------------|
| Total rows | 486,647 | Scale of maintenance burden |
| Has structured item reference | 10.6% | ~90% relies on free text |
| Has appliance config | 24.1% | Structured for some activities |
| Has free text title | 99.99% | Everything falls back to text |
| Items with customization options | 71 (8%) | Most are fixed builds |
| Items with restaurant overrides | 201 (24%) | Location variants multiply complexity |

### Activity Type Coverage

| Activity | Count | % of Total | Structured Reference Rate |
|----------|-------|------------|---------------------------|
| GARNISH | 58% | Largest category | 4% (mostly free text) |
| COOK | 24% | Kitchen operations | 17.7% (some structure) |
| COMPLETE | 13% | Packaging/finish | 45% (best structured) |
| VEND | 5% | Delivery | ~50% (decent structure) |

### Line Build Variant Distribution

```
1 variant:  574 items (74%) - Simple, single path
2 variants: 112 items (14%) - Dual configuration
3 variants:  58 items (7%)  - Moderate complexity
4+ variants: 34 items (4%)  - High complexity
```

## Discovery Documents

### [analysis-current-state-v1.md](analysis-current-state-v1.md)
**What:** Detailed BigQuery data analysis with query results
**Key Finding:** Structured fields exist but are systematically underutilized; free text carries semantic meaning that should be in structured fields

### [research-pain-points-constraints.md](research-pain-points-constraints.md)
**What:** Comprehensive catalog of documented pain points from Slack and Confluence
**Key Finding:** Five major problem categories identified across stakeholder groups

### [research-existing-initiatives.md](research-existing-initiatives.md)
**What:** Summary of prior/ongoing work (archetypes, complexity scoring, AI inference, Line Builds 2.0)
**Key Finding:** Multiple partial solutions exist; none address the fundamental data model gap

### [analysis-abstraction-context-v1.md](analysis-abstraction-context-v1.md)
**What:** Context for abstraction design including colleague's candidate approaches
**Key Finding:** Four candidate abstractions (Archetypes, Interchangeability Groups, Slot Roles, Hybrid) each with different tradeoffs

## Sources Consulted

### Confluence Pages (Primary)
- Line Builds Revamp (stakeholder pain points workshop)
- Complexity Analysis of Line Builds (scoring methodology)
- Line build & Archetype PRD (standardization initiative)
- Reducing Line Build Configuration (complexity reduction)
- Gemini Inference Plan for KDS T-Shirt Sizing (AI approach)
- System & Data Considerations: Wonder Create x Infinite Kitchen (future requirements)
- Line Builds 2.0 PRD (consolidation proposal)
- Archetype Standard Operating Procedure (definitions)

### Slack Channels Searched
- #cookbook-help
- #kds-requests
- #data-help
- General search across workspace

### BigQuery Tables Queried
- `secure-recipe-prod.recipe_v2.item_line_builds`
- `secure-recipe-prod.recipe_v2.item_versions`
- `wonder-recipe-prod.mongo_batch_recipe_v2.tags`
- `wonder-recipe-prod.mongo_batch_recipe_v2.tag_groups`

## Next Steps

1. **Synthesize POC Requirements** - Define minimum viable complexity scoring approach
2. **Validate with Stakeholders** - Confirm pain point prioritization with CE, Ops, KDS
3. **Prototype Data Model** - Test candidate abstractions against real line build data
4. **Align with Product Catalog** - Ensure compatibility with 40*/41* model transition
