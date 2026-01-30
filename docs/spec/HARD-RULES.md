# Hard Rules (Publish-Blocking Invariants)

> **⚠️ Source of truth:** TypeScript implementation in `line-build-cli/scripts/lib/validate/`
> This document provides conceptual guidance but may lag behind implementation.
> **Scope:** These rules define what must be true for a line build to be considered **valid** (and therefore publishable, unless overridden by explicit policy).

---

## Philosophy

- **Hard or nothing**: A "warning" that users ignore is worse than no warning.
- **Hard invariants**: violations represent real data errors and should block publish.
- **Notes are an escape hatch**: when edge cases can't be structured yet, preserve truth in `notes` rather than inventing structure.

---

## Entities (Referenced by Rules)

See TypeScript schema in `line-build-cli/scripts/lib/schema/`:

- **Build**: `BenchTopLineBuild` (build.ts)
- **Step**: `Step` (step.ts)
- **Assembly**: `Assembly`, `AssemblyRef` (assembly.ts)

Rules reference these fields:

- Build: `status`, `steps`, `customizationGroups`, `validationOverrides`, `requiresBuilds`, `assemblies`, `primaryOutputAssemblyId`
- Step: `id`, `orderIndex`, `trackId`, `action.family`, `target`, `equipment`, `time`, `container`, `prepType`, `storageLocation`, `bulkPrep`, `quantity`, `conditions`, `overlays`, `dependsOn`, `input`, `output`, `workLocation`, `notes`
- **Note:** `from`/`to` removed from steps, now only on `AssemblyRef`

---

## Validation Output (Implementation Shape)

Recommended output for a validator:

```ts
export type ValidationSeverity = "hard";

export interface ValidationError {
  severity: ValidationSeverity;
  ruleId: HardRuleId;
  message: string;
  stepId?: string;
  fieldPath?: string; // e.g. "steps[3].time.durationSeconds"
}

export interface BuildValidationResult {
  valid: boolean;            // true if no hard violations OR policy permits overrides
  hardErrors: ValidationError[];
}
```

---

## Rule Summary (H1–H25)

> Note: Additional composition/flow invariants are defined in `docs/spec/INVARIANTS.md`. For MVP, we treat them as schema-contract invariants; teams can decide whether they are publish-blocking in policy.

| ID | Scope | Rule (Plain English) |
|----|-------|-----------------------|
| H1 | Step | Every step has `action.family` (valid enum) |
| H2 | Build | `orderIndex` is present and unique within its ordering scope |
| H3 | Step | If `time` exists: `durationSeconds > 0` and `isActive` is boolean |
| H4 | Step | Containers are not targets (container concepts must not live in `target.name`) |
| H5 | Step | `notes` is always allowed (escape hatch) |
| H6 | Build | Published builds must have at least 1 step |
| H7 | Build | `step.id` values are unique within a build |
| H8 | Build | `dependsOn` references must exist |
| H9 | Build | Dependencies must not create cycles (must be a DAG) |
| H10 | Step | If `quantity` exists: `quantity.value > 0` |
| H11 | Step | If overlay exists: `overlay.priority` is a number |
| H12 | Build | `customizationGroups[].optionId` unique within build |
| H13 | Build | If validation override exists: `validationOverride.reason` non-empty |
| H14 | Step | Overlay predicates must not be empty (must specify at least 1 predicate) |
| H15 | Step | If `action.family === "HEAT"` then `equipment` must exist |
| H16 | Step | If `action.family === "PACKAGING"` then container or packaging target must exist |
| H17 | Step | If `prepType === "pre_service"` then `storageLocation` must exist |
| H18 | Step | If `bulkPrep === true` then `prepType === "pre_service"` |
| H19 | Build | Step conditions must reference valid customization `valueIds` |
| H20 | Build | Overlay predicates must reference valid customization `valueIds` |
| H21 | Build | `MANDATORY_CHOICE` groups must have `minChoices` and `maxChoices` |
| H22 | Step | If `action.family === "HEAT"` then `time` OR non-empty `notes` |
| H24 | Step | If `action.family === "PORTION"` then `quantity` OR non-empty `notes` |
| H25 | Step | If `action.family === "PREP"` then `techniqueId` OR non-empty `notes` |
| H27 | Step | If `action.family === "TRANSFER"` and `action.techniqueId === "place"` then `to` must exist |
| H28 | Step | If `action.family === "TRANSFER"` and `action.techniqueId === "retrieve"` then `from` must exist |

