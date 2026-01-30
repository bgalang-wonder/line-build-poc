import {
  type BenchTopLineBuild,
  type Step,
  type ValidationSeverity,
} from "../schema";

/**
 * Shared validation utilities and helper functions.
 */

// -----------------------------
// Types
// -----------------------------

export type ValidationError = {
  severity: ValidationSeverity;
  ruleId: string;
  message: string;
  stepId?: string;
  fieldPath?: string;
};

export type BuildValidationResult = {
  valid: boolean;
  hardErrors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  metrics?: Record<string, unknown>;
};

export type ValidateBuildOptions = {
  /**
   * Optional BOM items for H23 coverage validation.
   * This is intentionally minimal for the PoC; `store.ts` will define IO shape later.
   */
  bom?: Array<{
    bomComponentId: string;
    type?: string; // e.g. "consumable" | "packaged_good"
    name?: string;
  }>;
};

// -----------------------------
// Severity Ranking
// -----------------------------

type SeverityRank = 0 | 1 | 2 | 3;

export function severityRank(severity: ValidationSeverity): SeverityRank {
  switch (severity) {
    case "hard":
      return 0;
    case "strong":
      return 1;
    case "soft":
      return 2;
    case "info":
      return 3;
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

// -----------------------------
// String Utilities
// -----------------------------

export function normalizeString(s: string | undefined | null): string {
  if (typeof s !== "string") return "";
  return s.trim();
}

export function isNonEmptyNotes(step: Step): boolean {
  return normalizeString(step.notes).length > 0;
}

// -----------------------------
// Step Ordering
// -----------------------------

/**
 * Get steps sorted deterministically by orderIndex, then trackId, then id.
 */
export function getOrderedSteps(build: BenchTopLineBuild): Step[] {
  return [...build.steps].sort((a, b) => {
    // Deterministic, independent of input ordering.
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    if ((a.trackId ?? "") !== (b.trackId ?? "")) return (a.trackId ?? "").localeCompare(b.trackId ?? "");
    return a.id.localeCompare(b.id);
  });
}

/**
 * Build a map from step ID to orderIndex for sorting.
 */
export function buildStepOrderIndexMap(build: BenchTopLineBuild): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of build.steps) map.set(s.id, s.orderIndex);
  return map;
}

// -----------------------------
// Error Sorting
// -----------------------------

/**
 * Sort validation errors by severity, rule ID, step order, and field path.
 */
export function sortErrors(
  errs: ValidationError[],
  stepOrderIndexById: Map<string, number>,
): ValidationError[] {
  return [...errs].sort((a, b) => {
    const ar = severityRank(a.severity);
    const br = severityRank(b.severity);
    if (ar !== br) return ar - br;

    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);

    const ao = a.stepId ? (stepOrderIndexById.get(a.stepId) ?? Number.POSITIVE_INFINITY) : Number.NEGATIVE_INFINITY;
    const bo = b.stepId ? (stepOrderIndexById.get(b.stepId) ?? Number.POSITIVE_INFINITY) : Number.NEGATIVE_INFINITY;
    if (ao !== bo) return ao - bo;

    const as = a.stepId ?? "";
    const bs = b.stepId ?? "";
    if (as !== bs) return as.localeCompare(bs);

    const ap = a.fieldPath ?? "";
    const bp = b.fieldPath ?? "";
    if (ap !== bp) return ap.localeCompare(bp);

    return a.message.localeCompare(b.message);
  });
}

// -----------------------------
// Cycle Detection Helpers
// -----------------------------

/**
 * Canonicalize a cycle path to start from the lexicographically smallest node.
 */
export function canonicalizeCyclePath(nodes: string[]): string[] {
  // nodes is a cycle without the repeated closing node (e.g. [A, B, C])
  if (nodes.length === 0) return nodes;
  const min = [...nodes].sort()[0]!;
  const startIdx = nodes.indexOf(min);
  const rotated = [...nodes.slice(startIdx), ...nodes.slice(0, startIdx)];
  return rotated;
}

// -----------------------------
// Customization Value Collection
// -----------------------------

/**
 * Collect all valid customization value IDs from build's customization groups.
 */
export function collectValidCustomizationValueIds(build: BenchTopLineBuild): Set<string> {
  return new Set((build.customizationGroups ?? []).flatMap((g) => g.valueIds ?? []));
}

// -----------------------------
// Container Detection
// -----------------------------

/**
 * Regex to detect container-like terms in target.name for H4 validation.
 */
export const CONTAINER_DETECTION_REGEX = /\b(bowl|pan|tray|clamshell|ramekin|cup|bag|foil|lid|lexan|deli.?cup|hotel.?pan|container)\b/i;
