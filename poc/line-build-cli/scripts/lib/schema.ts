import { z } from "zod";

/**
 * Canonical PoC schema types + runtime validation.
 *
 * Source of truth for field presence: docs/handoff/POC_TASKS.json -> shared_conventions.schema_contract
 *
 * Notes:
 * - This PoC contract intentionally omits legacy WorkUnit types.
 * - Per schema_contract note: StepKind is NOT part of the PoC contract.
 */

// -----------------------------
// Scalar IDs
// -----------------------------

export type BuildId = string;
export type ItemId = string;
export type MenuItemId = string;
export type StepId = string;
export type ArtifactId = string;
export type BomUsageId = string;
export type BomComponentId = string;

// -----------------------------
// Build
// -----------------------------

export type BuildStatus = "draft" | "published" | "archived";

export interface BenchTopLineBuild {
  // required
  id: BuildId;
  itemId: ItemId;
  version: number;
  status: BuildStatus;
  steps: Step[];
  createdAt: string;
  updatedAt: string;

  // optional (per schema_contract)
  menuItemId?: MenuItemId;
  operations?: Operation[];
  tracks?: TrackDefinition[];
  requiresBuilds?: BuildRef[];
  artifacts?: Artifact[];
  primaryOutputArtifactId?: string;
  customizationGroups?: CustomizationGroup[];
  validationOverrides?: ValidationOverride[];
  authorId?: string;
  changeLog?: string;
}

// Not defined in the embedded PoC schema_contract; keep permissive for Cycle 1.
export type Operation = Record<string, unknown>;
export type TrackDefinition = Record<string, unknown>;

// -----------------------------
// Cross-build composition
// -----------------------------

export type BuildRefRole = "prepared_component";
export type BuildRefVersion = number | "latest_published";

export interface BuildRef {
  itemId: ItemId;
  version?: BuildRefVersion;
  role?: BuildRefRole;
  notes?: string;
}

// -----------------------------
// Step + subtypes
// -----------------------------

export enum ActionFamily {
  PREP = "PREP",
  HEAT = "HEAT",
  TRANSFER = "TRANSFER",
  COMBINE = "COMBINE",
  ASSEMBLE = "ASSEMBLE",
  PORTION = "PORTION",
  CHECK = "CHECK",
  VEND = "VEND",
  OTHER = "OTHER",
}

// SCHEMA-REFERENCE defines TechniqueId vocabulary, but the PoC contract does not constrain it.
export type TechniqueId = string;

export interface StepAction {
  family: ActionFamily;
  techniqueId?: TechniqueId;
  detailId?: string;
  displayTextOverride?: string;
}

export type TargetType =
  | "bom_usage"
  | "bom_component"
  | "packaging"
  | "free_text"
  | "unknown";

export interface StepTarget {
  type: TargetType;
  bomUsageId?: BomUsageId;
  bomComponentId?: BomComponentId;
  name?: string;
}

export type StationId =
  | "hot_side"
  | "cold_side"
  | "prep"
  | "garnish"
  | "expo"
  | "vending"
  | "pass"
  | "other";

export type ToolId =
  | "hand"
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
  | "viper"
  | "scale"
  | "bench_scraper"
  | "utility_knife"
  | "whisk"
  | "ladle"
  | "other";

export type ApplianceId =
  | "turbo"
  | "fryer"
  | "waterbath"
  | "toaster"
  | "salamander"
  | "clamshell_grill"
  | "press"
  | "induction"
  | "conveyor"
  | "hot_box"
  | "hot_well"
  | "other";

export interface StepEquipment {
  applianceId: ApplianceId;
  presetId?: string;
}

export interface StepTime {
  durationSeconds: number;
  isActive: boolean;
}

export enum CookingPhase {
  PRE_COOK = "PRE_COOK",
  COOK = "COOK",
  POST_COOK = "POST_COOK",
  ASSEMBLY = "ASSEMBLY",
  PASS = "PASS",
}

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
  | "lexan"
  | "deli_cup"
  | "hotel_pan"
  | "squeeze_bottle"
  | "other";

export interface StepContainer {
  type?: ContainerType;
  name?: string;
  size?: string;
}

export type PrepType = "pre_service" | "order_execution";

export type StorageLocationType =
  | "cold_storage"
  | "cold_rail"
  | "dry_rail"
  | "freezer"
  | "ambient"
  | "hot_hold_well"
  | "kit"
  | "other";

export interface StorageLocation {
  type: StorageLocationType;
  detail?: string;
}

export type StepQuantityKind = "absolute" | "multiplier";

export interface StepQuantity {
  value: number;
  unit: string;
  kind?: StepQuantityKind;
}

export type ProvenanceType =
  | "manual"
  | "inherited"
  | "overlay"
  | "inferred"
  | "legacy_import";

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

