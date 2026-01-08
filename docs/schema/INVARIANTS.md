---
type: specification
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
tags: [schema, invariants, validation, contract]
---

# Schema Invariants

## Purpose

This document defines the **contract** for the Line Build Schema v1. Invariants are rules that must hold for data to be considered valid. They enable:

1. **Validation** — Automated checks that catch errors
2. **Trust** — Downstream consumers know what to expect
3. **Quality measurement** — Track how much data meets each level

## Invariant Tiers

| Tier | Meaning | Violation Consequence |
|------|---------|----------------------|
| **Hard** | Must always hold | Data is invalid; reject or error |
| **Strong** | Should hold for quality data | Warning; flag for review |
| **Soft** | Nice to have | Informational; track as metric |
| **Deferred** | Explicitly not required in v1 | No validation |

---

## Hard Invariants

These MUST hold. Violations make data invalid.

### H1: Every Step Has an ActionFamily

**Rule:** `step.action.family` is required and must be a valid `ActionFamily` enum value.

**Rationale:** 
- ActionFamily is the semantic spine of the schema
- Translation analysis showed 100% extraction rate
- All downstream processing (scoring, display, routing) depends on this

**Validation:**
```typescript
function validateH1(step: Step): ValidationResult {
  if (!step.action?.family) {
    return { valid: false, error: "H1: action.family is required" };
  }
  if (!Object.values(ActionFamily).includes(step.action.family)) {
    return { valid: false, error: `H1: invalid action.family: ${step.action.family}` };
  }
  return { valid: true };
}
```

**Failure examples:**
- `{ action: {} }` — Missing family
- `{ action: { family: "COOK" } }` — Invalid enum value (should be HEAT)

---

### H2: OrderIndex Defines Deterministic Ordering

**Rule:** `step.orderIndex` must be present and unique within its ordering scope.

**Ordering scope:**
- If `trackId` is used: unique within (buildId, trackId)
- If no tracks: unique within buildId

**Rationale:**
- Sequencing and scoring depend on deterministic order
- "Cold-to-hot rotation" requires knowing step sequence
- KDS display requires ordered steps

**Validation:**
```typescript
function validateH2(build: BenchTopLineBuild): ValidationResult {
  const seen = new Map<string, Set<number>>();
  
  for (const step of build.steps) {
    if (step.orderIndex === undefined || step.orderIndex === null) {
      return { valid: false, error: `H2: step ${step.id} missing orderIndex` };
    }
    
    const scope = step.trackId || "__default__";
    if (!seen.has(scope)) seen.set(scope, new Set());
    
    if (seen.get(scope)!.has(step.orderIndex)) {
      return { valid: false, error: `H2: duplicate orderIndex ${step.orderIndex} in scope ${scope}` };
    }
    seen.get(scope)!.add(step.orderIndex);
  }
  return { valid: true };
}
```

---

### H3: Time Fields Are Internally Consistent

**Rule:** If `step.time` exists:
- `durationSeconds` must be > 0
- `isActive` must be boolean

**Rationale:**
- Scoring aggregates time values
- Zero or negative durations poison calculations
- `isActive` distinguishes labor time from wait time

**Validation:**
```typescript
function validateH3(step: Step): ValidationResult {
  if (!step.time) return { valid: true }; // Optional field
  
  if (typeof step.time.durationSeconds !== "number" || step.time.durationSeconds <= 0) {
    return { valid: false, error: `H3: durationSeconds must be > 0, got ${step.time.durationSeconds}` };
  }
  if (typeof step.time.isActive !== "boolean") {
    return { valid: false, error: `H3: isActive must be boolean` };
  }
  return { valid: true };
}
```

---

### H4: Containers Are Not Targets

**Rule:** If a step references packaging/container, it must use `step.container`, not `step.target`.

**Rationale:**
- Triage report showed "container parsed as target" as high-severity error (135 cases)
- Containers (bags, bowls, pans) are not ingredients
- Downstream logic treats targets as food items

**Validation:**
```typescript
const CONTAINER_PATTERNS = [
  /bag/i, /bowl/i, /pan/i, /tray/i, /clamshell/i, 
  /ramekin/i, /cup/i, /foil/i, /lid/i, /pulp/i
];

function validateH4(step: Step): ValidationResult {
  if (!step.target?.name) return { valid: true };
  
  const isContainerName = CONTAINER_PATTERNS.some(p => p.test(step.target!.name!));
  if (isContainerName && !step.container) {
    return { 
      valid: false, 
      error: `H4: "${step.target.name}" appears to be a container, not a target. Use step.container instead.`
    };
  }
  return { valid: true };
}
```

