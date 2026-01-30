/**
 * Validation rules reference.
 * 
 * Source of truth: docs/spec/HARD-RULES.md
 */

export type RuleSeverity = "hard" | "strong" | "soft";

export type RuleInfo = {
  id: string;
  scope: "Build" | "Step";
  description: string;
  appliesTo?: string; // e.g., "HEAT steps", "pre_service steps"
  /** Default severity: H* = hard, S* = soft, C* = strong (composition) */
  severity?: RuleSeverity;
  /** True if rule is deprecated and no longer enforced */
  deprecated?: boolean;
  /** Deprecation reason */
  deprecatedReason?: string;
};

export const VALIDATION_RULES: RuleInfo[] = [
  {
    id: "H1",
    scope: "Step",
    description: "Every step has action.family (valid enum)",
  },
  {
    id: "H2",
    scope: "Build",
    description: "orderIndex is derived for UX; duplicates are OK unless custom ordering is needed",
  },
  {
    id: "H3",
    scope: "Step",
    description: "If time exists: durationSeconds > 0 and isActive is boolean",
  },
  {
    id: "H4",
    scope: "Step",
    description: "Containers are not targets (container concepts must not live in target.name)",
  },
  {
    id: "H5",
    scope: "Step",
    description: "notes is always allowed (escape hatch)",
  },
  {
    id: "H6",
    scope: "Build",
    description: "Published builds must have at least 1 step",
  },
  {
    id: "H7",
    scope: "Build",
    description: "step.id values are unique within a build",
  },
  {
    id: "H8",
    scope: "Build",
    description: "dependsOn references must exist",
  },
  {
    id: "H9",
    scope: "Build",
    description: "Dependencies must not create cycles (must be a DAG)",
  },
  {
    id: "H10",
    scope: "Step",
    description: "If quantity exists: quantity.value > 0",
  },
  {
    id: "H11",
    scope: "Step",
    description: "If overlay exists: overlay.priority is a number",
  },
  {
    id: "H12",
    scope: "Build",
    description: "customizationGroups[].optionId unique within build",
  },
  {
    id: "H13",
    scope: "Build",
    description: "If validation override exists: validationOverride.reason non-empty",
  },
  {
    id: "H14",
    scope: "Step",
    description: "Overlay predicates must not be empty (must specify at least 1 predicate)",
  },
  {
    id: "H15",
    scope: "Step",
    appliesTo: "HEAT steps",
    description: "HEAT step requires equipment",
  },
  {
    id: "H16",
    scope: "Step",
    appliesTo: "PACKAGING steps",
    description: "PACKAGING step requires container or packaging target",
  },
  {
    id: "H17",
    scope: "Step",
    appliesTo: "pre_service steps",
    description: "pre_service steps require to.sublocation (where the prepped item is stored)",
  },
  {
    id: "H18",
    scope: "Step",
    appliesTo: "bulkPrep steps",
    description: "bulkPrep=true requires prepType='pre_service'",
  },
  {
    id: "H19",
    scope: "Build",
    description: "Step conditions must reference valid customization valueIds",
  },
  {
    id: "H20",
    scope: "Build",
    description: "Overlay predicates must reference valid customization valueIds",
  },
  {
    id: "H21",
    scope: "Build",
    description: "MANDATORY_CHOICE groups must have minChoices and maxChoices",
  },
  {
    id: "H22",
    scope: "Step",
    appliesTo: "HEAT steps",
    description: "HEAT step requires time OR non-empty notes",
  },
  {
    id: "H23",
    scope: "Build",
    description: "BOM coverage required (POC-only, if BOM provided)",
  },
  {
    id: "H24",
    scope: "Step",
    appliesTo: "PORTION steps",
    description: "PORTION step requires quantity OR non-empty notes",
  },
  {
    id: "H25",
    scope: "Step",
    appliesTo: "PREP steps",
    description: "PREP step requires techniqueId OR non-empty notes",
  },
  {
    id: "H26",
    scope: "Build",
    description: "Graph must be connected: >75% of steps should have dependsOn (soft warning; entry points can be retrieval steps or first steps of parallel tracks)",
  },
  {
    id: "H27",
    scope: "Step",
    appliesTo: "TRANSFER/place steps",
    description: "TRANSFER/place requires `to`",
    deprecated: true,
    deprecatedReason: "TRANSFER steps are derived-only in this PoC (see H38).",
  },
  {
    id: "H28",
    scope: "Step",
    appliesTo: "TRANSFER/retrieve steps",
    description: "TRANSFER/retrieve requires `from`",
    deprecated: true,
    deprecatedReason: "TRANSFER steps are derived-only in this PoC (see H38).",
  },
  {
    id: "H29",
    scope: "Build",
    description: "Merge steps require input[].role and exactly one base input",
  },
  {
    id: "H30",
    scope: "Build",
    description: "1:1 transformations require assembly.lineage.evolvesFrom",
  },
  {
    id: "H31",
    scope: "Step",
    description: "Assembly refs should include location details (legacy rule; see H40/H42)",
    deprecated: true,
    deprecatedReason: "Replaced by H40 (sublocation required) + H42 (stationId only when ambiguous).",
  },
  {
    id: "C1",
    scope: "Build",
    description: "requiresBuilds must be unique and not self-referential",
  },
  {
    id: "C2",
    scope: "Build",
    description: "external_build input must be declared in requiresBuilds",
  },
  {
    id: "C3",
    scope: "Build",
    description: "in_build assembly refs must exist",
  },
  {
    id: "S6",
    scope: "Build",
    description: "primaryOutputAssemblyId should be set when assemblies present (warning)",
  },
  {
    id: "S7",
    scope: "Step",
    appliesTo: "HEAT steps",
    description: "HEAT technique should match equipment (warning)",
  },
  {
    id: "S8",
    scope: "Step",
    description: "Station change without explicit transfer modeling (warning)",
  },
  {
    id: "S9",
    scope: "Step",
    appliesTo: "HEAT steps",
    description: "HEAT sublocation should be equipment(...) and match equipment.applianceId (warning)",
    deprecated: true,
    deprecatedReason: "Superseded by H32 + H35; sublocation now derived automatically for HEAT actions",
  },
  {
    id: "S10",
    scope: "Step",
    appliesTo: "TRANSFER steps",
    description: "TRANSFER should specify techniqueId (place/retrieve/pass/handoff) or notes (warning)",
  },
  {
    id: "S11",
    scope: "Step",
    appliesTo: "TRANSFER place/retrieve steps",
    description: "TRANSFER place/retrieve should specify endpoint stationId/sublocation shape (warning)",
  },
  {
    id: "S12",
    scope: "Step",
    appliesTo: "published order_execution steps",
    description: "Published order_execution steps should set stationId (warning)",
  },
  {
    id: "S13",
    scope: "Step",
    appliesTo: "steps with stationId='pass'",
    description: "stationId='pass' is typically only used for TRANSFER steps (warning)",
  },
  {
    id: "S14",
    scope: "Step",
    description: "Technique suggests a different action family (warning)",
  },
  {
    id: "S15",
    scope: "Step",
    description: "Assembly refs with stationId should also specify sublocation for precise routing (soft warning)",
    deprecated: true,
    deprecatedReason: "Sublocation is now derived automatically from action family and equipment",
  },
  {
    id: "S16a",
    scope: "Build",
    description: "Grouping bouncing: build leaves a kitchen grouping (hot_side, cold_side, vending) and returns to it later (strong warning)",
  },
  {
    id: "S16b",
    scope: "Build",
    description: "Station bouncing: build leaves a station and returns to it later within the same grouping (soft warning)",
  },
  {
    id: "S20",
    scope: "Step",
    description: "Step has dependsOn but no input[] (work-only dependency; verify material flow)",
  },
  {
    id: "S21",
    scope: "Build",
    description: "Assembly IDs should be descriptive (avoid step-based names like step3_v1)",
  },
  {
    id: "S22",
    scope: "Build",
    description: "Material flow continuity: input location should align with producer output (warn on potential teleports)",
  },
  {
    id: "H32",
    scope: "Step",
    description: "Sublocation must be valid for the station (config-driven)",
  },
  {
    id: "H33",
    scope: "Step",
    description: "TechniqueId must be in controlled vocabulary and match action family",
  },
  {
    id: "H38",
    scope: "Step",
    description: "TRANSFER steps are derived-only (authored TRANSFER not allowed)",
  },
  {
    id: "H39",
    scope: "Step",
    description: "Step requires from/to locations (sublocation required; stationId only when ambiguous)",
  },
  {
    id: "H40",
    scope: "Step",
    description: "Assembly refs require locations (sublocation required; stationId only when ambiguous)",
  },
  {
    id: "H41",
    scope: "Step",
    description: "Steps require explicit material flow (output required)",
  },
  {
    id: "H42",
    scope: "Step",
    description: "StationId required when a location is ambiguous (sublocation/equipment appears in multiple stations)",
  },
  {
    id: "H43",
    scope: "Build",
    description: "Material flow continuity required for published builds (input location must match producer output)",
  },
  // ============================================
  // Derived field review warnings
  // ============================================
  {
    id: "S17",
    scope: "Step",
    description: "Derived sublocation flagged for review (provenance.sublocation.type='inferred')",
  },
  {
    id: "S18",
    scope: "Step",
    description: "Derived output destination flagged for review (provenance.to.type='inferred')",
  },
  {
    id: "S19",
    scope: "Step",
    description: "Derived sublocation may be incorrect for this action (soft warning)",
  },
  {
    id: "H35",
    scope: "Step",
    description: "Equipment must be available at station (config-driven)",
  },
  // ============================================
  // Station derivation rules
  // ============================================
  {
    id: "H36",
    scope: "Step",
    description: "Step requires stationId when step location is ambiguous (stationId can be derived when unique)",
  },
  {
    id: "H37",
    scope: "Step",
    appliesTo: "steps with shared equipment",
    description: "Shared equipment requires explicit stationId (equipment available at multiple stations)",
  },
  {
    id: "H44",
    scope: "Build",
    description: "Each assembly must have exactly one producing step (multiple producers create location ambiguity)",
  },
];

