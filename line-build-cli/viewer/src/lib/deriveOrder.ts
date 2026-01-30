import type { BenchTopLineBuild, Step } from "@/types";
import { getDependencyStepId } from "@/types";

type StepMap = Map<string, Step>;

function compareSteps(a: Step, b: Step): number {
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
  return a.id.localeCompare(b.id);
}

function buildDependencyGraph(steps: Step[]): {
  stepById: StepMap;
  indegree: Map<string, number>;
  dependents: Map<string, string[]>;
} {
  const stepById: StepMap = new Map();
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const step of steps) {
    stepById.set(step.id, step);
    indegree.set(step.id, 0);
    dependents.set(step.id, []);
  }

  for (const step of steps) {
    for (const depRef of step.dependsOn ?? []) {
      const depId = getDependencyStepId(depRef);
      if (!stepById.has(depId)) continue;
      indegree.set(step.id, (indegree.get(step.id) ?? 0) + 1);
      dependents.get(depId)!.push(step.id);
    }
  }

  return { stepById, indegree, dependents };
}

function deriveTopologicalOrder(steps: Step[]): Step[] {
  const { stepById, indegree, dependents } = buildDependencyGraph(steps);

  const queue: Step[] = [];
  for (const step of steps) {
    if ((indegree.get(step.id) ?? 0) === 0) queue.push(step);
  }
  queue.sort(compareSteps);

  const ordered: Step[] = [];
  const enqueueSorted = (step: Step) => {
    const idx = queue.findIndex((s) => compareSteps(step, s) < 0);
    if (idx === -1) queue.push(step);
    else queue.splice(idx, 0, step);
  };

  while (queue.length > 0) {
    const next = queue.shift()!;
    ordered.push(next);
    for (const childId of dependents.get(next.id) ?? []) {
      const nextIn = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, nextIn);
      if (nextIn === 0) {
        const child = stepById.get(childId);
        if (child) enqueueSorted(child);
      }
    }
  }

  if (ordered.length < steps.length) {
    const remaining = steps
      .filter((s) => !ordered.find((o) => o.id === s.id))
      .sort(compareSteps);
    ordered.push(...remaining);
  }

  return ordered;
}

export function deriveOrderIndexMap(steps: Step[]): Map<string, number> {
  const ordered = deriveTopologicalOrder(steps);
  const counters = new Map<string, number>();
  const derived = new Map<string, number>();

  for (const step of ordered) {
    const track = step.trackId ?? "default";
    const next = counters.get(track) ?? 0;
    derived.set(step.id, next);
    counters.set(track, next + 1);
  }

  return derived;
}

export function applyDerivedOrderIndex(build: BenchTopLineBuild): BenchTopLineBuild {
  const derived = deriveOrderIndexMap(build.steps);
  return {
    ...build,
    steps: build.steps.map((step) => ({
      ...step,
      orderIndex: derived.get(step.id) ?? step.orderIndex,
    })),
  };
}
