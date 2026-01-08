---
type: analysis
status: current
project: line-build-redesign
created: 2025-12-16
updated: 2025-12-16
author: Brandon Galang
priority: high
tags: [line-builds, bigquery, data-analysis, current-state]
related: [research-discovery-overview.md]
version: 1
confidence: high
data_sources: [secure-recipe-prod.recipe_v2.item_line_builds, secure-recipe-prod.recipe_v2.item_versions, wonder-recipe-prod.mongo_batch_recipe_v2.tags]
analysis_date: 2025-12-16
data_freshness: current
staleness_trigger: "Major schema changes or data model updates"
open_questions: [Why is related_item_number only 10.6% populated?, What convention governs free text patterns?, How do location variants impact maintenance?]
---

# Line Build Current State Analysis

## Executive Summary

Line builds exist as JSON documents in Cookbook that describe step-by-step preparation instructions for menu items. While structured fields exist in the schema, the system relies on **\~99.99% free text** for instruction content, with only **10.6%** of steps having a structured item reference.

This analysis examines the `item_line_builds` table to understand:

- What structured data exists vs. what's free text

- How line builds vary across activities, items, and locations

- Where opportunities exist for structured inference

---

## Data Source

**Primary Table:** `secure-recipe-prod.recipe_v2.item_line_builds`

This is a flattened view of the nested JSON structure:

```
item_line_build → line_builds[] → tasks[] → procedures[] → procedure_steps[]
```

**Total Records:** 486,647 procedure step rows

---

## 1. Structured vs. Free Text Coverage

### Overall Coverage

| Field | Has Value | % Coverage | Notes |
| --- | --- | --- | --- |
| `sub_steps_title` (free text) | 486,635 | 99.99% | Primary instruction field |
| `related_item_number` | 51,463 | 10.6% | BOM component reference |
| `customization_option_id` | 261,227 | 53.7% | Customization mapping |
| `appliance_config_id` | 117,311 | 24.1% | Equipment settings |

### Key Insight

The schema **supports** structured references (`related_item_number`), but they're systematically underutilized. The 10.6% coverage appears concentrated in specific activity types.

---

## 2. Activity Type Distribution

Line builds categorize steps into four activity types (100% coverage):

| Activity | Row Count | % of Total | Description |
| --- | --- | --- | --- |
| GARNISH | \~282,000 | 58% | Cold assembly, finishing |
| COOK | \~117,000 | 24% | Heat application, appliance usage |
| COMPLETE | \~63,000 | 13% | Packaging, final assembly |
| VEND | \~24,000 | 5% | Delivery, handoff |

### Structured Reference by Activity

| Activity | Free Text Only | Has Item Reference | Structured Rate |
| --- | --- | --- | --- |
| GARNISH | 31,086 | 1,309 | 4% |
| COOK | 15,201 | 3,273 | 17.7% |
| COMPLETE | 3,784 | 3,100 | 45% |
| VEND | \~2,400 | \~2,600 | \~52% |

**Insight:** COMPLETE and VEND activities have better structure because they reference packaging items. GARNISH is almost entirely free text because it describes assembly actions, not component retrieval.

---

## 3. Appliance Configuration

### Appliance Types (16 distinct values)

| Appliance | Description | Coverage |
| --- | --- | --- |
| FRYER | Deep frying | Common |
| TURBO_OVEN | Rapid heat | Most common |
| WATER_BATH | Sous vide / retherm | Common |
| SALAMANDER | Broiling | Limited |
| PANINI_PRESS | Pressing/grilling | Limited |
| INDUCTION | Stovetop | Limited |
| PITCO | Commercial fryer | Limited |
| (others) | Various | Rare |

### Appliance Config IDs

Only **8 distinct preset configurations** exist in the system, suggesting equipment settings are standardized but underutilized for complexity scoring.

### Cooking Phases (5 values)

- HOT_HOLD

- COOK

- FINISH

- (others)

**Insight:** Equipment metadata exists and could inform complexity scoring, but it's not systematically captured across all COOK steps.

---

## 4. Item-Level Analysis

### Total Menu Items with Line Builds

**\~850 unique items** have line build data

### Line Build Variants Per Item

| Variant Count | Item Count | % of Items |
| --- | --- | --- |
| 1 variant | 574 | 74% |
| 2 variants | 112 | 14% |
| 3 variants | 58 | 7% |
| 4-5 variants | 25 | 3% |
| 6+ variants | 9 | 1% |

**Insight:** Most items (74%) have a single line build, but 201 items (24%) have **restaurant-specific overrides** that create the variant proliferation.

### Customization Options

| Configuration | Item Count | % of Items |
| --- | --- | --- |
| Fixed Build (No Options) | 778 | 92% |
| Has Customization Options | 71 | 8% |

**Insight:** Customization-driven complexity is concentrated in a small subset of items (e.g., build-your-own options, doneness levels).

---

## 5. Attribute System (Tags)

The tag system provides item-level categorization that could inform archetypes.

### Dish Category (211 items tagged)

| Category | Item Count |
| --- | --- |
| Entrees | 120 |
| Sides | 39 |
| Appetizers | 30 |
| Kids | 9 |
| Salads | 7 |
| Desserts | 6 |

### Cooking Groups (530 items tagged)

Used for station assignment and batching logic.

### Tier Classification

