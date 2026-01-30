/**
 * Transfer step derivation.
 *
 * Transfer steps are always derived (never authored) and are computed from
 * material flow + location data.
 *
 * In the ideal model, transfers are derived from explicit assembly flow:
 * - Producer step outputs assembly X at location A
 * - Consumer step inputs assembly X at location B
 * - If A ≠ B, derive an implicit TRANSFER step
 *
 * This PoC treats transfers as strictly derived from explicit assembly flow.
 * If a build omits assembly flow (empty input/output arrays), no transfers can
 * be derived.
 */

import {
  ActionFamily,
  type BenchTopLineBuild,
  type Step,
  type DerivedTransferStep,
  type LocationRef,
  type AssemblyId,
  type StepId,
  type StationId,
  type TransferType,
} from "./schema";
import {
  determineTransferType,
  getTransferComplexity,
  getTransferBaseTime,
  type TransferLocationInfo,
} from "../../config/transfers.config";
import { assignPodForStep, type HdrPodConfig } from "../../config/hdr-pod.mock";
import { loadActiveHdrConfig } from "./hdrConfig";

// ============================================
// Types
// ============================================

/**
 * Maps assemblyId → the step that produces it and its output location.
 */
interface ProducerInfo {
  stepId: StepId;
  outputLocation: LocationRef;
}

// ============================================
// Core Derivation Logic
// ============================================

type TransferTechnique = "place" | "retrieve" | "pass" | "handoff";

const RETRIEVAL_SUBLOCATIONS = new Set<string>([
  "cold_storage",
  "freezer",
  "kit_storage",
  "packaging",
  "cold_rail",
  "dry_rail",
]);

function isMeaningfulLocation(loc: LocationRef | undefined): boolean {
  if (!loc) return false;
  return Boolean(loc.stationId || loc.sublocation?.type);
}

function normalizeLocation(loc: LocationRef | undefined): LocationRef | undefined {
  return isMeaningfulLocation(loc) ? loc : undefined;
}

function withFallbackStation(
  loc: LocationRef | undefined,
  stationId: StationId | undefined,
): LocationRef | undefined {
  if (!loc) return loc;
  if (loc.stationId || !stationId) return loc;
  if (!loc.sublocation?.type) return loc;
  return { ...loc, stationId };
}

function stepWorkLocation(step: Step): LocationRef | undefined {
  const stationId = step.stationId;
  const workLocation = step.workLocation;
  if (!stationId && !workLocation) return undefined;
  return {
    ...(stationId ? { stationId } : {}),
    ...(workLocation ? { sublocation: workLocation } : {}),
  };
}

function resolveProducerLocation(step: Step, out?: { to?: LocationRef }): LocationRef | undefined {
  return (
    normalizeLocation(withFallbackStation(out?.to, step.stationId)) ??
    normalizeLocation(withFallbackStation(step.to, step.stationId)) ??
    stepWorkLocation(step)
  );
}

function resolveConsumerLocation(step: Step, inp?: { from?: LocationRef }): LocationRef | undefined {
  // For transfer derivation, we need to know where the WORK happens, not where the material came from.
  // inp.from tracks material provenance, but the transfer occurs TO the step's work location.
  return (
    stepWorkLocation(step) ??
    normalizeLocation(withFallbackStation(step.from, step.stationId)) ??
    normalizeLocation(withFallbackStation(inp?.from, step.stationId))
  );
}

/**
 * Build a map of assemblyId → producer info.
 * Finds which step produces each assembly and where it outputs to.
 */
function buildProducerMap(build: BenchTopLineBuild): Map<AssemblyId, ProducerInfo> {
  const producers = new Map<AssemblyId, ProducerInfo>();

  for (const step of build.steps) {
    for (const out of step.output || []) {
      if (out.source.type === "in_build") {
        const assemblyId = out.source.assemblyId;
        const outputLocation = resolveProducerLocation(step, out);
        if (!outputLocation) continue;
        producers.set(assemblyId, {
          stepId: step.id,
          outputLocation,
        });
      }
    }
  }

  return producers;
}

/**
 * Convert a LocationRef to TransferLocationInfo for transfer type determination.
 */
function locationToTransferInfo(loc: LocationRef, hdrConfig: HdrPodConfig): TransferLocationInfo {
  const equipmentId =
    loc.sublocation?.type === "equipment" ? loc.sublocation.equipmentId : undefined;
  const podId = assignPodForStep(equipmentId, loc.stationId, hdrConfig);
  return {
    stationId: loc.stationId,
    sublocationId: loc.sublocation?.type,
    podId,
  };
}

/**
 * Check if two locations are effectively the same (no transfer needed).
 */
function locationsMatch(from: LocationRef, to: LocationRef): boolean {
  if (from.stationId !== to.stationId) return false;
  if (from.sublocation?.type !== to.sublocation?.type) return false;
  // Equipment sublocation needs equipmentId match too
  if (from.sublocation?.type === "equipment" || to.sublocation?.type === "equipment") {
    return from.sublocation?.equipmentId === to.sublocation?.equipmentId;
  }
  return true;
}

function inferTransferTechnique(from: LocationRef, to: LocationRef): TransferTechnique {
  const toSubloc = to.sublocation?.type;
  if (to.stationId === "expo" || toSubloc === "window_shelf") return "handoff";

  const fromSubloc = from.sublocation?.type;
  if (fromSubloc && RETRIEVAL_SUBLOCATIONS.has(fromSubloc)) return "retrieve";

  if (from.stationId && to.stationId && from.stationId !== to.stationId) return "pass";

  return "place";
}

