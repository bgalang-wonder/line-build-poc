# Confidence Triage Report

**Generated:** 2025-12-19 20:09  
**Total Medium Confidence:** 2688  
**Total Low Confidence:** 232

---

## Summary by Category

### Medium Confidence (2688 total)


#### Acceptable Cautious (1323 cases)

**Issue:** Model parsed correctly but marked medium confidence  
**Recommendation:** Accept as-is, model is being conservative  
**Severity:** none

**Examples:**
- `Spray- Pizza Pan` → Action: PREP, Target: Pizza Pan
- `Spray- Pizza Pan` → Action: PREP, Target: Pizza Pan
- `Spray- Pizza Pan` → Action: PREP, Target: Pizza Pan
- `Spray- Pizza Pan` → Action: PREP, Target: Pizza Pan
- `Spray- Pizza Pan` → Action: PREP, Target: Pizza Pan

#### Unclassified (507 cases)

**Issue:** Needs manual review  
**Recommendation:** Review individually  
**Severity:** unknown

**Examples:**
- `Roasted Brussel Sprouts` → Action: PORTION, Target: Brussel Sprouts
- `Roasted Brussel Sprouts` → Action: PORTION, Target: Brussel Sprouts
- `Roasted Brussel Sprouts` → Action: PORTION, Target: Brussel Sprouts
- `Roasted Brussel Sprouts` → Action: PORTION, Target: Brussel Sprouts
- `Roasted Brussel Sprouts` → Action: PORTION, Target: Brussel Sprouts

#### Schema Gap Negation (271 cases)

**Issue:** Negative instruction (exclude ingredient)  
**Recommendation:** Add `exclude` boolean field or use customization options  
**Severity:** medium

**Examples:**
- `No Pickle` → Action: VEND, Target: Pickle
- `No Pickle` → Action: VEND, Target: Pickle
- `No Pickle` → Action: VEND, Target: Pickle
- `No Pickle` → Action: VEND, Target: Pickle
- `No Pickle` → Action: VEND, Target: Pickle

#### Data Quality Too Terse (207 cases)

**Issue:** Step text is too short to extract meaning  
**Recommendation:** Source data needs more context  
**Severity:** low

**Examples:**
- `Slice` → Action: PREP, Target: None
- `Slice` → Action: PREP, Target: None
- `Slice` → Action: PREP, Target: None
- `Slice` → Action: PREP, Target: None
- `Slice` → Action: PREP, Target: None

#### Schema Gap Post Cook (205 cases)

**Issue:** Post-cooking step (scrape, transfer, etc.)  
**Recommendation:** Consider adding `cooking_phase` field  
**Severity:** low

**Examples:**
- `POST COOK: (1) Foil Sheet` → Action: OTHER, Target: Foil Sheet
- `POST COOK: (1) Foil Sheet` → Action: OTHER, Target: Foil Sheet
- `POST COOK: (1) Foil Sheet` → Action: OTHER, Target: Foil Sheet
- `POST COOK: (1) Foil Sheet` → Action: OTHER, Target: Foil Sheet
- `POST COOK: (1) Foil Sheet` → Action: OTHER, Target: Foil Sheet

#### Parsing Container As Target (135 cases)

**Issue:** Model parsed container as target instead of ingredient  
**Recommendation:** Improve prompt to distinguish containers from ingredients  
**Severity:** high

**Examples:**
- `AMBER Pan` → Action: HEAT, Target: AMBER Pan
- `AMBER Pan` → Action: HEAT, Target: AMBER Pan
- `AMBER Pan` → Action: HEAT, Target: AMBER Pan
- `AMBER Pan` → Action: HEAT, Target: AMBER Pan
- `AMBER Pan` → Action: HEAT, Target: AMBER Pan

#### Schema Gap Container (40 cases)

**Issue:** Step only mentions container, not ingredient  
**Recommendation:** Add `container` field to schema  
**Severity:** medium

**Examples:**
- `POST COOK: Place in bowl` → Action: TRANSFER, Target: None
- `POST COOK: Place in bowl` → Action: TRANSFER, Target: None
- `POST COOK: Place in bowl` → Action: TRANSFER, Target: None
- `POST COOK: Place in bowl` → Action: TRANSFER, Target: None
- `POST COOK: Place in bowl` → Action: TRANSFER, Target: None

### Low Confidence (232 total)


#### Schema Gap Container (217 cases)

**Issue:** Step only mentions container, not ingredient  
**Recommendation:** Add `container` field to schema  
**Severity:** medium

**Examples:**
- `32oz Pulp Bowl` → Action: HEAT, Target: None
  - Notes: Contents of container are being cooked.
- `32oz Pulp Bowl` → Action: HEAT, Target: None
  - Notes: Contents of container are being cooked.
- `32oz Pulp Bowl` → Action: HEAT, Target: None
  - Notes: Contents of container are being cooked.
- `32oz Pulp Bowl` → Action: HEAT, Target: None
  - Notes: Contents of container are being cooked.
- `32oz Pulp Bowl` → Action: HEAT, Target: None
  - Notes: Contents of container are being cooked.

#### Unclassified (12 cases)

**Issue:** Needs manual review  
**Recommendation:** Review individually  
**Severity:** unknown

**Examples:**
- `52oz Black & Gold` → Action: HEAT, Target: Black & Gold Container
- `52oz Black & Gold` → Action: HEAT, Target: Black & Gold Container
- `52oz Black & Gold` → Action: HEAT, Target: Black & Gold Container
- `52oz Black & Gold` → Action: HEAT, Target: Black & Gold Container
- `52oz Black & Gold` → Action: HEAT, Target: Black & Gold Container

#### Acceptable Cautious (2 cases)

**Issue:** Model parsed correctly but marked medium confidence  
**Recommendation:** Accept as-is, model is being conservative  
**Severity:** none

**Examples:**
- `Branded Clamshell ` → Action: PREP, Target: Branded Clamshell
- `Lid - Raita` → Action: ASSEMBLE, Target: Lid

#### Schema Gap Post Cook (1 cases)

**Issue:** Post-cooking step (scrape, transfer, etc.)  
**Recommendation:** Consider adding `cooking_phase` field  
**Severity:** low

**Examples:**
- `POST COOK: Scrape into Bowl` → Action: TRANSFER, Target: contents

---

## Recommended Actions

### High Priority (Schema Changes)

1. **Parsing Container As Target** (135 cases): Improve prompt to distinguish containers from ingredients

### Medium Priority (Schema Enhancements)

1. **Schema Gap Negation** (271 cases): Add `exclude` boolean field or use customization options
1. **Schema Gap Container** (40 cases): Add `container` field to schema
1. **Schema Gap Container** (217 cases): Add `container` field to schema

### Low Priority (Data Quality)

1. **Data Quality Too Terse** (207 cases): Source data needs more context
1. **Schema Gap Post Cook** (205 cases): Consider adding `cooking_phase` field
1. **Schema Gap Post Cook** (1 cases): Consider adding `cooking_phase` field

### Acceptable (No Action Needed)

1. **Acceptable Cautious** (1323 cases): Model is being conservative, parsing is correct
1. **Acceptable Cautious** (2 cases): Model is being conservative, parsing is correct
