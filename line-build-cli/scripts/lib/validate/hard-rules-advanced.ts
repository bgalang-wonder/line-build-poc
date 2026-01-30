import {
  ActionFamily,
  type BenchTopLineBuild,
  type Step,
  type LocationRef,
  getDependencyStepId,
} from "../schema";
import {
  isValidSublocationForStation,
  isKnownTechnique,
  getTechniqueActionFamily,
  isEquipmentAvailableAtStation,
  isSharedEquipment,
  canDeriveStationFromEquipment,
  STATIONS,
  STATION_BY_ID,
  type EquipmentId,
} from "../../../config";
import {
  type ValidationError,
  type ValidateBuildOptions,
  isNonEmptyNotes,
  getOrderedSteps,
  collectValidCustomizationValueIds,
} from "./helpers";

/**
 * Advanced hard validation rules (H19-H42).
 * Includes customization, transfer, station, and config-driven rules.
 */

// -----------------------------
// H19: Step Condition Customization Refs Valid
// -----------------------------

export function validateH19(build: BenchTopLineBuild): ValidationError[] {
  const validValueIds = collectValidCustomizationValueIds(build);
  const errors: ValidationError[] = [];
  for (const step of build.steps) {
    for (const v of step.conditions?.requiresCustomizationValueIds ?? []) {
      if (!validValueIds.has(v)) {
        errors.push({
          severity: "hard",
          ruleId: "H19",
          message: `H19: step ${step.id} references unknown customization valueId ${v}`,
          stepId: step.id,
          fieldPath: "conditions.requiresCustomizationValueIds",
        });
      }
    }
  }
  return errors;
}

// -----------------------------
// H20: Overlay Customization Refs Valid
// -----------------------------

export function validateH20(build: BenchTopLineBuild): ValidationError[] {
  const validValueIds = collectValidCustomizationValueIds(build);
  const errors: ValidationError[] = [];
  for (const step of build.steps) {
    for (const overlay of step.overlays ?? []) {
      for (const v of overlay.predicate?.customizationValueIds ?? []) {
        if (!validValueIds.has(v)) {
          errors.push({
            severity: "hard",
            ruleId: "H20",
            message: `H20: overlay ${overlay.id} references unknown customization valueId ${v}`,
            stepId: step.id,
            fieldPath: "overlays[].predicate.customizationValueIds",
          });
        }
      }
    }
  }
  return errors;
}

// -----------------------------
// H21: Mandatory Choice Requires Min/Max
// -----------------------------

export function validateH21(build: BenchTopLineBuild): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const g of build.customizationGroups ?? []) {
    if (g.type !== "MANDATORY_CHOICE") continue;
    if (g.minChoices == null || g.maxChoices == null) {
      errors.push({
        severity: "hard",
        ruleId: "H21",
        message: `H21: MANDATORY_CHOICE group ${g.optionId} requires minChoices and maxChoices`,
        fieldPath: "customizationGroups[].minChoices|maxChoices",
      });
    }
  }
  return errors;
}

// -----------------------------
// H22: HEAT Requires Time or Notes
// -----------------------------

export function validateH22(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.HEAT) return [];
  const hasTime = !!step.time;
  if (hasTime || isNonEmptyNotes(step)) return [];
  return [
    {
      severity: "hard",
      ruleId: "H22",
      message: "H22: HEAT step requires time or non-empty notes",
      stepId: step.id,
      fieldPath: "time|notes",
    },
  ];
}

// -----------------------------
// H23: BOM Coverage
// -----------------------------

export function validateH23(
  build: BenchTopLineBuild,
  bom: ValidateBuildOptions["bom"],
): ValidationError[] {
  if (!bom || bom.length === 0) return [];
  const referenced = new Set<string>();
  for (const step of build.steps) {
    const id = step.target?.bomComponentId;
    if (typeof id === "string" && id.trim().length > 0) referenced.add(id);
  }

  const uncovered = bom
    .filter((i) => i && typeof i.bomComponentId === "string" && i.bomComponentId.trim().length > 0)
    .filter((i) => {
      const t = (i.type ?? "").toLowerCase();
      const required = t === "consumable" || t === "packaged_good";
      return required && !referenced.has(i.bomComponentId);
    });

  if (uncovered.length === 0) return [];
  const label = uncovered
    .map((i) => i.name ?? i.bomComponentId)
    .slice(0, 10)
    .join(", ");
  return [
    {
      severity: "hard",
      ruleId: "H23",
      message: `H23: ${uncovered.length} BOM item(s) uncovered: ${label}`,
      fieldPath: "bom",
    },
  ];
}

