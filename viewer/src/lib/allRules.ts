export type RuleDefinition = {
  id: string;
  scope: "Step" | "Build";
  description: string;
  appliesTo?: string;
};

export const ALL_RULES: RuleDefinition[] = [
  { id: "H1", scope: "Step", description: "Every step has action.family (valid enum)" },
  { id: "H2", scope: "Build", description: "orderIndex is present and unique within its ordering scope" },
  { id: "H3", scope: "Step", description: "If time exists: durationSeconds > 0 and isActive is boolean" },
  { id: "H4", scope: "Step", description: "Containers are not targets (container concepts must not live in target.name)" },
  { id: "H5", scope: "Step", description: "notes is always allowed (escape hatch)" },
  { id: "H6", scope: "Build", description: "Published builds must have at least 1 step" },
  { id: "H7", scope: "Build", description: "step.id values are unique within a build" },
  { id: "H8", scope: "Build", description: "dependsOn references must exist" },
  { id: "H9", scope: "Build", description: "Dependencies must not create cycles (must be a DAG)" },
  { id: "H10", scope: "Step", description: "If quantity exists: quantity.value > 0" },
  { id: "H11", scope: "Step", description: "If overlay exists: overlay.priority is a number" },
  { id: "H12", scope: "Build", description: "customizationGroups[].optionId unique within build" },
  { id: "H13", scope: "Build", description: "If validation override exists: validationOverride.reason non-empty" },
  { id: "H14", scope: "Step", description: "Overlay predicates must not be empty (must specify at least 1 predicate)" },
  { id: "H15", scope: "Step", description: "HEAT step requires equipment", appliesTo: "HEAT steps" },
  { id: "H16", scope: "Step", description: "PACKAGING step requires container or packaging target", appliesTo: "PACKAGING steps" },
  { id: "H17", scope: "Step", description: "pre_service steps require storageLocation", appliesTo: "pre_service steps" },
  { id: "H18", scope: "Step", description: "bulkPrep=true requires prepType='pre_service'", appliesTo: "bulkPrep steps" },
  { id: "H19", scope: "Build", description: "Step conditions must reference valid customization valueIds" },
  { id: "H20", scope: "Build", description: "Overlay predicates must reference valid customization valueIds" },
  { id: "H21", scope: "Build", description: "MANDATORY_CHOICE groups must have minChoices and maxChoices" },
  { id: "H22", scope: "Step", description: "HEAT step requires time OR non-empty notes", appliesTo: "HEAT steps" },
  { id: "H23", scope: "Build", description: "BOM coverage required (POC-only, if BOM provided)" },
  { id: "H24", scope: "Step", description: "PORTION step requires quantity OR non-empty notes", appliesTo: "PORTION steps" },
  { id: "H25", scope: "Step", description: "PREP step requires techniqueId OR non-empty notes", appliesTo: "PREP steps" },
  { id: "H26", scope: "Build", description: "Graph must be connected: >75% of steps should have dependsOn" },
  { id: "H27", scope: "Step", description: "TRANSFER/place requires `to`", appliesTo: "TRANSFER/place steps" },
  { id: "H28", scope: "Step", description: "TRANSFER/retrieve requires `from`", appliesTo: "TRANSFER/retrieve steps" },
  { id: "C1", scope: "Build", description: "requiresBuilds must be unique and not self-referential" },
  { id: "C2", scope: "Build", description: "external_build input must be declared in requiresBuilds" },
  { id: "C3", scope: "Build", description: "in_build artifact refs must exist" },
  { id: "S6", scope: "Build", description: "primaryOutputArtifactId should be set when artifacts present (warning)" },
  { id: "S7", scope: "Step", description: "HEAT technique should match equipment (warning)", appliesTo: "HEAT steps" },
  { id: "S8", scope: "Step", description: "Station change without explicit TRANSFER step (warning)" },
  { id: "S9", scope: "Step", description: "HEAT sublocation should be equipment(...) and match equipment.applianceId (warning)", appliesTo: "HEAT steps" },
  { id: "S10", scope: "Step", description: "TRANSFER should specify techniqueId or notes (warning)", appliesTo: "TRANSFER steps" },
  { id: "S11", scope: "Step", description: "TRANSFER place/retrieve should specify endpoint stationId/sublocation shape (warning)", appliesTo: "TRANSFER place/retrieve steps" },
  { id: "S12", scope: "Step", description: "Published order_execution steps should set stationId (warning)", appliesTo: "published order_execution steps" },
  { id: "S13", scope: "Step", description: "stationId='pass' is typically only used for TRANSFER steps (warning)", appliesTo: "steps with stationId='pass'" },
  { id: "S14", scope: "Step", description: "Technique suggests a different action family (warning)" }
];
