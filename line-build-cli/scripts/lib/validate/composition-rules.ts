import {
  type BenchTopLineBuild,
  type BuildRef,
} from "../schema";
import {
  type ValidationError,
  getOrderedSteps,
} from "./helpers";

/**
 * Composition and flow integrity validation rules (C1-C3).
 * These check cross-build references and assembly flow integrity.
 */

// -----------------------------
// C1: RequiresBuilds Integrity
// -----------------------------

/**
 * C1: Validates that requiresBuilds has no self-references or duplicates.
 */
export function validateRequiresBuildsIntegrity(build: BenchTopLineBuild): ValidationError[] {
  const refs: BuildRef[] = build.requiresBuilds ?? [];
  if (refs.length === 0) return [];

  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  const dupes = new Set<string>();

  for (const r of refs) {
    if (r.itemId === build.itemId) {
      errors.push({
        severity: "hard",
        ruleId: "C1",
        message: `requiresBuilds: self-dependency is not allowed (itemId=${build.itemId})`,
        fieldPath: "requiresBuilds[].itemId",
      });
    }
    if (seen.has(r.itemId)) dupes.add(r.itemId);
    seen.add(r.itemId);
  }

  for (const d of [...dupes].sort()) {
    errors.push({
      severity: "hard",
      ruleId: "C1",
      message: `requiresBuilds: duplicate itemId ${d}`,
      fieldPath: "requiresBuilds[].itemId",
    });
  }

  return errors;
}

// -----------------------------
// C2: External Build Refs Declared
// -----------------------------

/**
 * C2: Validates that all external_build references in steps are declared in requiresBuilds.
 */
export function validateExternalBuildRefsDeclared(build: BenchTopLineBuild): ValidationError[] {
  const declared = new Set((build.requiresBuilds ?? []).map((r) => r.itemId));
  const errors: ValidationError[] = [];
  for (const step of getOrderedSteps(build)) {
    const refs = [
      ...(step.input ?? []).map((r) => ({ kind: "input" as const, r })),
      ...(step.output ?? []).map((r) => ({ kind: "output" as const, r })),
    ];
    for (const { kind, r } of refs) {
      if (r.source.type !== "external_build") continue;
      if (!declared.has(r.source.itemId)) {
        errors.push({
          severity: "hard",
          ruleId: "C2",
          message: `external_build reference must be declared in build.requiresBuilds (missing itemId=${r.source.itemId})`,
          stepId: step.id,
          fieldPath: `${kind}[].source.itemId`,
        });
      }
    }
  }
  return errors;
}

// -----------------------------
// C3: In-Build Assembly Refs Resolve
// -----------------------------

/**
 * C3: Validates that all in_build assembly references resolve to assemblies in build.assemblies.
 */
export function validateInBuildAssemblyRefsResolve(build: BenchTopLineBuild): ValidationError[] {
  const assemblyIds = new Set((build.assemblies ?? []).map((a) => a.id));
  const hasAssemblies = (build.assemblies ?? []).length > 0;
  // PoC: allow in_build refs without authored assemblies metadata.
  // Assemblies can be auto-created during normalization.
  if (!hasAssemblies) return [];

  const errors: ValidationError[] = [];
  for (const step of getOrderedSteps(build)) {
    const refs = [
      ...(step.input ?? []).map((r) => ({ kind: "input" as const, r })),
      ...(step.output ?? []).map((r) => ({ kind: "output" as const, r })),
    ];
    for (const { kind, r } of refs) {
      if (r.source.type !== "in_build") continue;
      if (!assemblyIds.has(r.source.assemblyId)) {
        errors.push({
          severity: "hard",
          ruleId: "C3",
          message: `in_build assembly reference does not resolve (assemblyId=${r.source.assemblyId})`,
          stepId: step.id,
          fieldPath: `${kind}[].source.assemblyId`,
        });
      }
    }
  }
  return errors;
}

// Keep the old name as an alias for backwards compatibility in index.ts
export const validateInBuildComponentRefsResolve = validateInBuildAssemblyRefsResolve;
