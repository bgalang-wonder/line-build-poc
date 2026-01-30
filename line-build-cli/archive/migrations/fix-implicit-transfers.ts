/**
 * Fix implicit transfers in all builds.
 *
 * This script finds steps where input.from.stationId differs from step.stationId
 * (which hides a transfer inside the step) and fixes them by updating the
 * input.from.stationId to match the step's station.
 *
 * This creates a location mismatch that triggers proper transfer derivation.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const BUILDS_DIR = "./data/line-builds";

// Storage sublocations where retrieval does NOT imply a transfer
// Note: "packaging" is NOT included - it's a work area, not storage
const STORAGE_SUBLOCATIONS = new Set([
  "cold_storage",
  "cold_rail",
  "dry_rail",
  "freezer",
  "kit_storage",
  "ambient",
]);

async function main() {
  const files = await fs.readdir(BUILDS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

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
      if (step.action.family === "TRANSFER") continue;
      const currentStation = step.stationId;
      if (!currentStation || currentStation === "other") continue;

      for (const inp of step.input ?? []) {
        const fromStation = inp.from?.stationId;
        const fromSubloc = inp.from?.sublocation?.type;

        // Skip storage retrievals
        if (fromSubloc && STORAGE_SUBLOCATIONS.has(fromSubloc)) continue;

        if (fromStation && fromStation !== currentStation) {
          // Fix: change input.from.stationId to match step.stationId
          const oldStation = inp.from.stationId;
          inp.from.stationId = currentStation;
          modified = true;
          totalFixed++;
          fixes.push(`${step.id}: ${oldStation} → ${currentStation}`);
        }
      }
    }

    if (modified) {
      build.updatedAt = new Date().toISOString();
      await fs.writeFile(buildPath, JSON.stringify(build, null, 2));
      buildsFixed++;
      details.push({ buildId: build.id, fixes });
    }
  }

  console.log(`\nFixed ${totalFixed} implicit transfers across ${buildsFixed} builds\n`);

  for (const { buildId, fixes } of details) {
    console.log(`${buildId}:`);
    for (const fix of fixes) {
      console.log(`  - ${fix}`);
    }
  }
}

main().catch(console.error);