function compareTransferSeverity(a: DerivedTransferStep, b: DerivedTransferStep): number {
  if (a.complexityScore !== b.complexityScore) return a.complexityScore - b.complexityScore;
  if (a.estimatedTimeSeconds !== b.estimatedTimeSeconds) {
    return a.estimatedTimeSeconds - b.estimatedTimeSeconds;
  }
  return 0;
}

function upsertMostSevere(
  transfersByEdge: Map<string, DerivedTransferStep>,
  next: DerivedTransferStep
): void {
  const key = `${next.producerStepId}->${next.consumerStepId}`;
  const existing = transfersByEdge.get(key);
  if (!existing) {
    transfersByEdge.set(key, next);
    return;
  }

  // Keep the more severe transfer (higher complexity / time).
  const cmp = compareTransferSeverity(existing, next);
  if (cmp < 0) {
    transfersByEdge.set(key, next);
    return;
  }

  // Stable tie-breaker: keep lexicographically smaller id.
  if (cmp === 0 && next.id.localeCompare(existing.id) < 0) {
    transfersByEdge.set(key, next);
  }
}

/**
 * Derive transfer steps for a build.
 *
 * For each step's input assemblies:
 * 1. Find the producer step (where that assembly was output)
 * 2. Compare producer's output location → consumer's input location
 * 3. If locations differ → generate a DerivedTransferStep
 *
 * Returns an array of derived transfer steps.
 */
export function deriveTransferSteps(build: BenchTopLineBuild): DerivedTransferStep[] {
  // Load HDR config once for all pod assignments
  const hdrConfig = loadActiveHdrConfig();

  const steps = [...build.steps].sort(
    (a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id),
  );
  const transfersByEdge = new Map<string, DerivedTransferStep>();
  const producers = buildProducerMap(build);

  for (const step of steps) {
    for (const inp of step.input ?? []) {
      if (inp.source.type !== "in_build") continue;

      const assemblyId = inp.source.assemblyId;
      const producer = producers.get(assemblyId);

      // No producer found: likely storage / external input.
      if (!producer) continue;

      const fromLocation = normalizeLocation(producer.outputLocation);
      const toLocation = resolveConsumerLocation(step, inp);
      if (!fromLocation || !toLocation) continue;

      if (locationsMatch(fromLocation, toLocation)) continue;

      const fromInfo = locationToTransferInfo(fromLocation, hdrConfig);
      const toInfo = locationToTransferInfo(toLocation, hdrConfig);
      const transferType = determineTransferType(fromInfo, toInfo);
      if (!transferType) continue;

      const techniqueId = inferTransferTechnique(fromLocation, toLocation);
      const id = `transfer-${producer.stepId}__${step.id}`;

      upsertMostSevere(transfersByEdge, {
        id,
        action: { family: ActionFamily.TRANSFER, techniqueId },
        transferType,
        assemblyId,
        from: fromLocation,
        to: toLocation,
        complexityScore: getTransferComplexity(transferType),
        estimatedTimeSeconds: getTransferBaseTime(transferType),
        derived: true,
        producerStepId: producer.stepId,
        consumerStepId: step.id,
        fromPodId: fromInfo.podId,
        toPodId: toInfo.podId,
      });
    }
  }

  const stepOrderById = new Map<string, number>(steps.map((s) => [s.id, s.orderIndex]));
  return Array.from(transfersByEdge.values()).sort((a, b) => {
    const aKey = `${stepOrderById.get(a.producerStepId) ?? 0}:${
      stepOrderById.get(a.consumerStepId) ?? 0
    }:${a.id}`;
    const bKey = `${stepOrderById.get(b.producerStepId) ?? 0}:${
      stepOrderById.get(b.consumerStepId) ?? 0
    }:${b.id}`;
    return aKey.localeCompare(bKey);
  });
}

// ============================================
// Analysis Utilities
// ============================================

/**
 * Group derived transfers by type for analysis.
 */
export function groupTransfersByType(
  transfers: DerivedTransferStep[]
): Record<TransferType, DerivedTransferStep[]> {
  const groups: Record<TransferType, DerivedTransferStep[]> = {
    intra_station: [],
    inter_station: [],
    inter_pod: [],
  };

  for (const t of transfers) {
    groups[t.transferType].push(t);
  }

  return groups;
}

/**
 * Calculate total complexity score for all transfers.
 */
export function totalTransferComplexity(transfers: DerivedTransferStep[]): number {
  return transfers.reduce((sum, t) => sum + t.complexityScore, 0);
}

/**
 * Calculate total estimated time for all transfers.
 */
export function totalTransferTime(transfers: DerivedTransferStep[]): number {
  return transfers.reduce((sum, t) => sum + t.estimatedTimeSeconds, 0);
}

/**
 * Get a summary of transfer complexity for a build.
 */
export function getTransferSummary(build: BenchTopLineBuild): {
  totalTransfers: number;
  byType: Record<TransferType, number>;
  totalComplexity: number;
  totalEstimatedTime: number;
  hasHighComplexityTransfers: boolean;
} {
  const transfers = deriveTransferSteps(build);
  const grouped = groupTransfersByType(transfers);

  return {
    totalTransfers: transfers.length,
    byType: {
      intra_station: grouped.intra_station.length,
      inter_station: grouped.inter_station.length,
      inter_pod: grouped.inter_pod.length,
    },
    totalComplexity: totalTransferComplexity(transfers),
    totalEstimatedTime: totalTransferTime(transfers),
    hasHighComplexityTransfers: grouped.inter_pod.length > 0,
  };
}
