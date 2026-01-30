/**
 * Tier 2 derivation functions.
 *
 * These functions derive Tier 2 fields (sublocation, output destination, input source)
 * from Tier 1 inputs (station, technique, equipment) + codified rules.
 *
 * Design principle: Minimize agent decision-making by encoding kitchen workflow patterns.
 */

import type {
  Step,
  StepSublocation,
  LocationRef,
  BenchTopLineBuild,
  ActionFamily,
  StationId,
  ApplianceId,
  SublocationId,
} from "./schema";
import {
  STATION_BY_ID,
  getDefaultSublocation,
  isValidSublocationForStation,
  type SublocationId as ConfigSublocationId,
  type EquipmentId,
} from "../../config/stations.config";
import {
  ACTION_SUBLOCATION_RULES,
  OUTPUT_DESTINATION_RULES,
  isStorageRetrievalTechnique,
  actionRequiresEquipment,
} from "../../config/derivation.config";

// ============================================
// Derived value wrapper types
// ============================================

/**
 * A value that may be explicitly set or derived.
 * When derived=true, the system inferred this value from rules.
 */
export interface DerivedValue<T> {
  value: T;
  derived: boolean;
}

/**
 * Wrap an existing value (not derived).
 */
export function explicit<T>(value: T): DerivedValue<T> {
  return { value, derived: false };
}

/**
 * Wrap a derived value.
 */
export function derived<T>(value: T): DerivedValue<T> {
  return { value, derived: true };
}

// ============================================
// Sublocation derivation
// ============================================

/**
 * Derive the workLocation for a step based on action family, equipment, and station.
 *
 * Logic:
 * 1. If step has explicit workLocation, use it (not derived)
 * 2. If HEAT action with equipment, workLocation is "equipment"
 * 3. If PREP action with retrieval technique, derive from storage pattern
 * 4. Otherwise use action family default
 */
export function deriveStepWorkLocation(
  step: Step
): DerivedValue<StepSublocation> | null {
  // If already has workLocation, return as explicit
  if (step.workLocation) {
    return explicit(step.workLocation);
  }

  const family = step.action.family;
  const rules = ACTION_SUBLOCATION_RULES[family];
  const stationId = step.stationId;

  // HEAT actions: sublocation is equipment
  if (rules.requiresEquipment && step.equipment) {
    const sublocation: StepSublocation = {
      type: "equipment",
      equipmentId: step.equipment.applianceId,
    };
    return derived(sublocation);
  }

  // PREP with retrieval technique: infer storage sublocation
  if (isStorageRetrievalTechnique(step.action.techniqueId)) {
    // REMOVED: step.from no longer exists
    // Default to cold_storage for retrieval
    const sublocation: StepSublocation = { type: "cold_storage" };
    // Validate it's allowed at this station
    if (stationId && !isValidSublocationForStation(stationId, "cold_storage")) {
      // Fall back to work_surface
      return derived({ type: "work_surface" as SublocationId });
    }
    return derived(sublocation);
  }

  // Default based on action family
  let defaultType = rules.default as SublocationId;

  // Validate the default is allowed at this station
  if (stationId && !isValidSublocationForStation(stationId, defaultType)) {
    defaultType = getDefaultSublocation(stationId) as SublocationId;
  }

  return derived({ type: defaultType });
}

// ============================================
// Output destination derivation
// ============================================

/**
 * Derive where the output goes after this step.
 *
 * Logic:
 * 1. If next step is at same station: output stays where it is
 * 2. If next step is at different station: output goes to work_surface (handoff point)
 * 3. If HEAT action: output stays at equipment until transfer
 * 4. If final step: output goes to expo
 */
export function deriveOutputAssemblyLocations(
  step: Step,
  nextStep: Step | null,
  _build?: BenchTopLineBuild
): DerivedValue<LocationRef> | null {
  // This function derives locations for OUTPUT ASSEMBLIES (output[].to),
  // not for step.to. Steps describe work location via stationId + sublocation.

  const currentStation = step.stationId;
  const family = step.action.family;

  // Final step: goes to expo
  if (!nextStep) {
    return derived({
      stationId: "expo" as StationId,
      sublocation: { type: "window_shelf" as SublocationId },
    });
  }

  const nextStation = nextStep.stationId;

  // Same station: stay at current sublocation
  if (currentStation && nextStation && currentStation === nextStation) {
    // HEAT action: stays at equipment
    if (actionRequiresEquipment(family) && step.equipment) {
      return derived({
        stationId: currentStation,
        sublocation: {
          type: "equipment" as SublocationId,
          equipmentId: step.equipment.applianceId,
        },
      });
    }
    // Otherwise work_surface
    return derived({
      stationId: currentStation,
      sublocation: { type: "work_surface" as SublocationId },
    });
  }

  // Cross-station: handoff at work_surface
  if (currentStation) {
    return derived({
      stationId: currentStation,
      sublocation: { type: "work_surface" as SublocationId },
    });
  }

  // No station info - can't derive
  return null;
}

