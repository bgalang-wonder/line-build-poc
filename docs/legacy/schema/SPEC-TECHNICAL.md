---
type: spec
status: draft
project: line-build-redesign
created: 2025-12-31
updated: 2025-12-31
author: Brandon Galang
priority: high
tags: [schema, line-builds, complexity-scoring, q1-2026]
audience: engineering
version: 0.1
related: [schema/PRD-BUSINESS.md]
---

# Technical Specification: Line Build Schema v1

> **Audience:** Engineering, Technical PMs\
****For business context:** See [PRD-BUSINESS.md](./PRD-BUSINESS.md)

## Executive Summary

This PRD defines the canonical data model for representing line builds — the step-by-step operational instructions for producing menu items. The schema must:

1. **Capture culinary truth** — Represent what actually happens to make a dish

2. **Enable complexity scoring** — Support programmatic derivation of operational complexity metrics

3. **Be extensible** — Support future routing, sequencing, and automation use cases without breaking changes

4. **Work with current data quality** — Accept partial structure while tracking provenance

**This is a schema-first project.** The schema is the product. Applications, scoring algorithms, and integrations are downstream consumers.

---

## Problem Statement

### Current State

Line builds exist as JSON documents with \~99.99% free text instructions. Structured fields exist but are underutilized:

- `related_item_number` (BOM reference): 10.6% populated

- `appliance_config_id`: 24% populated

- `sub_steps_title` (free text): 99.99% populated

### Impact

- **Complexity scoring** happens in spreadsheets with manual data entry

- **Bulk operations** are unreliable due to text pattern matching

- **BOM ↔ Line Build sync** is manual and error-prone

- **Automation/robot translation** is blocked by ambiguous instructions

### Opportunity

Translation analysis proved that legacy free text can be mapped to structured schema with **99.2% high confidence**. The schema gaps are known and bounded (container, phase, exclude).

---

## Goals & Non-Goals

### Goals

1. Define a canonical schema that represents operational cooking instructions

2. Enable complexity scoring to be computed from schema (not spreadsheets)

3. Design extension points for routing/sequencing without implementing them

4. Support incremental data quality improvement via provenance tracking

### Non-Goals (v1)

- KDS integration or changes

- Equipment-based line build selection implementation

- BOM system changes or backfill initiatives

- Production Cookbook integration

- Full dependency graph / DAG scheduling

- AI-generated line builds

---

## User Stories

### As Jen (Ops Director)

- I want to compute complexity scores from structured data so that I don't need spreadsheets

- I want to compare complexity across menu items so that I can optimize the portfolio

- I want to identify high hot-ratio items so that I can prevent throughput bottlenecks

### As Shin (CE Lead)

- I want to author line builds with clear structure so that data entry is consistent

- I want validation rules to catch errors so that I don't ship broken instructions

- I want to do bulk edits across the portfolio so that component swaps are fast

### As Michelle (KDS PM)

- I want to see how the schema supports sequencing so that I know we're not blocked

- I want clear extension points so that future KDS work can build on this

### As Brandon (PM)

- I want a stable schema so that downstream work can proceed with confidence

- I want provenance tracking so that I can measure data quality improvement over time

---

## Schema Specification

### Design Principles

1. **Culinary truth over operational policy** — The schema captures what happens to make a dish, not how it's assigned or routed

2. **Explicit over implicit** — Prefer dedicated fields over parsing from notes

3. **Optional over required** — Accept partial data; track quality via provenance

4. **Extensible over complete** — Include extension points for known future needs

### Entity Relationship

```
BenchTopLineBuild (1) ──────── (N) Step
```

```
   │                            │
```

`│ ├── StepAction`\
`│ ├── StepTarget`\
`│ ├── StepEquipment`\
`│ ├── StepTime`\
`│ ├── StepContainer`\
`│ └── StepProvenance`\
`│`\
`├── (N) Operation (optional grouping)`\
`└── (N) TrackDefinition (optional lanes)`

---

## Core Types

### BenchTopLineBuild

The root container for a menu item's production instructions.

```typescript
interface BenchTopLineBuild {
```

`// Identity`\
`id: BuildId; // UUID`\
`menuItemId: MenuItemId; // 80* item reference`\
`version: number; // Immutable version number`\
`status: BuildStatus; // draft | published | archived`

`// Content`\
`steps: Step[]; // Required: the actual instructions`

`// Optional structure`\
`operations?: Operation[]; // Authoring groups (UX convenience)`\
`tracks?: TrackDefinition[]; // Parallel lanes (hot/cold)`

