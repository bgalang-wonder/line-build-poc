import {
  BenchTopLineBuild,
  Assembly,
  AssemblyId,
  type AssemblyRef,
  type StationId,
  type LocationRef,
  type Step,
} from "./schema";
import { deriveDependencies } from "./flow";
import { deriveAllMaterialFlow } from "./derive";
import {
  canDeriveStationFromEquipment,
  getStationForUniqueEquipment,
  STATIONS,
  STATION_BY_ID,
  type EquipmentId,
} from "../../config/stations.config";

/**
 * Normalizes a line build by:
 * 1. Filling defaults (input/output arrays)
 * 2. Auto-creating missing assemblies
 * 3. Normalizing material flow roles + lineage
 * 4. Deriving Tier 2 fields (sublocation, to, from)
 * 5. Deriving dependencies from material flow
 *
 * Note: Transfer steps are now computed separately and cached in data/derived/.
 * See derivedCache.ts for transfer computation.
 *
 * This implements the "normalize-on-write" strategy.
 */
export function normalizeBuild(build: BenchTopLineBuild): BenchTopLineBuild {
  // Clone to avoid mutation if needed, though Zod parse already produces a fresh object
  const normalized = { ...build };

  // 1. Ensure steps have input/output arrays (already defaulted by Zod, but safe for manual calls)
  // 1b. Derive stationIds where unambiguous (step + location refs)
  normalized.steps = normalized.steps.map(step => {
    const withDefaults: Step = {
      ...step,
      input: step.input || [],
      output: step.output || [],
      dependsOn: step.dependsOn || [],
    };

    const derivedStationId = deriveStationIdForStep(withDefaults);
    const withStation: Step = derivedStationId
      ? { ...withDefaults, stationId: derivedStationId }
      : withDefaults;

    return {
      ...withStation,
      // Removed: from/to derivation at step level
      // Only derive on assembly refs (material flow is on assemblies, not steps)
      input: (withStation.input ?? []).map((inp) => ({
        ...inp,
        from: applyStationToLocation(inp.from, withStation),
      })),
      output: (withStation.output ?? []).map((out) => ({
        ...out,
        to: applyStationToLocation(out.to, withStation),
      })),
    };
  });

  // 2. Auto-create assembly stubs for any referenced in_build assemblies
  const existingAssemblyIds = new Set(normalized.assemblies?.map(a => a.id) || []);
  const referencedAssemblyIds = new Set<AssemblyId>();

  for (const step of normalized.steps) {
    for (const input of step.input) {
      if (input.source.type === "in_build") {
        referencedAssemblyIds.add(input.source.assemblyId);
      }
    }
    for (const output of step.output) {
      if (output.source.type === "in_build") {
        referencedAssemblyIds.add(output.source.assemblyId);
      }
    }
  }

  const assemblies = [...(normalized.assemblies || [])];
  let assembliesChanged = false;
  const assemblyById = new Map<string, Assembly>();

  for (const assembly of assemblies) {
    assemblyById.set(assembly.id, assembly);
  }

  const ensureAssembly = (assemblyId: AssemblyId): Assembly => {
    const existing = assemblyById.get(assemblyId);
    if (existing) return existing;
    const created: Assembly = {
      id: assemblyId,
      name: assemblyId,
      type: "intermediate",
    };
    assemblies.push(created);
    assemblyById.set(assemblyId, created);
    assembliesChanged = true;
    return created;
  };

  for (const assemblyId of referencedAssemblyIds) {
    if (!existingAssemblyIds.has(assemblyId)) {
      ensureAssembly(assemblyId);
    }
  }

  if (assembliesChanged) {
    normalized.assemblies = assemblies;
  }

  // 2a. Derive groupId from lineage chains (for material flow coloring)
  const deriveGroupIdForAssembly = (assembly: Assembly, visited = new Set<string>()): string => {
    // If already set, use it
    if (assembly.groupId) return assembly.groupId;

    // Trace back to the root of the lineage chain
    let root = assembly;
    while (root.lineage?.evolvesFrom && !visited.has(root.id)) {
      visited.add(root.id);
      const parent = assemblyById.get(root.lineage.evolvesFrom);
      if (!parent) break;
      root = parent;
    }

    // Use the root's ID (strip version suffixes like _v1, _v2, etc.)
    return root.id.replace(/_v\d+$/, '').replace(/_positioned$/, '').replace(/_ready$/, '').replace(/_complete$/, '');
  };

  for (const assembly of assemblies) {
    if (!assembly.groupId) {
      assembly.groupId = deriveGroupIdForAssembly(assembly);
      assembliesChanged = true;
    }
  }

  if (assembliesChanged) {
    normalized.assemblies = assemblies;
  }

  // 2b. Normalize material flow roles + lineage
  const isInBuildRef = (
    ref: AssemblyRef,
  ): ref is AssemblyRef & { source: { type: "in_build"; assemblyId: AssemblyId } } =>
    ref.source.type === "in_build";

  for (const step of normalized.steps) {
    const inputRefs = step.input.filter(isInBuildRef);
    const outputRefs = step.output.filter(isInBuildRef);

    if (inputRefs.length === 0 || outputRefs.length === 0) continue;

    // 1:1 evolution -> set lineage + base role
    if (inputRefs.length === 1 && outputRefs.length === 1) {
      const inputId = inputRefs[0].source.assemblyId;
      const outputId = outputRefs[0].source.assemblyId;
      const outputAssembly = ensureAssembly(outputId);
      if (!outputAssembly.lineage?.evolvesFrom) {
        outputAssembly.lineage = { evolvesFrom: inputId };
        assembliesChanged = true;
      }
      if (!inputRefs[0].role) {
        inputRefs[0].role = "base";
      }
      continue;
    }

    // Merge (multi-input, single output) -> assign base vs added
    if (inputRefs.length > 1 && outputRefs.length === 1) {
      const outputId = outputRefs[0].source.assemblyId;
      const outputAssembly = ensureAssembly(outputId);
      const outputGroupId = outputAssembly.groupId;

      const baseRefs = inputRefs.filter((ref) => ref.role === "base");
      let inferredBase: typeof inputRefs[number] | undefined;

      if (baseRefs.length === 1) {
        inferredBase = baseRefs[0];
      } else if (baseRefs.length === 0) {
        const groupMatches = outputGroupId
          ? inputRefs.filter((ref) => {
              const inputAssembly = assemblyById.get(ref.source.assemblyId);
              return inputAssembly?.groupId === outputGroupId;
            })
          : [];
        if (groupMatches.length === 1) {
          inferredBase = groupMatches[0];
        } else if (groupMatches.length > 1) {
          inferredBase =
            groupMatches.find((ref) => {
              const inputAssembly = assemblyById.get(ref.source.assemblyId);
              return (inputAssembly?.subAssemblies?.length ?? 0) > 1;
            }) ?? groupMatches[0];
        } else {
          const subassemblies = inputRefs.filter((ref) => {
            const inputAssembly = assemblyById.get(ref.source.assemblyId);
            return (inputAssembly?.subAssemblies?.length ?? 0) > 1;
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

  // 3. Derive Tier 2 fields (sublocation, to, from) from Tier 1 inputs + rules
  // This fills in missing location/sublocation data based on action family, equipment, and station
  const withDerivedFlow = deriveAllMaterialFlow(normalized);

  // 4. Derive dependencies from material flow and merge with explicit dependsOn
  const derivedDeps = deriveDependencies(withDerivedFlow);

  withDerivedFlow.steps = withDerivedFlow.steps.map(step => {
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

  return withDerivedFlow;
}

function stationsForSublocation(sublocationId: string): string[] {
  return STATIONS.filter((s) => s.sublocations.includes(sublocationId as any)).map((s) => s.id);
}

function stationsForEquipment(equipmentId: string): string[] {
  return STATIONS.filter((s) =>
    (s.equipmentAvailable ?? []).includes(equipmentId as EquipmentId)
  ).map((s) => s.id);
}

function filterCandidatesByGrouping(
  candidates: string[],
  groupingId: Step["groupingId"],
): string[] {
  if (!groupingId) return candidates;
  const filtered = candidates.filter((id) => STATION_BY_ID[id]?.side === groupingId);
  return filtered.length > 0 ? filtered : candidates;
}

function deriveStationIdForLocation(
  loc: LocationRef | undefined,
  groupingId: Step["groupingId"],
): StationId | undefined {
  if (!loc?.sublocation?.type) return undefined;
  if (loc.stationId) return loc.stationId as StationId;

  const candidates = loc.sublocation.type === "equipment" && loc.sublocation.equipmentId
    ? stationsForEquipment(loc.sublocation.equipmentId)
    : stationsForSublocation(loc.sublocation.type);

  const filtered = filterCandidatesByGrouping(candidates, groupingId);
  return filtered.length === 1 ? (filtered[0] as StationId) : undefined;
}

function deriveStationIdForStep(step: Step): StationId | undefined {
  if (step.stationId) return step.stationId;

  const equipmentId = step.equipment?.applianceId;
  if (equipmentId && canDeriveStationFromEquipment(equipmentId)) {
    const derivedStation = getStationForUniqueEquipment(equipmentId);
    if (derivedStation) return derivedStation as StationId;
  }

  if (!step.workLocation) return undefined;
  const equipmentFallback =
    step.workLocation.type === "equipment" && !step.workLocation.equipmentId
      ? step.equipment?.applianceId
      : undefined;

  const loc: LocationRef = {
    sublocation:
      step.workLocation.type === "equipment"
        ? {
            ...step.workLocation,
            equipmentId: step.workLocation.equipmentId ?? equipmentFallback,
          }
        : step.workLocation,
  };

  return deriveStationIdForLocation(loc, step.groupingId);
}

function applyStationToLocation(
  loc: LocationRef | undefined,
  step: Step
): LocationRef | undefined {
  if (!loc?.sublocation?.type) return loc;
  if (loc.stationId) return loc;
  if (step.stationId) return { ...loc, stationId: step.stationId };
  const derived = deriveStationIdForLocation(loc, step.groupingId);
  return derived ? { ...loc, stationId: derived } : loc;
}
