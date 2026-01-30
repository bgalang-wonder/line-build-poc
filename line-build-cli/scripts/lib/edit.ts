import { type BenchTopLineBuild, type Step, parseBuild, ActionFamily, CookingPhase } from "./schema";
import { matchesWhere, parseWhere, QUERY_FIELD_WHITELIST, type QueryField, type QueryPrimitive, coerceQueryValue } from "./query";

/**
 * Atomic mutation engine for BenchTopLineBuilds.
 * Supports field-level and structural edits.
 */

export type EditOp =
  | { type: "set_field"; where?: string; field: string; value: string | number | boolean }
  | { type: "add_step"; step: Partial<Step>; afterStepId?: string; atIndex?: number }
  | { type: "remove_step"; stepId: string }
  | { type: "move_step"; stepId: string; toOrderIndex: number }
  | { type: "add_dep"; stepId: string; dependsOn: string }
  | { type: "remove_dep"; stepId: string; dependsOn: string }
  | { type: "set_build_field"; field: string; value: string | number | boolean }
  | { type: "normalize_indices" };

export class EditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditError";
  }
}

function cloneJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function applyOps(build: BenchTopLineBuild, ops: EditOp[]): BenchTopLineBuild {
  let current = cloneJson(build);

  for (const op of ops) {
    switch (op.type) {
      case "set_field":
        current = applySetField(current, op);
        break;
      case "add_step":
        current = applyAddStep(current, op);
        break;
      case "remove_step":
        current = applyRemoveStep(current, op);
        break;
      case "move_step":
        current = applyMoveStep(current, op);
        break;
      case "add_dep":
        current = applyAddDep(current, op);
        break;
      case "remove_dep":
        current = applyRemoveDep(current, op);
        break;
      case "set_build_field":
        current = applySetBuildField(current, op);
        break;
      case "normalize_indices":
        current = applyNormalizeIndices(current);
        break;
      default:
        // @ts-ignore
        throw new EditError(`Unknown op type: ${op.type}`);
    }
  }

  // Final schema validation
  return parseBuild(current);
}

function applySetField(build: BenchTopLineBuild, op: { where?: string; field: string; value: any }): BenchTopLineBuild {
  const clauses = op.where ? parseWhere(op.where) : [];
  const field = op.field as QueryField;
  
  if (!(QUERY_FIELD_WHITELIST as readonly string[]).includes(field)) {
    throw new EditError(`Field not allowed in set_field: ${field}`);
  }

  for (const step of build.steps) {
    if (matchesWhere(clauses, build, step)) {
      setStepField(step, field, op.value);
    }
  }
  return build;
}

function setStepField(step: Step, field: string, value: any) {
  // Simplified field setting logic from old bulkUpdate.ts
  if (field === "step.time.durationSeconds") {
    if (!step.time) step.time = { durationSeconds: value, isActive: false };
    else step.time.durationSeconds = value;
  } else if (field === "step.time.isActive") {
    if (!step.time) step.time = { durationSeconds: 0, isActive: value };
    else step.time.isActive = value;
  } else if (field === "step.quantity.value") {
    if (!step.quantity) step.quantity = { value, unit: "" };
    else step.quantity.value = value;
  } else if (field === "step.action.family") {
    step.action.family = value;
  } else if (field === "step.action.techniqueId") {
    step.action.techniqueId = value;
  } else if (field === "step.stationId") {
    step.stationId = value;
  } else if (field === "step.toolId") {
    step.toolId = value;
  } else if (field === "step.notes") {
    step.notes = value;
  } else if (field === "step.instruction") {
    step.instruction = value;
  } else if (field === "step.cookingPhase") {
    step.cookingPhase = value;
  } else if (field === "step.workLocation.type") {
    if (!step.workLocation) step.workLocation = { type: value };
    else step.workLocation.type = value;
  } else if (field === "step.workLocation.equipmentId") {
    if (!step.workLocation) step.workLocation = { type: "equipment", equipmentId: value };
    else step.workLocation.equipmentId = value;
  } else if (field === "step.from.stationId") {
    if (!step.from) step.from = { stationId: value };
    else step.from.stationId = value;
  } else if (field === "step.from.sublocation.type") {
    if (!step.from) step.from = { sublocation: { type: value } } as any;
    else {
      if (!step.from.sublocation) step.from.sublocation = { type: value } as any;
      else step.from.sublocation.type = value;
    }
  } else if (field === "step.from.sublocation.equipmentId") {
    if (!step.from) step.from = { sublocation: { type: "equipment", equipmentId: value } } as any;
    else {
      if (!step.from.sublocation) step.from.sublocation = { type: "equipment", equipmentId: value } as any;
      else step.from.sublocation.equipmentId = value;
    }
  } else if (field === "step.to.stationId") {
    if (!step.to) step.to = { stationId: value };
    else step.to.stationId = value;
  } else if (field === "step.to.sublocation.type") {
    if (!step.to) step.to = { sublocation: { type: value } } as any;
    else {
      if (!step.to.sublocation) step.to.sublocation = { type: value } as any;
      else step.to.sublocation.type = value;
    }
  } else if (field === "step.to.sublocation.equipmentId") {
    if (!step.to) step.to = { sublocation: { type: "equipment", equipmentId: value } } as any;
    else {
      if (!step.to.sublocation) step.to.sublocation = { type: "equipment", equipmentId: value } as any;
      else step.to.sublocation.equipmentId = value;
    }
  } else if (field.startsWith("step.equipment.")) {
    if (!step.equipment) step.equipment = { applianceId: value };
    else step.equipment.applianceId = value;
  } else if (field.startsWith("step.container.")) {
    const sub = field.split(".")[2];
    if (!step.container) step.container = {} as any;
    (step.container as any)[sub!] = value;
  } else if (field.startsWith("step.storageLocation.")) {
    if (!step.storageLocation) step.storageLocation = { type: value };
    else step.storageLocation.type = value;
  } else if (field.startsWith("step.target.")) {
    const sub = field.split(".")[2];
    if (!step.target) step.target = { type: sub === "bomUsageId" ? "bom_usage" : "bom_component" } as any;
    (step.target as any)[sub!] = value;
  } else if (field === "step.quantity.unit") {
    if (!step.quantity) step.quantity = { value: 0, unit: value };
    else step.quantity.unit = value;
  } else {
    throw new EditError(`Unsupported field for set_field: ${field}`);
  }
}

