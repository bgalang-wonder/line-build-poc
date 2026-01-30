/**
 * Migration script: Station/Grouping Model Refactor
 *
 * This script migrates existing builds from the old stationId model to the new
 * groupingId + stationId model.
 *
 * OLD MODEL:
 * - stationId contained mixed values: hot_side, cold_side, garnish, expo, prep, pass, vending
 *
 * NEW MODEL:
 * - groupingId: 3 values (hot_side, cold_side, vending) - the kitchen area
 * - stationId: Equipment/work areas (fryer, waterbath, garnish, expo, etc.)
 *
 * MIGRATION LOGIC:
 * 1. If old stationId is a grouping value (hot_side, cold_side), set groupingId to it
 * 2. Derive new stationId:
 *    - If equipment.applianceId exists → use it as stationId
 *    - If old stationId is a work area (garnish, expo, prep, pass, vending) → preserve it
 *    - Otherwise → 'other'
 *
 * Usage: npx tsx scripts/migrate-station-model.ts [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import { type GroupingId, type StationId, getGroupingForStation } from "./lib/schema";

const BUILDS_DIR = path.resolve(__dirname, "../data/line-builds");

// Old grouping values that were used as stationId
const OLD_GROUPING_VALUES = new Set(["hot_side", "cold_side"]);

// Work area values that should be preserved as stationId
const WORK_AREA_VALUES = new Set(["garnish", "speed_line", "expo", "prep", "pass", "vending"]);

type StepWithOldModel = {
  id: string;
  stationId?: string;
  groupingId?: string;
  equipment?: { applianceId?: string };
  [key: string]: unknown;
};

type BuildWithOldModel = {
  id: string;
  steps: StepWithOldModel[];
  [key: string]: unknown;
};

function deriveNewStationId(step: StepWithOldModel): StationId | undefined {
  // If equipment.applianceId exists, use it
  if (step.equipment?.applianceId) {
    return step.equipment.applianceId as StationId;
  }

  const oldStationId = step.stationId;
  if (!oldStationId) return undefined;

  // If old stationId is a work area, preserve it
  if (WORK_AREA_VALUES.has(oldStationId)) {
    return oldStationId as StationId;
  }

  // If old stationId is a grouping value, we can't determine the station
  // (the step was at hot_side or cold_side generically)
  if (OLD_GROUPING_VALUES.has(oldStationId)) {
    return "other";
  }

  // Otherwise, assume it's already a valid station value
  return oldStationId as StationId;
}

function deriveGroupingId(step: StepWithOldModel, newStationId: StationId | undefined): GroupingId {
  // If step already has groupingId, use it
  if (step.groupingId) {
    return step.groupingId as GroupingId;
  }

  const oldStationId = step.stationId;

  // If old stationId was a grouping value, use it directly
  if (oldStationId && OLD_GROUPING_VALUES.has(oldStationId)) {
    return oldStationId as GroupingId;
  }

  // If old stationId was "vending", the grouping is vending
  if (oldStationId === "vending") {
    return "vending";
  }

  // Otherwise derive from the new stationId using the canonical mapping
  return getGroupingForStation(newStationId);
}

function migrateStep(step: StepWithOldModel): { modified: boolean; changes: string[] } {
  const changes: string[] = [];
  let modified = false;

  const newStationId = deriveNewStationId(step);
  const newGroupingId = deriveGroupingId(step, newStationId);

  // Set groupingId if not already set or different
  if (step.groupingId !== newGroupingId) {
    changes.push(`groupingId: ${step.groupingId || "undefined"} → ${newGroupingId}`);
    step.groupingId = newGroupingId;
    modified = true;
  }

  // Set stationId if different
  if (step.stationId !== newStationId) {
    changes.push(`stationId: ${step.stationId || "undefined"} → ${newStationId || "undefined"}`);
    step.stationId = newStationId;
    modified = true;
  }

  return { modified, changes };
}

function migrateBuild(build: BuildWithOldModel, dryRun: boolean): { modified: boolean; stepChanges: Map<string, string[]> } {
  const stepChanges = new Map<string, string[]>();
  let modified = false;

  for (const step of build.steps) {
    const result = migrateStep(step);
    if (result.modified) {
      modified = true;
      stepChanges.set(step.id, result.changes);
    }
  }

  return { modified, stepChanges };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(`Station/Grouping Model Migration${dryRun ? " (DRY RUN)" : ""}`);
  console.log("=".repeat(50));

  const buildFiles = fs.readdirSync(BUILDS_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${buildFiles.length} build files\n`);

  let totalModified = 0;
  let totalStepsModified = 0;

  for (const file of buildFiles) {
    const filePath = path.join(BUILDS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const build = JSON.parse(content) as BuildWithOldModel;

    const result = migrateBuild(build, dryRun);

    if (result.modified) {
      totalModified++;
      totalStepsModified += result.stepChanges.size;

      console.log(`\n${build.id}:`);
      for (const [stepId, changes] of result.stepChanges) {
        console.log(`  ${stepId}:`);
        for (const change of changes) {
          console.log(`    - ${change}`);
        }
      }

      if (!dryRun) {
        fs.writeFileSync(filePath, JSON.stringify(build, null, 2) + "\n");
        console.log(`  ✓ Saved`);
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Summary: ${totalModified} builds modified, ${totalStepsModified} steps updated`);
  if (dryRun) {
    console.log("(Dry run - no files were modified)");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