export interface StepCondition {
  requiresEquipmentProfileIds?: string[];
  requiresCustomizationValueIds?: string[];
  requiresRestaurantIds?: string[];
}

export interface StepOverlay {
  id: string;
  predicate: {
    equipmentProfileId?: string;
    customizationValueIds?: string[];
    minCustomizationCount?: number;
  };
  overrides: Partial<
    Pick<
      Step,
      | "stationId"
      | "toolId"
      | "equipment"
      | "time"
      | "cookingPhase"
      | "container"
      | "notes"
      | "exclude"
      | "quantity"
    >
  >;
  priority: number;
}

export type CustomizationGroupType =
  | "MANDATORY_CHOICE"
  | "OPTIONAL_ADDITION"
  | "OPTIONAL_SUBTRACTION"
  | "EXTRA_REQUESTS"
  | "DISH_PREFERENCE"
  | "ON_THE_SIDE";

export interface CustomizationGroup {
  optionId: string;
  type: CustomizationGroupType;
  minChoices?: number;
  maxChoices?: number;
  valueIds?: string[];
  displayName?: string;
}

export type ValidationSeverity = "hard" | "strong" | "soft";

export interface ValidationOverride {
  id: string;
  ruleId: string;
  severity: ValidationSeverity;
  stepId?: StepId;
  fieldPath?: string;
  reason: string;
  createdAt: string;
  createdByUserId?: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  approved?: boolean;
}

export interface Step {
  // required (per schema_contract)
  id: StepId;
  orderIndex: number;
  action: StepAction;

  // optional (per schema_contract)
  instruction?: string;
  trackId?: string;
  operationId?: string;
  target?: StepTarget;
  stationId?: StationId;
  toolId?: ToolId;
  equipment?: StepEquipment;
  time?: StepTime;
  cookingPhase?: CookingPhase;
  container?: StepContainer;
  exclude?: boolean;
  prepType?: PrepType;
  storageLocation?: StorageLocation;
  bulkPrep?: boolean;
  quantity?: StepQuantity;
  notes?: string;
  provenance?: StepProvenance;
  conditions?: StepCondition;
  overlays?: StepOverlay[];
  dependsOn?: StepId[];
  consumes?: ArtifactRef[];
  produces?: ArtifactRef[];
}

// -----------------------------
// Artifacts / flow
// -----------------------------

export type ArtifactType =
  | "intermediate"
  | "final"
  | "packaging"
  | "free_text"
  | "bom_usage"
  | "bom_component";

export interface Artifact {
  id: ArtifactId;
  name?: string;
  type?: ArtifactType;
  bomUsageId?: BomUsageId;
  bomComponentId?: BomComponentId;
  notes?: string;
}

export type ArtifactSource =
  | { type: "in_build"; artifactId: ArtifactId }
  | {
      type: "external_build";
      itemId: ItemId;
      version?: BuildRefVersion;
      artifactId?: ArtifactId;
    };

export interface ArtifactRef {
  source: ArtifactSource;
  quantity?: StepQuantity;
  notes?: string;
}

// -----------------------------
// Zod schemas (runtime validation)
// -----------------------------

const NonEmptyString = z.string().min(1);

const StationIdSchema = z.union([
  z.literal("hot_side"),
  z.literal("cold_side"),
  z.literal("prep"),
  z.literal("garnish"),
  z.literal("expo"),
  z.literal("vending"),
  z.literal("pass"),
  z.literal("other"),
]);

const ToolIdSchema = z.union([
  z.literal("hand"),
  z.literal("tongs"),
  z.literal("mini_tong"),
  z.literal("paddle"),
  z.literal("spatula"),
  z.literal("spoon"),
  z.literal("spoodle_1oz"),
  z.literal("spoodle_2oz"),
  z.literal("spoodle_3oz"),
  z.literal("fry_basket"),
  z.literal("squeeze_bottle"),
  z.literal("shaker"),
  z.literal("viper"),
  z.literal("scale"),
  z.literal("bench_scraper"),
  z.literal("utility_knife"),
  z.literal("whisk"),
  z.literal("ladle"),
  z.literal("other"),
]);

const ProvenanceTypeSchema = z.union([
  z.literal("manual"),
  z.literal("inherited"),
  z.literal("overlay"),
  z.literal("inferred"),
  z.literal("legacy_import"),
]);

const FieldProvenanceSchema = z
  .object({
    type: ProvenanceTypeSchema,
    sourceId: z.string().optional(),
    confidence: z
      .union([z.literal("high"), z.literal("medium"), z.literal("low")])
      .optional(),
  })
  .strict();