`// Metadata`\
`createdAt: string; // ISO timestamp`\
`updatedAt: string; // ISO timestamp`\
`authorId?: string;`\
`changeLog?: string;`\
`}`

`type BuildId = string;`\
`type MenuItemId = string;`\
`type BuildStatus = "draft" | "published" | "archived";`

**Invariants:**

- `id` must be unique

- `menuItemId` must reference a valid catalog item

- `steps` must not be empty for published builds

- `version` is immutable once created

---

### Step

The primitive unit of work. Every step represents one discrete action in the cooking process.

```typescript
interface Step {
```

`// Identity & ordering`\
`id: StepId; // UUID`\
`orderIndex: number; // Sequence within build (or track)`

`// Optional grouping`\
`operationId?: OperationId; // Parent operation (authoring convenience)`\
`trackId?: string; // Parallel lane assignment`

`// Semantic meaning (REQUIRED)`\
`kind: StepKind; // component | action | quality_check | meta`\
`action: StepAction; // What are we doing? (REQUIRED)`

`// Target (STRONGLY RECOMMENDED for component steps)`\
`target?: StepTarget; // What are we acting on?`

`// Execution details (OPTIONAL, inheritable)`\
`stationId?: StationId; // Where does this happen?`\
`toolId?: ToolId; // What tool is used?`\
`equipment?: StepEquipment; // What appliance?`\
`time?: StepTime; // How long?`

`// Phase semantics (RECOMMENDED for HEAT steps)`\
`cookingPhase?: CookingPhase; // PRE_COOK | COOK | POST_COOK | PASS`

`// Container/packaging (RECOMMENDED for VEND/TRANSFER steps)`\
`container?: StepContainer; // Bag, bowl, pan, etc.`

`// Negation (for "No X" steps)`\
`exclude?: boolean; // true = "do not include this"`

`// Escape hatch (ALWAYS ALLOWED)`\
`notes?: string; // Free text for ambiguous cases`

`// Data quality tracking`\
`provenance?: StepProvenance; // Where did field values come from?`

`// Extension points (OPTIONAL, for future use)`\
`conditions?: StepCondition[]; // When does this step apply?`\
`overlays?: StepOverlay[]; // Conditional field overrides`\
`dependsOn?: StepId[]; // DAG edges (future)`\
`}`

`type StepId = string;`\
`type StepKind = "component" | "action" | "quality_check" | "meta";`

---

### StepAction

What are we doing? Every step must have an action.

```typescript
interface StepAction {
```

`family: ActionFamily; // REQUIRED: high-level category`\
`detailId?: string; // Optional: specific technique`\
`displayTextOverride?: string; // Only for legacy output fixes`\
`}`

`enum ActionFamily {`\
`PREP = "PREP", // Open, stage, unwrap`\
`HEAT = "HEAT", // Cook, re-therm, toast, fry`\
`TRANSFER = "TRANSFER", // Move from A to B`\
`COMBINE = "COMBINE", // Add X to Y, mix`\
`ASSEMBLE = "ASSEMBLE", // Build, stack, wrap`\
`PORTION = "PORTION", // Measure out quantity`\
`CHECK = "CHECK", // QA, temp check`\
`VEND = "VEND", // Hand off, package for delivery`\
`OTHER = "OTHER" // Escape hatch`\
`}`

**Invariants:**

- `action.family` is REQUIRED for every step

- `OTHER` should be used sparingly (&lt;10% of steps in a well-structured build)

**Action Family Definitions:**

| Family | Definition | Examples |
| --- | --- | --- |
| PREP | Prepare ingredient for use | Open pouch, unwrap, stage |
| HEAT | Apply heat to ingredient | Fry, turbo, waterbath, toast |
| TRANSFER | Move ingredient between locations | Place in pan, move to station |
| COMBINE | Mix or add ingredients together | Add sauce, mix, stir |
| ASSEMBLE | Build final product structure | Stack, wrap, layer |
| PORTION | Measure specific quantity | Scoop 2oz, weigh 150g |
| CHECK | Quality or safety verification | Temp check, visual QA |
| VEND | Final packaging and handoff | Bag, label, pass to runner |
| OTHER | Doesn't fit above categories | See manager, special instruction |

---

### StepTarget

What are we acting on? Strongly recommended for `component` steps.

```typescript
interface StepTarget {
```

`type: TargetType; // How is target identified?`

`// Structured references (preferred)`\
`bomUsageId?: BomUsageId; // Stable usage ID (40*/41* abstraction)`\
`bomComponentId?: BomComponentId; // Component definition ID (40*)`

`// Fallback for unstructured data`\
`name?: string; // Human-readable name`\
`}`

