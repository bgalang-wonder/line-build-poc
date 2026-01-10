import {
  ActionFamily,
  type BenchTopLineBuild,
  type BuildRef,
  type Step,
  type ValidationSeverity,
} from "./schema";

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

type SeverityRank = 0 | 1 | 2;

function severityRank(severity: ValidationSeverity): SeverityRank {
  switch (severity) {
    case "hard":
      return 0;
    case "strong":
      return 1;
    case "soft":
      return 2;
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

function normalizeString(s: string | undefined | null): string {
  if (typeof s !== "string") return "";
  return s.trim();
}

function sortErrors(
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

function isNonEmptyNotes(step: Step): boolean {
  return normalizeString(step.notes).length > 0;
}

function getOrderedSteps(build: BenchTopLineBuild): Step[] {
  return [...build.steps].sort((a, b) => {
    // Deterministic, independent of input ordering.
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    if ((a.trackId ?? "") !== (b.trackId ?? "")) return (a.trackId ?? "").localeCompare(b.trackId ?? "");
    return a.id.localeCompare(b.id);
  });
}

function buildStepOrderIndexMap(build: BenchTopLineBuild): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of build.steps) map.set(s.id, s.orderIndex);
  return map;
}

// --------------------------------------------
// H-rules (H1–H25) per docs/spec/HARD-RULES.md
// --------------------------------------------

function validateH1(step: Step): ValidationError[] {
  // NOTE: parseBuild already enforces action.family is present + valid enum,
  // but we keep this validator deterministic and self-contained.
  const family = step.action?.family as unknown;
  if (!family) {
    return [
      {
        severity: "hard",
        ruleId: "H1",
        message: "H1: action.family is required",
        stepId: step.id,
        fieldPath: "action.family",
      },
    ];
  }
  if (!Object.values(ActionFamily).includes(family as ActionFamily)) {
    return [
      {
        severity: "hard",
        ruleId: "H1",
        message: `H1: invalid action.family: ${String(family)}`,
        stepId: step.id,
        fieldPath: "action.family",
      },
    ];
  }
  return [];
}

function validateH2(build: BenchTopLineBuild): ValidationError[] {
  const seenByScope = new Map<string, Set<number>>();
  const errors: ValidationError[] = [];

  for (const step of build.steps) {
    // parseBuild guarantees number, but we keep guard for defensive callers.
    if (step.orderIndex === undefined || step.orderIndex === null) {
      errors.push({
        severity: "hard",
        ruleId: "H2",
        message: `H2: step ${step.id} missing orderIndex`,
        stepId: step.id,
        fieldPath: "orderIndex",
      });
      continue;
    }

    const scopeKey = step.trackId ?? "__default__";
    if (!seenByScope.has(scopeKey)) seenByScope.set(scopeKey, new Set());
    const seen = seenByScope.get(scopeKey)!;
    if (seen.has(step.orderIndex)) {
      errors.push({
        severity: "hard",
        ruleId: "H2",
        message: `H2: duplicate orderIndex ${step.orderIndex} in scope ${scopeKey}`,
        stepId: step.id,
        fieldPath: "orderIndex",
      });
      continue;
    }
    seen.add(step.orderIndex);
  }

  return errors;
}

function validateH3(step: Step): ValidationError[] {
  if (!step.time) return [];
  const errs: ValidationError[] = [];
  if (!(step.time.durationSeconds > 0)) {
    errs.push({
      severity: "hard",
      ruleId: "H3",
      message: "H3: time.durationSeconds must be > 0",
      stepId: step.id,
      fieldPath: "time.durationSeconds",
    });
  }
  if (typeof step.time.isActive !== "boolean") {
    errs.push({
      severity: "hard",
      ruleId: "H3",
      message: "H3: time.isActive must be boolean",
      stepId: step.id,
      fieldPath: "time.isActive",
    });
  }
  return errs;
}

const CONTAINER_LIKE_RE =
  /\b(bag|bowl|pan|tray|clamshell|lid|cup|ramekin|foil|wrapper|container)\b/i;

function validateH4(step: Step): ValidationError[] {
  // Allow explicit packaging targets.
  if (step.target?.type === "packaging") return [];
  const name = normalizeString(step.target?.name);
  if (!name) return [];
  if (CONTAINER_LIKE_RE.test(name) && !step.container) {
    return [
      {
        severity: "hard",
        ruleId: "H4",
        message:
          "H4: target appears to be a container; use step.container or target.type='packaging'",
        stepId: step.id,
        fieldPath: "target.name",
      },
    ];
  }
  return [];
}

function validateH6(build: BenchTopLineBuild): ValidationError[] {
  if (build.status !== "published") return [];
  if (build.steps.length > 0) return [];
  return [
    {
      severity: "hard",
      ruleId: "H6",
      message: "H6: published build must contain at least 1 step",
      fieldPath: "steps",
    },
  ];
}

function validateH7(build: BenchTopLineBuild): ValidationError[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const step of build.steps) {
    if (seen.has(step.id)) dupes.add(step.id);
    seen.add(step.id);
  }
  if (dupes.size === 0) return [];
  return [
    {
      severity: "hard",
      ruleId: "H7",
      message: `H7: duplicate step.id values: ${[...dupes].sort().join(", ")}`,
      fieldPath: "steps[].id",
    },
  ];
}

