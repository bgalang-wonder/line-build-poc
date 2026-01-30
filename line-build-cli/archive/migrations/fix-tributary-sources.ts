/**
 * Fix tributary sources in builds.
 *
 * This script finds steps where the instruction mentions an ingredient source
 * ("from Steam Well", "from Cold Rail", etc.) but the output doesn't have a
 * `from` field to indicate where the ingredient came from.
 *
 * Adding output[].from allows the viewer to render tributary edges showing
 * where customization ingredients (protein, cheese, vegetables) originate.
 *
 * Usage:
 *   npx tsx scripts/fix-tributary-sources.ts           # Dry run (show what would change)
 *   npx tsx scripts/fix-tributary-sources.ts --apply   # Apply changes
 *   npx tsx scripts/fix-tributary-sources.ts --all     # Process all builds
 *   npx tsx scripts/fix-tributary-sources.ts <buildId> # Process specific build
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const BUILDS_DIR = "./data/line-builds";

// Map instruction patterns to location info
// These are case-insensitive patterns that match "from X" in instructions
const SOURCE_PATTERNS: Array<{
  pattern: RegExp;
  stationId: string;
  sublocation: { type: string; equipmentId?: string };
}> = [
  {
    pattern: /from steam well/i,
    stationId: "speed_line",
    sublocation: { type: "equipment", equipmentId: "steam_well" },
  },
  {
    pattern: /from cold rail/i,
    stationId: "speed_line",
    sublocation: { type: "cold_rail" },
  },
  {
    pattern: /from dry rail/i,
    stationId: "speed_line",
    sublocation: { type: "dry_rail" },
  },
  {
    pattern: /from packaging/i,
    stationId: "speed_line",
    sublocation: { type: "packaging" },
  },
  {
    pattern: /from cold storage/i,
    stationId: "speed_line",
    sublocation: { type: "cold_storage" },
  },
  {
    pattern: /from sauce warmer/i,
    stationId: "speed_line",
    sublocation: { type: "equipment", equipmentId: "sauce_warmer" },
  },
  {
    pattern: /from hot well/i,
    stationId: "speed_line",
    sublocation: { type: "equipment", equipmentId: "hot_well" },
  },
];

// Action families that typically add ingredients to an existing assembly
// These are the ones where we want to add tributary source info
const INGREDIENT_ADD_FAMILIES = new Set(["PORTION", "ASSEMBLE", "COMBINE"]);

function detectSourceFromInstruction(instruction: string): {
  stationId: string;
  sublocation: { type: string; equipmentId?: string };
} | null {
  for (const { pattern, stationId, sublocation } of SOURCE_PATTERNS) {
    if (pattern.test(instruction)) {
      return { stationId, sublocation };
    }
  }
  return null;
}

function shouldAddTributarySource(step: any): boolean {
  // Only process PORTION/ASSEMBLE/COMBINE steps
  if (!INGREDIENT_ADD_FAMILIES.has(step.action?.family)) return false;

  // Must have inputs (it's adding to something)
  if (!step.input || step.input.length === 0) return false;

  // Must have outputs
  if (!step.output || step.output.length === 0) return false;

  // Must have an instruction that mentions a source
  if (!step.instruction) return false;
  if (!detectSourceFromInstruction(step.instruction)) return false;

  // Check if output already has a from field
  for (const out of step.output) {
    if (out.from) return false; // Already has from, skip
  }

  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes("--apply");
  const processAll = args.includes("--all");
  const specificBuildId = args.find((a) => !a.startsWith("--"));

  const files = await fs.readdir(BUILDS_DIR);
  let jsonFiles = files.filter((f) => f.endsWith(".json"));

  // Filter to BYO builds by default, or all if --all
  if (!processAll && !specificBuildId) {
    jsonFiles = jsonFiles.filter((f) => f.includes("-byo-") || f.includes("byo-"));
  }

  // Filter to specific build if provided
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
      if (!shouldAddTributarySource(step)) continue;

      const source = detectSourceFromInstruction(step.instruction);
      if (!source) continue;

      // Add from to all outputs that don't have one
      for (const out of step.output) {
        if (out.from) continue;
        if (out.source?.type !== "in_build") continue;

        out.from = {
          stationId: source.stationId,
          sublocation: source.sublocation,
        };
        modified = true;
        totalFixed++;

        const assemblyId = out.source.assemblyId || "unknown";
        const locDesc = source.sublocation.equipmentId
          ? `${source.sublocation.type}:${source.sublocation.equipmentId}`
          : source.sublocation.type;
        fixes.push(`${step.id} (${step.instruction.substring(0, 40)}...): added output.from → ${locDesc}`);
      }
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

  console.log(`\n${applyChanges ? "Fixed" : "Would fix"} ${totalFixed} tributary sources across ${buildsFixed} builds\n`);

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
