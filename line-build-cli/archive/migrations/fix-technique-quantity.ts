/**
 * Fix step.quantity to be technique quantity (not ingredient quantity).
 *
 * step.quantity should be technique counts like "2 shakes", "3 drizzles", "1 scoop"
 * NOT ingredient amounts like "4 oz", "2 tbsp"
 *
 * This script:
 * 1. Extracts technique counts from instruction/notes where possible
 * 2. Removes oz/tbsp/tsp quantities that can't be converted
 * 3. Preserves the ingredient info in notes
 *
 * Usage:
 *   npx tsx scripts/fix-technique-quantity.ts           # Dry run
 *   npx tsx scripts/fix-technique-quantity.ts --apply   # Apply changes
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const BUILDS_DIR = "./data/line-builds";

// Units that are ingredient quantities (wrong for step.quantity)
const INGREDIENT_UNITS = new Set(["oz", "tbsp", "tsp", "Tbsp", "g", "ml", "lb"]);

// Patterns to extract technique counts from instruction/notes
const TECHNIQUE_PATTERNS = [
  // "2 scoops" or "(2 scoops)"
  /(\d+)\s*scoops?/i,
  // "3 drizzles"
  /(\d+)\s*drizzles?/i,
  // "2 shakes"
  /(\d+)\s*shakes?/i,
  // "2 swipes"
  /(\d+)\s*swipes?/i,
  // "2 sprays"
  /(\d+)\s*sprays?/i,
  // "2 lines"
  /(\d+)\s*lines?/i,
  // "2 folds"
  /(\d+)\s*folds?/i,
  // "2 pours"
  /(\d+)\s*pours?/i,
];

interface TechniqueQuantity {
  value: number;
  unit: string;
}

function extractTechniqueQuantity(
  instruction: string | undefined,
  notes: string | undefined
): TechniqueQuantity | null {
  const text = `${instruction || ""} ${notes || ""}`;

  for (const pattern of TECHNIQUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      // Extract the unit (singularize if needed)
      let unit = match[0].replace(/^\d+\s*/, "").toLowerCase();
      // Normalize to singular form for consistency
      if (unit.endsWith("s") && !unit.endsWith("ss")) {
        unit = unit.slice(0, -1);
      }
      return { value, unit };
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes("--apply");

  const files = await fs.readdir(BUILDS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  console.log(`Processing ${jsonFiles.length} builds...`);
  console.log(applyChanges ? "Mode: APPLY" : "Mode: DRY RUN (use --apply to write changes)");
  console.log("");

  let totalRemoved = 0;
  let totalConverted = 0;
  let buildsModified = 0;

  const details: Array<{
    buildId: string;
    removed: string[];
    converted: string[];
  }> = [];

  for (const file of jsonFiles) {
    const buildPath = path.join(BUILDS_DIR, file);
    const raw = await fs.readFile(buildPath, "utf8");
    const build = JSON.parse(raw);

    let modified = false;
    const removed: string[] = [];
    const converted: string[] = [];

    for (const step of build.steps) {
      if (!step.quantity) continue;

      const unit = step.quantity.unit;
      if (!INGREDIENT_UNITS.has(unit)) continue;

      // Try to extract technique quantity from instruction/notes
      const techniqueQty = extractTechniqueQuantity(step.instruction, step.notes);

      if (techniqueQty) {
        // Preserve original ingredient info in notes
        const originalInfo = `${step.quantity.value} ${step.quantity.unit}`;
        if (!step.notes) {
          step.notes = `Ingredient qty: ${originalInfo}`;
        } else if (!step.notes.includes(originalInfo)) {
          step.notes = `${step.notes} | Ingredient qty: ${originalInfo}`;
        }

        // Replace with technique quantity
        step.quantity = techniqueQty;
        converted.push(
          `${step.id}: ${originalInfo} → ${techniqueQty.value} ${techniqueQty.unit}`
        );
        totalConverted++;
        modified = true;
      } else {
        // No technique quantity found - preserve info in notes and remove quantity
        const originalInfo = `${step.quantity.value} ${step.quantity.unit}`;
        if (!step.notes) {
          step.notes = `Ingredient qty: ${originalInfo}`;
        } else if (!step.notes.includes(originalInfo)) {
          step.notes = `${step.notes} | Ingredient qty: ${originalInfo}`;
        }

        delete step.quantity;
        removed.push(`${step.id}: removed ${originalInfo} (no technique count found)`);
        totalRemoved++;
        modified = true;
      }
    }

    if (modified) {
      if (applyChanges) {
        build.updatedAt = new Date().toISOString();
        await fs.writeFile(buildPath, JSON.stringify(build, null, 2));
      }
      buildsModified++;
      details.push({ buildId: build.id, removed, converted });
    }
  }

  console.log(`\n${applyChanges ? "Fixed" : "Would fix"} ${totalConverted + totalRemoved} quantity fields across ${buildsModified} builds`);
  console.log(`  - Converted: ${totalConverted}`);
  console.log(`  - Removed: ${totalRemoved}`);
  console.log("");

  for (const { buildId, removed, converted } of details) {
    console.log(`${buildId}:`);
    for (const c of converted) {
      console.log(`  ✓ ${c}`);
    }
    for (const r of removed) {
      console.log(`  ✗ ${r}`);
    }
  }

  if (!applyChanges && (totalConverted + totalRemoved) > 0) {
    console.log("\nRun with --apply to write changes to disk.");
  }
}

main().catch(console.error);
