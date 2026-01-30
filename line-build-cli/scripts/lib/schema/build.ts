import { z } from "zod";
import {
  ActionFamily,
  type BuildId,
  type ItemId,
  type MenuItemId,
  type AssemblyId,
  type StepId,
  type StationId,
  type BuildStatus,
  type BuildRefRole,
  type BuildRefVersion,
  type ValidationSeverity,
  type CustomizationGroupType,
  type TransferType,
  NonEmptyString,
  TransferTypeSchema,
} from "./enums";
import { type Step, StepSchema, type LocationRef, LocationRefSchema } from "./step";
import { type Assembly, type BomEntry, AssemblySchema } from "./assembly";

/**
 * Build-level types and Zod schemas.
 * The BenchTopLineBuild is the top-level container for a line build.
 */

// -----------------------------
// Operation & Track (Permissive)
// -----------------------------

// Not defined in the embedded PoC schema_contract; keep permissive for Cycle 1.
export type Operation = Record<string, unknown>;
export type TrackDefinition = Record<string, unknown>;

// -----------------------------
// Build Reference
// -----------------------------

export interface BuildRef {
  itemId: ItemId;
  version?: BuildRefVersion;
  role?: BuildRefRole;
  notes?: string;
}

export const BuildRefSchema = z
  .object({
    itemId: NonEmptyString,
    version: z.union([z.number(), z.literal("latest_published")]).optional(),
    role: z.literal("prepared_component").optional(),
    notes: z.string().optional(),
  })
  .strict();

// -----------------------------
// Customization Group
// -----------------------------

export interface CustomizationGroup {
  optionId: string;
  type: CustomizationGroupType;
  minChoices?: number;
  maxChoices?: number;
  valueIds?: string[];
  displayName?: string;
}

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

// -----------------------------
// Validation Override
// -----------------------------

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

// -----------------------------
// Derived Transfer Step
// -----------------------------

/**
 * A derived transfer step - generated from assembly flow, not authored.
 *
 * Transfer steps are materialized during normalization when an assembly
 * moves from one location to another between producer and consumer steps.
 */
export interface DerivedTransferStep {
  /** Generated ID: transfer-{assemblyId}-{index} */
  id: string;

  /** Always TRANSFER for derived transfer steps */
  action: {
    family: typeof ActionFamily.TRANSFER;
    techniqueId?: "place" | "retrieve" | "pass" | "handoff";
  };

  /** Type of transfer determines complexity scoring */
  transferType: TransferType;

  /** The assembly being moved */
  assemblyId: AssemblyId;

  /** Where the assembly comes from (producer's output location) */
  from: LocationRef;

  /** Where the assembly goes (consumer's input location) */
  to: LocationRef;

  /** Complexity score from transfer config */
  complexityScore: number;

  /** Estimated time in seconds from transfer config */
  estimatedTimeSeconds: number;

  /** Always true for derived transfers */
  derived: true;

  /** Step that produced this assembly */
  producerStepId: StepId;

  /** Step that consumes this assembly */
  consumerStepId: StepId;

  /** Optional pod assignment (when HDR config is available) */
  fromPodId?: string;
  toPodId?: string;
}

// Derived transfer step schema (for normalized builds)
export const DerivedTransferStepSchema = z
  .object({
    id: z.string(),
    action: z
      .object({
        family: z.literal(ActionFamily.TRANSFER),
        techniqueId: z
          .union([
            z.literal("place"),
            z.literal("retrieve"),
            z.literal("pass"),
            z.literal("handoff"),
          ])
          .optional(),
      })
      .strict(),
    transferType: TransferTypeSchema,
    assemblyId: z.string(),
    from: LocationRefSchema,
    to: LocationRefSchema,
    complexityScore: z.number(),
    estimatedTimeSeconds: z.number(),
    derived: z.literal(true),
    producerStepId: z.string(),
    consumerStepId: z.string(),
    fromPodId: z.string().optional(),
    toPodId: z.string().optional(),
  })
  .strict();

// -----------------------------
// BenchTopLineBuild (Main Interface)
// -----------------------------

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
  name?: string;
  menuItemId?: MenuItemId;
  operations?: Operation[];
  tracks?: TrackDefinition[];
  requiresBuilds?: BuildRef[];
  // Bill of Materials: component list for this menu item.
  // Used for step.target mapping and component tagging.
  bom?: BomEntry[];
  assemblies?: Assembly[];
  primaryOutputAssemblyId?: string;
  customizationGroups?: CustomizationGroup[];
  validationOverrides?: ValidationOverride[];
  authorId?: string;
  changeLog?: string;

}

// Import BomEntrySchema from assembly (already defined there)
import { BomEntrySchema } from "./assembly";

export const BenchTopLineBuildSchema = z
  .object({
    id: NonEmptyString,
    itemId: NonEmptyString,
    version: z.number(),
    status: z.union([z.literal("draft"), z.literal("published"), z.literal("archived")]),
    steps: z.array(StepSchema),
    createdAt: z.string(),
    updatedAt: z.string(),

    name: z.string().optional(),
    menuItemId: z.string().optional(),
    operations: z.array(z.record(z.string(), z.unknown())).optional(),
    tracks: z.array(z.record(z.string(), z.unknown())).optional(),
    requiresBuilds: z.array(BuildRefSchema).optional(),
    bom: z.array(BomEntrySchema).default([]),
    assemblies: z.array(AssemblySchema).optional(),
    primaryOutputAssemblyId: z.string().optional(),
    customizationGroups: z.array(CustomizationGroupSchema).optional(),
    validationOverrides: z.array(ValidationOverrideSchema).optional(),
    authorId: z.string().optional(),
    changeLog: z.string().optional(),
  })
  .strict();
