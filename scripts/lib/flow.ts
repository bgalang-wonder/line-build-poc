import { BenchTopLineBuild, StepId, ArtifactId, BomEntryId } from "./schema";

/**
 * Derives dependencies between steps based on material flow.
 * If Step B inputs an artifact that Step A outputs, then B depends on A.
 */
export function deriveDependencies(build: BenchTopLineBuild): Array<[StepId, StepId]> {
  const artifactProducers = new Map<ArtifactId, StepId>();
  const dependencies: Array<[StepId, StepId]> = [];

  // Track which step produces which artifact
  for (const step of build.steps) {
    for (const output of step.output) {
      if (output.source.type === "in_build") {
        artifactProducers.set(output.source.artifactId, step.id);
      }
    }
  }

  // Find steps that consume those artifacts
  for (const step of build.steps) {
    for (const input of step.input) {
      if (input.source.type === "in_build") {
        const producerId = artifactProducers.get(input.source.artifactId);
        if (producerId && producerId !== step.id) {
          dependencies.push([producerId, step.id]);
        }
      }
    }
  }

  return dependencies;
}

/**
 * Computes the full list of BOM components contained in each artifact version.
 * This traces material flow through the DAG.
 */
export function computeAssemblyComponents(
  build: BenchTopLineBuild
): Map<ArtifactId, BomEntryId[]> {
  const artifactComponents = new Map<ArtifactId, Set<BomEntryId>>();
  
  // 1. Initialize from build.artifacts metadata (if provided)
  if (build.artifacts) {
    for (const artifact of build.artifacts) {
      if (artifact.components) {
        artifactComponents.set(artifact.id, new Set(artifact.components));
      }
      // If it's directly linked to a BOM entry
      if (artifact.bomUsageId) {
        const set = artifactComponents.get(artifact.id) || new Set();
        set.add(artifact.bomUsageId);
        artifactComponents.set(artifact.id, set);
      }
    }
  }

  // 2. Trace through steps to accumulate components
  // We assume steps are roughly in order for this simple trace
  for (const step of build.steps) {
    const inputComponents = new Set<BomEntryId>();
    
    for (const input of step.input) {
      if (input.source.type === "in_build") {
        const components = artifactComponents.get(input.source.artifactId);
        if (components) {
          components.forEach(c => inputComponents.add(c));
        }
      }
    }

    // Apply accumulated components to all outputs of this step
    for (const output of step.output) {
      if (output.source.type === "in_build") {
        const existing = artifactComponents.get(output.source.artifactId) || new Set();
        inputComponents.forEach(c => existing.add(c));
        artifactComponents.set(output.source.artifactId, existing);
      }
    }
  }

  // Convert Sets to Arrays for the final map
  const result = new Map<ArtifactId, BomEntryId[]>();
  artifactComponents.forEach((components, id) => {
    result.set(id, Array.from(components));
  });

  return result;
}

/**
 * Resolves the latest artifact ID for a given groupId by looking at 
 * which version appears furthest along in the step sequence.
 */
export function resolveLatestInGroup(
  build: BenchTopLineBuild,
  groupId: string
): ArtifactId | undefined {
  if (!build.artifacts) return undefined;

  const groupArtifacts = build.artifacts.filter(a => a.groupId === groupId);
  if (groupArtifacts.length === 0) return undefined;
  if (groupArtifacts.length === 1) return groupArtifacts[0].id;

  // Find which of these is an output of the latest step
  const groupIds = new Set(groupArtifacts.map(a => a.id));
  let latestId: ArtifactId | undefined = groupArtifacts[0].id;
  let latestStepIndex = -1;

  build.steps.forEach((step, index) => {
    for (const output of step.output) {
      if (output.source.type === "in_build" && groupIds.has(output.source.artifactId)) {
        latestId = output.source.artifactId;
        latestStepIndex = index;
      }
    }
  });

  return latestId;
}