/**
 * Derive where each output component goes.
 * Fills in output[].to when missing.
 */
export function deriveOutputComponentDestinations(
  step: Step,
  nextStep: Step | null,
  build?: BenchTopLineBuild
): Step {
  if (!step.output || step.output.length === 0) {
    return step;
  }

  const stepDestination = deriveOutputAssemblyLocations(step, nextStep, build);

  const derivedOutputs = step.output.map((out) => {
    // If already has destination, keep it
    if (out.to && (out.to.stationId || out.to.sublocation)) {
      return out;
    }

    // Use step-level destination
    if (stepDestination) {
      return {
        ...out,
        to: stepDestination.value,
      };
    }

    return out;
  });

  return {
    ...step,
    output: derivedOutputs,
  };
}

// ============================================
// Input source derivation
// ============================================

/**
 * Derive where input comes from based on producer step.
 *
 * Logic:
 * 1. If producer exists: input comes from producer's output destination
 * 2. If from storage (no producer): derive storage location based on item
 */
export function deriveInputSource(
  step: Step,
  build: BenchTopLineBuild,
  producerOutputs: Map<string, LocationRef>
): Step {
  if (!step.input || step.input.length === 0) {
    return step;
  }

  const derivedInputs = step.input.map((inp) => {
    // If already has source location, keep it
    if (inp.from && (inp.from.stationId || inp.from.sublocation)) {
      return inp;
    }

    // Check if we have producer output location
    if (inp.source.type === "in_build") {
      const assemblyId = inp.source.assemblyId;
      const producerLoc = producerOutputs.get(assemblyId);
      if (producerLoc) {
        return {
          ...inp,
          from: producerLoc,
        };
      }
    }

    // No producer - must be storage retrieval
    // REMOVED: step.from no longer exists
    // Input location should be explicitly set or derived from storageLocation
    return inp;
  });

  return {
    ...step,
    input: derivedInputs,
  };
}

// ============================================
// Build-level derivation
// ============================================

/**
 * Create a provenance entry for a derived field.
 */
function inferredProvenance(): { type: "inferred"; confidence: "high" } {
  return { type: "inferred", confidence: "high" };
}

/**
 * Derive all Tier 2 fields for a build.
 * Called after parsing, before validation.
 *
 * Returns a new build with derived fields filled in and provenance tracked.
 */
export function deriveAllMaterialFlow(build: BenchTopLineBuild): BenchTopLineBuild {
  // First pass: derive output destinations
  // Need to know next step for each step
  const stepsWithOutputs = build.steps.map((step, idx) => {
    const nextStep = build.steps[idx + 1] ?? null;
    return deriveOutputComponentDestinations(step, nextStep, build);
  });

  // Build map of assemblyId -> output location for input derivation
  const producerOutputs = new Map<string, LocationRef>();
  for (const step of stepsWithOutputs) {
    for (const out of step.output || []) {
      if (out.source.type === "in_build" && out.to) {
        producerOutputs.set(out.source.assemblyId, out.to);
      }
    }
  }

  // Second pass: derive input sources and step workLocations
  const stepsWithInputs = stepsWithOutputs.map((step) => {
    // Derive input sources
    const stepWithInputs = deriveInputSource(step, build, producerOutputs);

    // Derive step workLocation
    const derivedWorkLoc = deriveStepWorkLocation(stepWithInputs);
    if (derivedWorkLoc && derivedWorkLoc.derived && !stepWithInputs.workLocation) {
      return {
        ...stepWithInputs,
        workLocation: derivedWorkLoc.value,
        provenance: {
          ...stepWithInputs.provenance,
          workLocation: inferredProvenance(),
        },
      };
    }

    return stepWithInputs;
  });

  // Third pass: REMOVED - no longer derive step.to
  // Material flow is described via assemblies (output[].to), not step.to
  // Steps describe work location via stationId + sublocation only
  const stepsWithTo = stepsWithInputs;

  return {
    ...build,
    steps: stepsWithTo,
  };
}

// ============================================
// Utility: Check if a field was derived
// ============================================

/**
 * Check if a step's workLocation appears to be derived (vs explicit).
 * This is a heuristic check based on whether it matches derivation rules.
 */
export function isLikelyDerivedWorkLocation(step: Step): boolean {
  if (!step.workLocation) return false;

  const family = step.action.family;
  const rules = ACTION_SUBLOCATION_RULES[family];

  // If matches the default for this action family, likely derived
  return step.workLocation.type === rules.default;
}