---

## Hard Rule Definitions (Implementation-Ready)

### H1 — Every Step Has an ActionFamily

- **Scope**: Step
- **Rule**: `step.action.family` is required and must be a valid `ActionFamily` enum value.
- **Suggested fix**: Ask user “What are we doing here?” and choose the closest family.

```ts
function validateH1(step: Step): ValidationError[] {
  if (!step.action?.family) {
    return [{ severity: "hard", ruleId: "H1", message: "H1: action.family is required", stepId: step.id, fieldPath: "action.family" }];
  }
  if (!Object.values(ActionFamily).includes(step.action.family)) {
    return [{ severity: "hard", ruleId: "H1", message: `H1: invalid action.family: ${String(step.action.family)}`, stepId: step.id, fieldPath: "action.family" }];
  }
  return [];
}
```

### H2 — OrderIndex Defines Deterministic Ordering

- **Scope**: Build
- **Rule**: `step.orderIndex` must exist and be unique within its ordering scope.
- **Ordering scope**:
  - If tracks are used: unique within `(trackId)` (effectively `(buildId, trackId)`).
  - If no tracks: unique within the build.

```ts
function validateH2(build: BenchTopLineBuild): ValidationError[] {
  const seenByScope = new Map<string, Set<number>>();
  const errors: ValidationError[] = [];

  for (const step of build.steps) {
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
```

### H3 — Time Fields Are Internally Consistent

- **Scope**: Step
- **Rule**: If `step.time` exists then:
  - `durationSeconds > 0`
  - `typeof isActive === "boolean"`

```ts
function validateH3(step: Step): ValidationError[] {
  if (!step.time) return [];
  const errs: ValidationError[] = [];
  if (!(step.time.durationSeconds > 0)) {
    errs.push({ severity: "hard", ruleId: "H3", message: "H3: time.durationSeconds must be > 0", stepId: step.id, fieldPath: "time.durationSeconds" });
  }
  if (typeof step.time.isActive !== "boolean") {
    errs.push({ severity: "hard", ruleId: "H3", message: "H3: time.isActive must be boolean", stepId: step.id, fieldPath: "time.isActive" });
  }
  return errs;
}
```

### H4 — Containers Are Not Targets

- **Scope**: Step
- **Rule**: Packaging/container concepts must not be modeled as the `target`.
- **Why**: targets are “food/ingredient items”; containers belong in `step.container` or `target.type === "packaging"`.
- **Suggested fix**: Move “bag/bowl/pan/tray/etc.” into `step.container`.

Implementation note: this is intentionally heuristic (string pattern match) because legacy data frequently puts containers in the target text.

```ts
function validateH4(step: Step): ValidationError[] {
  const name = step.target?.name?.toLowerCase();
  if (!name) return [];
  const containerLike = /\b(bag|bowl|pan|tray|clamshell|lid|cup|ramekin|foil|wrapper|container)\b/;
  if (containerLike.test(name)) {
    return [{
      severity: "hard",
      ruleId: "H4",
      message: "H4: target appears to be a container; use step.container or target.type='packaging'",
      stepId: step.id,
      fieldPath: "target.name",
    }];
  }
  return [];
}
```

### H5 — Notes Escape Hatch Is Always Allowed

- **Scope**: Step
- **Rule**: `notes` may always exist, regardless of other field completeness.
- **Validation**: no validation needed (this is permissive by design).

### H6 — Published Builds Must Have Steps

- **Scope**: Build
- **Rule**: If `build.status === "published"`, then `build.steps.length > 0`.

```ts
function validateH6(build: BenchTopLineBuild): ValidationError[] {
  if (build.status !== "published") return [];
  if (build.steps.length > 0) return [];
  return [{ severity: "hard", ruleId: "H6", message: "H6: published build must contain at least 1 step", fieldPath: "steps" }];
}
```

### H7 — Step IDs Must Be Unique

- **Scope**: Build
- **Rule**: No duplicate `step.id` within a build.

```ts
function validateH7(build: BenchTopLineBuild): ValidationError[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const step of build.steps) {
    if (seen.has(step.id)) dupes.push(step.id);
    seen.add(step.id);
  }
  if (dupes.length === 0) return [];
  return [{ severity: "hard", ruleId: "H7", message: `H7: duplicate step.id values: ${dupes.join(", ")}`, fieldPath: "steps[].id" }];
}
```

