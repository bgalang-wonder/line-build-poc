import { z } from "zod";
import {
  ActionFamily,
  CookingPhase,
  type StepId,
  type GroupingId,
  type StationId,
  type ToolId,
  type ApplianceId,
  type SublocationId,
  type ContainerType,
  type PrepType,
  type StepQuantityKind,
  type ProvenanceType,
  type TechniqueId,
  NonEmptyString,
  GroupingIdSchema,
  StationIdSchema,
  ToolIdSchema,
  ApplianceIdSchema,
  SublocationIdSchema,
  ContainerTypeSchema,
  ProvenanceTypeSchema,
} from "./enums";
import {
  type AssemblyRef,
  AssemblyRefSchema,
} from "./assembly";

/**
 * Step-related types and Zod schemas.
 * A Step represents an individual action in the line build workflow.
 */

// -----------------------------
// Step Action
// -----------------------------

export interface StepAction {
  family: ActionFamily;
  techniqueId?: TechniqueId;
  detailId?: string;
  displayTextOverride?: string;
}

export const StepActionSchema = z
  .object({
    family: z.nativeEnum(ActionFamily),
    techniqueId: z.string().optional(),
    detailId: z.string().optional(),
    displayTextOverride: z.string().optional(),
  })
  .strict();

// -----------------------------
// Step Target
// -----------------------------

export interface StepTarget {
  type: "bom_usage" | "bom_component" | "packaging" | "free_text" | "unknown";
  bomUsageId?: string;
  bomComponentId?: string;
  name?: string;
}

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

// -----------------------------
// Step Equipment
// -----------------------------

export interface StepEquipment {
  applianceId: ApplianceId;
  presetId?: string;
}

export const StepEquipmentSchema = z
  .object({
    applianceId: ApplianceIdSchema,
    presetId: z.string().optional(),
  })
  .strict();

// -----------------------------
// Step Sublocation
// -----------------------------

export interface StepSublocation {
  type: SublocationId;
  equipmentId?: ApplianceId; // required when type === "equipment"
}

const StepSublocationSchema = z
  .object({
    type: SublocationIdSchema,
    equipmentId: ApplianceIdSchema.optional(),
  })
  .strict();

// -----------------------------
// Location Reference
// -----------------------------

export interface LocationRef {
  stationId?: StationId;
  sublocation?: StepSublocation;
}

export const LocationRefSchema = z
  .object({
    stationId: StationIdSchema.optional(),
    sublocation: StepSublocationSchema.optional(),
  })
  .strict();

// -----------------------------
// Step Time
// -----------------------------

export interface StepTime {
  durationSeconds: number;
  isActive: boolean;
}

export const StepTimeSchema = z
  .object({
    durationSeconds: z.number(),
    isActive: z.boolean(),
  })
  .strict();

// -----------------------------
// Step Container
// -----------------------------

export interface StepContainer {
  type?: ContainerType;
  name?: string;
  size?: string;
}

export const StepContainerSchema = z
  .object({
    type: ContainerTypeSchema.optional(),
    name: z.string().optional(),
    size: z.string().optional(),
  })
  .strict();

// -----------------------------
// Step Quantity
// -----------------------------

export interface StepQuantity {
  value: number;
  unit: string;
  kind?: StepQuantityKind;
}

export const StepQuantitySchema = z
  .object({
    value: z.number(),
    unit: z.string(),
    kind: z.union([z.literal("absolute"), z.literal("multiplier")]).optional(),
  })
  .strict();

// -----------------------------
// Field Provenance
// -----------------------------

export interface FieldProvenance {
  type: ProvenanceType;
  sourceId?: string;
  confidence?: "high" | "medium" | "low";
}

const FieldProvenanceSchema = z
  .object({
    type: ProvenanceTypeSchema,
    sourceId: z.string().optional(),
    confidence: z
      .union([z.literal("high"), z.literal("medium"), z.literal("low")])
      .optional(),
  })
  .strict();

export interface StepProvenance {
  target?: FieldProvenance;
  stationId?: FieldProvenance;
  toolId?: FieldProvenance;
  equipment?: FieldProvenance;
  time?: FieldProvenance;
  container?: FieldProvenance;
  cookingPhase?: FieldProvenance;
  exclude?: FieldProvenance;
  // Tier 2 derived fields (new)
  workLocation?: FieldProvenance;
  from?: FieldProvenance;
  to?: FieldProvenance;
}

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
    // Tier 2 derived fields
    workLocation: FieldProvenanceSchema.optional(),
    from: FieldProvenanceSchema.optional(),
    to: FieldProvenanceSchema.optional(),
  })
  .strict();