export function getRuleById(id: string): RuleInfo | undefined {
  return VALIDATION_RULES.find((r) => r.id === id);
}

export function getRulesByScope(scope: "Build" | "Step"): RuleInfo[] {
  return VALIDATION_RULES.filter((r) => r.scope === scope);
}

export function getRulesByActionFamily(family: string): RuleInfo[] {
  const familyRules: Record<string, string[]> = {
    HEAT: ["H15", "H22"],
    PACKAGING: ["H16"],
    PORTION: ["H24"],
    PREP: ["H25"],
  };
  const ruleIds = familyRules[family] ?? [];
  return VALIDATION_RULES.filter((r) => ruleIds.includes(r.id));
}

/**
 * Check if a rule is deprecated.
 */
export function isRuleDeprecated(id: string): boolean {
  const rule = getRuleById(id);
  return rule?.deprecated === true;
}

/**
 * Get all active (non-deprecated) rules.
 */
export function getActiveRules(): RuleInfo[] {
  return VALIDATION_RULES.filter((r) => !r.deprecated);
}

/**
 * Get the effective severity of a rule.
 * H* rules are hard, S* rules are soft, C* rules are strong by default.
 */
export function getRuleSeverity(rule: RuleInfo): RuleSeverity {
  if (rule.severity) return rule.severity;
  if (rule.id.startsWith("H")) return "hard";
  if (rule.id.startsWith("S")) return "soft";
  if (rule.id.startsWith("C")) return "strong";
  return "soft"; // Default fallback
}
