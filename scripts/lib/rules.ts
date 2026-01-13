/**
 * Validation rules reference.
 * 
 * Source of truth: docs/spec/HARD-RULES.md
 */

export type RuleInfo = {
  id: string;
  scope: "Build" | "Step";
  description: string;
  appliesTo?: string; // e.g., "HEAT steps", "pre_service steps"
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
    description: "orderIndex is present and unique within its ordering scope",
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
    appliesTo: "VEND steps",
    description: "VEND step requires container or packaging target",
  },
  {
    id: "H17",
    scope: "Step",
    appliesTo: "pre_service steps",
    description: "pre_service steps require storageLocation",
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
    description: "Graph must be connected: >75% of steps should have dependsOn (entry points are retrieval steps or first steps of parallel tracks)",
  },
  {
    id: "C1",
    scope: "Build",
    description: "requiresBuilds must be unique and not self-referential",
  },
  {
    id: "C2",
    scope: "Build",
    description: "external_build consumes must be declared in requiresBuilds",
  },
  {
    id: "C3",
    scope: "Build",
    description: "in_build artifact refs must exist",
  },
  {
    id: "S6",
    scope: "Build",
    description: "primaryOutputArtifactId should be set when artifacts present (warning)",
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
    VEND: ["H16"],
    PORTION: ["H24"],
    PREP: ["H25"],
  };
  const ruleIds = familyRules[family] ?? [];
  return VALIDATION_RULES.filter((r) => ruleIds.includes(r.id));
}
