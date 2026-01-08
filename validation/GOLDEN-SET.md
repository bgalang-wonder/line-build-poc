---
type: validation
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
tags: [validation, golden-set, testing]
---

# Golden Set Definition

## Purpose

The golden set is a curated collection of 20-50 representative menu items used to validate the schema. Every schema change must be tested against the golden set before approval.

**Selection criteria:** Items should cover the full range of complexity, equipment usage, and edge cases found in production.

---

## Selection Criteria

### Must Include

| Category | Count | Rationale |
|----------|-------|-----------|
| **High complexity items** | 5-10 | Test scoring at upper bound |
| **Low complexity items** | 5-10 | Test scoring at lower bound |
| **Multi-appliance items** | 5-10 | Test equipment variety, rotations |
| **Single-appliance items** | 3-5 | Test simple paths |
| **High hot ratio** | 3-5 | Test hot/cold classification |
| **High cold ratio** | 3-5 | Test garnish-heavy items |
| **Customization-heavy** | 3-5 | Test conditional logic |
| **Packaging-complex** | 3-5 | Test container handling |
| **Edge cases** | 5-10 | Test escape hatches, ambiguity |

### Edge Cases to Include

| Edge Case | Example | Why Include |
|-----------|---------|-------------|
| Terse steps | "Slice" | Tests target-missing handling |
| Negation steps | "No Pickle" | Tests exclude flag |
| Container-only steps | "32oz Pulp Bowl" | Tests container vs target |
| Phase markers | "POST COOK: Transfer" | Tests cookingPhase extraction |
| Meta steps | "See manager" | Tests kind: meta |
| Multi-track items | Hot + Cold parallel | Tests track handling |
| Equipment variants | Fryer vs Turbo for same item | Tests conditions (future) |

---

## Golden Set Items

### Selection Status

| # | Item ID | Item Name | Category | Status |
|---|---------|-----------|----------|--------|
| 1 | TBD | TBD | High complexity | 🔲 Pending |
| 2 | TBD | TBD | High complexity | 🔲 Pending |
| 3 | TBD | TBD | Low complexity | 🔲 Pending |
| ... | ... | ... | ... | ... |

*To be populated after stakeholder input on representative items.*

---

## Selection Process

### Step 1: Candidate Generation
1. Query BigQuery for items by complexity tier (from existing spreadsheet)
2. Query for items by equipment usage patterns
3. Query for items with known edge cases (from triage report)

### Step 2: Stakeholder Input
1. Shin reviews candidates for authoring edge cases
2. Jen reviews candidates for scoring edge cases
3. Combine into draft golden set

### Step 3: Coverage Validation
1. Verify all selection criteria categories are covered
2. Verify edge cases are represented
3. Adjust if gaps found

### Step 4: Lock Golden Set
1. Document final list with rationale
2. Create structured representations for each item
3. Baseline for all future validation

---

## Validation Protocol

### For Each Golden Set Item

1. **Legacy snapshot**
   - Capture current line build from Cookbook/BigQuery
   - Document free text steps

2. **Structured translation**
   - Translate to new schema (manual or AI-assisted)
   - Document any ambiguities or decisions

3. **Invariant validation**
   - Run all hard invariants (must pass)
   - Run all strong invariants (document warnings)
   - Compute quality metrics

4. **Derivability check**
   - Compute complexity score
   - Verify stakeholder queries work
   - Document any gaps

5. **Stakeholder review**
   - Present to relevant stakeholder
   - Confirm representation is accurate
   - Document feedback

---

## Quality Metrics (Per Item)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Hard invariant pass | 100% | All H* rules pass |
| Strong invariant pass | >90% | S* warnings acceptable |
| Target coverage | >95% | Component steps have target |
| Equipment coverage | >80% | HEAT steps have equipment |
| OTHER usage | <10% | Escape hatch bounded |
| Semantic loss | None | No meaning lost in translation |

---

## Golden Set Maintenance

### When to Update

- New edge case discovered in production
- Schema change requires new test coverage
- Stakeholder identifies missing scenario

### Update Process

1. Propose new item with rationale
2. Validate against current schema
3. Add to golden set with documentation
4. Re-run full validation suite

---

## Appendix: Candidate Queries

### High Complexity Items
```sql
-- Items with highest step counts
SELECT item_number, item_name, COUNT(*) as step_count
FROM `secure-recipe-prod.recipe_v2.item_line_builds`
GROUP BY item_number, item_name
ORDER BY step_count DESC
LIMIT 20
```

### Multi-Appliance Items
```sql
-- Items using multiple appliance types
SELECT item_number, COUNT(DISTINCT appliance_type) as appliance_count
FROM `secure-recipe-prod.recipe_v2.item_line_builds`
WHERE appliance_type IS NOT NULL
GROUP BY item_number
HAVING appliance_count > 2
ORDER BY appliance_count DESC
```

### Edge Case: Terse Steps
```sql
-- Steps with very short text (likely ambiguous)
SELECT item_number, sub_steps_title
FROM `secure-recipe-prod.recipe_v2.item_line_builds`
WHERE LENGTH(sub_steps_title) < 10
LIMIT 50
```

### Edge Case: Negation Patterns
```sql
-- Steps with "No X" patterns
SELECT item_number, sub_steps_title
FROM `secure-recipe-prod.recipe_v2.item_line_builds`
WHERE REGEXP_CONTAINS(sub_steps_title, r'\bNo\b')
LIMIT 50
```

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-31 | Initial template | Brandon Galang |