### H8 — Dependency References Must Exist

- **Scope**: Build
- **Rule**: All IDs in each step’s `dependsOn` must exist in `build.steps`.

```ts
function validateH8(build: BenchTopLineBuild): ValidationError[] {
  const ids = new Set(build.steps.map(s => s.id));
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
```

### H9 — No Circular Dependencies (DAG Required)

- **Scope**: Build
- **Rule**: The dependency graph must be acyclic.

```ts
function validateH9(build: BenchTopLineBuild): ValidationError[] {
  const stepMap = new Map(build.steps.map(s => [s.id, s] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const errors: ValidationError[] = [];

  const dfs = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      errors.push({ severity: "hard", ruleId: "H9", message: `H9: cycle detected at step ${id}`, stepId: id, fieldPath: "dependsOn" });
      return;
    }
    visiting.add(id);
    const step = stepMap.get(id);
    for (const dep of step?.dependsOn ?? []) dfs(dep);
    visiting.delete(id);
    visited.add(id);
  };

  for (const step of build.steps) dfs(step.id);
  return errors;
}
```

### H10 — Quantity Values Must Be Positive

- **Scope**: Step
- **Rule**: If `step.quantity` exists, `quantity.value > 0`.

```ts
function validateH10(step: Step): ValidationError[] {
  if (!step.quantity) return [];
  if (step.quantity.value > 0) return [];
  return [{ severity: "hard", ruleId: "H10", message: "H10: quantity.value must be > 0", stepId: step.id, fieldPath: "quantity.value" }];
}
```

### H11 — Overlay Priority Is Numeric

- **Scope**: Step
- **Rule**: For each `overlay` in `step.overlays`, `typeof overlay.priority === "number"`.

```ts
function validateH11(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const overlay of step.overlays ?? []) {
    if (typeof overlay.priority !== "number") {
      errors.push({ severity: "hard", ruleId: "H11", message: "H11: overlay.priority must be a number", stepId: step.id, fieldPath: "overlays[].priority" });
    }
  }
  return errors;
}
```

### H12 — Customization Group IDs Are Unique

- **Scope**: Build
- **Rule**: `customizationGroups[].optionId` must be unique.

```ts
function validateH12(build: BenchTopLineBuild): ValidationError[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const g of build.customizationGroups ?? []) {
    if (seen.has(g.optionId)) dupes.push(g.optionId);
    seen.add(g.optionId);
  }
  if (dupes.length === 0) return [];
  return [{ severity: "hard", ruleId: "H12", message: `H12: duplicate customizationGroups.optionId: ${dupes.join(", ")}`, fieldPath: "customizationGroups[].optionId" }];
}
```

### H13 — Override Reasons Required

- **Scope**: Build
- **Rule**: For each `validationOverride`, `reason.trim().length > 0`.

```ts
function validateH13(build: BenchTopLineBuild): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const o of build.validationOverrides ?? []) {
    if (!o.reason || o.reason.trim().length === 0) {
      errors.push({ severity: "hard", ruleId: "H13", message: "H13: validationOverride.reason must be non-empty", fieldPath: "validationOverrides[].reason" });
    }
  }
  return errors;
}
```

### H14 — Overlay Predicates Not Empty

- **Scope**: Step
- **Rule**: Each overlay predicate must set at least one predicate field.

```ts
function validateH14(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const overlay of step.overlays ?? []) {
    const p = overlay.predicate;
    const hasAny =
      !!p?.equipmentProfileId ||
      (Array.isArray(p?.customizationValueIds) && p.customizationValueIds.length > 0) ||
      p?.minCustomizationCount !== undefined;
    if (!hasAny) {
      errors.push({ severity: "hard", ruleId: "H14", message: "H14: overlay.predicate must not be empty", stepId: step.id, fieldPath: "overlays[].predicate" });
    }
  }
  return errors;
}
```

### H15 — HEAT Steps Require Equipment

- **Scope**: Step
- **Rule**: If `action.family === "HEAT"`, then `equipment` exists.

```ts
function validateH15(step: Step): ValidationError[] {
  if (step.action?.family !== "HEAT") return [];
  if (step.equipment) return [];
  return [{ severity: "hard", ruleId: "H15", message: "H15: HEAT step requires equipment", stepId: step.id, fieldPath: "equipment" }];
}
```