// -----------------------------
// H24: PORTION Requires Quantity or Notes
// -----------------------------

export function validateH24(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.PORTION) return [];
  const hasQty = !!step.quantity;
  if (hasQty || isNonEmptyNotes(step)) return [];
  return [
    {
      severity: "hard",
      ruleId: "H24",
      message: "H24: PORTION step requires quantity or non-empty notes",
      stepId: step.id,
      fieldPath: "quantity|notes",
    },
  ];
}

// -----------------------------
// H25: PREP Requires TechniqueId or Notes
// -----------------------------

export function validateH25(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.PREP) return [];
  const hasTech = !!step.action?.techniqueId;
  if (hasTech || isNonEmptyNotes(step)) return [];
  return [
    {
      severity: "hard",
      ruleId: "H25",
      message: "H25: PREP step requires techniqueId or non-empty notes",
      stepId: step.id,
      fieldPath: "action.techniqueId|notes",
    },
  ];
}

// -----------------------------
// H27: TRANSFER/place Requires `to`
// -----------------------------

export function validateH27(step: Step): ValidationError[] {
  // REMOVED: step.to no longer exists
  // TRANSFER steps are derived-only (H38), so this validation is obsolete
  return [];
}

// -----------------------------
// H28: TRANSFER/retrieve Requires `from`
// -----------------------------

export function validateH28(step: Step): ValidationError[] {
  // REMOVED: step.from no longer exists
  // TRANSFER steps are derived-only (H38), so this validation is obsolete
  return [];
}

// -----------------------------
// H32: WorkLocation Valid for Station
// -----------------------------

export function validateH32StationSublocationCompatibility(step: Step): ValidationError[] {
  const stationId = step.stationId;
  const workLocationId = step.workLocation?.type;

  if (!stationId || !workLocationId) return [];

  if (!isValidSublocationForStation(stationId, workLocationId)) {
    return [
      {
        severity: "hard",
        ruleId: "H32",
        message: `H32: workLocation '${workLocationId}' is not valid for station '${stationId}'`,
        stepId: step.id,
        fieldPath: "workLocation.type",
      },
    ];
  }
  return [];
}

// -----------------------------
// H33: Technique Vocabulary Valid
// -----------------------------

export function validateH33TechniqueVocabulary(step: Step): ValidationError[] {
  const techniqueId = step.action?.techniqueId;
  if (!techniqueId) return [];

  const errors: ValidationError[] = [];

  // Check if technique is known
  if (!isKnownTechnique(techniqueId)) {
    errors.push({
      severity: "hard",
      ruleId: "H33",
      message: `H33: techniqueId '${techniqueId}' is not in the controlled vocabulary`,
      stepId: step.id,
      fieldPath: "action.techniqueId",
    });
    return errors;
  }

  // Check if technique matches the action family
  const expectedFamily = getTechniqueActionFamily(techniqueId);
  const actualFamily = step.action.family;
  if (expectedFamily && expectedFamily !== actualFamily) {
    errors.push({
      severity: "hard",
      ruleId: "H33",
      message: `H33: techniqueId '${techniqueId}' belongs to ${expectedFamily}, not ${actualFamily}`,
      stepId: step.id,
      fieldPath: "action.techniqueId",
    });
  }

  return errors;
}

// -----------------------------
// H34: Inter-Station Transitions Require TRANSFER
// -----------------------------

export function validateH34InterStationTransfer(build: BenchTopLineBuild): ValidationError[] {
  const errors: ValidationError[] = [];
  const stepMap = new Map(build.steps.map((s) => [s.id, s] as const));
  const orderedSteps = getOrderedSteps(build);

  for (const step of orderedSteps) {
    // Skip if this step has no dependencies
    if (!step.dependsOn || step.dependsOn.length === 0) continue;

    // Skip if this step doesn't have a stationId (can't check inter-station)
    const stepStationId = step.stationId;
    if (!stepStationId) continue;

    // Check each dependency
    for (const depRef of step.dependsOn) {
      const depId = getDependencyStepId(depRef);
      const depStep = stepMap.get(depId);
      if (!depStep) continue; // H8 handles missing refs

      // Get the station where the dependency outputs components
      // Check all outputs from the dependency step
      const depOutputs = depStep.output ?? [];
      if (depOutputs.length === 0) continue;

      // For each output from the dependency, check if it flows to a different station
      for (const output of depOutputs) {
        const outputStationId = output.to?.stationId;
        if (!outputStationId) continue; // H31 handles missing location refs

        // If the dependency outputs to a different station than where this step happens,
        // then this step must be a TRANSFER step
        if (outputStationId !== stepStationId) {
          // Check if this step is a TRANSFER step
          if (step.action?.family !== ActionFamily.TRANSFER) {
            errors.push({
              severity: "hard",
              ruleId: "H34",
              message: `H34: Step ${step.id} depends on step ${depId} which outputs to station '${outputStationId}', but step ${step.id} happens at station '${stepStationId}'. Inter-station transitions require a TRANSFER step.`,
              stepId: step.id,
              fieldPath: "action.family",
            });
            // Only report once per step (don't duplicate for multiple outputs)
            break;
          }
        }
      }
    }
  }

  return errors;
}

