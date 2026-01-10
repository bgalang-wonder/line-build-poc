# Schema Reference (Canonical v1)

> **Purpose:** Single source of truth for the POC data model.  
> **Primary sources:** `docs/schema/SPEC-TECHNICAL.md`, `docs/schema/INVARIANTS.md`.  
> **Note:** `docs/schema/types-benchtop.ts` contains earlier “WorkUnit” types preserved for reference; this doc defines the canonical `BenchTopLineBuild` + `Step` schema used by invariants H1–H22.

---

## High-level Model

- A **line build** is a list of steps with a deterministic order and optional dependency edges.
- Each **step** is one unit of work, categorized by an **action family**.
- Optional fields enrich the model (station, cooking phase, container, prep metadata, conditions/overlays).

---

## Canonical Types (TypeScript)

### `BenchTopLineBuild`

```ts
export type BuildId = string;     // UUID
export type MenuItemId = string;  // 80* item reference (string)
export type BuildStatus = "draft" | "published" | "archived";

export interface BenchTopLineBuild {
  // Identity
  id: BuildId;
  menuItemId: MenuItemId;
  version: number;               // immutable once created
  status: BuildStatus;

  // Content
  steps: Step[];                 // required (H6 constrains published)

  // Optional authoring structure
  operations?: Operation[];      // UX convenience grouping
  tracks?: TrackDefinition[];    // optional parallel lanes

  // Customization DAG support
  customizationGroups?: CustomizationGroup[];

  // Validation audit trail (policy layer; see HARD-RULES.md)
  validationOverrides?: ValidationOverride[];

  // Metadata
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  authorId?: string;
  changeLog?: string;
}
```

### `Step`

```ts
export type StepId = string; // UUID
export type StepKind = "component" | "action" | "quality_check" | "meta";

export interface Step {
  // Identity & ordering
  id: StepId;                     // unique within build (H7)
  orderIndex: number;             // required + unique in scope (H2)
  trackId?: string;               // if present, orderIndex uniqueness is within track scope
  operationId?: string;           // optional grouping

  // Semantic meaning (required)
  kind: StepKind;
  action: StepAction;             // required (H1)

  // What is being acted on? (strongly recommended)
  target?: StepTarget;            // constrained by H4 and action-specific patterns

  // Execution details (optional, often inferable)
  stationId?: StationId;
  toolId?: ToolId;
  equipment?: StepEquipment;       // required for HEAT (H15)
  time?: StepTime;                // required for HEAT unless notes non-empty (H22)

  // Phase semantics (recommended; tracked by metrics)
  cookingPhase?: CookingPhase;

  // Container / packaging (recommended; required for VEND unless packaging target) (H16)
  container?: StepContainer;

  // Negation / exclusion (OPTIONAL_SUBTRACTION pattern)
  exclude?: boolean;

  // Pre-service prep (P1.9)
  prepType?: PrepType;            // default: "order_execution"
  storageLocation?: StorageLocation; // required when prepType="pre_service" (H17)
  bulkPrep?: boolean;             // implies prepType="pre_service" (H18)

  // Quantity / amount (EXTRA_REQUESTS, portions)
  quantity?: StepQuantity;        // if present, value must be > 0 (H10)

  // Escape hatch (always allowed) (H5)
  notes?: string;

  // Data quality tracking (optional)
  provenance?: StepProvenance;

  // Extension points (optional)
  conditions?: StepCondition;      // equipment/customization gating
  overlays?: StepOverlay[];        // conditional field overrides
  dependsOn?: StepId[];            // dependency edges (if present: H8 + H9 apply)
}

```

---

## Core Enums

### `StationId` (Physical Location)

Stations are **physical locations** in the kitchen where work happens. They are distinct from equipment (appliances).

```ts
export type StationId =
  | "hot_side"      // hot line — fryer, turbo, waterbath, etc.
  | "cold_side"     // cold prep / cold line
  | "prep"          // general prep area
  | "garnish"       // garnish / cold assembly station
  | "expo"          // expeditor / pass window
  | "vending"       // vending / packaging station
  | "pass"          // pass to next station (handoff point)
  | "other";        // escape hatch + detail in notes

// Note: In some legacy data, "station" was conflated with equipment (e.g., "Turbo", "Fryer").
// The canonical model separates these: station = where, equipment = what appliance.
```

### `ToolId` (Hand Tools)

Tools are **hand-held implements** used to manipulate food. Common vocabulary from scorecard:

```ts
export type ToolId =
  | "hand"          // bare hands (most common)
  | "tongs"
  | "mini_tong"
  | "paddle"
  | "spatula"
  | "spoon"
  | "spoodle_1oz"
  | "spoodle_2oz"
  | "spoodle_3oz"
  | "fry_basket"
  | "squeeze_bottle"
  | "shaker"
  | "viper"         // portion tool
  | "other";        // escape hatch
```

