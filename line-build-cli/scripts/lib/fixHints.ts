 /**
  * Fix hints for validation rules.
  * Provides actionable guidance for resolving validation errors.
  */
 
 const FIX_HINTS: Record<string, string> = {
   // Core structural rules
   H1: "Set action.family to a valid enum (PREP, HEAT, TRANSFER, ASSEMBLE, PORTION, PACKAGING, etc.)",
  H2: "orderIndex is derived for UX; set unique values only if you want a specific display order",
   H3: "Set time.durationSeconds > 0 and time.isActive to boolean",
   H4: "Move container concepts out of target.name (containers are not targets)",
   H6: "Add at least 1 step before publishing",
   H7: "Ensure all step.id values are unique",
   H8: "Fix dependsOn references to point to existing step IDs",
   H9: "Remove circular dependencies to form a valid DAG",
   H10: "Set quantity.value > 0",
   H11: "Set overlay.priority to a number",
   H12: "Ensure customizationGroups[].optionId is unique",
   H13: "Add validationOverride.reason (non-empty string)",
   H14: "Add at least 1 predicate to overlay",
 
   // Action-specific rules
   H15: "Add equipment.applianceId to HEAT step",
   H16: "Add container or packaging target to PACKAGING step",
   H17: "Add to.sublocation for pre_service step (where prepped item is stored)",
   H18: "Set prepType='pre_service' when bulkPrep=true",
   H22: "Add time.durationSeconds or notes to HEAT step",
   H24: "Add quantity or notes to PORTION step",
   H25: "Add action.techniqueId or notes to PREP step",
 
   // Graph connectivity
   H26: "Add dependsOn to connect steps (>75% should have dependencies)",
 
  // Transfer rules
  H27: "Add 'to' field for TRANSFER/place step",
  H28: "Add 'from' field for TRANSFER/retrieve step",
  H38: "Remove authored TRANSFER steps; model movement via material flow and locations instead",
  H39: "REMOVED - step.from/to no longer exist; material flow is on assembly refs",
  H40: "Set input[].from and output[].to with sublocation for each assembly ref (stationId only when ambiguous)",
  H41: "Add at least one output assembly ref for the step",
  H42: "Set stationId on any from/to/input/output location that could map to multiple stations",
  H43: "Ensure input[].from matches the producer output location before publishing",
  S21: "Rename step-based assembly IDs to descriptive names (e.g., pizza_baked_v1)",
  S22: "Ensure input[].from aligns with the producer output location or explicitly model movement",
 
   // Assembly/merge rules
   H29: "Add input[].role with exactly one 'base' for merge steps (2+ inputs)",
   H30: "Add assembly.lineage.evolvesFrom for 1:1 transformations",
 
   // Station/config rules
   H32: "Use valid workLocation for this station (see config/stations.config.ts)",
   H33: "Use valid techniqueId from controlled vocabulary (see config/techniques.config.ts)",
  // H34 removed: transfers are derived-only
   H35: "Use equipment available at this station (see config/stations.config.ts)",
  H36: "Add stationId when step.workLocation is ambiguous (shared across stations)",
   H37: "Add explicit stationId (equipment is shared across multiple stations)",
 
   // Customization rules
   H19: "Fix step conditions to reference valid customization valueIds",
   H20: "Fix overlay predicates to reference valid customization valueIds",
   H21: "Add minChoices and maxChoices to MANDATORY_CHOICE groups",
 
   // Composition rules
   C1: "Ensure requiresBuilds entries are unique and not self-referential",
   C2: "Declare external_build input in requiresBuilds array",
   C3: "Ensure in_build assembly refs point to existing assemblies",
 };
 
 /**
  * Get a fix hint for a validation rule.
  * Returns null if no hint is available.
  */
 export function getFixHint(ruleId: string): string | null {
   return FIX_HINTS[ruleId] ?? null;
 }
 
 /**
  * Get all available fix hints.
  */
 export function getAllFixHints(): Record<string, string> {
   return { ...FIX_HINTS };
 }
