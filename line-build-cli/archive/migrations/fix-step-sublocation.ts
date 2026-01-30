/**
 * Fix missing step.sublocation in all builds.
 *
 * This script backfills step.sublocation based on step.from/step.to:
 * - For HEAT steps: use step.from.sublocation (action happens at equipment)
 * - For other steps: use step.to.sublocation (action happens where result lands)
 * - Fallback: use step.from.sublocation if step.to is missing
 *
 * Usage:
 *   npx tsx scripts/fix-step-sublocation.ts           # Dry run
 *   npx tsx scripts/fix-step-sublocation.ts --apply   # Apply changes
 *   npx tsx scripts/fix-step-sublocation.ts <buildId> # Process specific build
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const BUILDS_DIR = "./data/line-builds";

// Action families where the action happens at the source (from) location
const ACTION_AT_FROM_FAMILIES = new Set(["HEAT"]);

function inferSublocation(step: any): { type: string; equipmentId?: string } | null {
  const family = step.action?.family;

  // For HEAT, the action happens at the equipment (from location)
  if (ACTION_AT_FROM_FAMILIES.has(family)) {
    if (step.from?.sublocation?.type) {
      return step.from.sublocation;
    }
  }

  // For most steps, use the destination (to location)
  if (step.to?.sublocation?.type) {
    return step.to.sublocation;
  }

  // Fallback to from location
  if (step.from?.sublocation?.type) {
    return step.from.sublocation;
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes("--apply");
  const specificBuildId = args.find((a) => !a.startsWith("--"));

  const files = await fs.readdir(BUILDS_DIR);
  let jsonFiles = files.filter((f) => f.endsWith(".json"));

  if (specificBuildId) {
    jsonFiles = jsonFiles.filter((f) => f.includes(specificBuildId));
  }

  console.log(`Processing ${jsonFiles.length} builds...`);
  console.log(applyChanges ? "Mode: APPLY" : "Mode: DRY RUN (use --apply to write changes)");
  console.log("");

  let totalFixed = 0;
  let buildsFixed = 0;
  const details: Array<{ buildId: string; fixes: string[] }> = [];

  for (const file of jsonFiles) {
    const buildPath = path.join(BUILDS_DIR, file);
    const raw = await fs.readFile(buildPath, "utf8");
    const build = JSON.parse(raw);

    let modified = false;
    const fixes: string[] = [];

    for (const step of build.steps) {
      // Skip if already has sublocation
      if (step.sublocation?.type) continue;

      // Skip excluded steps
      if (step.exclude) continue;

      const inferred = inferSublocation(step);
      if (!inferred) {
        console.warn(`  WARNING: Cannot infer sublocation for ${build.id}:${step.id}`);
        continue;
      }

      step.sublocation = inferred;
      modified = true;
      totalFixed++;

      const locDesc = inferred.equipmentId
        ? `${inferred.type}:${inferred.equipmentId}`
        : inferred.type;
      fixes.push(`${step.id}: set sublocation → ${locDesc}`);
    }

    if (modified) {
      if (applyChanges) {
        build.updatedAt = new Date().toISOString();
        await fs.writeFile(buildPath, JSON.stringify(build, null, 2));
      }
      buildsFixed++;
      details.push({ buildId: build.id, fixes });
    }
  }

  console.log(`\n${applyChanges ? "Fixed" : "Would fix"} ${totalFixed} missing sublocations across ${buildsFixed} builds\n`);

  for (const { buildId, fixes } of details) {
    console.log(`${buildId}:`);
    for (const fix of fixes) {
      console.log(`  - ${fix}`);
    }
  }

  if (!applyChanges && totalFixed > 0) {
    console.log("\nRun with --apply to write changes to disk.");
  }
}

main().catch(console.error);
