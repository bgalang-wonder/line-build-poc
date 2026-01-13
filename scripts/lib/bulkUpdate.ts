import { ActionFamily, parseBuild, type BenchTopLineBuild, type Step } from "./schema";
import {
  coerceQueryValue,
  QUERY_FIELD_WHITELIST,
  matchesWhere,
  parseWhere,
  type QueryClause,
  type QueryField,
  type QueryPrimitive,
} from "./query";

/**
 * Bulk update engine (structured-only).
 *
 * Source of truth:
 * - docs/handoff/POC_TASKS.json -> shared_conventions.dsl_contract.patch_contract
 *
 * Notes:
 * - Default is dry-run; caller must pass --apply to persist changes.
 * - Patches apply to matched steps unless the field starts with "build."
 * - PoC: no general array ops; build.requiresBuilds.itemId is NOT patchable here.
 */

export class BulkUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkUpdateError";
  }
}

export type SetOp = { field: QueryField; value: QueryPrimitive };

export type BulkUpdateChange = {
  scope: "build" | "step";
  buildId: string;
  itemId: string;
  stepId?: string;
  orderIndex?: number;
  field: QueryField;
  from: unknown;
  to: unknown;
};

export type PlannedBuildUpdate = {
  buildId: string;
  itemId: string;
  version: number;
  status: BenchTopLineBuild["status"];
  matchedSteps: number;
  changes: BulkUpdateChange[];
  after: BenchTopLineBuild;
};

function cloneJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

const DUMMY_STEP: Step = {
  id: "__dummy__",
  orderIndex: 0,
  action: { family: ActionFamily.OTHER },
} as Step;

