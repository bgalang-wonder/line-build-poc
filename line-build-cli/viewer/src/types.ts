// Kitchen groupings - high-level area classification (3 values)
export type GroupingId = "hot_side" | "cold_side" | "vending";

// Stations - equipment and work areas
export type StationId =
  // Hot Side equipment
  | "fryer"
  | "waterbath"
  | "turbo"
  | "toaster"
  | "salamander"
  | "clamshell_grill"
  | "press"
  | "induction"
  | "conveyor"
  | "hot_box"
  | "hot_well"
  | "rice_cooker"
  | "pasta_cooker"
  | "pizza_oven"
  | "pizza_conveyor_oven"
  | "steam_well"
  | "sauce_warmer"
  // Cold Side work areas
  | "garnish"
  | "speed_line"
  | "expo"
  | "prep"
  | "pass"
  // Vending
  | "vending"
  // Backwards compatibility (legacy grouping values used as stationId)
  | "hot_side"
  | "cold_side"
  // Fallback
  | "other";

// Canonical mapping from station to grouping
export const STATION_TO_GROUPING: Record<StationId, GroupingId> = {
  // Hot Side equipment
  fryer: "hot_side",
  waterbath: "hot_side",
  turbo: "hot_side",
  toaster: "hot_side",
  salamander: "hot_side",
  clamshell_grill: "hot_side",
  press: "hot_side",
  induction: "hot_side",
  conveyor: "hot_side",
  hot_box: "hot_side",
  hot_well: "hot_side",
  rice_cooker: "hot_side",
  pasta_cooker: "hot_side",
  pizza_oven: "hot_side",
  pizza_conveyor_oven: "hot_side",
  steam_well: "hot_side",
  sauce_warmer: "hot_side",
  // Cold Side work areas
  garnish: "cold_side",
  speed_line: "cold_side",
  expo: "cold_side",
  prep: "cold_side",
  pass: "cold_side",
  // Vending
  vending: "vending",
  // Backwards compatibility (legacy grouping values used as stationId)
  hot_side: "hot_side",
  cold_side: "cold_side",
  // Fallback
  other: "cold_side",
};

// Helper to derive grouping from station
export function getGroupingForStation(stationId: StationId | string | undefined): GroupingId {
  if (!stationId) return "cold_side";
  return STATION_TO_GROUPING[stationId as StationId] ?? "cold_side";
}

export type BuildSummary = {
  buildId: string;
  itemId: string;
  name?: string;
  version: number;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  createdAt: string;
};

export type ValidationError = {
  severity: "hard" | "strong" | "soft";
  ruleId: string;
  message: string;
  stepId?: string;
  fieldPath?: string;
};

export type ValidationOutput = {
  buildId: string;
  itemId: string;
  timestamp: string;
  valid: boolean;
  hardErrors: ValidationError[];
  warnings: ValidationError[];
};

// Conditional dependency support
export type DependencyCondition = {
  requiresCustomizationValueIds?: string[];
};

export type DependencyRef =
  | string  // Simple form: just the step ID
  | {
      stepId: string;
      condition?: DependencyCondition;
    };

/**
 * Helper to extract the step ID from a DependencyRef.
 */
export function getDependencyStepId(ref: DependencyRef): string {
  return typeof ref === "string" ? ref : ref.stepId;
}

/**
 * Helper to check if a dependency is conditional.
 */
export function isConditionalDependency(ref: DependencyRef): boolean {
  return typeof ref !== "string" && ref.condition !== undefined;
}

// Provenance tracking for derived fields
export type FieldProvenance = {
  type: "manual" | "inherited" | "overlay" | "inferred" | "legacy_import";
  sourceId?: string;
  confidence?: "high" | "medium" | "low";
};

export type StepProvenance = {
  target?: FieldProvenance;
  stationId?: FieldProvenance;
  toolId?: FieldProvenance;
  equipment?: FieldProvenance;
  time?: FieldProvenance;
  container?: FieldProvenance;
  cookingPhase?: FieldProvenance;
  exclude?: FieldProvenance;
  sublocation?: FieldProvenance;
  from?: FieldProvenance;
  to?: FieldProvenance;
};