### H16 — PACKAGING Steps Require Container or Packaging Target

- **Scope**: Step
- **Rule**: If `action.family === "PACKAGING"`, require either:
  - `step.container` exists, OR
  - `step.target?.type === "packaging"`

```ts
function validateH16(step: Step): ValidationError[] {
  if (step.action?.family !== "PACKAGING") return [];
  const ok = !!step.container || step.target?.type === "packaging";
  if (ok) return [];
  return [{ severity: "hard", ruleId: "H16", message: "H16: PACKAGING step requires container or packaging target", stepId: step.id, fieldPath: "container|target.type" }];
}
```

### H17 — Pre-Service Steps Require Storage Location

- **Scope**: Step
- **Rule**: If `prepType === "pre_service"`, then `storageLocation` exists.

```ts
function validateH17(step: Step): ValidationError[] {
  if (step.prepType !== "pre_service") return [];
  if (step.storageLocation) return [];
  return [{ severity: "hard", ruleId: "H17", message: "H17: pre_service steps require storageLocation", stepId: step.id, fieldPath: "storageLocation" }];
}
```

### H18 — Bulk Prep Requires Pre-Service Type

- **Scope**: Step
- **Rule**: If `bulkPrep === true`, then `prepType === "pre_service"`.

```ts
function validateH18(step: Step): ValidationError[] {
  if (step.bulkPrep !== true) return [];
  if (step.prepType === "pre_service") return [];
  return [{ severity: "hard", ruleId: "H18", message: "H18: bulkPrep=true requires prepType='pre_service'", stepId: step.id, fieldPath: "bulkPrep|prepType" }];
}
```

### H19 — Condition ValueIds Must Be Valid

- **Scope**: Build
- **Rule**: All `requiresCustomizationValueIds` referenced by steps must exist in `customizationGroups[].valueIds`.

```ts
function validateH19(build: BenchTopLineBuild): ValidationError[] {
  const validValueIds = new Set(
    (build.customizationGroups ?? []).flatMap(g => g.valueIds ?? [])
  );
  const errors: ValidationError[] = [];
  for (const step of build.steps) {
    for (const v of step.conditions?.requiresCustomizationValueIds ?? []) {
      if (!validValueIds.has(v)) {
        errors.push({ severity: "hard", ruleId: "H19", message: `H19: step ${step.id} references unknown customization valueId ${v}`, stepId: step.id, fieldPath: "conditions.requiresCustomizationValueIds" });
      }
    }
  }
  return errors;
}
```

### H20 — Overlay Predicate ValueIds Must Be Valid

- **Scope**: Build
- **Rule**: All overlay predicate `customizationValueIds` must exist in `customizationGroups[].valueIds`.

```ts
function validateH20(build: BenchTopLineBuild): ValidationError[] {
  const validValueIds = new Set(
    (build.customizationGroups ?? []).flatMap(g => g.valueIds ?? [])
  );
  const errors: ValidationError[] = [];
  for (const step of build.steps) {
    for (const overlay of step.overlays ?? []) {
      for (const v of overlay.predicate?.customizationValueIds ?? []) {
        if (!validValueIds.has(v)) {
          errors.push({ severity: "hard", ruleId: "H20", message: `H20: overlay ${overlay.id} references unknown customization valueId ${v}`, stepId: step.id, fieldPath: "overlays[].predicate.customizationValueIds" });
        }
      }
    }
  }
  return errors;
}
```

### H21 — MANDATORY_CHOICE Groups Require Cardinality

- **Scope**: Build
- **Rule**: If `customizationGroup.type === "MANDATORY_CHOICE"`, then `minChoices` and `maxChoices` must be set.

```ts
function validateH21(build: BenchTopLineBuild): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const g of build.customizationGroups ?? []) {
    if (g.type !== "MANDATORY_CHOICE") continue;
    if (g.minChoices == null || g.maxChoices == null) {
      errors.push({ severity: "hard", ruleId: "H21", message: `H21: MANDATORY_CHOICE group ${g.optionId} requires minChoices and maxChoices`, fieldPath: "customizationGroups[].minChoices|maxChoices" });
    }
  }
  return errors;
}
```

### H22 — HEAT Steps Require Time or Notes

- **Scope**: Step
- **Rule**: If `action.family === "HEAT"`, then either `time` exists OR `notes.trim().length > 0`.
- **Intent**: Avoid “heat something” steps with no timing guidance. Notes allow edge cases (“cook to temp”, “until golden”).