function validateH8(build: BenchTopLineBuild): ValidationError[] {
  const ids = new Set(build.steps.map((s) => s.id));
  const errors: ValidationError[] = [];
  for (const step of build.steps) {
    for (const depId of step.dependsOn ?? []) {
      if (!ids.has(depId)) {
        errors.push({
          severity: "hard",
          ruleId: "H8",
          message: `H8: step ${step.id} dependsOn missing stepId ${depId}`,
          stepId: step.id,
          fieldPath: "dependsOn",
        });
      }
    }
  }
  return errors;
}

function canonicalizeCyclePath(nodes: string[]): string[] {
  // nodes is a cycle without the repeated closing node (e.g. [A, B, C])
  if (nodes.length === 0) return nodes;
  const min = [...nodes].sort()[0]!;
  const startIdx = nodes.indexOf(min);
  const rotated = [...nodes.slice(startIdx), ...nodes.slice(0, startIdx)];
  return rotated;
}

function validateH9(build: BenchTopLineBuild): ValidationError[] {
  const stepMap = new Map(build.steps.map((s) => [s.id, s] as const));
  const ordered = getOrderedSteps(build);

  const state = new Map<string, 0 | 1 | 2>(); // 0 = unvisited, 1 = visiting, 2 = done
  const stack: string[] = [];
  const cycleKeys = new Set<string>();
  const errors: ValidationError[] = [];

  const dfs = (id: string) => {
    const st = state.get(id) ?? 0;
    if (st === 2) return;
    if (st === 1) return; // Should only happen via back-edge detection.

    state.set(id, 1);
    stack.push(id);

    const step = stepMap.get(id);
    for (const dep of step?.dependsOn ?? []) {
      if (!stepMap.has(dep)) continue; // H8 handles missing refs.
      const depState = state.get(dep) ?? 0;
      if (depState === 0) {
        dfs(dep);
        continue;
      }
      if (depState === 1) {
        const idx = stack.indexOf(dep);
        const cycle = idx >= 0 ? stack.slice(idx) : [dep];
        const canonical = canonicalizeCyclePath(cycle);
        const key = canonical.join("->");
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          errors.push({
            severity: "hard",
            ruleId: "H9",
            message: `H9: cycle detected: ${[...canonical, canonical[0]!].join(" -> ")}`,
            stepId: canonical[0],
            fieldPath: "dependsOn",
          });
        }
      }
    }

    stack.pop();
    state.set(id, 2);
  };

  for (const step of ordered) dfs(step.id);
  return errors;
}

function validateH10(step: Step): ValidationError[] {
  if (!step.quantity) return [];
  if (step.quantity.value > 0) return [];
  return [
    {
      severity: "hard",
      ruleId: "H10",
      message: "H10: quantity.value must be > 0",
      stepId: step.id,
      fieldPath: "quantity.value",
    },
  ];
}