const StepProvenanceSchema = z
  .object({
    target: FieldProvenanceSchema.optional(),
    stationId: FieldProvenanceSchema.optional(),
    toolId: FieldProvenanceSchema.optional(),
    equipment: FieldProvenanceSchema.optional(),
    time: FieldProvenanceSchema.optional(),
    container: FieldProvenanceSchema.optional(),
    cookingPhase: FieldProvenanceSchema.optional(),
    exclude: FieldProvenanceSchema.optional(),
  })
  .strict();

export const BuildRefSchema = z
  .object({
    itemId: NonEmptyString,
    version: z.union([z.number(), z.literal("latest_published")]).optional(),
    role: z.literal("prepared_component").optional(),
    notes: z.string().optional(),
  })
  .strict();

export const StepActionSchema = z
  .object({
    family: z.nativeEnum(ActionFamily),
    techniqueId: z.string().optional(),
    detailId: z.string().optional(),
    displayTextOverride: z.string().optional(),
  })
  .strict();

export const StepTargetSchema = z
  .object({
    type: z.union([
      z.literal("bom_usage"),
      z.literal("bom_component"),
      z.literal("packaging"),
      z.literal("free_text"),
      z.literal("unknown"),
    ]),
    bomUsageId: z.string().optional(),
    bomComponentId: z.string().optional(),
    name: z.string().optional(),
  })
  .strict();

export const StepEquipmentSchema = z
  .object({
    applianceId: z.union([
      z.literal("turbo"),
      z.literal("fryer"),
      z.literal("waterbath"),
      z.literal("toaster"),
      z.literal("salamander"),
      z.literal("clamshell_grill"),
      z.literal("press"),
      z.literal("induction"),
      z.literal("conveyor"),
      z.literal("hot_box"),
      z.literal("hot_well"),
      z.literal("other"),
    ]),
    presetId: z.string().optional(),
  })
  .strict();

export const StepTimeSchema = z
  .object({
    durationSeconds: z.number(),
    isActive: z.boolean(),
  })
  .strict();

export const StepContainerSchema = z
  .object({
    type: z
      .union([
        z.literal("bag"),
        z.literal("bowl"),
        z.literal("pan"),
        z.literal("tray"),
        z.literal("clamshell"),
        z.literal("ramekin"),
        z.literal("cup"),
        z.literal("foil"),
        z.literal("lid"),
        z.literal("lexan"),
        z.literal("deli_cup"),
        z.literal("hotel_pan"),
        z.literal("squeeze_bottle"),
        z.literal("other"),
      ])
      .optional(),
    name: z.string().optional(),
    size: z.string().optional(),
  })
  .strict();

export const StorageLocationSchema = z
  .object({
    type: z.union([
      z.literal("cold_storage"),
      z.literal("cold_rail"),
      z.literal("dry_rail"),
      z.literal("freezer"),
      z.literal("ambient"),
      z.literal("hot_hold_well"),
      z.literal("kit"),
      z.literal("other"),
    ]),
    detail: z.string().optional(),
  })
  .strict();

export const StepQuantitySchema = z
  .object({
    value: z.number(),
    unit: z.string(),
    kind: z.union([z.literal("absolute"), z.literal("multiplier")]).optional(),
  })
  .strict();

export const StepConditionSchema = z
  .object({
    requiresEquipmentProfileIds: z.array(z.string()).optional(),
    requiresCustomizationValueIds: z.array(z.string()).optional(),
    requiresRestaurantIds: z.array(z.string()).optional(),
  })
  .strict();

export const StepOverlaySchema = z
  .object({
    id: z.string(),
    predicate: z
      .object({
        equipmentProfileId: z.string().optional(),
        customizationValueIds: z.array(z.string()).optional(),
        minCustomizationCount: z.number().optional(),
      })
      .strict(),
    overrides: z
      .object({
        stationId: StationIdSchema,
        toolId: ToolIdSchema,
        equipment: StepEquipmentSchema,
        time: StepTimeSchema,
        cookingPhase: z.nativeEnum(CookingPhase),
        container: StepContainerSchema,
        notes: z.string(),
        exclude: z.boolean(),
        quantity: StepQuantitySchema,
      })
      .partial()
      .strict(),
    priority: z.number(),
  })
  .strict();

export const CustomizationGroupSchema = z
  .object({
    optionId: z.string(),
    type: z.union([
      z.literal("MANDATORY_CHOICE"),
      z.literal("OPTIONAL_ADDITION"),
      z.literal("OPTIONAL_SUBTRACTION"),
      z.literal("EXTRA_REQUESTS"),
      z.literal("DISH_PREFERENCE"),
      z.literal("ON_THE_SIDE"),
    ]),
    minChoices: z.number().optional(),
    maxChoices: z.number().optional(),
    valueIds: z.array(z.string()).optional(),
    displayName: z.string().optional(),
  })
  .strict();