---

### `ActionFamily` (Required)

```ts
export enum ActionFamily {
  PREP = "PREP",          // open/stage/unwrap
  HEAT = "HEAT",          // cook/re-therm/toast/fry
  TRANSFER = "TRANSFER",  // move from A to B
  COMBINE = "COMBINE",    // add X to Y, mix
  ASSEMBLE = "ASSEMBLE",  // build final product
  PORTION = "PORTION",    // measure quantity
  CHECK = "CHECK",        // QA/temp check
  VEND = "VEND",          // package/handoff
  OTHER = "OTHER",        // escape hatch (track usage; goal <10%)
}
```

### `CookingPhase` (Recommended)

```ts
export enum CookingPhase {
  PRE_COOK = "PRE_COOK",
  COOK = "COOK",
  POST_COOK = "POST_COOK",
  ASSEMBLY = "ASSEMBLY",
  PASS = "PASS",
}
```

---

## Step Sub-Types

### `StepAction` (Required)

```ts
export interface StepAction {
  family: ActionFamily;             // required (H1)
  detailId?: string;                // optional technique taxonomy
  displayTextOverride?: string;      // legacy output fixes (rare)
}
```

### `StepTarget`

```ts
export type TargetType =
  | "bom_usage"      // preferred stable usage reference
  | "bom_component"  // acceptable component ID reference
  | "packaging"      // packaging item (9* or similar)
  | "free_text"      // name-only fallback
  | "unknown";

export type BomUsageId = string;
export type BomComponentId = string;

export interface StepTarget {
  type: TargetType;
  bomUsageId?: BomUsageId;
  bomComponentId?: BomComponentId;
  name?: string;          // strongly recommended for human readability
}
```

### `StepEquipment`

Equipment refers to **appliances** that apply heat or perform mechanical work.

```ts
export type ApplianceId =
  // Heat appliances (common)
  | "turbo"           // turbo oven / rapid cook
  | "fryer"           // deep fryer
  | "waterbath"       // sous vide / immersion circulator
  | "toaster"         // toaster
  | "salamander"      // salamander broiler
  | "clamshell_grill" // clamshell / contact grill
  | "press"           // panini press / sandwich press
  | "induction"       // induction cooktop
  | "conveyor"        // conveyor oven
  // Holding equipment
  | "hot_box"         // hot holding cabinet
  | "hot_well"        // steam table / hot well
  // Escape hatch
  | "other";          // + detail in notes

export interface StepEquipment {
  applianceId: ApplianceId;
  presetId?: string;  // e.g., "350F", "program_3"
}
```

### `StepTime`

```ts
export interface StepTime {
  durationSeconds: number; // if present, must be > 0 (H3)
  isActive: boolean;       // true = hands-on, false = waiting (H3)
}
```

### `StepContainer`

```ts
export type ContainerType =
  | "bag"
  | "bowl"
  | "pan"
  | "tray"
  | "clamshell"
  | "ramekin"
  | "cup"
  | "foil"
  | "lid"
  | "other";

export interface StepContainer {
  type?: ContainerType;
  name?: string; // e.g. "Tray, 52oz, Black-Gold"
  size?: string; // keep as string to avoid unit complexity
}
```

### Pre-service prep types

```ts
export type PrepType = "pre_service" | "order_execution";

export type StorageLocationType =
  | "cold_storage"    // walk-in or reach-in fridge
  | "cold_rail"       // cold line/rail at station
  | "dry_rail"        // dry storage at station
  | "freezer"         // frozen storage
  | "ambient"         // room temperature
  | "hot_hold_well"   // hot holding equipment
  | "kit"             // pre-assembled kit (ready to use)
  | "other";

export interface StorageLocation {
  type: StorageLocationType;
  detail?: string; // e.g. "left reach-in", "garnish rail"
}
```

### `StepQuantity`

```ts
export interface StepQuantity {
  value: number;                         // if present, must be > 0 (H10)
  unit: string;                          // "g", "ea", "oz", etc.
  kind?: "absolute" | "multiplier";      // default: "absolute"
}
```

---

## Customization + Overlays (Extension Points)

### `StepCondition`

All arrays use **AND semantics** (must match all specified values).

```ts
export interface StepCondition {
  requiresEquipmentProfileIds?: string[];
  requiresCustomizationValueIds?: string[]; // value IDs (not option IDs)
  requiresRestaurantIds?: string[];         // use sparingly
}
```

### `StepOverlay`