`type TargetType =`\
`| "bom_usage" // Best: stable usage reference`\
`| "bom_component" // Good: component definition`\
`| "packaging" // Packaging item (9* or similar)`\
`| "free_text" // Fallback: name only`\
`| "unknown"; // No target identifiable`

`type BomUsageId = string;`\
`type BomComponentId = string;`

**Invariants:**

- If `type === "bom_usage"`, then `bomUsageId` should be present

- If `type === "bom_component"`, then `bomComponentId` should be present

- `name` should always be populated for human readability

---

### StepEquipment

What appliance is used? Recommended for HEAT steps.

```typescript
interface StepEquipment {
```

`applianceId: ApplianceId; // turbo, fryer, waterbath, etc.`\
`presetId?: string; // Appliance setting/program`\
`}`

`type ApplianceId =`\
`| "turbo"`\
`| "fryer"`\
`| "waterbath"`\
`| "salamander"`\
`| "panini_press"`\
`| "induction"`\
`| "clamshell"`\
`| "toaster"`\
`| "conveyor"`\
`| string; // Extensible for new equipment`

**Invariants:**

- If `action.family === HEAT`, then `equipment` should be present

- `applianceId` must be from known vocabulary (warn on unknown)

---

### StepTime

How long does this take?

```typescript
interface StepTime {
```

`durationSeconds: number; // Estimated duration (must be > 0)`\
`isActive: boolean; // true = chef busy, false = waiting`\
`}`

**Invariants:**

- `durationSeconds` must be &gt; 0 if present

- `isActive` distinguishes labor time from wait time

**Usage:**

- `isActive: true` — Chef is actively working (portioning, assembling)

- `isActive: false` — Chef is waiting (frying, waterbath cooking)

---

### CookingPhase

When in the cooking process does this happen?

```typescript
enum CookingPhase {
```

`PRE_COOK = "PRE_COOK", // Before heat application`\
`COOK = "COOK", // During heat application`\
`POST_COOK = "POST_COOK", // After heat, before assembly`\
`PASS = "PASS" // Handoff between stations`\
`}`

**Usage:**

- Critical for "cold-to-hot rotation" scoring

- Helps distinguish prep work from finishing work

---

### StepContainer

What container or packaging is involved?

```typescript
interface StepContainer {
```

`type?: ContainerType;`\
`name?: string; // "32oz Pulp Bowl", "AMBER Pan"`\
`size?: string; // "32oz", "52oz" (string to avoid unit complexity)`\
`}`

`type ContainerType =`\
`| "bag"`\
`| "bowl"`\
`| "pan"`\
`| "tray"`\
`| "clamshell"`\
`| "ramekin"`\
`| "cup"`\
`| "foil"`\
`| "lid"`\
`| "other";`

**Rationale:**

- 5,613 occurrences in legacy data

- Prevents "container parsed as target" errors

- Supports packaging complexity scoring

---

### StepProvenance

Where did field values come from? Enables data quality tracking.

```typescript
interface StepProvenance {
```

`target?: FieldProvenance;`\
`stationId?: FieldProvenance;`\
`toolId?: FieldProvenance;`\
`equipment?: FieldProvenance;`\
`time?: FieldProvenance;`\
`container?: FieldProvenance;`\
`cookingPhase?: FieldProvenance;`\
`exclude?: FieldProvenance;`\
`}`

`interface FieldProvenance {`\
`type: ProvenanceType;`\
`sourceId?: string; // bomId, overlayId, model run ID, etc.`\
`confidence?: "high" | "medium" | "low";`\
`}`

`type ProvenanceType =`\
`| "manual" // Human entered`\
`| "inherited" // From BOM defaults or parent`\
`| "overlay" // From conditional override`\
`| "inferred" // AI/model derived`\
`| "legacy_import"; // Migrated from legacy data`

**Usage:**

- Track what percentage of data is structured vs. inferred

- Focus human review on low-confidence fields

- Measure data quality improvement over time

---

### Extension Points (Optional, Future Use)

These fields are included in the schema but NOT required for v1 validity.

#### StepCondition

When does this step apply? For equipment-based filtering.

```typescript
interface StepCondition {
```

`// All conditions are AND'd together`\
`requiresEquipmentProfile?: string[]; // Kitchen must have these capabilities`\
`requiresCustomizationOption?: string[]; // Customer selected these options`\
`requiresRestaurantId?: string[]; // Only at specific locations (use sparingly)`\
`}`

#### StepOverlay

Conditional field overrides with priority.

```typescript
interface StepOverlay {
```

