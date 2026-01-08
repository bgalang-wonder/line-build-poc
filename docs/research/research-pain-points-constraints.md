---
type: research
status: current
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
priority: high
tags: [line-builds, pain-points, constraints, user-research]
related: [research-discovery-overview.md, analysis-current-state-v1.md]
data_sources: [confluence:Line Builds Revamp, confluence:Reducing Line Build Configuration, slack:#cookbook-help, slack:#kds-requests]
---

# Line Build Pain Points & Constraints

## Overview

This document catalogs pain points and constraints identified across stakeholder groups through Slack discussions and Confluence documentation. Pain points are organized by category and attributed to specific sources where available.

---

## Pain Point Categories

### 1. Tool Usability and Functionality

**Summary:** The line build tool's design complexity and manual nature lead to user errors and require frequent feature updates.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| Manual and unstructured nature leads to downstream defects | CDT, CE | Line Builds Revamp |
| Testing requires full portal setup before ops trial | CDT | Line Builds Revamp |
| No "Find and Replace" pattern for bulk text updates | CE | Line Builds 2.0 Notes |
| Steep learning curve and operational inefficiencies | CDT | Line Builds Revamp |
| Cannot preview exactly how customizations appear on KDS | CDT | Line Builds Revamp |

#### User Quotes

> "Making edits to line builds manually, updating 5 times for the steaks" — Chris, CDT

> "The ease of ability to test the line builds because you need to set it up in the portal to be able to actually test it correctly and then have to wait for ops trial and then last minute to make changes" — CDT

> "I'm wondering if the 'Find and Replace' pattern of updating text in a document could be translated to identifying line build steps that match a criteria and quickly updating them." — Line Builds 2.0 Notes

---

### 2. Data Integrity and Management

**Summary:** Inconsistent data entry and lack of validation rules result in operational inaccuracies and scalability challenges.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| Free text fields lead to data entry mistakes | CDT, CE | Line Builds Revamp |
| Inconsistencies between item names in line builds vs. schematic/ERP labels | Ops, Training | Line Builds Revamp |
| No central view/management system for line build information | Product | Line Builds Revamp |
| Data migration difficult due to free text reliance | Engineering | Line Builds Revamp |
| Component names not mapped to common names | CDT | Line Builds Revamp |

#### User Quotes

> "All free text, hard to map things" — CDT

> "Free text fields lead to data entry mistakes and make data migration difficult." — Line Builds Revamp

> "Inconsistent naming and images: 'I struggle with knowing what to name things and what images to use, leading to confusion and inconsistencies.'" — Line Builds Revamp

---

### 3. BOM ↔ Line Build Disconnect

**Summary:** Component changes in BOMs do not flow through to line builds, breaking mappings and requiring manual reconciliation.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| Line builds don't automatically update with BOM changes | CDT, CE | Line Builds Revamp |
| Component swaps break customization mappings | CE | Slack: bacon incident |
| Cannot distinguish which component to replace during swap | Engineering | Slack: Matt Gorney |
| "It's frustrating when I can't easily break apart and manage components that are tied up in the BOM" | CDT | Line Builds Revamp |

#### The Bacon Incident (Slack Case Study)

When bacon SKU changed from `8807196` to `8807255`:
1. Line build didn't pick up new SKU
2. Customization mapping broke
3. Kitchen displayed wrong customizations

**Root Cause (Matt Gorney):**
> "In the current UX workflow, we cannot distinguish which component item will be replaced by the new component item. So we cannot auto-replace the item from customization/line build."

**Impact:**
- Bulk swap function only works for BOM path
- Line build and customization updates require manual intervention
- Risk of serving incorrect customizations

---

### 4. Multi-Line Build Complexity

**Summary:** Items require multiple line builds to support equipment variants, location differences, and customization options, multiplying maintenance burden.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| 500+ items × multiple line builds = massive data volume | CE, Product | Reducing Line Build Configuration |
| Restaurant overrides create variant proliferation | CE | BigQuery analysis |
| Same change must be made across multiple line builds | CDT | Line Builds Revamp |
| No global change capability | CDT | Line Builds Revamp |

#### Sources of Multi-Line Build Selection (from Confluence)

| Selection Type | Use Case | Frequency |
|----------------|----------|-----------|
| Restaurant-based | Alternate appliances, vending routing, direct-to-expo | Most common |
| Customization-based | Different cook times/temps (steak doneness) | Moderate |
| Customization count | Variable portions based on topping count | Rare |
| Default | Fallback when no other mechanism | Common |

#### User Quote

> "Making the same change to multiple line builds is tedious and time-consuming because I can't do it globally." — Line Builds Revamp

---

### 5. Lack of Standardization

**Summary:** No enforced standards for naming, actions, or structure leads to inconsistent data that hinders automation and analysis.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| No standardized list of actions/techniques | CE, Training | Line build & Archetype PRD |
| Inconsistent verbiage (stir vs. mix, pinch vs. scoop) | Training, Ops | Line Builds Revamp |
| No predefined actions and tools per component | CE | Line Builds Revamp |
| Style guide requested but not implemented | CE, CDT | Line Builds Revamp |
| Archetype definition incomplete (doesn't capture parallel cooking) | Product | Line build & Archetype PRD |

#### Free Text Convention Examples (from Slack - Shin)

Sauce form factors embedded in naming without validation:
- `[Cup, 25g]` - Standard portion cup
- `[Bottle]` - Squeeze bottle application
- `[Container/32]` - 32oz bulk container

These conventions exist but are not enforced or machine-readable.

---

### 6. 40* Model Transition Gaps

**Summary:** The transition to the 40*/41* consumable model has created gaps in hot hold data and component mappings.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| Hot hold data not fully migrated to 40* model | CE, Ops | Slack |
| Line build mappings break during transitions | CE | Slack |
| Incomplete migration blocks bulk operations | CDT | Slack |

#### Context

The 40* model introduces a stable concept ID for consumable items (separate from the physical 88* vendor SKU), but:
- Not all items have been transitioned
- Hot holding instructions may not transfer automatically
- Line build step mappings to old 88* IDs break

---

### 7. Operational Misalignment

**Summary:** Discrepancies between tool capabilities and operational needs create workarounds and inefficiencies.

#### Documented Issues

| Pain Point | Stakeholder | Source |
|------------|-------------|--------|
| What cooks see vs. what customers see are misaligned | Ops, Consumer | Line Builds Revamp |
| Cannot capture technique in current line build | Ops | Slack |
| Step times in line builds don't match operational reality | KDS, Ops | Ops-Informed Line Build Step Times |
| No way to distinguish labor time from equipment time | Training | Slack |

#### User Quotes

> "Disparity between what the cooks need to see vs customer needs to see => misalignment" — Line Builds Revamp

> "While line build suggests a production time of 0.8 minutes (48 seconds) for human time when we have all components hot-held, field observations indicate actual times closer to 2-3 minutes" — Ops-Informed Line Build Step Times

---

### 8. Scaling and Future Requirements

**Summary:** Current architecture cannot support scaling goals (NSO, Infinite Kitchens) without fundamental changes.

#### Documented Issues

| Pain Point | Impact | Source |
|------------|--------|--------|
| "Double Maintenance" - separate human vs. robot instructions | Capacity bottleneck | Wonder Create x Infinite Kitchen |
| Cannot pipe current line builds to Infinite Kitchen | Automation blocked | Wonder Create x Infinite Kitchen |
| NSO scaling blocked by line build re-assignment needs | Growth constraint | NSO Scaling Potential Blockers |
| Non-standard HDR configurations require custom line builds | Setup time increase | NSO Scaling Potential Blockers |

#### Quote from Wonder Create x Infinite Kitchen

> "Our current data structure molds to Operations (exceptions are the norm) rather than enforcing strict validation rules... Because we lack standardized rules, we cannot easily script a 'Human-to-Robot' translation layer."

---

## Constraints

### Technical Constraints

| Constraint | Description | Source |
|------------|-------------|--------|
| KDS Dependency | Any change to line build content/structure requires KDS changes | Line Builds Revamp |
| JSON Structure | Line builds stored as nested JSON; schema changes require migration | BigQuery analysis |
| Free Text Parsing | AI inference needed to extract structure from existing free text | Gemini Inference Plan |

### Organizational Constraints

| Constraint | Description | Source |
|------------|-------------|--------|
| Cross-team buy-in required | Global changes need CE, Ops, Product, KDS alignment | Line Builds Revamp |
| Change velocity | Operations changes faster than tool can adapt | Line Builds Revamp |
| Training capacity | Limited CDT resources for data cleanup | Line Builds Revamp |

### Business Constraints

| Constraint | Description | Source |
|------------|-------------|--------|
| Cannot lose restaurant-based selection | Needed for rollouts and A/B testing | Reducing Line Build Configuration |
| Cannot break existing KDS flows | Production system dependency | Line Builds Revamp |
| Must support existing customization logic | Customer-facing impact | Line Builds Revamp |

---

## Priority Matrix (from Line Builds Revamp voting)

| Priority | Pain Point | Votes |
|----------|------------|-------|
| Must Have | Standardization in cooking procedures | 12 |
| Must Have | Data validation and consistency | 12 |
| Should Have | Bulk editing capability | 1 |
| Nice to Have | Preview/testing improvements | 3 |

---

## Stakeholder Impact Summary

| Stakeholder | Primary Pain Points | Impact |
|-------------|---------------------|--------|
| CDT | Manual updates, no bulk edit, inconsistent naming | High data entry burden |
| CE | BOM disconnect, no standardization, archetype gaps | Cannot control dish complexity |
| Ops | Operational misalignment, wrong step times | Training inefficiency, throughput issues |
| KDS/Product | Line build changes = KDS changes | Development coupling |
| Training | Inconsistent verbiage, no technique capture | Extended training time |
| Engineering | Free text blocks automation, migration difficulty | Technical debt |

---

## Key Confluence Sources

| Document | URL | Key Content |
|----------|-----|-------------|
| Line Builds Revamp | https://wonder.atlassian.net/wiki/spaces/CSO/pages/3058794878 | Stakeholder pain points workshop |
| Reducing Line Build Configuration | https://wonder.atlassian.net/wiki/spaces/TECHXIAMEN/pages/3460825156 | Complexity reduction opportunities |
| Line build & Archetype PRD | https://wonder.atlassian.net/wiki/spaces/~6363e9b913f37118d728a576/pages/3024158922 | Standardization initiative |
| Wonder Create x Infinite Kitchen | https://wonder.atlassian.net/wiki/spaces/~712020735951bb19ca4030aef4f98504f0b3da/pages/4520770473 | Future requirements |
| NSO Scaling Potential Blockers | https://wonder.atlassian.net/wiki/spaces/TECHXIAMEN/pages/4265181343 | Scaling constraints |
