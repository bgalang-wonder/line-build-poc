import {
  ActionFamily,
  type BenchTopLineBuild,
  type Step,
  getDependencyStepId,
} from "../schema";
import {
  type ValidationError,
  type ValidateBuildOptions,
  normalizeString,
  isNonEmptyNotes,
  getOrderedSteps,
  canonicalizeCyclePath,
  CONTAINER_DETECTION_REGEX,
} from "./helpers";

/**
 * Core hard validation rules (H1-H18).
 * These are blocking errors that prevent publication.
 */

// -----------------------------
// H1: Action Family Required
// -----------------------------

export function validateH1(step: Step): ValidationError[] {
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

// -----------------------------
// H2: Unique OrderIndex per Track
// -----------------------------

export function validateH2(build: BenchTopLineBuild): ValidationError[] {
  const seenByScope = new Map<string, Set<number>>();
  const errors: ValidationError[] = [];

  for (const step of build.steps) {
    // parseBuild guarantees number, but we keep guard for defensive callers.
    if (step.orderIndex === undefined || step.orderIndex === null) {
      errors.push({
        severity: "soft",
        ruleId: "H2",
        message: `H2: step ${step.id} missing orderIndex (orderIndex is derived for UX; set only if needed)`,
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
        severity: "soft",
        ruleId: "H2",
        message: `H2: duplicate orderIndex ${step.orderIndex} in scope ${scopeKey} (orderIndex is derived for UX; adjust only if needed)`,
        stepId: step.id,
        fieldPath: "orderIndex",
      });
      continue;
    }
    seen.add(step.orderIndex);
  }

  return errors;
}

// -----------------------------
// H3: Time Field Validity
// -----------------------------

export function validateH3(step: Step): ValidationError[] {
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

// -----------------------------
// H4: Container in Target Name
// -----------------------------

export function validateH4(step: Step): ValidationError[] {
  // Allow explicit packaging targets.
  if (step.target?.type === "packaging") return [];
  const name = normalizeString(step.target?.name);
  if (!name) return [];
  if (CONTAINER_DETECTION_REGEX.test(name) && !step.container) {
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

// -----------------------------
// H6: Published Build Must Have Steps
// -----------------------------

export function validateH6(build: BenchTopLineBuild): ValidationError[] {
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

// -----------------------------
// H7: Unique Step IDs
// -----------------------------

export function validateH7(build: BenchTopLineBuild): ValidationError[] {
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

// -----------------------------
// H8: Dependencies Must Exist
// -----------------------------

export function validateH8(build: BenchTopLineBuild): ValidationError[] {
  const ids = new Set(build.steps.map((s) => s.id));
  const errors: ValidationError[] = [];
  for (const step of build.steps) {
    for (const depRef of step.dependsOn ?? []) {
      const depId = getDependencyStepId(depRef);
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

// -----------------------------
// H9: No Dependency Cycles
// -----------------------------

export function validateH9(build: BenchTopLineBuild): ValidationError[] {
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
    for (const depRef of step?.dependsOn ?? []) {
      const dep = getDependencyStepId(depRef);
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

// -----------------------------
// H10: Quantity Value Must Be Positive
// -----------------------------

export function validateH10(step: Step): ValidationError[] {
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

// -----------------------------
// H11: Overlay Priority Required
// -----------------------------

export function validateH11(step: Step): ValidationError[] {
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

// -----------------------------
// H12: Unique Customization Option IDs
// -----------------------------

export function validateH12(build: BenchTopLineBuild): ValidationError[] {
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

// -----------------------------
// H13: Validation Override Reason Required
// -----------------------------

export function validateH13(build: BenchTopLineBuild): ValidationError[] {
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

// -----------------------------
// H14: Overlay Predicate Must Not Be Empty
// -----------------------------

export function validateH14(step: Step): ValidationError[] {
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

// -----------------------------
// H15: HEAT Requires Equipment
// -----------------------------

export function validateH15(step: Step): ValidationError[] {
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

// -----------------------------
// H16: PACKAGING Requires Container
// -----------------------------

export function validateH16(step: Step): ValidationError[] {
  if (step.action?.family !== ActionFamily.PACKAGING) return [];
  const ok = !!step.container || step.target?.type === "packaging";
  if (ok) return [];
  return [
    {
      severity: "hard",
      ruleId: "H16",
      message: "H16: PACKAGING step requires container or packaging target",
      stepId: step.id,
      fieldPath: "container|target.type",
    },
  ];
}

// -----------------------------
// H17: Pre-Service Requires Storage Location
// -----------------------------

export function validateH17(step: Step): ValidationError[] {
  if (step.prepType !== "pre_service") return [];
  // pre_service steps should specify where the output goes via output[].to.sublocation
  // UPDATED: step.to no longer exists, check output[].to instead
  const hasDestination = step.output?.[0]?.to?.sublocation?.type;
  if (hasDestination) return [];
  return [
    {
      severity: "hard",
      ruleId: "H17",
      message: "H17: pre_service steps require output[].to.sublocation (where the prepped item is stored)",
      stepId: step.id,
      fieldPath: "output[0].to.sublocation",
    },
  ];
}

// -----------------------------
// H18: Bulk Prep Requires Pre-Service
// -----------------------------

export function validateH18(step: Step): ValidationError[] {
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
