/**
 * Feature extraction for complexity scoring.
 *
 * Extracts deterministic features from steps and builds.
 * These features are the input to the scoring algorithm.
 */

import type { BenchTopLineBuild, Step, ActionFamily } from "../schema";
import type { StepFeatures, BuildFeatures } from "./types";
import {
  canonicalizeLocation,
  canonicalizeTechnique,
  isHotSide,
  isColdSide,
  isExpoSide,
  isVendingSide,
} from "./mapping";

/**
 * Extract features from a single step.
 */
export function extractStepFeatures(step: Step): StepFeatures {
  // Determine station side from explicit groupingId or derive from stationId
  const stationSide = step.groupingId
    ? (step.groupingId as ReturnType<typeof canonicalizeLocation>)
    : canonicalizeLocation(step.stationId);

  // Get duration and active status
  const durationSeconds = step.time?.durationSeconds ?? 0;
  const isActive = step.time?.isActive ?? false;

  // Get equipment ID
  const equipmentId = step.equipment?.applianceId;

  // Get technique ID (canonicalized)
  const techniqueId = canonicalizeTechnique(step.action.techniqueId);

  // Count inputs and outputs
  const inputCount = step.input?.length ?? 0;
  const outputCount = step.output?.length ?? 0;

  // Get quantity value if present
  const quantityValue = step.quantity?.value;

  return {
    stepId: step.id,
    stationSide,
    stationId: step.stationId,
    actionFamily: step.action.family,
    techniqueId,
    equipmentId,
    durationSeconds,
    isActive,
    isHotSide: isHotSide(stationSide),
    isColdSide: isColdSide(stationSide),
    isExpo: isExpoSide(stationSide),
    isVending: isVendingSide(stationSide),
    inputCount,
    outputCount,
    quantityValue,
  };
}

/**
 * Extract aggregate features from a build.
 */
export function extractBuildFeatures(build: BenchTopLineBuild): BuildFeatures {
  // Get ordered steps (by orderIndex)
  const steps = [...build.steps].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  // Extract features for each step
  const stepFeatures = steps.map(extractStepFeatures);

  // Count steps by location
  let hotSideStepCount = 0;
  let coldSideStepCount = 0;
  let expoStepCount = 0;
  let vendingStepCount = 0;

  // Collect unique values
  const uniqueStations = new Set<string>();
  const uniqueEquipment = new Set<string>();
  const uniqueActionFamilies = new Set<ActionFamily>();

  // Accumulate durations
  let totalDurationSeconds = 0;
  let totalActiveSeconds = 0;

  // Count entry points (steps with no dependencies)
  let entryPointCount = 0;

  for (const sf of stepFeatures) {
    // Count by location
    if (sf.isHotSide) hotSideStepCount++;
    else if (sf.isColdSide) coldSideStepCount++;
    else if (sf.isExpo) expoStepCount++;
    else if (sf.isVending) vendingStepCount++;

    // Collect unique stations
    if (sf.stationId) uniqueStations.add(sf.stationId);

    // Collect unique equipment
    if (sf.equipmentId) uniqueEquipment.add(sf.equipmentId);

    // Collect unique action families
    uniqueActionFamilies.add(sf.actionFamily);

    // Accumulate durations
    totalDurationSeconds += sf.durationSeconds;
    if (sf.isActive) totalActiveSeconds += sf.durationSeconds;
  }

  // Count entry points from original steps
  for (const step of steps) {
    const deps = step.dependsOn ?? [];
    if (deps.length === 0) entryPointCount++;
  }

  return {
    buildId: build.id,
    stepCount: steps.length,
    hotSideStepCount,
    coldSideStepCount,
    expoStepCount,
    vendingStepCount,
    uniqueStations: Array.from(uniqueStations),
    uniqueEquipment: Array.from(uniqueEquipment),
    uniqueActionFamilies: Array.from(uniqueActionFamilies),
    totalDurationSeconds,
    totalActiveSeconds,
    entryPointCount,
    stepFeatures,
  };
}

/**
 * Compute hot/cold work ratio.
 * Returns 0-1 where 1 = all hot side work, 0 = all cold side work.
 * Expo and vending steps are excluded from this ratio.
 */
export function computeHotColdRatio(features: BuildFeatures): number {
  const hotColdTotal = features.hotSideStepCount + features.coldSideStepCount;
  if (hotColdTotal === 0) return 0;
  return features.hotSideStepCount / hotColdTotal;
}