`id: string;`\
`predicate: {`\
`equipmentProfileId?: string;`\
`customizationValueIds?: string[];`\
`minCustomizationCount?: number;`\
`};`\
`overrides: Partial>;`\
`priority: number; // Higher wins`\
`}`

---

### Supporting Types

```typescript
// Authoring convenience groupings
```

`interface Operation {`\
`id: OperationId;`\
`name: string;`\
`type: "cook" | "assemble" | "prep";`\
`}`

`// Parallel lane definitions`\
`interface TrackDefinition {`\
`id: string; // "track_hot", "track_cold"`\
`name: string; // "Hot Line", "Garnish"`\
`defaultStationId?: StationId;`\
`}`

`// Reference types`\
`type OperationId = string;`\
`type StationId = string;`\
`type ToolId = string;`

---

## Schema Invariants

### Hard Invariants (Must Always Hold)

| ID | Rule | Rationale |
| --- | --- | --- |
| H1 | Every Step has `action.family` | Core semantic spine; 100% extractable from legacy |
| H2 | `orderIndex` is unique within ordering scope | Sequencing requires deterministic order |
| H3 | If `time` exists, `durationSeconds > 0` | Prevents poisoned aggregations |
| H4 | Containers are not targets | Prevents downstream confusion |
| H5 | `notes` escape hatch is always allowed | Legacy data is ambiguous; don't block on structure |

### Strong Invariants (Should Hold for Quality)

| ID | Rule | Rationale |
| --- | --- | --- |
| S1 | Component steps should have `target` | Enables BOM tracing, bulk ops |
| S2 | HEAT steps should have `equipment` | Enables appliance-based scoring |
| S3 | VEND steps should have `container` or packaging target | Enables packaging complexity |
| S4 | Phase markers in text should match `cookingPhase` | Consistency check |

### Soft Invariants (Nice to Have)

| ID | Rule | Rationale |
| --- | --- | --- |
| F1 | `toolId` and `stationId` can be null/inherited | Upstream data not ready |
| F2 | `detailId` taxonomy can be loose initially | Capture meaning first, normalize later |

### Explicitly Deferred

| ID | What | Why |
| --- | --- | --- |
| D1 | Equipment profile filtering required | Upstream data doesn't exist |
| D2 | Full dependency graph | Tracks + orderIndex sufficient for v1 |
| D3 | BOM usage ID required | Only 10.6% populated in legacy |

---

## Complexity Scoring Derivation

The schema must support computing these factors:

| Factor | Schema Query | Fields Required |
| --- | --- | --- |
| Step count | `steps.length` | `steps` |
| Equipment variety | `DISTINCT(equipment.applianceId)` | `equipment` |
| Short appliance steps | `steps WHERE equipment AND time.durationSeconds < 45` | `equipment`, `time` |
| Cold-to-hot rotation | Sequence analysis on `orderIndex` + phase/equipment | `orderIndex`, `cookingPhase`, `equipment` |
| Back-to-back turbo | Consecutive steps with `equipment.applianceId = turbo` | `orderIndex`, `equipment` |
| Total cook time | `SUM(time.durationSeconds) WHERE action.family = HEAT` | `time`, `action.family` |
| Active vs passive time | `SUM(time) GROUP BY isActive` | `time.isActive` |
| Hot/cold ratio | Steps by equipment classification | `equipment.applianceId` |
| Packaging complexity | `COUNT(steps WHERE container OR action.family = VEND)` | `container`, `action.family` |

---

## Validation Rules

Deterministic checks that can be implemented in any consumer.

| Rule | Severity | Condition |
| --- | --- | --- |
| Terse step | Warning | `action.family` exists but `target` missing and `notes` &lt; 10 chars |
| Container-only step | Warning | `container` exists and `target` missing and `action.family` in (HEAT, TRANSFER) |
| HEAT without equipment | Warning | `action.family = HEAT` and `equipment` missing |
| Phase mismatch | Warning | `notes` contains "POST COOK" but `cookingPhase` not set |
| Negation without exclude | Warning | `notes` matches "No X" pattern but `exclude` not set |
| OTHER overuse | Warning | `action.family = OTHER` for &gt;10% of steps in build |
| Empty build | Error | `status = published` and `steps.length = 0` |

---

## Migration & Compatibility

### Legacy → Schema Translation

Based on analysis of 64,909 legacy rows:

- **100%** can be assigned an `action.family`

- **97.9%** have extractable `target.name`

- **95.5%** translate with high confidence

- **0.8%** have data quality issues (terse text, ambiguous references)

### Schema → Legacy Generation

For KDS compatibility until native consumption:

- Generate legacy free-text format from structured fields

- `action.family` + `target.name` + `quantity` → legacy phrasing