// -----------------------------
// Step Condition
// -----------------------------

export interface StepCondition {
  requiresEquipmentProfileIds?: string[];
  requiresCustomizationValueIds?: string[];
  requiresRestaurantIds?: string[];
}

export const StepConditionSchema = z
  .object({
    requiresEquipmentProfileIds: z.array(z.string()).optional(),
    requiresCustomizationValueIds: z.array(z.string()).optional(),
    requiresRestaurantIds: z.array(z.string()).optional(),
  })
  .strict();

// -----------------------------
// Step Overlay
// -----------------------------

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

// -----------------------------
// Conditional Dependencies
// -----------------------------

/**
 * Condition that must be met for a dependency to be required.
 * Used for optional tracks like customizations (e.g., sour cream on baked potato).
 */
export interface DependencyCondition {
  /**
   * Dependency is only required if ANY of these customization values are selected.
   * References CustomizationGroup.valueIds.
   */
  requiresCustomizationValueIds?: string[];
}

/**
 * A dependency reference that can be conditional.
 * Supports both simple string form (backwards compatible) and object form with conditions.
 */
export type DependencyRef =
  | StepId  // Simple form: just the step ID
  | {
      stepId: StepId;
      condition?: DependencyCondition;
    };

export const DependencyConditionSchema = z
  .object({
    requiresCustomizationValueIds: z.array(z.string()).optional(),
  })
  .strict();

export const DependencyRefSchema = z.union([
  z.string(), // Simple form: just the step ID
  z
    .object({
      stepId: z.string(),
      condition: DependencyConditionSchema.optional(),
    })
    .strict(),
]);

/**
 * Helper to extract the step ID from a DependencyRef.
 */
export function getDependencyStepId(ref: DependencyRef): StepId {
  return typeof ref === "string" ? ref : ref.stepId;
}

/**
 * Helper to check if a dependency is conditional.
 */
export function isConditionalDependency(ref: DependencyRef): boolean {
  return typeof ref !== "string" && ref.condition !== undefined;
}

// -----------------------------
// Step (Main Interface)
// -----------------------------

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
  groupingId?: GroupingId;
  stationId?: StationId;
  toolId?: ToolId;
  equipment?: StepEquipment;
  time?: StepTime;
  cookingPhase?: CookingPhase;
  container?: StepContainer;
  workLocation?: StepSublocation;
  /** @deprecated Legacy field - use workLocation instead */
  storageLocation?: { type: SublocationId };
  exclude?: boolean;
  prepType?: PrepType;
  bulkPrep?: boolean;
  quantity?: StepQuantity;
  notes?: string;
  provenance?: StepProvenance;
  conditions?: StepCondition;
  overlays?: StepOverlay[];
  dependsOn?: DependencyRef[];
  // Assembly/material flow
  input: AssemblyRef[];
  output: AssemblyRef[];

  // Location flow: REMOVED - material flow is described via assembly refs (input[].from, output[].to)
  // Steps only describe WHERE WORK HAPPENS via stationId + sublocation
}

export const StepSchema = z
  .object({
    id: NonEmptyString,
    orderIndex: z.number(),
    action: StepActionSchema,

    instruction: z.string().optional(),
    trackId: z.string().optional(),
    operationId: z.string().optional(),
    target: StepTargetSchema.optional(),
    groupingId: GroupingIdSchema.optional(),
    stationId: StationIdSchema.optional(),
    toolId: ToolIdSchema.optional(),
    equipment: StepEquipmentSchema.optional(),
    time: StepTimeSchema.optional(),
    cookingPhase: z.nativeEnum(CookingPhase).optional(),
    container: StepContainerSchema.optional(),
    workLocation: StepSublocationSchema.optional(),
    // Legacy field - storage location for retrieval steps
    storageLocation: z.object({ type: SublocationIdSchema }).optional(),
    // REMOVED: from/to fields - material flow is described via assembly refs only
    exclude: z.boolean().optional(),
    prepType: z.union([z.literal("pre_service"), z.literal("order_execution")]).optional(),
    bulkPrep: z.boolean().optional(),
    quantity: StepQuantitySchema.optional(),
    notes: z.string().optional(),
    provenance: StepProvenanceSchema.optional(),
    conditions: StepConditionSchema.optional(),
    overlays: z.array(StepOverlaySchema).optional(),
    dependsOn: z.array(DependencyRefSchema).optional(),
    // In the new model we want these present on every step. For backwards compatibility,
    // we default missing arrays to [].
    input: z.array(AssemblyRefSchema).default([]),
    output: z.array(AssemblyRefSchema).default([]),
  })
  .strict();