export const ValidationOverrideSchema = z
  .object({
    id: z.string(),
    ruleId: z.string(),
    severity: z.union([
      z.literal("hard"),
      z.literal("strong"),
      z.literal("soft"),
    ]),
    stepId: z.string().optional(),
    fieldPath: z.string().optional(),
    reason: z.string(),
    createdAt: z.string(),
    createdByUserId: z.string().optional(),
    reviewedAt: z.string().optional(),
    reviewedByUserId: z.string().optional(),
    approved: z.boolean().optional(),
  })
  .strict();

export const ArtifactSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    type: z.union([
      z.literal("intermediate"),
      z.literal("final"),
      z.literal("packaging"),
      z.literal("free_text"),
      z.literal("bom_usage"),
      z.literal("bom_component"),
    ]).optional(),
    bomUsageId: z.string().optional(),
    bomComponentId: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const ArtifactSourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("in_build"),
      artifactId: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("external_build"),
      itemId: z.string(),
      version: z.union([z.number(), z.literal("latest_published")]).optional(),
      artifactId: z.string().optional(),
    })
    .strict(),
]);

export const ArtifactRefSchema = z
  .object({
    source: ArtifactSourceSchema,
    quantity: StepQuantitySchema.optional(),
    notes: z.string().optional(),
  })
  .strict();

export const StepSchema = z
  .object({
    id: NonEmptyString,
    orderIndex: z.number(),
    action: StepActionSchema,

    instruction: z.string().optional(),
    trackId: z.string().optional(),
    operationId: z.string().optional(),
    target: StepTargetSchema.optional(),
    stationId: StationIdSchema.optional(),
    toolId: ToolIdSchema.optional(),
    equipment: StepEquipmentSchema.optional(),
    time: StepTimeSchema.optional(),
    cookingPhase: z.nativeEnum(CookingPhase).optional(),
    container: StepContainerSchema.optional(),
    exclude: z.boolean().optional(),
    prepType: z.union([z.literal("pre_service"), z.literal("order_execution")]).optional(),
    storageLocation: StorageLocationSchema.optional(),
    bulkPrep: z.boolean().optional(),
    quantity: StepQuantitySchema.optional(),
    notes: z.string().optional(),
    provenance: StepProvenanceSchema.optional(),
    conditions: StepConditionSchema.optional(),
    overlays: z.array(StepOverlaySchema).optional(),
    dependsOn: z.array(z.string()).optional(),
    consumes: z.array(ArtifactRefSchema).optional(),
    produces: z.array(ArtifactRefSchema).optional(),
  })
  .strict();

export const BenchTopLineBuildSchema = z
  .object({
    id: NonEmptyString,
    itemId: NonEmptyString,
    version: z.number(),
    status: z.union([z.literal("draft"), z.literal("published"), z.literal("archived")]),
    steps: z.array(StepSchema),
    createdAt: z.string(),
    updatedAt: z.string(),

    menuItemId: z.string().optional(),
    operations: z.array(z.record(z.string(), z.unknown())).optional(),
    tracks: z.array(z.record(z.string(), z.unknown())).optional(),
    requiresBuilds: z.array(BuildRefSchema).optional(),
    artifacts: z.array(ArtifactSchema).optional(),
    primaryOutputArtifactId: z.string().optional(),
    customizationGroups: z.array(CustomizationGroupSchema).optional(),
    validationOverrides: z.array(ValidationOverrideSchema).optional(),
    authorId: z.string().optional(),
    changeLog: z.string().optional(),
  })
  .strict();

// -----------------------------
// parseBuild()
// -----------------------------

export type BuildParseIssue = {
  path: string;
  message: string;
  code: string;
};

export class BuildParseError extends Error {
  public readonly issues: BuildParseIssue[];

  constructor(issues: BuildParseIssue[]) {
    super("Build JSON failed schema validation");
    this.name = "BuildParseError";
    this.issues = issues;
  }
}

function formatZodPath(path: Array<string | number | symbol>): string {
  // Converts Zod paths like ["steps", 0, "action", "family"] into "steps[0].action.family"
  return path
    .map((p) => (typeof p === "number" ? `[${p}]` : String(p)))
    .reduce((acc, part) => {
      if (part.startsWith("[")) return `${acc}${part}`;
      if (acc === "") return part;
      return `${acc}.${part}`;
    }, "");
}

export function parseBuild(json: unknown): BenchTopLineBuild {
  const result = BenchTopLineBuildSchema.safeParse(json);
  if (result.success) return result.data;

  const issues: BuildParseIssue[] = result.error.issues.map((i) => ({
    path: formatZodPath(i.path),
    message: i.message,
    code: i.code,
  }));

  throw new BuildParseError(issues);
}