- LLM can assist with natural phrasing

- Human review for edge cases

### Provenance Strategy

Track data quality improvement:

- `legacy_import` — Migrated from existing data

- `inferred` — AI-derived structure

- `manual` — Human authored/corrected

- Goal: Increase `manual` percentage over time

---

## Success Metrics

| Metric | Target | Measurement |
| --- | --- | --- |
| Golden set coverage | ≥95% steps without semantic loss | Manual review |
| OTHER usage | ≤10% of steps | Schema validation |
| Scoring accuracy | Within 5% of spreadsheet | Comparison test |
| Stakeholder sign-off | 3/3 approvers | Explicit approval |
| Schema stability | No breaking changes for 2 weeks | Change log |

---

## Open Questions

| Question | Owner | Target Date |
| --- | --- | --- |
| Scoring factor weights (align with Confluence methodology) | Brandon + Jen | Week 4 |
| Golden set item selection criteria | Brandon + Shin | Week 2 |
| `detailId` vocabulary standardization | Brandon + Shin | Week 6 |
| Station classification (hot vs cold) | Brandon + Jen | Week 3 |

---

## Appendix A: Example Instance

```json
{
```

`"id": "build_abc123",`\
`"menuItemId": "8000001",`\
`"version": 1,`\
`"status": "published",`\
`"tracks": [`\
`{ "id": "hot", "name": "Hot Line" },`\
`{ "id": "cold", "name": "Assembly" }`\
`],`\
`"steps": [`\
`{`\
`"id": "step_1",`\
`"orderIndex": 1,`\
`"trackId": "hot",`\
`"kind": "component",`\
`"action": { "family": "PREP", "detailId": "open_pouch" },`\
`"target": {`\
`"type": "bom_component",`\
`"bomComponentId": "4000001",`\
`"name": "Chicken Breast (150g)"`\
`},`\
`"cookingPhase": "PRE_COOK",`\
`"provenance": {`\
`"target": { "type": "manual", "confidence": "high" }`\
`}`\
`},`\
`{`\
`"id": "step_2",`\
`"orderIndex": 2,`\
`"trackId": "hot",`\
`"kind": "component",`\
`"action": { "family": "HEAT", "detailId": "waterbath" },`\
`"target": {`\
`"type": "bom_component",`\
`"bomComponentId": "4000001",`\
`"name": "Chicken Breast (150g)"`\
`},`\
`"equipment": { "applianceId": "waterbath" },`\
`"time": { "durationSeconds": 300, "isActive": false },`\
`"cookingPhase": "COOK"`\
`},`\
`{`\
`"id": "step_3",`\
`"orderIndex": 3,`\
`"trackId": "hot",`\
`"kind": "action",`\
`"action": { "family": "TRANSFER", "detailId": "place" },`\
`"container": { "type": "pan", "name": "AMBER Pan" },`\
`"cookingPhase": "POST_COOK",`\
`"notes": "Transfer to holding pan"`\
`},`\
`{`\
`"id": "step_4",`\
`"orderIndex": 1,`\
`"trackId": "cold",`\
`"kind": "component",`\
`"action": { "family": "PREP", "detailId": "open" },`\
`"target": {`\
`"type": "bom_component",`\
`"bomComponentId": "4000002",`\
`"name": "Brioche Bun"`\
`}`\
`},`\
`{`\
`"id": "step_5",`\
`"orderIndex": 2,`\
`"trackId": "cold",`\
`"kind": "action",`\
`"action": { "family": "ASSEMBLE", "detailId": "build" },`\
`"notes": "Place chicken on bun, add toppings"`\
`},`\
`{`\
`"id": "step_6",`\
`"orderIndex": 3,`\
`"trackId": "cold",`\
`"kind": "action",`\
`"action": { "family": "VEND" },`\
`"container": { "type": "bag", "name": "Delivery Bag" }`\
`}`\
`],`\
`"createdAt": "2025-12-31T12:00:00Z",`\
`"updatedAt": "2025-12-31T12:00:00Z"`\
`}`

---

## Appendix B: Related Documents

- `governance/CHARTER.md` — Project scope and governance

- `governance/STAKEHOLDER-REGISTRY.md` — Who cares about what

- `governance/DECISIONS.md` — Decision audit trail

- `schema/INVARIANTS.md` — Detailed invariant definitions

- `schema/FIELD-RATIONALE.md` — Why each field exists

- `validation/GOLDEN-SET.md` — Representative items for validation

- `validation/DERIVABILITY-MATRIX.md` — Stakeholder query validation

---

## Change History

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 0.1 | 2025-12-31 | Brandon Galang | Initial draft |
