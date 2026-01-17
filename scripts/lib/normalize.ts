import { BenchTopLineBuild, Artifact, ArtifactId, type ArtifactRef } from "./schema";
import { deriveDependencies } from "./flow";

/**
 * Normalizes a line build by filling defaults, auto-creating missing artifacts,
 * and merging derived dependencies.
 * 
 * This implements the "normalize-on-write" strategy.
 */
export function normalizeBuild(build: BenchTopLineBuild): BenchTopLineBuild {
  // Clone to avoid mutation if needed, though Zod parse already produces a fresh object
  const normalized = { ...build };

  // 1. Ensure steps have input/output arrays (already defaulted by Zod, but safe for manual calls)
  normalized.steps = normalized.steps.map(step => ({
    ...step,
    input: step.input || [],
    output: step.output || [],
    dependsOn: step.dependsOn || []
  }));

  // 2. Auto-create artifact stubs for any referenced in_build artifacts
  const existingArtifactIds = new Set(normalized.artifacts?.map(a => a.id) || []);
  const referencedArtifactIds = new Set<ArtifactId>();

  for (const step of normalized.steps) {
    for (const input of step.input) {
      if (input.source.type === "in_build") {
        referencedArtifactIds.add(input.source.artifactId);
      }
    }
    for (const output of step.output) {
      if (output.source.type === "in_build") {
        referencedArtifactIds.add(output.source.artifactId);
      }
    }
  }

  const artifacts = [...(normalized.artifacts || [])];
  let artifactsChanged = false;
  const artifactById = new Map<string, Artifact>();

  for (const artifact of artifacts) {
    artifactById.set(artifact.id, artifact);
  }

  const ensureArtifact = (artifactId: ArtifactId): Artifact => {
    const existing = artifactById.get(artifactId);
    if (existing) return existing;
    const created: Artifact = {
      id: artifactId,
      name: artifactId,
      type: "intermediate",
    };
    artifacts.push(created);
    artifactById.set(artifactId, created);
    artifactsChanged = true;
    return created;
  };

  for (const artifactId of referencedArtifactIds) {
    if (!existingArtifactIds.has(artifactId)) {
      ensureArtifact(artifactId);
    }
  }

  if (artifactsChanged) {
    normalized.artifacts = artifacts;
  }

  // 2b. Normalize material flow roles + lineage
  const isInBuildRef = (
    ref: ArtifactRef,
  ): ref is ArtifactRef & { source: { type: "in_build"; artifactId: ArtifactId } } =>
    ref.source.type === "in_build";

  for (const step of normalized.steps) {
    const inputRefs = step.input.filter(isInBuildRef);
    const outputRefs = step.output.filter(isInBuildRef);

    if (inputRefs.length === 0 || outputRefs.length === 0) continue;

    // 1:1 evolution -> set lineage + base role
    if (inputRefs.length === 1 && outputRefs.length === 1) {
      const inputId = inputRefs[0].source.artifactId;
      const outputId = outputRefs[0].source.artifactId;
      const outputArtifact = ensureArtifact(outputId);
      if (!outputArtifact.lineage?.evolvesFrom) {
        outputArtifact.lineage = { evolvesFrom: inputId };
        artifactsChanged = true;
      }
      if (!inputRefs[0].role) {
        inputRefs[0].role = "base";
      }
      continue;
    }

    // Merge (multi-input, single output) -> assign base vs added
    if (inputRefs.length > 1 && outputRefs.length === 1) {
      const outputId = outputRefs[0].source.artifactId;
      const outputArtifact = ensureArtifact(outputId);
      const outputGroupId = outputArtifact.groupId;

      const baseRefs = inputRefs.filter((ref) => ref.role === "base");
      let inferredBase: typeof inputRefs[number] | undefined;

      if (baseRefs.length === 1) {
        inferredBase = baseRefs[0];
      } else if (baseRefs.length === 0) {
        const groupMatches = outputGroupId
          ? inputRefs.filter((ref) => {
              const inputArtifact = artifactById.get(ref.source.artifactId);
              return inputArtifact?.groupId === outputGroupId;
            })
          : [];
        if (groupMatches.length === 1) {
          inferredBase = groupMatches[0];
        } else if (groupMatches.length > 1) {
          inferredBase =
            groupMatches.find((ref) => {
              const inputArtifact = artifactById.get(ref.source.artifactId);
              return (inputArtifact?.components?.length ?? 0) > 1;
            }) ?? groupMatches[0];
        } else {
          const subassemblies = inputRefs.filter((ref) => {
            const inputArtifact = artifactById.get(ref.source.artifactId);
            return (inputArtifact?.components?.length ?? 0) > 1;
          });
          inferredBase = subassemblies[0] ?? inputRefs[0];
        }
      }

      for (const ref of inputRefs) {
        if (ref.role) continue;
        if (inferredBase && ref === inferredBase) {
          ref.role = "base";
        } else {
          ref.role = "added";
        }
      }
    }
  }

  // 3. Derive dependencies from material flow and merge with explicit dependsOn
  const derivedDeps = deriveDependencies(normalized);
  
  normalized.steps = normalized.steps.map(step => {
    const deps = new Set(step.dependsOn || []);
    
    // Add any derived dependencies where this step is the consumer
    for (const [producerId, consumerId] of derivedDeps) {
      if (consumerId === step.id) {
        deps.add(producerId);
      }
    }

    return {
      ...step,
      dependsOn: Array.from(deps).sort()
    };
  });

  return normalized;
}