```ts
export interface StepOverlay {
  id: string;
  predicate: {
    equipmentProfileId?: string;
    customizationValueIds?: string[]; // AND semantics
    minCustomizationCount?: number;
  };
  overrides: Partial<Pick<Step,
    | "stationId"
    | "toolId"
    | "equipment"
    | "time"
    | "cookingPhase"
    | "container"
    | "notes"
    | "exclude"
    | "quantity"
  >>;
  priority: number; // higher wins (H11)
}
```

**Not overridable (by design):** `id`, `orderIndex`, `trackId`, `action`, `target`, `dependsOn`, `operationId`, `kind`.

### `CustomizationGroup`

```ts
export type CustomizationGroupType =
  | "MANDATORY_CHOICE"
  | "OPTIONAL_ADDITION"
  | "OPTIONAL_SUBTRACTION"
  | "EXTRA_REQUESTS"
  | "DISH_PREFERENCE"
  | "ON_THE_SIDE";

export interface CustomizationGroup {
  optionId: string;            // unique within build (H12)
  type: CustomizationGroupType;
  minChoices?: number;         // required when type=MANDATORY_CHOICE (H21)
  maxChoices?: number;         // required when type=MANDATORY_CHOICE (H21)
  valueIds?: string[];         // required for validating conditions (H19/H20)
  displayName?: string;
}
```

### `ValidationOverride` (Audit Trail)

```ts
export type ValidationSeverity = "hard" | "strong" | "soft";

export interface ValidationOverride {
  id: string;
  ruleId: string;                  // which rule is overridden
  severity: ValidationSeverity;
  stepId?: StepId;
  fieldPath?: string;              // e.g. "prepType", "equipment.applianceId"
  reason: string;                  // required non-empty (H13)
  createdAt: string;               // ISO timestamp
  createdByUserId?: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  approved?: boolean;
}
```

---

## Provenance (Optional, Recommended for POC)

```ts
export type ProvenanceType = "manual" | "inherited" | "overlay" | "inferred" | "legacy_import";

export interface FieldProvenance {
  type: ProvenanceType;
  sourceId?: string;
  confidence?: "high" | "medium" | "low";
}

export interface StepProvenance {
  target?: FieldProvenance;
  stationId?: FieldProvenance;
  toolId?: FieldProvenance;
  equipment?: FieldProvenance;
  time?: FieldProvenance;
  container?: FieldProvenance;
  cookingPhase?: FieldProvenance;
  exclude?: FieldProvenance;
}
```

---

## Conditional Requirements (What’s required vs optional)

### Always required (hard rules)

- `step.action.family` (H1)
- `step.id` unique (H7)
- `step.orderIndex` present + unique per scope (H2)
- If `build.status === "published"`, then `steps.length > 0` (H6)

### Conditionally required (hard rules)

- If `step.action.family === "HEAT"`:
  - `step.equipment` required (H15)
  - `step.time` required **OR** `step.notes` non-empty (H22)
- If `step.action.family === "VEND"`:
  - `step.container` required **OR** `step.target.type === "packaging"` (H16)
- If `step.prepType === "pre_service"`:
  - `step.storageLocation` required (H17)
- If `step.bulkPrep === true`:
  - `step.prepType` must be `"pre_service"` (H18)
- If `step.quantity` exists:
  - `quantity.value > 0` (H10)
- If `step.dependsOn` exists:
  - all references must exist (H8)
  - no cycles (H9)
- If `customizationGroups` / `conditions` / `overlays` are used:
  - `optionId` unique (H12)
  - mandatory choice cardinality set (H21)
  - valueId references valid (H19, H20)
  - overlay predicate non-empty (H14) and priority numeric (H11)

### Optional (tracked via metrics / quality goals)

- `step.target` (recommended; container concepts must not be placed here) (see H4)
- `step.cookingPhase`
- `step.stationId`, `step.toolId`
- `step.provenance`
- `build.operations`, `build.tracks`

---

## Reference: Mapping from Legacy “WorkUnit” POC Types

Earlier POC types (`docs/schema/types-benchtop.ts`) model:

- `WorkUnit.tags.action` (string action types like `"FINISH"`, `"QUALITY_CHECK"`)
- `WorkUnit.tags.phase` (phase)
- `WorkUnit.tags.station` (string station)
- `WorkUnit.tags.time` (value/unit/type rather than seconds/isActive)

Canonical v1 schema maps to:

- `tags.action` → `step.action.family` (normalize to `ActionFamily`)
- `tags.phase` → `step.cookingPhase`
- `tags.station` → `step.stationId` (or keep as free string for POC)
- `tags.time { value, unit, type }` → `step.time { durationSeconds, isActive }`