// -----------------------------
// H35: Equipment Available at Station
// -----------------------------

export function validateH35EquipmentAtStation(step: Step): ValidationError[] {
  const stationId = step.stationId;
  const equipmentId = step.equipment?.applianceId;

  if (!stationId || !equipmentId) return [];

  if (!isEquipmentAvailableAtStation(stationId, equipmentId as EquipmentId)) {
    return [
      {
        severity: "hard",
        ruleId: "H35",
        message: `H35: equipment '${equipmentId}' is not available at station '${stationId}'`,
        stepId: step.id,
        fieldPath: "equipment.applianceId",
      },
    ];
  }
  return [];
}

// -----------------------------
// H36: StationId Required When Step Location Is Ambiguous
// -----------------------------

export function validateH36StationOrUniqueEquipment(step: Step): ValidationError[] {
  const stationId = step.stationId;
  const equipmentId = step.equipment?.applianceId;
  const workLocation = step.workLocation;
  const groupingId = step.groupingId;

  // If stationId is already set, no problem
  if (stationId) return [];

  // If equipment is set and unique, stationId can be derived - no error
  if (equipmentId && canDeriveStationFromEquipment(equipmentId)) {
    return [];
  }

  // Only enforce when step has an explicit workLocation
  if (!workLocation?.type) return [];

  const candidates = filterCandidatesByGrouping(
    workLocation.type === "equipment" && workLocation.equipmentId
      ? stationsForEquipment(workLocation.equipmentId)
      : stationsForSublocation(workLocation.type),
    groupingId,
  );

  if (candidates.length === 1) return [];

  if (candidates.length > 1) {
    return [
      {
        severity: "hard",
        ruleId: "H36",
        message: `H36: step.workLocation requires stationId to disambiguate (${candidates.join(", ")})`,
        stepId: step.id,
        fieldPath: "stationId",
      },
    ];
  }

  return [];
}

// -----------------------------
// H37: Shared Equipment Requires Station
// -----------------------------

export function validateH37SharedEquipmentRequiresStation(step: Step): ValidationError[] {
  const stationId = step.stationId;
  const equipmentId = step.equipment?.applianceId;

  // If stationId is set, no problem
  if (stationId) return [];

  // If no equipment, H36 handles it
  if (!equipmentId) return [];

  // If equipment is shared (at multiple stations), require explicit stationId
  if (isSharedEquipment(equipmentId)) {
    return [
      {
        severity: "hard",
        ruleId: "H37",
        message: `H37: Equipment '${equipmentId}' is available at multiple stations - stationId required`,
        stepId: step.id,
        fieldPath: "stationId",
      },
    ];
  }

  return [];
}

// -----------------------------
// H38: TRANSFER Steps Are Derived-Only
// -----------------------------

export function validateH38NoAuthoredTransfer(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.TRANSFER) return [];
  return [
    {
      severity: "hard",
      ruleId: "H38",
      message:
        "H38: TRANSFER steps are derived-only. Remove authored TRANSFER and model movement via input/output + locations.",
      stepId: step.id,
      fieldPath: "action.family",
    },
  ];
}

function hasSublocation(loc: LocationRef | undefined): boolean {
  return Boolean(loc?.sublocation?.type);
}

function isValidEquipmentSublocation(loc: LocationRef | undefined): boolean {
  if (loc?.sublocation?.type !== "equipment") return true;
  return Boolean(loc.sublocation.equipmentId);
}

function stationsForSublocation(sublocationId: string): string[] {
  return STATIONS.filter((s) => s.sublocations.includes(sublocationId as any)).map((s) => s.id);
}

function stationsForEquipment(equipmentId: string): string[] {
  return STATIONS.filter((s) =>
    (s.equipmentAvailable ?? []).includes(equipmentId as any)
  ).map((s) => s.id);
}

