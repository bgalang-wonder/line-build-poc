import { z } from "zod";
import {
  type AssemblyId,
  type ItemId,
  type BomUsageId,
  type BomComponentId,
  type BomEntryId,
  type AssemblyType,
  type AssemblyInputRole,
  type BuildRefVersion,
  type StationId,
  type SublocationId,
  type ApplianceId,
  type StepQuantityKind,
  StationIdSchema,
  SublocationIdSchema,
  ApplianceIdSchema,
} from "./enums";

/**
 * Assembly and material flow types and Zod schemas.
 * Assemblies represent materials that flow through steps in the build.
 */

// -----------------------------
// BOM Entry
// -----------------------------

export interface BomEntry {
  id: BomEntryId; // usage id within the build
  componentId?: BomComponentId; // catalog component id (if known)
  name: string;
  quantity?: {
    value: number;
    unit: string;
  };
  notes?: string;
}

const BomEntrySchema = z
  .object({
    id: z.string().min(1),
    componentId: z.string().optional(),
    name: z.string().min(1),
    quantity: z
      .object({
        value: z.number(),
        unit: z.string(),
      })
      .strict()
      .optional(),
    notes: z.string().optional(),
  })
  .strict();

export { BomEntrySchema };

// -----------------------------
// Assembly Lineage
// -----------------------------

export interface AssemblyLineage {
  evolvesFrom?: AssemblyId;
}

// -----------------------------
// Assembly
// -----------------------------

export interface Assembly {
  id: AssemblyId;
  name?: string;
  type?: AssemblyType;
  bomUsageId?: BomUsageId;
  bomComponentId?: BomComponentId;
  notes?: string;

  // Group versioned assemblies together (e.g., quesadilla_main_v1 and _v2 share groupId)
  groupId?: string;

  // For sub-assemblies, track what BOM entries are in this version
  subAssemblies?: BomEntryId[];

  // Lineage tracking for 1:1 evolution steps
  lineage?: AssemblyLineage;
}

export const AssemblySchema = z
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
    groupId: z.string().optional(),
    subAssemblies: z.array(z.string()).optional(),
    lineage: z
      .object({
        evolvesFrom: z.string().optional(),
      })
      .optional(),
  })
  .strict();

// -----------------------------
// Assembly Source
// -----------------------------

export type AssemblySource =
  | { type: "in_build"; assemblyId: AssemblyId }
  | {
      type: "external_build";
      itemId: ItemId;
      version?: BuildRefVersion;
      assemblyId?: AssemblyId;
    };

const InBuildSourceSchema = z
  .object({
    type: z.literal("in_build"),
    assemblyId: z.string(),
  })
  .strict();

const ExternalBuildSourceSchema = z
  .object({
    type: z.literal("external_build"),
    itemId: z.string(),
    version: z.union([z.number(), z.literal("latest_published")]).optional(),
    assemblyId: z.string().optional(),
  })
  .strict();

export const AssemblySourceSchema = z.discriminatedUnion("type", [
  InBuildSourceSchema,
  ExternalBuildSourceSchema,
]);

// -----------------------------
// Step Quantity (for AssemblyRef)
// -----------------------------

interface StepQuantity {
  value: number;
  unit: string;
  kind?: StepQuantityKind;
}

const StepQuantitySchema = z
  .object({
    value: z.number(),
    unit: z.string(),
    kind: z.union([z.literal("absolute"), z.literal("multiplier")]).optional(),
  })
  .strict();

// -----------------------------
// Location Reference (for AssemblyRef)
// -----------------------------

interface StepSublocation {
  type: SublocationId;
  equipmentId?: ApplianceId;
}

const StepSublocationSchema = z
  .object({
    type: SublocationIdSchema,
    equipmentId: ApplianceIdSchema.optional(),
  })
  .strict();

interface LocationRef {
  stationId?: StationId;
  sublocation?: StepSublocation;
}

const LocationRefSchema = z
  .object({
    stationId: StationIdSchema.optional(),
    sublocation: StepSublocationSchema.optional(),
  })
  .strict();

// -----------------------------
// Assembly Reference
// -----------------------------

export interface AssemblyRef {
  source: AssemblySource;
  quantity?: StepQuantity;
  notes?: string;

  // Precise location tracking for this assembly
  from?: LocationRef;
  to?: LocationRef;

  // Assembly-relative placement (e.g., place cheese ON the tortilla)
  onAssembly?: AssemblyId;

  // Input role for merge steps (base vs added)
  role?: AssemblyInputRole;
}

export const AssemblyRefSchema = z
  .object({
    source: AssemblySourceSchema,
    quantity: StepQuantitySchema.optional(),
    notes: z.string().optional(),
    from: LocationRefSchema.optional(),
    to: LocationRefSchema.optional(),
    onAssembly: z.string().optional(),
    role: z.union([z.literal("base"), z.literal("added")]).optional(),
  })
  .strict();