function validateH11(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const overlay of step.overlays ?? []) {
    if (typeof overlay.priority !== "number") {
      errors.push({
        severity: "hard",
        ruleId: "H11",
        message: "H11: overlay.priority must be a number",
        stepId: step.id,
        fieldPath: "overlays[].priority",
      });
    }
  }
  return errors;
}

function validateH12(build: BenchTopLineBuild): ValidationError[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const g of build.customizationGroups ?? []) {
    if (seen.has(g.optionId)) dupes.add(g.optionId);
    seen.add(g.optionId);
  }
  if (dupes.size === 0) return [];
  return [
    {
      severity: "hard",
      ruleId: "H12",
      message: `H12: duplicate customizationGroups.optionId: ${[...dupes].sort().join(", ")}`,
      fieldPath: "customizationGroups[].optionId",
    },
  ];
}

function validateH13(build: BenchTopLineBuild): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const o of build.validationOverrides ?? []) {
    if (!o.reason || o.reason.trim().length === 0) {
      errors.push({
        severity: "hard",
        ruleId: "H13",
        message: "H13: validationOverride.reason must be non-empty",
        fieldPath: "validationOverrides[].reason",
      });
    }
  }
  return errors;
}

function validateH14(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const overlay of step.overlays ?? []) {
    const p = overlay.predicate;
    const hasAny =
      !!p?.equipmentProfileId ||
      (Array.isArray(p?.customizationValueIds) && p.customizationValueIds.length > 0) ||
      p?.minCustomizationCount !== undefined;
    if (!hasAny) {
      errors.push({
        severity: "hard",
        ruleId: "H14",
        message: "H14: overlay.predicate must not be empty",
        stepId: step.id,
        fieldPath: "overlays[].predicate",
      });
    }
  }
  return errors;
}

function validateH15(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.HEAT) return [];
  if (step.equipment) return [];
  return [
    {
      severity: "hard",
      ruleId: "H15",
      message: "H15: HEAT step requires equipment",
      stepId: step.id,
      fieldPath: "equipment",
    },
  ];
}

function validateH16(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.VEND) return [];
  const ok = !!step.container || step.target?.type === "packaging";
  if (ok) return [];
  return [
    {
      severity: "hard",
      ruleId: "H16",
      message: "H16: VEND step requires container or packaging target",
      stepId: step.id,
      fieldPath: "container|target.type",
    },
  ];
}

function validateH17(step: Step): ValidationError[] {
  if (step.prepType !== "pre_service") return [];
  if (step.storageLocation) return [];
  return [
    {
      severity: "hard",
      ruleId: "H17",
      message: "H17: pre_service steps require storageLocation",
      stepId: step.id,
      fieldPath: "storageLocation",
    },
  ];
}

function validateH18(step: Step): ValidationError[] {
  if (step.bulkPrep !== true) return [];
  if (step.prepType === "pre_service") return [];
  return [
    {
      severity: "hard",
      ruleId: "H18",
      message: "H18: bulkPrep=true requires prepType='pre_service'",
      stepId: step.id,
      fieldPath: "bulkPrep|prepType",
    },
  ];
}

function collectValidCustomizationValueIds(build: BenchTopLineBuild): Set<string> {
  return new Set((build.customizationGroups ?? []).flatMap((g) => g.valueIds ?? []));
}

