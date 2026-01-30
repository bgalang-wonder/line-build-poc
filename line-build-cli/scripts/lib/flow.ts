import { BenchTopLineBuild, StepId, AssemblyId, BomEntryId } from "./schema";

/**
 * Derives dependencies between steps based on material flow.
 * If Step B inputs an assembly that Step A outputs, then B depends on A.
 */
export function deriveDependencies(build: BenchTopLineBuild): Array<[StepId, StepId]> {
  const assemblyProducers = new Map<AssemblyId, StepId>();
  const dependencies: Array<[StepId, StepId]> = [];

  // Track which step produces which assembly
  for (const step of build.steps) {
    for (const output of step.output) {
      if (output.source.type === "in_build") {
        assemblyProducers.set(output.source.assemblyId, step.id);
      }
    }
  }

  // Find steps that consume those assemblies
  for (const step of build.steps) {
    for (const input of step.input) {
      if (input.source.type === "in_build") {
        const producerId = assemblyProducers.get(input.source.assemblyId);
        if (producerId && producerId !== step.id) {
          dependencies.push([producerId, step.id]);
        }
      }
    }
  }

  return dependencies;
}

/**
 * Computes the full list of BOM components contained in each assembly version.
 * This traces material flow through the DAG.
 */
export function computeAssemblyComponents(
  build: BenchTopLineBuild
): Map<AssemblyId, BomEntryId[]> {
  const assemblyBomEntries = new Map<AssemblyId, Set<BomEntryId>>();

  // 1. Initialize from build.assemblies metadata (if provided)
  if (build.assemblies) {
    for (const assembly of build.assemblies) {
      if (assembly.subAssemblies) {
        assemblyBomEntries.set(assembly.id, new Set(assembly.subAssemblies));
      }
      // If it's directly linked to a BOM entry
      if (assembly.bomUsageId) {
        const set = assemblyBomEntries.get(assembly.id) || new Set();
        set.add(assembly.bomUsageId);
        assemblyBomEntries.set(assembly.id, set);
      }
    }
  }

  // 2. Trace through steps to accumulate BOM entries
  // We assume steps are roughly in order for this simple trace
  for (const step of build.steps) {
    const inputEntries = new Set<BomEntryId>();

    for (const input of step.input) {
      if (input.source.type === "in_build") {
        const entries = assemblyBomEntries.get(input.source.assemblyId);
        if (entries) {
          entries.forEach(c => inputEntries.add(c));
        }
      }
    }

    // Apply accumulated BOM entries to all outputs of this step
    for (const output of step.output) {
      if (output.source.type === "in_build") {
        const existing = assemblyBomEntries.get(output.source.assemblyId) || new Set();
        inputEntries.forEach(c => existing.add(c));
        assemblyBomEntries.set(output.source.assemblyId, existing);
      }
    }
  }

  // Convert Sets to Arrays for the final map
  const result = new Map<AssemblyId, BomEntryId[]>();
  assemblyBomEntries.forEach((entries, id) => {
    result.set(id, Array.from(entries));
  });

  return result;
}

/**
 * Resolves the latest assembly ID for a given groupId by looking at
 * which version appears furthest along in the step sequence.
 */
export function resolveLatestInGroup(
  build: BenchTopLineBuild,
  groupId: string
): AssemblyId | undefined {
  if (!build.assemblies) return undefined;

  const groupAssemblies = build.assemblies.filter(a => a.groupId === groupId);
  if (groupAssemblies.length === 0) return undefined;
  if (groupAssemblies.length === 1) return groupAssemblies[0].id;

  // Find which of these is an output of the latest step
  const groupIds = new Set(groupAssemblies.map(a => a.id));
  let latestId: AssemblyId | undefined = groupAssemblies[0].id;
  let latestStepIndex = -1;

  build.steps.forEach((step, index) => {
    for (const output of step.output) {
      if (output.source.type === "in_build" && groupIds.has(output.source.assemblyId)) {
        latestId = output.source.assemblyId;
        latestStepIndex = index;
      }
    }
  });

  return latestId;
}
