---
type: specification
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
tags: [schema, extensibility, future, routing, sequencing]
---

# Schema Extension Points

## Purpose

This document defines what the schema explicitly **does not require in v1** but **is designed to support in the future**. These are the "pluggable inputs" that allow the schema to grow without breaking changes.

**Design principle:** "Design for the future state, don't require it to ship."

---

## Extension Point Summary

| Extension | Field | v1 Status | Future Use Case |
|-----------|-------|-----------|-----------------|
| Equipment-based filtering | `step.conditions` | Optional | Select steps based on kitchen equipment |
| Conditional overrides | `step.overlays` | Optional | Modify step fields based on context |
| Dependency graph | `step.dependsOn` | Optional | Model parallel cooking, critical path |
| BOM usage references | `target.bomUsageId` | Optional | Stable ingredient references |
| Provenance tracking | `step.provenance` | Optional | Data quality measurement |

---

## EP-1: Equipment-Based Step Filtering

### Current State (v1)
- `step.conditions` is an optional field
- Not validated or required
- Steps are included unconditionally

### Future State
When equipment profile data exists cleanly:
- Steps can declare `conditions.requiresEquipmentProfile`
- Resolution algorithm filters steps based on kitchen capabilities
- Single line build serves multiple equipment configurations

### Schema (Already Included)

```typescript
interface StepCondition {
  requiresEquipmentProfile?: string[];    // Kitchen must have these
  requiresCustomizationOption?: string[]; // Customer selected these
  requiresRestaurantId?: string[];        // Only at specific locations
}
```

### Migration Path
1. Equipment profile registry created (external dependency)
2. Populate `conditions` on steps that vary by equipment
3. Build resolution algorithm
4. Deprecate location-based line build assignment

### Blocking Dependencies
- Equipment profile registry with capability definitions
- Kitchen → equipment profile mapping
- Resolution algorithm implementation

---

## EP-2: Conditional Field Overrides (Overlays)

### Current State (v1)
- `step.overlays` is an optional field
- Benchtop MVP implements overlay resolution
- Not required for schema validity

### Future State
- Steps can have multiple overlays with predicates
- Overlays modify fields (station, tool, time) based on context
- Priority system determines which overlay wins

### Schema (Already Included)

```typescript
interface StepOverlay {
  id: string;
  predicate: {
    equipmentProfileId?: string;
    customizationValueIds?: string[];
    minCustomizationCount?: number;
  };
  overrides: Partial<Pick<Step, "stationId" | "toolId" | "time" | "notes">>;
  priority: number;
}
```

### Migration Path
1. Define overlay use cases (equipment variants, customizations)
2. Author overlays for high-value items
3. Build resolution algorithm (exists in benchtop MVP)
4. Integrate with authoring UI

### Blocking Dependencies
- Authoring UI for overlay management
- Clear use cases from ops/CE

---

## EP-3: Dependency Graph (DAG)

### Current State (v1)
- `step.dependsOn` is an optional field
- `orderIndex` + `tracks` provide basic sequencing
- No DAG validation

### Future State
- Steps can declare dependencies on other steps
- Enables parallel cooking optimization
- Supports critical path analysis for KDS

### Schema (Already Included)

```typescript
interface Step {
  // ... other fields
  dependsOn?: StepId[];  // Steps that must complete before this one
}
```

### Migration Path
1. KDS defines sequencing requirements
2. Identify items with parallel cooking patterns
3. Populate `dependsOn` for those items
4. Build DAG validation (acyclic, resolvable)
5. Build critical path algorithm

### Blocking Dependencies
- KDS ready to consume dependency data
- Clear definition of "parallel" vs "sequential" for ops
- DAG validation implementation

---

## EP-4: BOM Usage References

### Current State (v1)
- `target.bomUsageId` is optional
- `target.bomComponentId` is acceptable fallback
- `target.name` is always-available fallback
- Legacy data has 10.6% structured references

### Future State
- All component steps have stable `bomUsageId`
- Enables automatic BOM ↔ line build sync
- Supports bulk operations when BOM changes

### Schema (Already Included)

```typescript
interface StepTarget {
  type: TargetType;
  bomUsageId?: BomUsageId;      // Preferred: stable usage reference
  bomComponentId?: BomComponentId; // Acceptable: component definition
  name?: string;                // Fallback: human-readable
}
```

### Migration Path
1. Product Catalog (40*/41* model) ships
2. Define BOM usage abstraction
3. Backfill `bomUsageId` for existing steps (AI-assisted)
4. Require `bomUsageId` for new items
5. Build sync mechanism

### Blocking Dependencies
- Product Catalog replatforming complete
- BOM usage ID abstraction defined
- Backfill initiative resourced

---

## EP-5: Provenance Tracking

### Current State (v1)
- `step.provenance` is optional
- Enables data quality measurement
- Not required for schema validity

### Future State
- All fields track their source
- Quality dashboards show manual vs inferred %
- Review workflows focus on low-confidence data

### Schema (Already Included)

```typescript
interface StepProvenance {
  target?: FieldProvenance;
  stationId?: FieldProvenance;
  toolId?: FieldProvenance;
  equipment?: FieldProvenance;
  time?: FieldProvenance;
  container?: FieldProvenance;
  cookingPhase?: FieldProvenance;
  exclude?: FieldProvenance;
}

interface FieldProvenance {
  type: ProvenanceType;
  sourceId?: string;
  confidence?: "high" | "medium" | "low";
}

type ProvenanceType = "manual" | "inherited" | "overlay" | "inferred" | "legacy_import";
```

### Migration Path
1. Populate provenance during legacy import
2. Track provenance in authoring UI
3. Build quality dashboards
4. Create review workflows for low-confidence data

### Blocking Dependencies
- Authoring UI that tracks provenance
- Quality dashboard implementation

---

## What This Means for Stakeholders

### For Michelle (KDS)
- **EP-1 (Equipment filtering):** When ready, KDS can receive pre-filtered steps
- **EP-3 (Dependency graph):** When ready, KDS can optimize fire timing
- **No blocking:** v1 schema doesn't prevent future KDS work

### For Shin (CE)
- **EP-2 (Overlays):** Can model equipment variants without cloning
- **EP-4 (BOM references):** When Product Catalog ships, can link properly
- **EP-5 (Provenance):** Can see what's structured vs inferred

### For Jen (Ops)
- **EP-1 (Equipment filtering):** Can model "what if we had different equipment"
- **EP-3 (Dependency graph):** Can analyze parallel cooking impact
- **No blocking:** Scoring works with v1 fields

### For Robot Team
- **All extension points:** Schema is ready for automation
- **EP-4 (BOM references):** Critical for ingredient picking
- **EP-3 (Dependency graph):** Critical for task scheduling

---

## Non-Goals (Explicitly Not Designed For)

| Capability | Why Not |
|------------|---------|
| Real-time collaborative editing | Requires different architecture |
| Version control / branching | Out of scope for data model |
| Multi-language support | Not a current requirement |
| Nutritional data | Separate domain |
| Cost/pricing data | Separate domain |

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-31 | Initial draft | Brandon Galang |