| Tier | Item Count |
| --- | --- |
| A | 20 |
| B | 20 |
| C | 18 |

**Insight:** Existing tag system provides coarse categorization but doesn't capture operational complexity (appliance transitions, parallel cooking, technique requirements).

---

## 6. Location Variant Analysis

### Restaurant Override Distribution

| Configuration | Item Count | Row Count |
| --- | --- | --- |
| Global (No Override) | 775 | 15,071 |
| Has Restaurant Override | 201 | 45,866 |

**Insight:** 24% of items have location-specific line builds, but these 201 items account for **3x the row count** of global items, showing the multiplicative effect of overrides.

### Override Drivers (from Confluence)

1. **Alternate appliances** - Different equipment per site

2. **Vending task routing** - Runner vs. vending pod

3. **Direct-to-expo paths** - HOT → EXPO vs. HOT → COLD → EXPO

4. **Receipt formatting** - Site-specific line breaks

---

## 7. Free Text Patterns

While 99.99% of instructions are free text, analysis of `sub_steps_title` reveals semantic patterns:

### Component Conventions (from Slack - Shin's documentation)

Sauce form factors embedded in naming:

- `[Cup, 25g]` - Standard portion cup

- `[Bottle]` - Squeeze bottle application

- `[Ramekin]` - Side container

- `[Container/32]` - 32oz bulk container

### Action Verbs (from Line Build Revamp notes)

Inconsistent use of:

- "Stir" vs. "Mix"

- "Pinch" (tongs) vs. "Scoop" (spoodle)

- "Place" vs. "Add" vs. "Put"

### Quantity Patterns

- `(2)` - Portion count

- `3 oz` - Weight specification

- `1/2` - Fractional portions

**Insight:** Free text contains structured information (form factor, quantity, action, tool) but encoding varies by author and lacks validation.

---

## 8. Schema Structure Reference

### JSON Hierarchy

```
item_version
```

`└── item_line_build`\
`└── line_builds[]`\
`├── apply_to_restaurants: [restaurant_ids]`\
`├── apply_to_options: [customization_options]`\
`└── tasks[]`\
`├── task_name`\
`└── procedures[]`\
`├── activity_type: COOK | GARNISH | COMPLETE | VEND`\
`├── appliance_config_id`\
`└── procedure_steps[]`\
`├── sub_steps_title (free text)`\
`├── related_item_number`\
`├── customization_option_id`\
`├── cooking_phase`\
`└── step_time_seconds`

### Key Fields for Complexity Scoring

| Field | Location | Availability |
| --- | --- | --- |
| Activity type | procedure | 100% |
| Appliance config | procedure | 24% |
| Step time | procedure_step | Variable |
| Cooking phase | procedure_step | \~30% |
| Related item | procedure_step | 10.6% |

---

## 9. Data Quality Issues

### Identified Gaps

1. **Missing component references** - 89.4% of steps lack `related_item_number`

2. **Inconsistent cooking phase** - Not populated for all COOK activities

3. **Step time accuracy** - Static culinary-defined times don't match operational reality

4. **Action encoding** - No structured field for technique/action type

5. **Tool encoding** - No structured field for smallware/equipment used

### Root Causes (from Confluence)

- "Free text fields lead to data entry mistakes and make data migration difficult"

- "The tool lacks a central view/management system for line build information"

- "Manual process of creating and updating the line builds leads to inconsistencies"

---

## 10. Implications for Abstraction Design

### What the Data Supports Today

1. **Activity-based grouping** - 100% coverage, clean enum

2. **Appliance-based grouping** - 24% coverage, 16 types

3. **Dish category tagging** - 211 items, 6 categories

4. **Cooking group tagging** - 530 items

### What the Data Cannot Support Today

1. **Technique inference** - No structured encoding

2. **Component-level tracing** - 89.4% gap in references

3. **Parallel cooking detection** - No explicit dependency graph

4. **Station flow analysis** - Inferred from activity sequence, not explicit

### Opportunity

The **T-shirt sizing AI inference approach** (Gemini) demonstrates that structured attributes can be derived from free text at scale. This pattern could extend to:

- Technique classification

- Tool/smallware inference

- Component reference backfill

- Action verb normalization

---

## Appendix: Sample Queries

### Structured vs. Free Text Coverage

```sql
SELECT
COUNT() as total_rows,
COUNTIF(related_item_number IS NOT NULL) as has_related_item,
COUNTIF(customization_option_id IS NOT NULL) as has_option_id,
COUNTIF(appliance_config_id IS NOT NULL) as has_appliance,
COUNTIF(sub_steps_title IS NOT NULL) as has_title
FROM secure-recipe-prod.recipe_v2.item_line_builds
```

### *Activity Distribution*

```
SELECT
activity_type,
COUNT() as row_count,
ROUND(COUNT() * 100.0 / SUM(COUNT()) OVER(), 2) as pct
FROM secure-recipe-prod.recipe_v2.item_line_builds
GROUP BY activity_type
ORDER BY row_count DESC
```

### Line Build Variants Per Item

```sql
SELECT
variant_count,
COUNT(*) as item_count
FROM (
SELECT
item_number,
COUNT(DISTINCT line_build_id) as variant_count
FROM secure-recipe-prod.recipe_v2.item_line_builds
GROUP BY item_number
)
GROUP BY variant_count
ORDER BY variant_count
```