---

### H5: Escape Hatch Is Always Allowed

**Rule:** Any step may have `notes` field populated, regardless of other field completeness.

**Rationale:**
- Legacy data is ambiguous
- v1 must not require perfect structure to be useful
- `notes` is the safety valve for edge cases

**Validation:** None needed — this is a permissive rule.

---

## Strong Invariants

These SHOULD hold for high-quality data. Violations produce warnings.

### S1: Component Steps Should Have Target

**Rule:** If `step.kind === "component"`, then `step.target` should exist.

**Rationale:**
- Component steps act on ingredients
- Target enables BOM tracing and bulk operations
- 97.9% of legacy steps have extractable target names

**Allowed exceptions:**
- Legacy "Slice" (verb only, no object)
- "See manager" type instructions
- Steps where target is implied by context

**Validation:**
```typescript
function validateS1(step: Step): ValidationResult {
  if (step.kind === "component" && !step.target) {
    return { 
      valid: true, // Not a hard failure
      warning: `S1: component step ${step.id} missing target`
    };
  }
  return { valid: true };
}
```

---

### S2: HEAT Steps Should Have Equipment

**Rule:** If `step.action.family === "HEAT"`, then `step.equipment` should exist.

**Rationale:**
- HEAT steps use appliances (turbo, fryer, waterbath)
- Equipment is critical for scoring (short appliance steps, back-to-back turbo)
- Legacy appliance_config coverage is 24%, so this is aspirational

**Validation:**
```typescript
function validateS2(step: Step): ValidationResult {
  if (step.action.family === ActionFamily.HEAT && !step.equipment) {
    return {
      valid: true,
      warning: `S2: HEAT step ${step.id} missing equipment`
    };
  }
  return { valid: true };
}
```

---

### S3: VEND Steps Should Reference Container or Packaging

**Rule:** If `step.action.family === "VEND"`, then `step.container` or `step.target.type === "packaging"` should exist.

**Rationale:**
- VEND steps involve final packaging
- Container/packaging info supports packaging complexity scoring
- Legacy VEND steps have ~52% structured rate (best of all activity types)

**Validation:**
```typescript
function validateS3(step: Step): ValidationResult {
  if (step.action.family === ActionFamily.VEND) {
    const hasContainer = !!step.container;
    const hasPackagingTarget = step.target?.type === "packaging";
    
    if (!hasContainer && !hasPackagingTarget) {
      return {
        valid: true,
        warning: `S3: VEND step ${step.id} missing container or packaging target`
      };
    }
  }
  return { valid: true };
}
```

---

### S4: Phase Markers Should Match CookingPhase Field

**Rule:** If `step.notes` contains phase markers ("POST COOK", "PRE COOK"), then `step.cookingPhase` should be set accordingly.

**Rationale:**
- Consistency between free text and structured fields
- Prevents confusion when notes say one thing and field says another
- 1,928 occurrences of phase markers in legacy data

**Validation:**
```typescript
function validateS4(step: Step): ValidationResult {
  if (!step.notes) return { valid: true };
  
  const hasPostCookMarker = /post.?cook/i.test(step.notes);
  const hasPreCookMarker = /pre.?cook/i.test(step.notes);
  
  if (hasPostCookMarker && step.cookingPhase !== CookingPhase.POST_COOK) {
    return {
      valid: true,
      warning: `S4: notes mention "POST COOK" but cookingPhase is ${step.cookingPhase || "not set"}`
    };
  }
  if (hasPreCookMarker && step.cookingPhase !== CookingPhase.PRE_COOK) {
    return {
      valid: true,
      warning: `S4: notes mention "PRE COOK" but cookingPhase is ${step.cookingPhase || "not set"}`
    };
  }
  return { valid: true };
}
```

---

### S5: Negation Patterns Should Use Exclude Flag

**Rule:** If `step.notes` contains negation patterns ("No X", "Hold X", "Without X"), then `step.exclude` should be `true`.

