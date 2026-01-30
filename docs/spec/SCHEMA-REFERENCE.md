# Schema Reference (Canonical v1)

> **⚠️ IMPORTANT:** This document is for **conceptual reference only**.
> **Source of truth:** TypeScript schema files in `line-build-cli/scripts/lib/schema/`:
> - `build.ts` - BenchTopLineBuild interface
> - `step.ts` - Step interface
> - `assembly.ts` - Assembly and AssemblyRef interfaces (material flow)
> - `enums.ts` - All enum types
>
> This doc provides high-level guidance but may lag behind implementation.
> **When in doubt, read the TypeScript files.**

---

## High-level Model

- A **line build** is a list of steps with a deterministic order and optional dependency edges (**work graph**).
- Each **step** is one unit of work, categorized by an **action family**.
- The schema uses **assembly-based material flow** (not artifact flow) via `input[]` and `output[]` arrays on each step.
- Material locations tracked via `AssemblyRef.from` and `AssemblyRef.to` (NOT on steps directly).
- Steps describe **where work happens** via `stationId` + `workLocation` (NOT via from/to fields).
- Optional fields enrich the model (station, cooking phase, container, prep metadata, conditions/overlays).

---

## Key Concepts

### Material Flow vs. Work Location

**Critical distinction:**
- **Material flow**: Where materials come FROM and go TO → tracked in `input[].from` and `output[].to`
- **Work location**: Where the work happens → tracked in `step.stationId` + `step.workLocation`

Example:
```typescript
{
  id: "add-cheese",
  stationId: "garnish",
  workLocation: { type: "work_surface" },  // Work happens at work surface
  input: [{
    source: { type: "in_build", assemblyId: "cheese" },
    from: {                                 // Material comes FROM cold rail
      stationId: "garnish",
      sublocation: { type: "cold_rail" }
    }
  }]
}
```

### Assemblies Replace Artifacts

- Old concept: `artifacts` (deprecated)
- New concept: `assemblies` (current)
- Assemblies represent materials that flow through steps
- Each step has `input: AssemblyRef[]` and `output: AssemblyRef[]`

---

## Schema Structure Overview

See TypeScript files for complete definitions. High-level structure:

### `BenchTopLineBuild` (see `build.ts`)

**Required fields:**
- `id: BuildId` - unique identifier
- `itemId: ItemId` - catalog item reference (80* menu items)
- `version: number` - immutable once created
- `status: "draft" | "published" | "archived"`
- `steps: Step[]` - array of steps (H6 constrains published)
- `createdAt: string` - ISO timestamp
- `updatedAt: string` - ISO timestamp

**Optional fields:**
- `name?: string` - human-readable name
- `menuItemId?: MenuItemId` - legacy alias for itemId
- `operations?: Operation[]` - UX grouping
- `tracks?: TrackDefinition[]` - parallel lanes
- `bom?: BomEntry[]` - Bill of Materials
- `assemblies?: Assembly[]` - **Material flow tracking (replaces artifacts)**
- `primaryOutputAssemblyId?: string` - main output
- `requiresBuilds?: BuildRef[]` - prepared component builds
- `customizationGroups?: CustomizationGroup[]` - customization DAG
- `validationOverrides?: ValidationOverride[]` - validation audit trail
- `authorId?: string`, `changeLog?: string` - metadata

### `Step` (see `step.ts`)

**⚠️ Material flow is tracked via `input[]` and `output[]` arrays, NOT via from/to on steps.**

**Required fields:**
- `id: StepId` - unique within build (H7)
- `orderIndex: number` - ordering within track (H2)
- `action: StepAction` - action family + technique (H1)
- `input: AssemblyRef[]` - input materials (default `[]`)
- `output: AssemblyRef[]` - output materials (default `[]`)

**Optional but important:**
- `stationId?: StationId` - where work happens
- `workLocation?: StepSublocation` - **where within station** (NOT from/to)
- `equipment?: StepEquipment` - required for HEAT (H15)
- `time?: StepTime` - cook time (H22 for HEAT)
- `toolId?: ToolId` - tool used
- `quantity?: StepQuantity` - amount (H24 for PORTION, H10 for value > 0)
- `target?: StepTarget` - what is being acted on
- `instruction?: string` - human-readable text
- `notes?: string` - escape hatch (H5)
- `dependsOn?: DependencyRef[]` - work dependencies (H8, H9)
- `trackId?: string`, `operationId?: string` - grouping

