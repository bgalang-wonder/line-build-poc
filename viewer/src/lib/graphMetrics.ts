import type { BenchTopLineBuild, Step } from "@/types";

export type BuildHealthMetrics = {
  stepCount: number;
  entryPointCount: number;
  entryPointPct: number;
  connectedComponents: number;
};

export function computeBuildHealth(build: BenchTopLineBuild | null): BuildHealthMetrics {
  if (!build || build.steps.length === 0) {
    return {
      stepCount: 0,
      entryPointCount: 0,
      entryPointPct: 0,
      connectedComponents: 0,
    };
  }

  const steps = build.steps;
  const entryPoints = steps.filter((s) => (s.dependsOn ?? []).length === 0);

  // Connectivity analysis (undirected)
  const adj = new Map<string, string[]>();
  steps.forEach((s) => {
    if (!adj.has(s.id)) adj.set(s.id, []);
    (s.dependsOn ?? []).forEach((depId) => {
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

  return {
    stepCount: steps.length,
    entryPointCount: entryPoints.length,
    entryPointPct: Math.round((entryPoints.length / steps.length) * 100),
    connectedComponents: components,
  };
}