function filterCandidatesByGrouping(candidates: string[], groupingId: Step["groupingId"]): string[] {
  if (!groupingId) return candidates;
  const filtered = candidates.filter((id) => STATION_BY_ID[id]?.side === groupingId);
  return filtered.length > 0 ? filtered : candidates;
}

function getLocationStationCandidates(
  loc: LocationRef | undefined,
  groupingId: Step["groupingId"],
): string[] {
  if (!loc?.sublocation?.type) return [];
  if (loc.sublocation.type === "equipment") {
    const equipmentId = loc.sublocation.equipmentId;
    if (!equipmentId) return [];
    return filterCandidatesByGrouping(stationsForEquipment(equipmentId), groupingId);
  }
  return filterCandidatesByGrouping(stationsForSublocation(loc.sublocation.type), groupingId);
}

// -----------------------------
// H39: REMOVED - Step-Level Locations No Longer Exist
// -----------------------------
// Material flow is described via assembly refs (input[].from, output[].to) only.
// Steps describe work location via stationId + sublocation.
// The step.from and step.to fields have been removed from the schema entirely.

// -----------------------------
// H40: Assembly Refs Require Locations
// -----------------------------

export function validateH40AssemblyRefLocations(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < (step.input ?? []).length; i++) {
    const inp = step.input[i]!;
    if (!hasSublocation(inp.from)) {
      errors.push({
        severity: "hard",
        ruleId: "H40",
        message: `H40: input[${i}] requires from.sublocation.type`,
        stepId: step.id,
        fieldPath: `input[${i}].from`,
      });
    } else if (!isValidEquipmentSublocation(inp.from)) {
      errors.push({
        severity: "hard",
        ruleId: "H40",
        message: `H40: input[${i}].from.sublocation.type='equipment' requires equipmentId`,
        stepId: step.id,
        fieldPath: `input[${i}].from.sublocation.equipmentId`,
      });
    }
  }

  for (let i = 0; i < (step.output ?? []).length; i++) {
    const out = step.output[i]!;
    if (!hasSublocation(out.to)) {
      errors.push({
        severity: "hard",
        ruleId: "H40",
        message: `H40: output[${i}] requires to.sublocation.type`,
        stepId: step.id,
        fieldPath: `output[${i}].to`,
      });
    } else if (!isValidEquipmentSublocation(out.to)) {
      errors.push({
        severity: "hard",
        ruleId: "H40",
        message: `H40: output[${i}].to.sublocation.type='equipment' requires equipmentId`,
        stepId: step.id,
        fieldPath: `output[${i}].to.sublocation.equipmentId`,
      });
    }
  }

  return errors;
}

// -----------------------------
// H41: Material Flow Required (input/output)
// -----------------------------

export function validateH41MaterialFlow(step: Step): ValidationError[] {
  if (step.exclude) return [];
  const errors: ValidationError[] = [];

  const outputs = step.output ?? [];
  if (outputs.length === 0) {
    errors.push({
      severity: "hard",
      ruleId: "H41",
      message: "H41: step requires at least 1 output assembly ref",
      stepId: step.id,
      fieldPath: "output",
    });
  }

  return errors;
}

// -----------------------------
// H42: StationId Required When Ambiguous
// -----------------------------

export function validateH42AmbiguousStation(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];
  const groupingId = step.groupingId;
  const fallbackStationId = step.stationId;

  const checkLocation = (
    loc: LocationRef | undefined,
    fieldPath: string,
    messagePrefix: string,
  ) => {
    if (!loc?.sublocation?.type) return;
    if (loc.stationId || fallbackStationId) return;
    const candidates = getLocationStationCandidates(loc, groupingId);
    if (candidates.length <= 1) return;
    errors.push({
      severity: "hard",
      ruleId: "H42",
      message: `${messagePrefix} requires stationId to disambiguate (${candidates.join(", ")})`,
      stepId: step.id,
      fieldPath,
    });
  };

  // REMOVED: step.from and step.to no longer exist
  // checkLocation(step.from, "from.stationId", "H42: step.from");
  // checkLocation(step.to, "to.stationId", "H42: step.to");

  for (let i = 0; i < (step.input ?? []).length; i++) {
    checkLocation(step.input[i]?.from, `input[${i}].from.stationId`, `H42: input[${i}]`);
  }
  for (let i = 0; i < (step.output ?? []).length; i++) {
    checkLocation(step.output[i]?.to, `output[${i}].to.stationId`, `H42: output[${i}]`);
  }

  return errors;
}

// -----------------------------
// H43: Material Flow Continuity (Published Builds)
// -----------------------------