```ts
function validateH22(step: Step): ValidationError[] {
  if (step.action?.family !== "HEAT") return [];
  const hasTime = !!step.time;
  const hasNotes = typeof step.notes === "string" && step.notes.trim().length > 0;
  if (hasTime || hasNotes) return [];
  return [{ severity: "hard", ruleId: "H22", message: "H22: HEAT step requires time or non-empty notes", stepId: step.id, fieldPath: "time|notes" }];
}
```

### H24 — PORTION Steps Require Quantity or Notes

- **Scope**: Step
- **Rule**: If `action.family === "PORTION"`, then either `quantity` exists OR `notes.trim().length > 0`.
- **Intent**: Portioning without a specific amount or description is invalid.

```ts
function validateH24(step: Step): ValidationError[] {
  if (step.action?.family !== "PORTION") return [];
  const hasQty = !!step.quantity;
  const hasNotes = typeof step.notes === "string" && step.notes.trim().length > 0;
  if (hasQty || hasNotes) return [];
  return [{ severity: "hard", ruleId: "H24", message: "H24: PORTION step requires quantity or non-empty notes", stepId: step.id, fieldPath: "quantity|notes" }];
}
```

### H25 — PREP Steps Require Technique or Notes

- **Scope**: Step
- **Rule**: If `action.family === "PREP"`, then either `techniqueId` exists OR `notes.trim().length > 0`.
- **Intent**: Generic "Prep" actions should be specified with a technique (wash, cut, open) or a note.

```ts
function validateH25(step: Step): ValidationError[] {
  if (step.action?.family !== "PREP") return [];
  const hasTech = !!step.action?.techniqueId;
  const hasNotes = typeof step.notes === "string" && step.notes.trim().length > 0;
  if (hasTech || hasNotes) return [];
  return [{ severity: "hard", ruleId: "H25", message: "H25: PREP step requires techniqueId or non-empty notes", stepId: step.id, fieldPath: "action.techniqueId|notes" }];
}
```

### H27 — DEPRECATED (was TRANSFER/place Requires `to`)

- **Status**: DEPRECATED - `step.to` removed from schema
- **Replacement**: Material flow now tracked via `output[].to` on AssemblyRef
- **New behavior**: TRANSFER steps are derived from assembly flow, not authored directly (see H38)

### H28 — DEPRECATED (was TRANSFER/retrieve Requires `from`)

- **Status**: DEPRECATED - `step.from` removed from schema
- **Replacement**: Material flow now tracked via `input[].from` on AssemblyRef
- **New behavior**: TRANSFER steps are derived from assembly flow, not authored directly (see H38)

### H38 — TRANSFER Steps Are Derived-Only

- **Scope**: Step
- **Rule**: Steps with `action.family === "TRANSFER"` MUST have `derived: true` and cannot be authored.
- **Intent**: Transfer steps are automatically generated from material flow (when assembly location changes between producer and consumer). Authors should NOT create explicit TRANSFER steps.

### H39 — DEPRECATED (Steps No Longer Have from/to)

- **Status**: DEPRECATED
- **Migration**: Material flow is tracked exclusively via `input[].from` and `output[].to` on AssemblyRef.

### H40 — Assembly Refs Require Locations

- **Scope**: Step
- **Rule**: Each `input[]` entry must have `from.sublocation` specified. Each `output[]` entry must have `to.sublocation` specified.
- **Intent**: Material flow must explicitly state where materials come from and go to.

### H41 — Steps Require Explicit Material Flow

- **Scope**: Step
- **Rule**: Every step must have at least one `output[]` entry (what it produces/modifies).
- **Intent**: Steps without output have no effect on material flow and are likely incomplete.

### H42 — StationId Required When Location Ambiguous

- **Scope**: Step
- **Rule**: When `workLocation.type` is used by multiple stations OR step uses shared equipment, `stationId` must be explicit.
- **Intent**: Prevents ambiguity about where work happens when locations/equipment are shared across stations.

---

## Execution Order (Recommended)

To produce helpful error messages and avoid cascades:

1. **Identity/structure**: H6, H7
2. **Ordering**: H2
3. **DAG integrity**: H8, H9
4. **Per-step checks**: H1, H3, H10, H15, H16, H17, H18, H22, H24, H25, H4
5. **Material flow**: H38, H40, H41, H42
6. **Customization + overlays** (if present): H12, H21, H19, H20, H11, H14
7. **Override hygiene**: H13

