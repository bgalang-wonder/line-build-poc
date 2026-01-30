#!/usr/bin/env npx tsx
/**
 * fix-step-ids.ts
 *
 * Migrates step IDs to track-prefixed format and makes orderIndex globally sequential.
 *
 * Before: step-1, step-7, step-13 (with overlapping orderIndex per track)
 * After:  crostini-1, mushrooms-1, assembly-1 (with global orderIndex 0, 1, 2...)
 *
 * Usage:
 *   npx tsx scripts/fix-step-ids.ts <buildId>         # Preview changes
 *   npx tsx scripts/fix-step-ids.ts <buildId> --apply # Apply changes
 *   npx tsx scripts/fix-step-ids.ts --all             # Preview all builds
 *   npx tsx scripts/fix-step-ids.ts --all --apply     # Apply to all builds
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const LINE_BUILDS_DIR = "data/line-builds";

interface Step {
  id: string;
  orderIndex: number;
  trackId?: string;
  dependsOn?: string[];
  [key: string]: unknown;
}

interface Build {
  id: string;
  steps: Step[];
  [key: string]: unknown;
}

/**
 * Topological sort of steps based on dependencies.
 * Steps with no dependencies come first, then steps that depend on those, etc.
 */
function topologicalSort(steps: Step[]): Step[] {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const result: Step[] = [];

  // Find steps with no dependencies (entry points)
  const entryPoints = steps.filter(
    (s) => !s.dependsOn || s.dependsOn.length === 0
  );

  // BFS from entry points
  const queue = [...entryPoints];
  const inQueue = new Set(queue.map((s) => s.id));

  while (queue.length > 0) {
    const step = queue.shift()!;
    if (visited.has(step.id)) continue;

    // Check if all dependencies are visited
    const deps = step.dependsOn ?? [];
    const allDepsVisited = deps.every((d) => visited.has(d));

    if (!allDepsVisited) {
      // Put back in queue to try later
      queue.push(step);
      continue;
    }

    visited.add(step.id);
    result.push(step);

    // Add steps that depend on this one
    for (const s of steps) {
      if (!inQueue.has(s.id) && s.dependsOn?.includes(step.id)) {
        queue.push(s);
        inQueue.add(s.id);
      }
    }
  }

  // Handle any remaining steps (cycles or orphans)
  for (const step of steps) {
    if (!visited.has(step.id)) {
      result.push(step);
    }
  }

  return result;
}

/**
 * Generate new track-prefixed step ID.
 */
function generateStepId(trackId: string | undefined, index: number): string {
  const track = trackId ?? "default";
  // Sanitize track name for use in ID
  const sanitized = track.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `${sanitized}-${index}`;
}

/**
 * Process a single build.
 */
function processBuild(
  build: Build,
  apply: boolean
): { oldId: string; newId: string; orderIndex: number }[] {
  const steps = build.steps;
  if (!steps || steps.length === 0) return [];

  // Sort steps topologically
  const sorted = topologicalSort(steps);

  // Group by track to assign per-track sequence numbers
  const trackCounters: Record<string, number> = {};

  // Create ID mapping
  const idMap: Record<string, string> = {};
  const changes: { oldId: string; newId: string; orderIndex: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];
    const track = step.trackId ?? "default";

    // Increment track counter
    trackCounters[track] = (trackCounters[track] ?? 0) + 1;
    const trackSeq = trackCounters[track];

    // Generate new ID
    const newId = generateStepId(track, trackSeq);
    idMap[step.id] = newId;

    changes.push({
      oldId: step.id,
      newId,
      orderIndex: i,
    });
  }

  if (apply) {
    // Apply changes to build
    for (const step of steps) {
      const newId = idMap[step.id];
      const change = changes.find((c) => c.oldId === step.id);

      // Update ID
      step.id = newId;

      // Update orderIndex
      step.orderIndex = change!.orderIndex;

      // Update dependsOn references
      if (step.dependsOn) {
        step.dependsOn = step.dependsOn.map((depId) => idMap[depId] ?? depId);
      }
    }

    // Sort steps array by new orderIndex
    build.steps.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  return changes;
}

/**
 * Main entry point.
 */
function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const all = args.includes("--all");
  const buildId = args.find((a) => !a.startsWith("--"));

  if (!all && !buildId) {
    console.log("Usage:");
    console.log("  npx tsx scripts/fix-step-ids.ts <buildId>         # Preview");
    console.log("  npx tsx scripts/fix-step-ids.ts <buildId> --apply # Apply");
    console.log("  npx tsx scripts/fix-step-ids.ts --all             # All builds preview");
    console.log("  npx tsx scripts/fix-step-ids.ts --all --apply     # All builds apply");
    process.exit(1);
  }

  const files = all
    ? readdirSync(LINE_BUILDS_DIR).filter((f) => f.endsWith(".json"))
    : [`${buildId}.json`];

  let totalChanges = 0;

  for (const file of files) {
    const filePath = join(LINE_BUILDS_DIR, file);
    let build: Build;

    try {
      build = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (e) {
      console.error(`Error reading ${file}: ${e}`);
      continue;
    }

    const changes = processBuild(build, apply);

    if (changes.length > 0) {
      console.log(`\n${build.id}:`);

      // Check if any changes are needed
      const needsChange = changes.some((c) => c.oldId !== c.newId);
      if (!needsChange) {
        console.log("  (no ID changes needed, already track-prefixed)");
        continue;
      }

      totalChanges += changes.length;

      // Show changes
      console.log("  Old ID -> New ID (orderIndex)");
      for (const c of changes) {
        const marker = c.oldId !== c.newId ? "→" : "=";
        console.log(`    ${c.oldId.padEnd(20)} ${marker} ${c.newId.padEnd(20)} (${c.orderIndex})`);
      }

      if (apply) {
        // Update timestamp
        build.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
        writeFileSync(filePath, JSON.stringify(build, null, 2) + "\n");
        console.log(`  ✓ Applied to ${file}`);
      }
    }
  }

  console.log(`\n${apply ? "Applied" : "Would change"} ${totalChanges} step IDs`);
  if (!apply && totalChanges > 0) {
    console.log("Run with --apply to apply changes");
  }
}

main();