**Rationale:**
- 271 cases of negation in triage report
- Explicit `exclude` flag is clearer than parsing notes
- Enables proper handling in scoring and display

**Validation:**
```typescript
function validateS5(step: Step): ValidationResult {
  if (!step.notes) return { valid: true };
  
  const hasNegation = /\b(no|hold|without|skip|omit)\b/i.test(step.notes);
  
  if (hasNegation && !step.exclude) {
    return {
      valid: true,
      warning: `S5: notes contain negation pattern but exclude flag not set`
    };
  }
  return { valid: true };
}
```

---

## Soft Invariants

These are nice-to-have. Track as metrics but don't warn.

### F1: Tool and Station Can Be Inherited

**Rule:** `toolId` and `stationId` are optional. They can be:
- Explicitly set on step
- Inherited from BOM defaults
- Left null if unknown

**Rationale:**
- Upstream data quality isn't ready for requirements
- Provenance tracks where values come from
- Progressive improvement over time

---

### F2: DetailId Taxonomy Can Be Loose

**Rule:** `action.detailId` is free-form in v1. No strict vocabulary enforcement.

**Rationale:**
- Capture meaning first, normalize later
- Different authors use different terms
- Can standardize in v2 once patterns emerge

---

### F3: Provenance Is Optional But Recommended

**Rule:** `step.provenance` is optional. When present, it should accurately reflect data source.

**Rationale:**
- Enables data quality tracking
- Not all data sources can provide provenance
- "Lying" provenance is worse than missing provenance

---

## Explicitly Deferred Invariants

These are NOT validated in v1. They may become requirements in future versions.

### D1: Equipment Profile Filtering

**What:** Steps with `conditions.requiresEquipmentProfile` are filtered based on kitchen capabilities.

**Why deferred:** Upstream equipment profile data doesn't exist cleanly. Schema includes the field as extension point.

---

### D2: Full Dependency Graph

**What:** Steps with `dependsOn` form a DAG that must be acyclic and resolvable.

**Why deferred:** `orderIndex` + `tracks` sufficient for v1 scoring. DAG adds complexity without immediate value.

---

### D3: BOM Usage ID Required

**What:** All component steps must have `target.bomUsageId`.

**Why deferred:** Legacy data has only 10.6% structured BOM references. Requiring this would block adoption.

---

## Validation Summary

### By Tier

| Tier | Count | IDs |
|------|-------|-----|
| Hard | 5 | H1, H2, H3, H4, H5 |
| Strong | 5 | S1, S2, S3, S4, S5 |
| Soft | 3 | F1, F2, F3 |
| Deferred | 3 | D1, D2, D3 |

### By Field

| Field | Invariants |
|-------|------------|
| `action.family` | H1 |
| `orderIndex` | H2 |
| `time` | H3 |
| `target` | H4, S1 |
| `container` | H4, S3 |
| `equipment` | S2 |
| `cookingPhase` | S4 |
| `exclude` | S5 |
| `notes` | H5, S4, S5 |

---

## Quality Metrics

Track these metrics to measure data quality improvement:

| Metric | Definition | Target |
|--------|------------|--------|
| Hard invariant pass rate | % of steps passing all H* rules | 100% |
| Strong invariant pass rate | % of steps passing all S* rules | >90% |
| Target coverage | % of component steps with target | >95% |
| Equipment coverage | % of HEAT steps with equipment | >80% |
| Phase coverage | % of steps with cookingPhase | >50% |
| OTHER usage | % of steps with action.family = OTHER | <10% |
| Provenance coverage | % of steps with provenance | >80% |
| Manual provenance | % of provenance marked "manual" | Increasing |

---

## Implementation Notes

### Validation Order

Run validations in this order:
1. Hard invariants (stop on first failure)
2. Strong invariants (collect all warnings)
3. Soft invariants (collect metrics)

### Error vs Warning

- Hard invariant violation → `{ valid: false, error: "..." }`
- Strong invariant violation → `{ valid: true, warning: "..." }`
- Soft invariant → No output, just metrics

### Batch Validation

For bulk validation, aggregate results:
```typescript
interface BuildValidationResult {
  buildId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    totalSteps: number;
    hardPassRate: number;
    strongPassRate: number;
    targetCoverage: number;
    equipmentCoverage: number;
    otherUsage: number;
  };
}
```

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-31 | Initial draft | Brandon Galang |

