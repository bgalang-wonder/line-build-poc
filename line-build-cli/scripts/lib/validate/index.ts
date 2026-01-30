import { type BenchTopLineBuild } from "../schema";

// Re-export types and helpers
export {
  type ValidationError,
  type BuildValidationResult,
  type ValidateBuildOptions,
  getOrderedSteps,
  buildStepOrderIndexMap,
  sortErrors,
} from "./helpers";

// Import all rule validators
import {
  validateH1,
  validateH2,
  validateH3,
  validateH4,
  validateH6,
  validateH7,
  validateH8,
  validateH9,
  validateH10,
  validateH11,
  validateH12,
  validateH13,
  validateH14,
  validateH15,
  validateH16,
  validateH17,
  validateH18,
} from "./hard-rules";

import {
  validateH19,
  validateH20,
  validateH21,
  validateH22,
  validateH23,
  validateH24,
  validateH25,
  validateH32StationSublocationCompatibility,
  validateH33TechniqueVocabulary,
  validateH35EquipmentAtStation,
  validateH36StationOrUniqueEquipment,
  validateH37SharedEquipmentRequiresStation,
  validateH38NoAuthoredTransfer,
  // validateH39StepFromToLocations, // REMOVED - step.from/to no longer exist
  validateH40AssemblyRefLocations,
  validateH41MaterialFlow,
  validateH42AmbiguousStation,
  validateH43MaterialFlowContinuity,
  validateH44SingleProducer,
  validateH46StepWorkLocation,
} from "./hard-rules-advanced";

import {
  validateRequiresBuildsIntegrity,
  validateExternalBuildRefsDeclared,
  validateInBuildComponentRefsResolve,
} from "./composition-rules";

import {
  validatePrimaryOutputComponentIdWarning,
  validateS15ComponentSublocation,
  validateS20DependsOnWithoutInput,
  validateS21AssemblyNaming,
  validateS22MaterialFlowContinuity,
  validateS23ImplicitTransfer,
  validateS45MissingTributarySource,
  validateS16aGroupingBouncing,
  validateS16bStationBouncing,
  validateS17DerivedSublocation,
  validateS18DerivedOutputDestination,
  validateH26GraphConnectivity,
  validateH29MergeRoles,
  validateH30Lineage,
} from "./soft-rules";

import {
  type ValidationError,
  type BuildValidationResult,
  type ValidateBuildOptions,
  getOrderedSteps,
  buildStepOrderIndexMap,
  sortErrors,
} from "./helpers";

/**
 * Deterministic build validator.
 *
 * Output shape aligns with docs/handoff/POC_TASKS.json -> shared_conventions.validation_output_contract.schema
 * (minus buildId/itemId/timestamp which are written by validationOutput.ts in a later cycle).
 */
export function validateBuild(
  build: BenchTopLineBuild,
  opts: ValidateBuildOptions = {},
): BuildValidationResult {
  const hardErrors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Build-level first (recommended order).
  hardErrors.push(...validateH6(build));
  hardErrors.push(...validateH7(build));
  hardErrors.push(...validateH8(build));
  hardErrors.push(...validateH9(build));

  // Per-step (deterministic iteration order).
  for (const step of getOrderedSteps(build)) {
    hardErrors.push(...validateH1(step));
    hardErrors.push(...validateH3(step));
    hardErrors.push(...validateH10(step));
    hardErrors.push(...validateH15(step));
    hardErrors.push(...validateH16(step));
    hardErrors.push(...validateH17(step));
    hardErrors.push(...validateH18(step));
    hardErrors.push(...validateH22(step));
    hardErrors.push(...validateH24(step));
    hardErrors.push(...validateH25(step));
    hardErrors.push(...validateH4(step));
    hardErrors.push(...validateH11(step));
    hardErrors.push(...validateH14(step));
    hardErrors.push(...validateH38NoAuthoredTransfer(step));
    // hardErrors.push(...validateH39StepFromToLocations(step)); // REMOVED - step.from/to no longer exist
    hardErrors.push(...validateH40AssemblyRefLocations(step));
    hardErrors.push(...validateH41MaterialFlow(step));
    hardErrors.push(...validateH42AmbiguousStation(step));
    hardErrors.push(...validateH46StepWorkLocation(step));
  }

  // Build-level customization/overlays + override hygiene.
  hardErrors.push(...validateH12(build));
  hardErrors.push(...validateH21(build));
  hardErrors.push(...validateH19(build));
  hardErrors.push(...validateH20(build));
  hardErrors.push(...validateH13(build));
  hardErrors.push(...validateH43MaterialFlowContinuity(build));
  hardErrors.push(...validateH44SingleProducer(build));

  // Optional H23 (only if bom provided).
  hardErrors.push(...validateH23(build, opts.bom));

  // Composition / flow integrity.
  hardErrors.push(...validateRequiresBuildsIntegrity(build));
  hardErrors.push(...validateExternalBuildRefsDeclared(build));
  hardErrors.push(...validateInBuildComponentRefsResolve(build));

  // Warnings (Strong) - MVP: primaryOutputComponentId requirement is not publish-blocking.
  warnings.push(...validatePrimaryOutputComponentIdWarning(build));
  warnings.push(...validateH2(build));
  warnings.push(...validateH26GraphConnectivity(build));
  warnings.push(...validateH29MergeRoles(build));
  warnings.push(...validateH30Lineage(build));
  warnings.push(...validateS15ComponentSublocation(build));
  warnings.push(...validateS21AssemblyNaming(build));
  warnings.push(...validateS22MaterialFlowContinuity(build));
  warnings.push(...validateS16aGroupingBouncing(build));
  warnings.push(...validateS16bStationBouncing(build));
  for (const step of getOrderedSteps(build)) {
    warnings.push(...validateS20DependsOnWithoutInput(step));
  }

  // Config-driven hard rules (per-step)
  for (const step of getOrderedSteps(build)) {
    hardErrors.push(...validateH32StationSublocationCompatibility(step));
    hardErrors.push(...validateH33TechniqueVocabulary(step));
    hardErrors.push(...validateH35EquipmentAtStation(step));
    hardErrors.push(...validateH36StationOrUniqueEquipment(step));
    hardErrors.push(...validateH37SharedEquipmentRequiresStation(step));
    // Soft warnings for derived fields
    warnings.push(...validateS17DerivedSublocation(step));
    warnings.push(...validateS18DerivedOutputDestination(step));
    // Implicit transfer detection
    warnings.push(...validateS23ImplicitTransfer(step));
    // Missing tributary source detection
    warnings.push(...validateS45MissingTributarySource(step));
  }

  const stepOrderIndexById = buildStepOrderIndexMap(build);
  
  // Consolidate and re-bucket by actual severity (in case a rule changed severity but was pushed to the wrong list)
  const finalHard: ValidationError[] = [];
  const finalWarn: ValidationError[] = [];
  const finalInfo: ValidationError[] = [];

  for (const e of [...hardErrors, ...warnings]) {
    if (e.severity === "hard") finalHard.push(e);
    else if (e.severity === "info") finalInfo.push(e);
    else finalWarn.push(e);
  }

  return {
    valid: finalHard.length === 0,
    hardErrors: sortErrors(finalHard, stepOrderIndexById),
    warnings: sortErrors(finalWarn, stepOrderIndexById),
    infos: sortErrors(finalInfo, stepOrderIndexById),
  };
}