function validateH19(build: BenchTopLineBuild): ValidationError[] {
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

function validateH20(build: BenchTopLineBuild): ValidationError[] {
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

function validateH21(build: BenchTopLineBuild): ValidationError[] {
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

function validateH22(step: Step): ValidationError[] {
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

function validateH23(
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

function validateH24(step: Step): ValidationError[] {
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

function validateH25(step: Step): ValidationError[] {
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

// ----------------------------------------------------------
// Composition / flow integrity checks (schema-contract level)
// ----------------------------------------------------------

function validateRequiresBuildsIntegrity(build: BenchTopLineBuild): ValidationError[] {
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

function validateExternalBuildRefsDeclared(build: BenchTopLineBuild): ValidationError[] {
  const declared = new Set((build.requiresBuilds ?? []).map((r) => r.itemId));
  const errors: ValidationError[] = [];
  for (const step of getOrderedSteps(build)) {
    const refs = [
      ...(step.consumes ?? []).map((r) => ({ kind: "consumes" as const, r })),
      ...(step.produces ?? []).map((r) => ({ kind: "produces" as const, r })),
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

function validateInBuildArtifactRefsResolve(build: BenchTopLineBuild): ValidationError[] {
  const artifactIds = new Set((build.artifacts ?? []).map((a) => a.id));
  const hasArtifacts = (build.artifacts ?? []).length > 0;

  const errors: ValidationError[] = [];
  for (const step of getOrderedSteps(build)) {
    const refs = [
      ...(step.consumes ?? []).map((r) => ({ kind: "consumes" as const, r })),
      ...(step.produces ?? []).map((r) => ({ kind: "produces" as const, r })),
    ];
    for (const { kind, r } of refs) {
      if (r.source.type !== "in_build") continue;
      if (!hasArtifacts) {
        errors.push({
          severity: "hard",
          ruleId: "C3",
          message: `in_build artifact reference requires build.artifacts (missing artifacts; artifactId=${r.source.artifactId})`,
          stepId: step.id,
          fieldPath: `${kind}[].source.artifactId`,
        });
        continue;
      }
      if (!artifactIds.has(r.source.artifactId)) {
        errors.push({
          severity: "hard",
          ruleId: "C3",
          message: `in_build artifact reference does not resolve (artifactId=${r.source.artifactId})`,
          stepId: step.id,
          fieldPath: `${kind}[].source.artifactId`,
        });
      }
    }
  }
  return errors;
}

function validatePrimaryOutputArtifactIdWarning(
  build: BenchTopLineBuild,
): ValidationError[] {
  const artifacts = build.artifacts ?? [];
  if (artifacts.length === 0) return [];
  const ids = new Set(artifacts.map((a) => a.id));

  if (!build.primaryOutputArtifactId) {
    return [
      {
        severity: "strong",
        ruleId: "S6",
        message:
          "Primary output artifact should be set when using artifacts (primaryOutputArtifactId missing)",
        fieldPath: "primaryOutputArtifactId",
      },
    ];
  }
  if (!ids.has(build.primaryOutputArtifactId)) {
    return [
      {
        severity: "strong",
        ruleId: "S6",
        message:
          "Primary output artifact should be set when using artifacts (primaryOutputArtifactId does not resolve)",
        fieldPath: "primaryOutputArtifactId",
      },
    ];
  }
  return [];
}

// --------------------------------------------
// Public API
// --------------------------------------------

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
  hardErrors.push(...validateH2(build));
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
  }

  // Build-level customization/overlays + override hygiene.
  hardErrors.push(...validateH12(build));
  hardErrors.push(...validateH21(build));
  hardErrors.push(...validateH19(build));
  hardErrors.push(...validateH20(build));
  hardErrors.push(...validateH13(build));

  // Optional H23 (only if bom provided).
  hardErrors.push(...validateH23(build, opts.bom));

  // Composition / flow integrity.
  hardErrors.push(...validateRequiresBuildsIntegrity(build));
  hardErrors.push(...validateExternalBuildRefsDeclared(build));
  hardErrors.push(...validateInBuildArtifactRefsResolve(build));

  // Warnings (Strong) - MVP: primaryOutputArtifactId requirement is not publish-blocking.
  warnings.push(...validatePrimaryOutputArtifactIdWarning(build));

  const stepOrderIndexById = buildStepOrderIndexMap(build);
  const sortedHard = sortErrors(hardErrors, stepOrderIndexById);
  const sortedWarn = sortErrors(warnings, stepOrderIndexById);

  return {
    valid: sortedHard.length === 0,
    hardErrors: sortedHard,
    warnings: sortedWarn,
  };
}