function getSnapshot(field: QueryField, build: BenchTopLineBuild, step: Step): unknown {
  switch (field) {
    case "build.itemId":
      return build.itemId;
    case "build.status":
      return build.status;
    case "build.name":
      return build.name;
    case "build.requiresBuilds.itemId":
      return (build.requiresBuilds ?? []).map((r) => r.itemId);

    case "step.action.family":
      return step.action.family;
    case "step.action.techniqueId":
      return step.action.techniqueId;
    case "step.equipment.applianceId":
      return step.equipment?.applianceId;
    case "step.time.durationSeconds":
      return step.time?.durationSeconds;
    case "step.time.isActive":
      return step.time?.isActive;
    case "step.cookingPhase":
      return step.cookingPhase;
    case "step.prepType":
      return step.prepType;
    case "step.storageLocation.type":
      return step.storageLocation?.type;
    case "step.container.type":
      return step.container?.type;
    case "step.container.name":
      return step.container?.name;
    case "step.container.size":
      return step.container?.size;
    case "step.stationId":
      return step.stationId;
    case "step.toolId":
      return step.toolId;
    case "step.target.bomUsageId":
      return step.target?.bomUsageId;
    case "step.target.bomComponentId":
      return step.target?.bomComponentId;
    case "step.quantity.value":
      return step.quantity?.value;
    case "step.quantity.unit":
      return step.quantity?.unit;
    case "step.notes":
      return step.notes;
    case "step.instruction":
      return step.instruction;
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function setValue(field: QueryField, build: BenchTopLineBuild, step: Step, value: QueryPrimitive): void {
  // Build scope
  if (field.startsWith("build.")) {
    if (field === "build.requiresBuilds.itemId") {
      throw new BulkUpdateError(
        "build.requiresBuilds.itemId is not patchable in PoC bulk-update (no array ops)",
      );
    }
    if (typeof value !== "string") {
      throw new BulkUpdateError(`set value for ${field} must be a string`);
    }
    if (field === "build.itemId") {
      build.itemId = value;
      return;
    }
    if (field === "build.status") {
      build.status = value as BenchTopLineBuild["status"];
      return;
    }
    if (field === "build.name") {
      build.name = value;
      return;
    }
    throw new BulkUpdateError(`unsupported build field for set: ${field}`);
  }

  // Step scope - numeric fields
  if (field === "step.time.durationSeconds") {
    if (typeof value !== "number") {
      throw new BulkUpdateError("set value for step.time.durationSeconds must be a number");
    }
    if (!step.time) {
      // PoC default: if creating time, assume waiting/not-hands-on.
      step.time = { durationSeconds: value, isActive: false };
    } else {
      step.time.durationSeconds = value;
    }
    return;
  }

  if (field === "step.quantity.value") {
    if (typeof value !== "number") {
      throw new BulkUpdateError("set value for step.quantity.value must be a number");
    }
    if (!step.quantity) {
      step.quantity = { value, unit: "" };
    } else {
      step.quantity.value = value;
    }
    return;
  }

  // Step scope - boolean fields
  if (field === "step.time.isActive") {
    if (typeof value !== "boolean") {
      throw new BulkUpdateError("set value for step.time.isActive must be a boolean");
    }
    if (!step.time) {
      // PoC default: if creating time for isActive, set duration to 0 (user should set it separately)
      step.time = { durationSeconds: 0, isActive: value };
    } else {
      step.time.isActive = value;
    }
    return;
  }

  // Step scope - string fields
  if (typeof value !== "string") {
    throw new BulkUpdateError(`set value for ${field} must be a string`);
  }

  switch (field) {
    case "step.action.family":
      step.action.family = value as Step["action"]["family"];
      return;
    case "step.action.techniqueId":
      step.action.techniqueId = value;
      return;
    case "step.equipment.applianceId":
      if (!step.equipment) step.equipment = { applianceId: value as any };
      else step.equipment.applianceId = value as any;
      return;
    case "step.cookingPhase":
      step.cookingPhase = value as Step["cookingPhase"];
      return;
    case "step.prepType":
      step.prepType = value as Step["prepType"];
      return;
    case "step.storageLocation.type":
      if (!step.storageLocation) step.storageLocation = { type: value as any } as any;
      else (step.storageLocation as any).type = value as any;
      return;
    case "step.container.type":
      if (!step.container) step.container = { type: value as any } as any;
      else (step.container as any).type = value as any;
      return;
    case "step.container.name":
      if (!step.container) step.container = { name: value };
      else step.container.name = value;
      return;
    case "step.container.size":
      if (!step.container) step.container = { size: value };
      else step.container.size = value;
      return;
    case "step.stationId":
      step.stationId = value as Step["stationId"];
      return;
    case "step.toolId":
      step.toolId = value as Step["toolId"];
      return;
    case "step.target.bomUsageId": {
      if (!step.target) step.target = { type: "bom_usage", bomUsageId: value };
      else {
        step.target.type = "bom_usage";
        step.target.bomUsageId = value;
      }
      return;
    }
    case "step.target.bomComponentId": {
      if (!step.target) step.target = { type: "bom_component", bomComponentId: value };
      else {
        step.target.type = "bom_component";
        step.target.bomComponentId = value;
      }
      return;
    }
    case "step.quantity.unit":
      if (!step.quantity) step.quantity = { value: 0, unit: value };
      else step.quantity.unit = value;
      return;
    case "step.notes":
      step.notes = value;
      return;
    case "step.instruction":
      step.instruction = value;
      return;
    default: {
      throw new BulkUpdateError(`unsupported step field for set: ${field}`);
    }
  }
}

export function parseSetOps(args: string[]): SetOp[] {
  if (args.length === 0) throw new BulkUpdateError("at least one --set is required");
  const ops: SetOp[] = [];
  for (const a of args) {
    const idx = a.indexOf("=");
    if (idx <= 0) {
      throw new BulkUpdateError(`invalid --set form (expected <field>=<value>): ${a}`);
    }
    const field = a.slice(0, idx).trim();
    const rawValue = a.slice(idx + 1).trim();
    if (field.length === 0) throw new BulkUpdateError(`invalid --set field: ${a}`);
    if (rawValue.length === 0) throw new BulkUpdateError(`invalid --set value: ${a}`);
    if (!(QUERY_FIELD_WHITELIST as readonly string[]).includes(field)) {
      throw new BulkUpdateError(`field not allowed in --set: ${field} (must be in whitelist)`);
    }
    ops.push({ field: field as QueryField, value: coerceQueryValue(rawValue) });
  }
  return ops;
}

export function planBulkUpdate(input: {
  builds: BenchTopLineBuild[];
  where: string;
  sets: SetOp[];
}): { clauses: QueryClause[]; planned: PlannedBuildUpdate[] } {
  const clauses = parseWhere(input.where);

  const planned: PlannedBuildUpdate[] = [];

  for (const build of input.builds) {
    const matchedSteps = build.steps.filter((s) => matchesWhere(clauses, build, s));
    if (matchedSteps.length === 0) continue;

    const after = cloneJson(build);

    // Apply build-level sets once per build.
    const buildSets = input.sets.filter((s) => s.field.startsWith("build."));
    const stepSets = input.sets.filter((s) => s.field.startsWith("step."));

    const changes: BulkUpdateChange[] = [];

    // Build-level changes
    for (const s of buildSets) {
      const beforeSnap = getSnapshot(
        s.field,
        build,
        build.steps[0] ?? DUMMY_STEP,
      );
      setValue(
        s.field,
        after,
        after.steps[0] ?? DUMMY_STEP,
        s.value,
      );
      const afterSnap = getSnapshot(
        s.field,
        after,
        after.steps[0] ?? DUMMY_STEP,
      );
      if (JSON.stringify(beforeSnap) !== JSON.stringify(afterSnap)) {
        changes.push({
          scope: "build",
          buildId: build.id,
          itemId: build.itemId,
          field: s.field,
          from: beforeSnap,
          to: afterSnap,
        });
      }
    }

    // Step-level changes (only for matched steps)
    const afterStepsById = new Map(after.steps.map((s) => [s.id, s] as const));
    for (const step of matchedSteps) {
      const afterStep = afterStepsById.get(step.id);
      if (!afterStep) continue;

      for (const s of stepSets) {
        const beforeSnap = getSnapshot(s.field, build, step);
        setValue(s.field, after, afterStep, s.value);
        const afterSnap = getSnapshot(s.field, after, afterStep);
        if (JSON.stringify(beforeSnap) !== JSON.stringify(afterSnap)) {
          changes.push({
            scope: "step",
            buildId: build.id,
            itemId: build.itemId,
            stepId: step.id,
            orderIndex: step.orderIndex,
            field: s.field,
            from: beforeSnap,
            to: afterSnap,
          });
        }
      }
    }

    // Ensure output still conforms to canonical schema (runtime).
    const parsed = parseBuild(after as unknown);

    // Deterministic ordering.
    changes.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
      const ao = a.orderIndex ?? Number.NEGATIVE_INFINITY;
      const bo = b.orderIndex ?? Number.NEGATIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const as = a.stepId ?? "";
      const bs = b.stepId ?? "";
      if (as !== bs) return as.localeCompare(bs);
      if (a.field !== b.field) return a.field.localeCompare(b.field);
      return JSON.stringify(a.from).localeCompare(JSON.stringify(b.from));
    });

    planned.push({
      buildId: parsed.id,
      itemId: parsed.itemId,
      version: parsed.version,
      status: parsed.status,
      matchedSteps: matchedSteps.length,
      changes,
      after: parsed,
    });
  }

  planned.sort((a, b) => {
    if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
    if (a.version !== b.version) return a.version - b.version;
    return a.buildId.localeCompare(b.buildId);
  });

  return { clauses, planned };
}

