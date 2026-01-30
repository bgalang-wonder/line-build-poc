/**
 * Structural signal extraction for complexity scoring.
 *
 * Extracts graph-based signals that indicate workflow complexity:
 * - Grouping bounces (S16a): leaving and returning to kitchen areas
 * - Station bounces (S16b): leaving and returning to stations
 * - Merge points: steps with multiple inputs
 * - Entry points: steps with no dependencies
 * - Equipment patterns: short steps, back-to-back equipment
 * - Transfers and transitions
 */

import type { BenchTopLineBuild, Step } from "../schema";
import type { StructuralSignals, SignalDetail } from "./types";
import type { SignalName } from "../../../config/complexity.config";
import { getStationSide, type StationSide } from "../../../config/stations.config";
import { loadComplexityConfig } from "./config";
import { getDerivedTransfersSync } from "../derivedCache";

/**
 * Get ordered steps for a build.
 */
function getOrderedSteps(build: BenchTopLineBuild): Step[] {
  return [...build.steps].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

/**
 * Count grouping-level bounces (S16a pattern).
 * Detects when a build leaves a grouping and returns to it.
 */
export function countGroupingBounces(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  const steps = getOrderedSteps(build);
  const stepsByTrack = new Map<string, Step[]>();

  for (const step of steps) {
    const trackId = step.trackId ?? "default";
    if (!stepsByTrack.has(trackId)) stepsByTrack.set(trackId, []);
    stepsByTrack.get(trackId)!.push(step);
  }

  let count = 0;
  const details: SignalDetail[] = [];

  for (const [trackId, trackSteps] of Array.from(stepsByTrack.entries())) {
    const groupingVisits = new Map<string, { firstStepId: string; visitIndices: number[] }>();
    let currentGrouping = "";
    let visitCount = 0;

    for (const step of trackSteps) {
      const groupingId = step.groupingId ?? getStationSide(step.stationId);
      if (groupingId !== currentGrouping) {
        currentGrouping = groupingId;
        visitCount++;
        if (!groupingVisits.has(groupingId)) {
          groupingVisits.set(groupingId, { firstStepId: step.id, visitIndices: [] });
        }
        groupingVisits.get(groupingId)!.visitIndices.push(visitCount);
      }
    }

    // Check for revisits
    for (const [groupingId, visits] of Array.from(groupingVisits.entries())) {
      if (visits.visitIndices.length > 1) {
        count++;
        details.push({
          stepIds: [visits.firstStepId],
          description: `Grouping '${groupingId}' revisited in track '${trackId}' (visits: ${visits.visitIndices.join(", ")})`,
        });
      }
    }
  }

  return { count, details };
}

/**
 * Count station-level bounces (S16b pattern).
 * Detects when a build leaves a station and returns within same grouping.
 */
export function countStationBounces(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  const steps = getOrderedSteps(build);
  const stepsByTrack = new Map<string, Step[]>();

  for (const step of steps) {
    const trackId = step.trackId ?? "default";
    if (!stepsByTrack.has(trackId)) stepsByTrack.set(trackId, []);
    stepsByTrack.get(trackId)!.push(step);
  }

  let count = 0;
  const details: SignalDetail[] = [];

  for (const [trackId, trackSteps] of Array.from(stepsByTrack.entries())) {
    const stationVisits = new Map<string, { firstStepId: string; visitIndices: number[] }>();
    let currentStation = "";
    let visitCount = 0;

    for (const step of trackSteps) {
      const stationId = step.stationId ?? "other";
      if (stationId !== currentStation) {
        currentStation = stationId;
        visitCount++;
        if (!stationVisits.has(stationId)) {
          stationVisits.set(stationId, { firstStepId: step.id, visitIndices: [] });
        }
        stationVisits.get(stationId)!.visitIndices.push(visitCount);
      }
    }

    // Check for revisits within same grouping (S16a covers cross-grouping)
    for (const [stationId, visits] of Array.from(stationVisits.entries())) {
      if (visits.visitIndices.length > 1) {
        // Check if stays within same grouping between visits
        const firstVisitIdx = visits.visitIndices[0]!;
        const secondVisitIdx = visits.visitIndices[1]!;

        let stayedInSameGrouping = true;
        let targetGrouping: StationSide | null = null;

        let scanStation = "";
        let scanVisitNum = 0;

        for (const step of trackSteps) {
          const stepStation = step.stationId ?? "other";
          if (stepStation !== scanStation) {
            scanStation = stepStation;
            scanVisitNum++;
          }

          if (scanVisitNum >= firstVisitIdx && scanVisitNum <= secondVisitIdx) {
            const grouping = step.groupingId ?? getStationSide(step.stationId);
            if (targetGrouping === null) {
              targetGrouping = grouping as StationSide;
            } else if (grouping !== targetGrouping) {
              stayedInSameGrouping = false;
              break;
            }
          }
        }

        // Only count if stayed in same grouping (S16a handles cross-grouping)
        if (stayedInSameGrouping) {
          count++;
          details.push({
            stepIds: [visits.firstStepId],
            description: `Station '${stationId}' revisited in track '${trackId}' within same grouping`,
          });
        }
      }
    }
  }

  return { count, details };
}

/**
 * Count merge points (steps with 2+ inputs).
 */
export function countMergePoints(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  let count = 0;
  const details: SignalDetail[] = [];

  for (const step of build.steps) {
    const inputCount = step.input?.length ?? 0;
    if (inputCount >= 2) {
      count++;
      details.push({
        stepIds: [step.id],
        description: `Merge point with ${inputCount} inputs`,
      });
    }
  }

  return { count, details };
}

/**
 * Count deep merge points (steps with 3+ inputs).
 */
export function countDeepMerges(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  let count = 0;
  const details: SignalDetail[] = [];

  for (const step of build.steps) {
    const inputCount = step.input?.length ?? 0;
    if (inputCount >= 3) {
      count++;
      details.push({
        stepIds: [step.id],
        description: `Deep merge with ${inputCount} inputs`,
      });
    }
  }

  return { count, details };
}

/**
 * Count parallel entry points (steps with no dependsOn).
 */
export function countParallelEntryPoints(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  let count = 0;
  const details: SignalDetail[] = [];

  for (const step of build.steps) {
    const deps = step.dependsOn ?? [];
    if (deps.length === 0) {
      count++;
      details.push({
        stepIds: [step.id],
        description: `Entry point (no dependencies)`,
      });
    }
  }

  return { count, details };
}

/**
 * Count short equipment steps (equipment steps with duration < threshold).
 */
export function countShortEquipmentSteps(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  const config = loadComplexityConfig();
  const threshold = config.thresholds.shortEquipmentSeconds;

  let count = 0;
  const details: SignalDetail[] = [];

  for (const step of build.steps) {
    if (step.equipment?.applianceId) {
      const duration = step.time?.durationSeconds ?? 0;
      if (duration > 0 && duration < threshold) {
        count++;
        details.push({
          stepIds: [step.id],
          description: `Short equipment step (${duration}s < ${threshold}s threshold)`,
        });
      }
    }
  }

  return { count, details };
}

/**
 * Count back-to-back equipment steps (adjacent steps both using equipment).
 */
export function countBackToBackEquipment(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  const steps = getOrderedSteps(build);

  let count = 0;
  const details: SignalDetail[] = [];

  for (let i = 1; i < steps.length; i++) {
    const prevStep = steps[i - 1]!;
    const currStep = steps[i]!;

    if (prevStep.equipment?.applianceId && currStep.equipment?.applianceId) {
      count++;
      details.push({
        stepIds: [prevStep.id, currStep.id],
        description: `Back-to-back equipment: ${prevStep.equipment.applianceId} → ${currStep.equipment.applianceId}`,
      });
    }
  }

  return { count, details };
}

/**
 * Count derived transfers.
 */
export function countTransfers(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  const transfers = getDerivedTransfersSync(build);

  const details: SignalDetail[] = transfers.map((t) => ({
    stepIds: [t.producerStepId, t.consumerStepId],
    description: `Transfer (${t.transferType}): ${t.assemblyId}`,
  }));

  return { count: transfers.length, details };
}

/**
 * Count station transitions (changes between stations).
 */
export function countStationTransitions(build: BenchTopLineBuild): {
  count: number;
  details: SignalDetail[];
} {
  const steps = getOrderedSteps(build);

  let count = 0;
  const details: SignalDetail[] = [];
  let prevStation: string | undefined;

  for (const step of steps) {
    const station = step.stationId ?? "other";
    if (prevStation && station !== prevStation) {
      count++;
      details.push({
        stepIds: [step.id],
        description: `Station transition: ${prevStation} → ${station}`,
      });
    }
    prevStation = station;
  }

  return { count, details };
}

/**
 * Extract all structural signals from a build.
 */
export function extractStructuralSignals(build: BenchTopLineBuild): StructuralSignals {
  const groupingBounces = countGroupingBounces(build);
  const stationBounces = countStationBounces(build);
  const mergePoints = countMergePoints(build);
  const deepMerges = countDeepMerges(build);
  const entryPoints = countParallelEntryPoints(build);
  const shortEquipment = countShortEquipmentSteps(build);
  const backToBack = countBackToBackEquipment(build);
  const transfers = countTransfers(build);
  const transitions = countStationTransitions(build);

  const details: Partial<Record<SignalName, SignalDetail[]>> = {};

  if (groupingBounces.details.length > 0) details.groupingBounces = groupingBounces.details;
  if (stationBounces.details.length > 0) details.stationBounces = stationBounces.details;
  if (mergePoints.details.length > 0) details.mergePointCount = mergePoints.details;
  if (deepMerges.details.length > 0) details.deepMergeCount = deepMerges.details;
  if (entryPoints.details.length > 0) details.parallelEntryPoints = entryPoints.details;
  if (shortEquipment.details.length > 0) details.shortEquipmentSteps = shortEquipment.details;
  if (backToBack.details.length > 0) details.backToBackEquipment = backToBack.details;
  if (transfers.details.length > 0) details.transferCount = transfers.details;
  if (transitions.details.length > 0) details.stationTransitions = transitions.details;

  return {
    groupingBounces: groupingBounces.count,
    stationBounces: stationBounces.count,
    mergePointCount: mergePoints.count,
    deepMergeCount: deepMerges.count,
    parallelEntryPoints: entryPoints.count,
    shortEquipmentSteps: shortEquipment.count,
    backToBackEquipment: backToBack.count,
    transferCount: transfers.count,
    stationTransitions: transitions.count,
    details,
  };
}

/**
 * Score structural signals using config weights.
 */
export function scoreStructuralSignals(signals: StructuralSignals): number {
  const config = loadComplexityConfig();

  return (
    signals.groupingBounces * config.signals.groupingBounces +
    signals.stationBounces * config.signals.stationBounces +
    signals.mergePointCount * config.signals.mergePointCount +
    signals.deepMergeCount * config.signals.deepMergeCount +
    signals.parallelEntryPoints * config.signals.parallelEntryPoints +
    signals.shortEquipmentSteps * config.signals.shortEquipmentSteps +
    signals.backToBackEquipment * config.signals.backToBackEquipment +
    signals.transferCount * config.signals.transferCount +
    signals.stationTransitions * config.signals.stationTransitions
  );
}