export type Step = {
  id: string;
  orderIndex: number;
  trackId?: string;
  action: {
    family: string;
    techniqueId?: string;
  };
  instruction?: string;
  notes?: string;
  target?: {
    type?: string;
    name?: string;
    bomUsageId?: string;
    bomComponentId?: string;
  };
  equipment?: {
    applianceId?: string;
    presetId?: string;
  };
  time?: {
    durationSeconds: number;
    isActive: boolean;
  };
  groupingId?: GroupingId;
  stationId?: StationId;
  toolId?: string;
  cookingPhase?: string;
  prepType?: string;
  container?: {
    type?: string;
    name?: string;
    size?: string;
  };
  storageLocation?: {
    type: string;
  };
  sublocation?: {
    type: string;
    equipmentId?: string;
  };
  from?: { stationId?: string; sublocation?: { type: string; equipmentId?: string } };
  to?: { stationId?: string; sublocation?: { type: string; equipmentId?: string } };
  quantity?: {
    value: number;
    unit: string;
    kind?: "absolute" | "multiplier";
  };
  dependsOn?: DependencyRef[];
  provenance?: StepProvenance;
  input?: Array<{
    source:
      | { type: "in_build"; assemblyId: string }
      | { type: "external_build"; itemId: string; version?: number | "latest_published"; assemblyId?: string };
    quantity?: { value: number; unit: string; kind?: "absolute" | "multiplier" };
    notes?: string;
    from?: { stationId?: string; sublocation?: { type: string; equipmentId?: string } };
    to?: { stationId?: string; sublocation?: { type: string; equipmentId?: string } };
    onAssembly?: string;
    role?: "base" | "added";
  }>;
  output?: Array<{
    source:
      | { type: "in_build"; assemblyId: string }
      | { type: "external_build"; itemId: string; version?: number | "latest_published"; assemblyId?: string };
    quantity?: { value: number; unit: string; kind?: "absolute" | "multiplier" };
    notes?: string;
    from?: { stationId?: string; sublocation?: { type: string; equipmentId?: string } };
    to?: { stationId?: string; sublocation?: { type: string; equipmentId?: string } };
    onAssembly?: string;
    role?: "base" | "added";
  }>;
};

export type BenchTopLineBuild = {
  id: string;
  itemId: string;
  name?: string;
  version: number;
  status: "draft" | "published" | "archived";
  steps: Step[];
  assemblies?: Array<{
    id: string;
    name?: string;
    type?: string;
    groupId?: string;
    subAssemblies?: string[];
    lineage?: { evolvesFrom?: string };
  }>;
  requiresBuilds?: Array<{
    itemId: string;
  }>;
  /** Derived transfer steps from assembly flow analysis */
  derivedTransfers?: DerivedTransferStep[];
  createdAt: string;
  updatedAt: string;
};

export type StationVisit = {
  id: string;
  trackId: string;
  stationId: string;
  visitNumber: number;
  globalVisitIndex: number;
  steps: Step[];
  stepRange: [number, number];
  stepIdRange: [string, string];
  primaryActions: string[];
};

export type TrackTimeline = {
  trackId: string;
  visits: StationVisit[];
  firstOrderIndex: number;
};

// Transfer types for derived transfer steps
export type TransferType = "intra_station" | "inter_station" | "inter_pod";

/**
 * A derived transfer step - generated from assembly flow, not authored.
 * Transfer steps are materialized when an assembly moves between producer/consumer steps.
 */
export type DerivedTransferStep = {
  /** Generated ID: transfer-{producerStepId}__{consumerStepId} */
  id: string;

  /** Action info - always TRANSFER */
  action: {
    family: "TRANSFER";
    techniqueId?: "place" | "retrieve" | "pass" | "handoff";
  };

  /** Type of transfer determines complexity scoring */
  transferType: TransferType;

  /** The assembly being moved */
  assemblyId: string;

  /** Where the component comes from (producer's output location) */
  from: {
    stationId?: string;
    sublocation?: { type: string; equipmentId?: string };
  };

  /** Where the component goes (consumer's input location) */
  to: {
    stationId?: string;
    sublocation?: { type: string; equipmentId?: string };
  };

  /** Complexity score from transfer config */
  complexityScore: number;

  /** Estimated time in seconds from transfer config */
  estimatedTimeSeconds: number;

  /** Always true for derived transfers */
  derived: true;

  /** Step that produced this assembly */
  producerStepId: string;

  /** Step that consumes this assembly */
  consumerStepId: string;

  /** Optional pod assignment (when HDR config is available) */
  fromPodId?: string;
  toPodId?: string;
};
