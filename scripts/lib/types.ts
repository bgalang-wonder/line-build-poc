
export type BuildId = string;
export type MenuItemId = string;
export type StepId = string;
export type BuildStatus = "draft" | "published" | "archived";

export interface BenchTopLineBuild {
  id: BuildId;
  menuItemId: MenuItemId;
  version: number;
  status: BuildStatus;
  steps: Step[];
  operations?: Operation[];
  tracks?: TrackDefinition[];
  customizationGroups?: CustomizationGroup[];
  validationOverrides?: ValidationOverride[];
  createdAt: string;
  updatedAt: string;
  authorId?: string;
  changeLog?: string;
}

export type StepKind = "component" | "action" | "quality_check" | "meta";

export interface Step {
  id: StepId;
  orderIndex: number;
  trackId?: string;
  operationId?: string;
  kind: StepKind;
  action: StepAction;
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
}

export interface StepAction {
  family: ActionFamily;
  techniqueId?: TechniqueId;
  detailId?: string;
  displayTextOverride?: string;
}

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

export type TechniqueId =
  | "portion" | "weigh" | "open_pack" | "seal" | "label" | "wash"
  | "cut_diced" | "cut_sliced" | "cut_julienne" | "stir" | "fold"
  | "whisk" | "scoop" | "wipe" | "other";

export type StationId =
  | "hot_side" | "cold_side" | "prep" | "garnish" | "expo"
  | "vending" | "pass" | "other";

export type ToolId =
  | "hand" | "tongs" | "mini_tong" | "paddle" | "spatula" | "spoon"
  | "spoodle_1oz" | "spoodle_2oz" | "spoodle_3oz" | "fry_basket"
  | "squeeze_bottle" | "shaker" | "viper" | "scale" | "bench_scraper"
  | "utility_knife" | "whisk" | "ladle" | "other";

export interface StepTarget {
  type: TargetType;
  bomUsageId?: string;
  bomComponentId?: string;
  name?: string;
}

export type TargetType = "bom_usage" | "bom_component" | "packaging" | "free_text" | "unknown";

export interface StepEquipment {
  applianceId: ApplianceId;
  presetId?: string;
}

export type ApplianceId =
  | "turbo" | "fryer" | "waterbath" | "toaster" | "salamander"
  | "clamshell_grill" | "press" | "induction" | "conveyor"
  | "hot_box" | "hot_well" | "other";

export interface StepTime {
  durationSeconds: number;
  isActive: boolean;
}

export interface StepContainer {
  type?: ContainerType;
  name?: string;
  size?: string;
}

export type ContainerType =
  | "bag" | "bowl" | "pan" | "tray" | "clamshell" | "ramekin" | "cup"
  | "foil" | "lid" | "lexan" | "deli_cup" | "hotel_pan" | "squeeze_bottle" | "other";

export type PrepType = "pre_service" | "order_execution";

export interface StorageLocation {
  type: StorageLocationType;
  detail?: string;
}

export type StorageLocationType =
  | "cold_storage" | "cold_rail" | "dry_rail" | "freezer"
  | "ambient" | "hot_hold_well" | "kit" | "other";

export interface StepQuantity {
  value: number;
  unit: string;
  kind?: "absolute" | "multiplier";
}

export enum CookingPhase {
  PRE_COOK = "PRE_COOK",
  COOK = "COOK",
  POST_COOK = "POST_COOK",
  ASSEMBLY = "ASSEMBLY",
  PASS = "PASS",
}

// Extension Types
export interface Operation { id: string; name: string; }
export interface TrackDefinition { id: string; name: string; }
export interface CustomizationGroup {
  optionId: string;
  type: "MANDATORY_CHOICE" | "OPTIONAL_ADDITION" | "OPTIONAL_SUBTRACTION" | "EXTRA_REQUESTS" | "DISH_PREFERENCE" | "ON_THE_SIDE";
  minChoices?: number;
  maxChoices?: number;
  valueIds?: string[];
  displayName?: string;
}
export interface ValidationOverride {
  id: string;
  ruleId: string;
  severity: "hard" | "strong" | "soft";
  stepId?: string;
  fieldPath?: string;
  reason: string;
  createdAt: string;
  createdByUserId?: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  approved?: boolean;
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
  overrides: Partial<Step>;
  priority: number;
}
export interface StepProvenance {
  target?: FieldProvenance;
  // ... other fields as needed
}
export interface FieldProvenance {
  type: "manual" | "inherited" | "overlay" | "inferred" | "legacy_import";
  sourceId?: string;
  confidence?: "high" | "medium" | "low";
}