function applySetBuildField(build: BenchTopLineBuild, op: { field: string; value: any }): BenchTopLineBuild {
  const field = op.field;
  if (field === "build.name") build.name = op.value;
  else if (field === "build.status") build.status = op.value;
  else if (field === "build.itemId") build.itemId = op.value;
  else throw new EditError(`Unsupported build field: ${field}`);
  return build;
}

function applyAddStep(build: BenchTopLineBuild, op: { step: Partial<Step>; afterStepId?: string; atIndex?: number }): BenchTopLineBuild {
  const newStep = {
    id: op.step.id || `step-${Date.now()}`,
    orderIndex: op.step.orderIndex ?? 0,
    action: op.step.action || { family: ActionFamily.OTHER },
    ...op.step
  } as Step;

  if (op.afterStepId) {
    const idx = build.steps.findIndex(s => s.id === op.afterStepId);
    if (idx === -1) throw new EditError(`Step not found: ${op.afterStepId}`);
    newStep.orderIndex = build.steps[idx]!.orderIndex + 1;
    // Shift others
    build.steps.forEach(s => {
      if (s.orderIndex >= newStep.orderIndex) s.orderIndex++;
    });
    build.steps.splice(idx + 1, 0, newStep);
  } else if (op.atIndex !== undefined) {
    build.steps.splice(op.atIndex, 0, newStep);
  } else {
    build.steps.push(newStep);
  }
  return build;
}

function applyRemoveStep(build: BenchTopLineBuild, op: { stepId: string }): BenchTopLineBuild {
  const idx = build.steps.findIndex(s => s.id === op.stepId);
  if (idx === -1) throw new EditError(`Step not found: ${op.stepId}`);
  
  build.steps.splice(idx, 1);
  
  // Clean up dependencies
  for (const s of build.steps) {
    if (s.dependsOn) {
      s.dependsOn = s.dependsOn.filter(d => d !== op.stepId);
      if (s.dependsOn.length === 0) delete s.dependsOn;
    }
  }
  return build;
}

function applyMoveStep(build: BenchTopLineBuild, op: { stepId: string; toOrderIndex: number }): BenchTopLineBuild {
  const step = build.steps.find(s => s.id === op.stepId);
  if (!step) throw new EditError(`Step not found: ${op.stepId}`);
  
  const oldIdx = step.orderIndex;
  step.orderIndex = op.toOrderIndex;
  
  // No automatic renumbering here, just set the field.
  // Use normalize_indices if clean sequence is needed.
  return build;
}

function applyAddDep(build: BenchTopLineBuild, op: { stepId: string; dependsOn: string }): BenchTopLineBuild {
  const step = build.steps.find(s => s.id === op.stepId);
  if (!step) throw new EditError(`Step not found: ${op.stepId}`);
  
  if (!step.dependsOn) step.dependsOn = [];
  if (!step.dependsOn.includes(op.dependsOn)) {
    step.dependsOn.push(op.dependsOn);
  }
  return build;
}

function applyRemoveDep(build: BenchTopLineBuild, op: { stepId: string; dependsOn: string }): BenchTopLineBuild {
  const step = build.steps.find(s => s.id === op.stepId);
  if (!step) return build;
  
  if (step.dependsOn) {
    step.dependsOn = step.dependsOn.filter(d => d !== op.dependsOn);
    if (step.dependsOn.length === 0) delete step.dependsOn;
  }
  return build;
}

function applyNormalizeIndices(build: BenchTopLineBuild): BenchTopLineBuild {
  // Sort by track then current orderIndex then id
  build.steps.sort((a, b) => {
    const aTrack = a.trackId || "";
    const bTrack = b.trackId || "";
    if (aTrack !== bTrack) return aTrack.localeCompare(bTrack);
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.id.localeCompare(b.id);
  });

  // Renumber within tracks
  const tracks = new Map<string, number>();
  for (const s of build.steps) {
    const track = s.trackId || "";
    const next = tracks.get(track) || 0;
    s.orderIndex = next;
    tracks.set(track, next + 1);
  }

  return build;
}
