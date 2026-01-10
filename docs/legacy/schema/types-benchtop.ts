/**
 * Core type definitions for Line Build MVP (Benchtop)
 * Shared across data layer, validation engines, and UI components
 *
 * Extracted from apps/line-build-mvp/src/lib/model/types.ts
 * Preserved for reference and future schema design
 */

// ============================================================================
// Work Unit Types
// ============================================================================

export type ActionType =
  | "PREP"
  | "HEAT"
  | "TRANSFER"
  | "ASSEMBLE"
  | "PORTION"
  | "PLATE"
  | "FINISH"
  | "QUALITY_CHECK";

export type Phase = "PRE_COOK" | "COOK" | "POST_COOK" | "ASSEMBLY" | "PASS";
export type TimingMode = "a_la_minute" | "sandbag" | "hot_hold";
export type PrepType = "pre_service" | "order_execution";

// ============================================================================
// Overlay & Variant Types (P1.6)
// ============================================================================

export interface EquipmentProfile {
  id: string;
  label: string; // e.g., "Waterbath Kitchen", "Turbo Kitchen"
  capabilities: string[]; // e.g., ["waterbath", "portion_scale"]
}

export interface CustomizationValue {
  optionId: string;
  valueId: string;
  label: string;
}

export interface WorkUnitOverlay {
  id: string;
  predicate: {
    equipmentProfileId?: string; // Match specific equipment profile
    customizationValueIds?: string[]; // All must be present
    minCustomizationCount?: number; // Minimum count of customizations
  };
  overrides: Partial<Pick<WorkUnit["tags"], "equipment" | "time" | "station">> & {
    notes?: string;
  };
  priority: number; // Lower priority applied first (allows higher priority to override)
}

export interface FieldProvenance {
  type: "inherited" | "manual" | "overlay" | "override";
  sourceId?: string; // e.g., equipment profile ID, overlay ID, or BOM ID
}

export interface ScenarioContext {
  equipmentProfileId: string;
  capabilities: string[];
  selectedCustomizationValueIds: string[];
  customizationCount: number;
}

export interface ResolvedWorkUnit extends WorkUnit {
  originalWorkUnitId: string;
  provenance: {
    equipment?: FieldProvenance;
    time?: FieldProvenance;
    station?: FieldProvenance;
    notes?: FieldProvenance;
  };
}

export interface ItemReference {
  bomId?: string;
  name: string;
}

export interface WorkUnit {
  id: string;
  tags: {
    action: ActionType;
    target: ItemReference;
    equipment?: string;
    time?: {
      value: number;
      unit: "sec" | "min";
      type: "active" | "passive";
    };
    phase?: Phase;
    station?: string;
    timingMode?: TimingMode;
    requiresOrder?: boolean;
    prepType?: PrepType;
    storageLocation?: string;
    bulkPrep?: boolean;
  };
  dependsOn: string[];
  overlays?: WorkUnitOverlay[]; // Conditional overrides for equipment/location variants
  metadata?: {
    legacySourceId?: string; // Link to original legacy procedure
    extractionConfidence?: "high" | "medium" | "low";
    extractionMethod?: "manual" | "ai" | "validated";
    requiresReview?: boolean;
  };
}

// ============================================================================
// Line Build Types
// ============================================================================

export interface ComplexityScore {
  overall: number; // 0-100 final score
  factors: {
    workVariety: number;
    equipmentVariety: number;
    stationChanges: number;
    timeBreakdown: number;
  };
  reasoning: string;
  timestamp: string; // ISO 8601
}

/**
 * Audit trail entry for tracking edits to a LineBuild
 * Distinguishes between direct human edits and agent-assisted changes
 */
export interface ChangelogEntry {
  id: string;
  timestamp: string; // ISO 8601
  userId: string; // Who triggered it (always a person)
  agentAssisted: boolean; // Was this done via agent/chat or direct human edit?
  action: string; // e.g., "added step", "edited step X", "deleted step"
  details?: string; // Optional context about what changed
}