**Key removals from legacy schema:**
- ❌ `from`, `to` - removed from steps, now only on AssemblyRef
- ❌ `sublocation` - renamed to `workLocation` for clarity
- ❌ `kind` - removed, use `action.family` instead

### `AssemblyRef` (see `assembly.ts`)

**Material flow is tracked here:**

```typescript
interface AssemblyRef {
  source: AssemblySource;          // which assembly
  from?: LocationRef;              // ✅ where material comes FROM
  to?: LocationRef;                // ✅ where material goes TO
  quantity?: StepQuantity;         // amount
  role?: "base" | "added";         // for merge steps
  onAssembly?: AssemblyId;         // relative placement
  notes?: string;
}
```

### `LocationRef` (see `step.ts`)

```typescript
interface LocationRef {
  stationId?: StationId;
  sublocation?: {
    type: SublocationId;
    equipmentId?: ApplianceId;     // when type="equipment"
  };
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
  | "vending"       // vending station (pickup / staging)
  | "pass"          // pass to next station (handoff point)
  | "other";        // escape hatch + detail in notes

// Note: In some legacy data, "station" was conflated with equipment (e.g., "Turbo", "Fryer").
// The canonical model separates these: station = where, equipment = what appliance.
```

#### Station POD Types (Temperature Classification)

Each station/equipment type is classified as Hot, Cold, or Vending for operational grouping:

| Station/Equipment | POD Type |
| :--- | :--- |
| Fryer | Hot |
| Waterbath | Hot |
| Turbo | Hot |
| Clamshell Grill | Hot |
| Pizza | Hot |
| Microwave | Hot |
| Garnish | Cold |
| Press | Cold |
| Toaster | Cold |
| Speed Line | Cold |
| Vending | Vending |

This classification is used for swimlane visualization and handoff complexity scoring.

### `SublocationId` + location references (Where within a station)

Sublocations describe **where within a station** the component/work is happening. These are used for:
- transfer/staging modeling (window/shelf)
- retrieval-effort scoring (rail vs cold storage)
- equipment-as-location modeling (equipment is a sublocation type)

```ts
export type SublocationId =
  | "work_surface"
  | "cold_rail"
  | "dry_rail"
  | "cold_storage"
  | "packaging"
  | "kit_storage"
  | "window_shelf"
  | "equipment";

export interface StepSublocation {
  type: SublocationId;
  // Required when type === "equipment"
  equipmentId?: ApplianceId;
}

export interface LocationRef {
  stationId?: StationId;
  sublocation?: StepSublocation;
}
```

#### Sublocation Capabilities (Mental Model)

> **Note:** This is a working mental model, not enforced validation rules. Needs SME validation before hardening.

Each sublocation tends to be used as a **source** (retrieve from) or **sink** (place to):

| Sublocation | Typical Source? | Typical Sink? | Notes |
| :--- | :--- | :--- | :--- |
| `work_surface` | Yes | Yes | Bidirectional; active work area |
| `equipment` | Yes | Yes | Bidirectional; equipment-specific work space |
| `window_shelf` | Yes | Yes | **Universal conceptual location**; staging between stations |
| `cold_rail` | Yes | Rare | Primarily retrieve; occasionally restock |
| `dry_rail` | Yes | Rare | Primarily retrieve |
| `cold_storage` | Yes | Yes* | Primarily source; *sink for put-back flows (reseal, return excess) |
| `packaging` | Yes | Rare | Primarily retrieve packaging materials |
| `kit_storage` | Yes | Rare | Primarily retrieve pre-assembled kits |

**Cold storage put-back flow:** The primary sublocation that supports a "return" operation. Used when:
- Excess ingredient is resealed and returned
- Pre-portioned component needs refrigeration between prep and service

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
  | "scale"         // for weighing portions
  | "bench_scraper"
  | "utility_knife"
  | "whisk"
  | "ladle"
  | "other";        // escape hatch
