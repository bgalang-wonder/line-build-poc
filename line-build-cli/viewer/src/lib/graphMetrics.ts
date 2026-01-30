import type { BenchTopLineBuild, Step } from "@/types";
import { getDependencyStepId } from "@/types";
import { resolveStepDuration } from "./timeResolution";

export type BuildHealthMetrics = {
  stepCount: number;
  entryPointCount: number;
  entryPointPct: number;
  connectedComponents: number;
  totalEstimatedSeconds: number;
  criticalPathSeconds: number;
};

export type CriticalPathResult = {
  nodeIds: string[];
  edgeIds: string[]; // "stepA->stepB" format
  totalSeconds: number;
  totalSecondsExplicit: number; // only explicit times
};

export function computeCriticalPath(
  steps: Step[],
  context?: { menuItemType?: string; buildId?: string; buildName?: string }
): CriticalPathResult {
  if (steps.length === 0) {
    return { nodeIds: [], edgeIds: [], totalSeconds: 0, totalSecondsExplicit: 0 };
  }

  // 1. Resolve all step durations
  const resolved = new Map(
    steps.map((s) => [s.id, resolveStepDuration(s, context)] as const)
  );

  // 2. Topological sort
  const visited = new Set<string>();
  const stack: string[] = [];
  const stepById = new Map(steps.map((s) => [s.id, s]));

  function sort(id: string) {
    if (visited.has(id)) return;
    const step = stepById.get(id);
    if (!step) return;
    visited.add(id);
    if (step.dependsOn) {
      for (const depRef of step.dependsOn) {
        const depId = getDependencyStepId(depRef);
        if (!stepById.has(depId)) continue;
        sort(depId);
      }
    }
    stack.push(id);
  }

  for (const step of steps) {
    sort(step.id);
  }

  // 3. Forward pass: compute earliest end times
  const earliestEnd = new Map<string, number>();
  const bestPrev = new Map<string, string>();

  for (const id of stack) {
    const step = stepById.get(id);
    if (!step) continue;
    const duration = resolved.get(id)!.seconds;
    
    let maxPrevEnd = 0;
    if (step.dependsOn && step.dependsOn.length > 0) {
      for (const depRef of step.dependsOn) {
        const depId = getDependencyStepId(depRef);
        const depEnd = earliestEnd.get(depId) || 0;
        if (depEnd >= maxPrevEnd) {
          maxPrevEnd = depEnd;
          bestPrev.set(id, depId);
        }
      }
    }
    
    earliestEnd.set(id, maxPrevEnd + duration);
  }

  // 4. Backtrack from the max end time
  let maxEnd = -1;
  let endId: string | null = null;

  Array.from(earliestEnd.entries()).forEach(([id, end]) => {
    if (end > maxEnd) {
      maxEnd = end;
      endId = id;
    }
  });

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let totalExplicit = 0;

  let curr: string | null = endId;
  while (curr) {
    nodeIds.unshift(curr);
    const res = resolved.get(curr)!;
    if (res.source === "explicit") {
      totalExplicit += res.seconds;
    }
    
    const prev = bestPrev.get(curr);
    if (prev) {
      edgeIds.unshift(`${prev}->${curr}`);
    }
    curr = prev || null;
  }

  return {
    nodeIds,
    edgeIds,
    totalSeconds: maxEnd,
    totalSecondsExplicit: totalExplicit,
  };
}

export function computeBuildHealth(build: BenchTopLineBuild | null): BuildHealthMetrics {
  if (!build || build.steps.length === 0) {
    return {
      stepCount: 0,
      entryPointCount: 0,
      entryPointPct: 0,
      connectedComponents: 0,
      totalEstimatedSeconds: 0,
      criticalPathSeconds: 0,
    };
  }

  const steps = build.steps;
  const entryPoints = steps.filter((s) => (s.dependsOn ?? []).length === 0);

  // Connectivity analysis (undirected)
  const adj = new Map<string, string[]>();
  steps.forEach((s) => {
    if (!adj.has(s.id)) adj.set(s.id, []);
    (s.dependsOn ?? []).forEach((depRef) => {
      const depId = getDependencyStepId(depRef);
      if (!adj.has(depId)) adj.set(depId, []);
      adj.get(s.id)!.push(depId);
      adj.get(depId)!.push(s.id);
    });
  });

  let components = 0;
  const visited = new Set<string>();

  steps.forEach((s) => {
    if (!visited.has(s.id)) {
      components++;
      // Simple BFS
      const queue = [s.id];
      visited.add(s.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        (adj.get(curr) ?? []).forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
  });

  const totalEstimatedSeconds = steps.reduce((sum, s) => {
    return sum + resolveStepDuration(s, { buildId: build.id, buildName: build.name }).seconds;
  }, 0);

  const cp = computeCriticalPath(steps, { buildId: build.id, buildName: build.name });

  return {
    stepCount: steps.length,
    entryPointCount: entryPoints.length,
    entryPointPct: Math.round((entryPoints.length / steps.length) * 100),
    connectedComponents: components,
    totalEstimatedSeconds,
    criticalPathSeconds: cp.totalSeconds,
  };
}