export interface LineBuild {
  id: string;
  menuItemId: string;
  menuItemName: string;
  workUnits: WorkUnit[];
  complexity?: ComplexityScore; // Computed complexity score
  metadata: {
    author: string;
    version: number;
    status: "draft" | "active";
    sourceConversations?: string[]; // Chat history that contributed to this build
    changelog?: ChangelogEntry[]; // Audit trail of edits
  };
}

// ============================================================================
// Override Types
// ============================================================================

export interface Override {
  id: string;
  workUnitId: string;
  fieldPath: string; // e.g., "tags.time.value" or "tags.equipment"
  originalValue: unknown;
  overriddenValue: unknown;
  reason?: string;
  timestamp: string; // ISO 8601
}

// ============================================================================
// Validation Rule Types
// ============================================================================

export type ValidationRuleType = "structured" | "semantic";

export interface StructuredValidationRule {
  id: string;
  type: "structured";
  name: string;
  description?: string;
  enabled: boolean;
  // Rule logic is defined as a condition that can be evaluated
  // For MVP, simple field-based rules (e.g., "action must be in [PREP, HEAT, ...]")
  condition: {
    field: string; // path in WorkUnit, e.g., "tags.action"
    operator: "in" | "equals" | "notEmpty" | "greaterThan" | "lessThan";
    value: unknown;
  };
  failureMessage: string;
  appliesTo?: "all" | ActionType[]; // which action types this rule applies to
}

export interface SemanticValidationRule {
  id: string;
  type: "semantic";
  name: string;
  description?: string;
  enabled: boolean;
  // Semantic rules are evaluated by Gemini for reasoning-based validation
  prompt: string; // The prompt to send to Gemini for evaluation
  guidance?: string; // Optional guidance for the AI model
  appliesTo?: "all" | ActionType[]; // which action types this rule applies to
}

export type ValidationRule = StructuredValidationRule | SemanticValidationRule;

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  ruleId: string;
  ruleName: string;
  ruleType: ValidationRuleType;
  workUnitId: string;
  pass: boolean;
  failures: string[]; // Array of failure reasons
  reasoning?: string; // Explanation from Gemini (for semantic rules)
  timestamp: string; // ISO 8601
}

export interface ValidationResultSet {
  buildId: string;
  timestamp: string;
  results: ValidationResult[];
}

// ============================================================================
// Aggregated Validation Status
// ============================================================================

export interface BuildValidationStatus {
  buildId?: string; // Optional for standalone validation results
  isDraft?: boolean;
  hasStructuredFailures?: boolean;
  hasSemanticFailures?: boolean;
  failureCount?: number;
  lastChecked?: string; // ISO 8601
  results?: ValidationResult[]; // Original fields for backward compatibility

  // New fields from ValidationOrchestrator
  passCount?: number;
  failCount?: number;
  totalCount?: number;
  isValid?: boolean;
  allResults?: ValidationResult[];
  failuresByRule?: Record<string, ValidationResult[]>;
  lastCheckedAt?: string; // ISO 8601 - when validation was run
  durationMs?: number; // How long the validation took
  error?: string; // Error message if validation failed
}

// ============================================================================
// Migration Types (P1.8)
// ============================================================================

export interface ValidationIssue {
  type:
    | "missing_required_field"
    | "low_confidence_extraction"
    | "ambiguous_instruction"
    | "invalid_reference"
    | "schema_mismatch";
  field: string;
  message: string;
  severity: "error" | "warning";
  suggestedValue?: any;
}

export interface MigrationResult {
  legacyItemId: string;
  itemName: string;
  status: "success" | "review_needed" | "failed";
  workUnits: WorkUnit[];
  issues: ValidationIssue[];
  createdLineBuildId?: string;
  processedAt: string; // ISO 8601
}

export interface MigrationJob {
  id: string;
  legacyBuildCount: number;
  convertedCount: number;
  reviewQueueCount: number;
  failedCount: number;
  status: "pending" | "in_progress" | "complete" | "failed";
  startedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
  results: MigrationResult[];
  error?: string;
}

export interface ReviewQueueItem {
  id: string;
  migrationResult: MigrationResult;
  createdAt: string; // ISO 8601
  assignedTo?: string;
  status: "pending" | "approved" | "needs_revision" | "rejected";
  reviewNotes?: string;
  approvedAt?: string; // ISO 8601
}