**Deprecated rules** (removed from schema): H27, H28, H39

---

## Overrides (Policy Layer, Not a Data Invariant)

The schema supports an **audit trail** for overriding hard blocks with a reason (`build.validationOverrides[]`), but the *policy* for when overrides permit publish is product-defined.

Recommended POC policy:

- **Never allow override** for: H7 (duplicate IDs), H8 (dangling dependsOn), H9 (cycles). These break resolution.
- **Allow override with reason** for: missing timing details (H22), missing equipment (H15), missing container for PACKAGING (H16), and pre-service storage details (H17) *only if the user explicitly confirms the data is unknown/unavailable*.
- Always surface override counts as a quality signal.

---

## Non-blocking checks (Strong/Soft)

These checks are implemented in the CLI/agent workflow to make authoring smoother and errors more explainable. They are **not publish-blocking** (unless we later promote them).

**H26 (strong)** — Graph under-specified:
- If too many steps have no `dependsOn`, the build looks like a list, not an instruction.
- Output should include a preview list of “entry point” steps to review.

**S7 (soft)** — HEAT technique ↔ equipment mismatch:
- If `action.family === "HEAT"` and technique looks like an appliance (e.g., `turbo`, `fry`) but equipment differs, warn.

**S8 (soft)** — Station change without explicit TRANSFER:
- If a step depends on a prior step at a different station, warn that an explicit staged transfer (`TRANSFER/place` → `TRANSFER/retrieve`) may be needed.

**S9 (strong/soft)** — HEAT sublocation consistency:
- HEAT steps should usually set `sublocation.type = "equipment"` with matching `equipmentId`.
- Warn if missing sublocation (soft); warn strongly if sublocation conflicts with `equipment.applianceId`.

**S10 (strong)** — TRANSFER technique recommended:
- TRANSFER steps should specify `action.techniqueId` (place/retrieve/pass/handoff) or include descriptive `notes`.

**S11 (strong)** — TRANSFER endpoints shape:
- For `TRANSFER/place`, recommend `to.stationId` and/or `to.sublocation`.
- For `TRANSFER/retrieve`, recommend `from.stationId` and/or `from.sublocation`.

**S12 (strong)** — Published order-execution steps should include stationId:
- For `status === "published"` and `prepType !== "pre_service"`, recommend `stationId` is set.

**S13 (soft)** — `stationId="pass"` should be TRANSFER:
- `pass` is a handoff marker; if used with non-TRANSFER families, warn.

**S14 (soft)** — Technique suggests different family:
- If technique is strongly suggestive (e.g., `wrap`, `lid`, `pass`, `fry`) but family differs, warn.

## Appendix: POC-Only Checks (Not in H1–H22)

These checks are implemented in the current React POC (`docs/HANDOFF-REACT-APP-POC.md`) but are **not** part of the canonical invariant set yet.

### H23 (POC): BOM Coverage Required

**Rule:** All consumables and packaged goods in the menu item's BOM must be accounted for in the line build.

**Coverage states:**
- `covered` — step explicitly references this BOM item via `target.bomComponentId`
- `implicit` — step uses item implicitly (e.g., frying oil during HEAT); tracked via `_bomImplicitUsage`
- `uncovered` — no step references this BOM item

**Validation:**
```ts
function validateH23(build: BenchTopLineBuild, bom: BOMItem[]): ValidationResult {
  const coverage = computeBOMCoverage(build, bom);
  const uncovered = coverage.items.filter(i =>
    i.status === "uncovered" &&
    (i.type === "consumable" || i.type === "packaged_good")
  );
  if (uncovered.length > 0) {
    return {
      valid: false,
      error: `H23: ${uncovered.length} BOM item(s) uncovered: ${uncovered.map(i => i.name).join(", ")}`
    };
  }
  return { valid: true };
}
```

**Override policy:** Allow override with reason.
- User must provide explanation for why item is intentionally uncovered
- Creates `ValidationOverride` with `ruleId: "H23"` and non-empty `reason`
- Common valid reasons: "Used in sub-component recipe", "Implicit usage (oil, water)", "Packaged separately"

**Why this matters:**
- Every ingredient in the dish should be traceable to a step
- Uncovered items = potential missing instructions or data quality gap
- Override + reason creates audit trail for intentional exceptions

