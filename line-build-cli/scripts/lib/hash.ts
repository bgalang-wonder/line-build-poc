import { createHash } from "node:crypto";
import type { BenchTopLineBuild } from "./schema";

/**
 * Compute a deterministic hash of a build's source data for cache invalidation.
 *
 * Includes steps and assemblies (the data that affects derived transfers).
 * Does NOT include metadata like updatedAt, status, etc.
 */
export function computeBuildSourceHash(build: BenchTopLineBuild): string {
  // Extract the data that affects derived transfers
  const sourceData = {
    // Steps are the primary source - their input/output arrays determine transfers
    steps: (build.steps || [])
      .map((s) => ({
        id: s.id,
        dependsOn: s.dependsOn ?? [],
        input: s.input,
        output: s.output,
        from: s.from,
        to: s.to,
        stationId: s.stationId,
        sublocation: s.sublocation,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),

    // Assemblies provide context for transfer derivation
    assemblies: (build.assemblies || [])
      .map((a) => ({
        id: a.id,
        groupId: a.groupId,
        lineage: a.lineage,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  // Deterministic JSON serialization (keys already sorted by extraction above)
  const json = JSON.stringify(sourceData);

  // SHA256 produces a 64-char hex string - truncate to 16 for readability
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}