function locationsMatchForContinuity(from: LocationRef | undefined, to: LocationRef | undefined): boolean {
  if (!from || !to) return false;
  if (from.sublocation?.type !== to.sublocation?.type) return false;
  if (from.sublocation?.type === "equipment" || to.sublocation?.type === "equipment") {
    return from.sublocation?.equipmentId === to.sublocation?.equipmentId;
  }
  if (from.stationId && to.stationId && from.stationId !== to.stationId) return false;
  return true;
}

export function validateH43MaterialFlowContinuity(build: BenchTopLineBuild): ValidationError[] {
  if (build.status !== "published") return [];
  const errors: ValidationError[] = [];

  const outputsByAssembly = new Map<string, Array<{ stepId: string; to?: LocationRef }>>();
  for (const step of getOrderedSteps(build)) {
    for (const out of step.output ?? []) {
      if (out.source.type !== "in_build") continue;
      const list = outputsByAssembly.get(out.source.assemblyId) ?? [];
      list.push({ stepId: step.id, to: out.to });
      outputsByAssembly.set(out.source.assemblyId, list);
    }
  }

  for (const step of getOrderedSteps(build)) {
    const inputs = step.input ?? [];
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i]!;
      if (inp.source.type !== "in_build") continue;
      const producers = outputsByAssembly.get(inp.source.assemblyId) ?? [];

      if (producers.length === 0) {
        errors.push({
          severity: "hard",
          ruleId: "H43",
          message: `H43: input assembly '${inp.source.assemblyId}' has no producing step`,
          stepId: step.id,
          fieldPath: `input[${i}].source`,
        });
        continue;
      }

      if (producers.length > 1) {
        errors.push({
          severity: "hard",
          ruleId: "H43",
          message: `H43: input assembly '${inp.source.assemblyId}' has multiple producers (${producers.map((p) => p.stepId).join(", ")})`,
          stepId: step.id,
          fieldPath: `input[${i}].source`,
        });
        continue;
      }

      const producer = producers[0];
      const from = inp.from;
      const to = producer?.to;
      if (!from || !to) continue;
      if (!locationsMatchForContinuity(from, to)) {
        errors.push({
          severity: "hard",
          ruleId: "H43",
          message: `H43: input assembly '${inp.source.assemblyId}' location does not match producer output (producer: ${producer.stepId})`,
          stepId: step.id,
          fieldPath: `input[${i}].from`,
        });
      }
    }
  }

  return errors;
}

// -----------------------------
// H44: Single Producer Per Assembly
// -----------------------------

/**
 * H44: Each assembly must have exactly one producing step.
 * Multiple producers create location ambiguity and make the material flow graph invalid.
 * This applies to all builds (draft or published).
 */
export function validateH44SingleProducer(build: BenchTopLineBuild): ValidationError[] {
  const outputsByAssembly = new Map<string, string[]>();

  for (const step of getOrderedSteps(build)) {
    if (step.exclude) continue;
    for (const out of step.output ?? []) {
      if (out.source.type !== "in_build") continue;
      const list = outputsByAssembly.get(out.source.assemblyId) ?? [];
      list.push(step.id);
      outputsByAssembly.set(out.source.assemblyId, list);
    }
  }

  const errors: ValidationError[] = [];
  for (const [assemblyId, producers] of outputsByAssembly) {
    if (producers.length > 1) {
      errors.push({
        severity: "hard",
        ruleId: "H44",
        message: `H44: assembly '${assemblyId}' has multiple producers (${producers.join(", ")}). Each step should output a unique assembly version.`,
        fieldPath: `assemblies`,
      });
    }
  }
  return errors;
}

// -----------------------------
// H46: Step WorkLocation Required
// -----------------------------

/**
 * H46: Every step must have step.workLocation set.
 * This field indicates where the step's action physically happens.
 */
export function validateH46StepWorkLocation(step: Step): ValidationError[] {
  if (step.exclude) return [];

  if (!step.workLocation?.type) {
    return [
      {
        severity: "hard",
        ruleId: "H46",
        message: "H46: step.workLocation.type is required",
        stepId: step.id,
        fieldPath: "workLocation",
      },
    ];
  }

  // If workLocation type is "equipment", equipmentId is required
  if (step.workLocation.type === "equipment" && !step.workLocation.equipmentId) {
    return [
      {
        severity: "hard",
        ruleId: "H46",
        message: "H46: step.workLocation.type='equipment' requires equipmentId",
        stepId: step.id,
        fieldPath: "workLocation.equipmentId",
      },
    ];
  }

  return [];
}