```

---

### `TechniqueId` (Standardized Actions)

Techniques are the **specific methods** used within an action family.

```ts
export type TechniqueId =
  | "portion"       // dividing into specific amounts
  | "weigh"         // measuring by weight
  | "open_pack"     // opening vendor packaging
  | "seal"          // sealing a bag/container
  | "label"         // applying a date/content label
  | "wash"          // cleaning produce
  | "cut_diced"     // dicing (e.g. 1/4", 1/2")
  | "cut_sliced"    // slicing
  | "cut_julienne"  // julienne strips
  | "stir"          // mixing gently
  | "fold"          // incorporating ingredients gently
  | "whisk"         // beating to incorporate air
  | "scoop"         // using a scoop/spoodle
  | "wipe"          // cleaning a surface/rim
  | "other";
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
  PACKAGING = "PACKAGING", // containerize/seal (pack, lid, sleeve, wrap)
  OTHER = "OTHER",         // escape hatch (track usage; goal <10%)
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

---

## Cross-Build Composition (Prepared Components)

Some items have their own prep/build instructions (e.g., a prepared component). Other menu items may depend on those prepared components.

```ts
export interface BuildRef {
  itemId: ItemId;
  version?: number | "latest_published";
  role?: "prepared_component";
  notes?: string;
}
```

**MVP policy:** `requiresBuilds` references published builds only.

---

## Artifact Flow (Material Graph)

The schema supports a material-flow graph so multiple components can move in parallel and then **join** at assembly/packaging.

This is distinct from `dependsOn`:
- `dependsOn` = work ordering constraints (work graph)
- `input`/`output` = material flow constraints (material graph)

### Versioned Artifacts & Grouping

To model how an item changes over time (e.g., adding ingredients to a tortilla), we use **versioned artifacts** tied together by a `groupId`.

```ts
export type ArtifactId = string;

export interface Artifact {
  id: ArtifactId;                // unique version ID (e.g., quesadilla_v1)
  name?: string;
  type?: ArtifactType;
  bomUsageId?: BomUsageId;
  bomComponentId?: BomComponentId;
  notes?: string;

  // NEW: Logical grouping for versions
  groupId?: string;              // stable group ID (e.g., quesadilla_main)

  // NEW: Component membership tracking
  components?: BomEntryId[];     // list of BOM components in this version
}
```

### Precise Location Tracking

Locations are tracked **per component** via `from` and `to` on the artifact reference.

```ts
export interface ArtifactRef {
  source: ArtifactSource;
  quantity?: StepQuantity;
  notes?: string;

  // NEW: Precise routing for this component
  from?: LocationRef;            // source station/sublocation
  to?: LocationRef;              // destination station/sublocation

  // NEW: Component-relative placement
  onArtifact?: ArtifactId;       // e.g., "place cheese ON the tortilla"
}

export type ArtifactSource =
  | { type: "in_build"; artifactId: ArtifactId }
  | {
      type: "external_build";
      itemId: ItemId;
      version?: number | "latest_published";
      artifactId?: ArtifactId; // optional; default is external build's primaryOutputArtifactId
    };
```

### Derived Dependencies (Work vs. Material)

The CLI implements **automatic dependency derivation**:
- If **Step B** takes an artifact as input that **Step A** produced as output, the system adds a dependency **A → B**.
- These derived edges are merged into the `dependsOn` array during normalization.

---

## Step Sub-Types

### `StepAction` (Required)

```ts
export interface StepAction {
  family: ActionFamily;             // required (H1)
  techniqueId?: TechniqueId;        // standardized technique
  detailId?: string;                // legacy/raw detail
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

  // IMPORTANT: StepTarget is about semantic identity (BOM linkage / “what is this step about?”).
  // Do NOT use target alone to model multi-component flow or joins.
  // Use consumes/produces + artifacts for flow semantics.
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
  | "lexan"        // clear plastic storage container
  | "deli_cup"     // clear round portion cup (16oz, 32oz)
  | "hotel_pan"    // stainless steel prep pan
  | "squeeze_bottle"
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
- If `step.action.family === "PACKAGING"`:
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

