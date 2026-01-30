#!/usr/bin/env npx tsx
/**
 * Fix orphan assembly references and duplicate inputs in line builds.
 *
 * Issues addressed:
 * 1. Remove duplicate input refs (same assembly referenced multiple times)
 * 2. Remove orphan input refs (assemblies with no producer and aren't external ingredients)
 * 3. Clean up assemblies array to remove unused placeholders
 */

import * as fs from "fs";
import * as path from "path";

interface Sublocation {
  type: string;
  equipmentId?: string;
}

interface Location {
  stationId?: string;
  sublocation?: Sublocation;
}

interface AssemblySource {
  type: "in_build" | "external";
  assemblyId?: string;
}

interface AssemblyRef {
  source: AssemblySource;
  from?: Location;
  to?: Location;
  role?: "base" | "added";
}

interface Step {
  id: string;
  orderIndex: number;
  trackId?: string;
  action: { family: string; techniqueId?: string };
  instruction: string;
  stationId?: string;
  input?: AssemblyRef[];
  output?: AssemblyRef[];
  dependsOn?: string[];
  [key: string]: any;
}

interface Assembly {
  id: string;
  name: string;
  groupId?: string;
  lineage?: { evolvesFrom?: string };
  subAssemblies?: string[];
}

interface Build {
  id: string;
  name?: string;
  primaryOutputAssemblyId?: string;
  assemblies?: Assembly[];
  steps: Step[];
  [key: string]: any;
}

// Check if assembly ID looks like a placeholder/migration artifact
function isPlaceholderAssembly(id: string): boolean {
  // Matches: step3_v1, foil_sheet_on_work_surface_v1, etc. (long auto-generated names)
  return /^step\d+_v\d+$/i.test(id) || /_on_work_surface_v\d+$/i.test(id) || /_on_press_v\d+$/i.test(id);
}

// Build producer map: which step produces which assembly
function buildProducerMap(steps: Step[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const step of steps) {
    if (step.output) {
      for (const ref of step.output) {
        if (ref.source.type === "in_build" && ref.source.assemblyId) {
          const id = ref.source.assemblyId;
          if (!map.has(id)) {
            map.set(id, []);
          }
          map.get(id)!.push(step.id);
        }
      }
    }
  }

  return map;
}

// Get all assembly IDs referenced in inputs
function getInputAssemblyIds(steps: Step[]): Set<string> {
  const ids = new Set<string>();
  for (const step of steps) {
    if (step.input) {
      for (const ref of step.input) {
        if (ref.source.type === "in_build" && ref.source.assemblyId) {
          ids.add(ref.source.assemblyId);
        }
      }
    }
  }
  return ids;
}

// Known external ingredient patterns (from rails/storage, no producer needed)
function isExternalIngredient(id: string, assemblyDef?: Assembly): boolean {
  // Check if it's defined as an ingredient in assemblies
  if (assemblyDef) {
    const name = assemblyDef.name.toLowerCase();
    // Ingredients typically have simple names like "Shredded Cheese", "Lime Wedge"
    if (!assemblyDef.lineage && !assemblyDef.subAssemblies) {
      return true; // Simple assembly without lineage = ingredient
    }
  }

  // Pattern-based detection for common ingredients
  const ingredientPatterns = [
    /^cheese/, /^bacon/, /^scallion/, /^onion/, /^lime/, /^salt/,
    /^lettuce/, /^tomato/, /^sauce/, /^dressing/, /^cheddar/,
    /lid_/, /sleeve$/, /container_/, /^foil_sheet$/, /^tortilla$/
  ];

  return ingredientPatterns.some((p) => p.test(id));
}

function fixBuild(build: Build): { build: Build; fixes: string[] } {
  const fixes: string[] = [];
  const producerMap = buildProducerMap(build.steps);

  // Build assembly lookup
  const assemblyLookup = new Map<string, Assembly>();
  if (build.assemblies) {
    for (const a of build.assemblies) {
      assemblyLookup.set(a.id, a);
    }
  }

  // Process each step
  for (const step of build.steps) {
    if (!step.input || step.input.length === 0) continue;

    const seenIds = new Set<string>();
    const newInputs: AssemblyRef[] = [];

    for (const ref of step.input) {
      if (ref.source.type !== "in_build" || !ref.source.assemblyId) {
        newInputs.push(ref);
        continue;
      }

      const assemblyId = ref.source.assemblyId;

      // Skip duplicates
      if (seenIds.has(assemblyId)) {
        fixes.push(`${step.id}: removed duplicate input '${assemblyId}'`);
        continue;
      }

      // Check if this assembly has a producer
      const producers = producerMap.get(assemblyId);
      const assemblyDef = assemblyLookup.get(assemblyId);

      if (!producers || producers.length === 0) {
        // No producer - check if it's an external ingredient or orphan placeholder
        if (isPlaceholderAssembly(assemblyId)) {
          fixes.push(`${step.id}: removed orphan placeholder '${assemblyId}'`);
          continue;
        }

        if (!isExternalIngredient(assemblyId, assemblyDef)) {
          // Not a recognized ingredient and no producer - might be an issue
          // But keep it for now, just note it
          // fixes.push(`${step.id}: kept unproduced assembly '${assemblyId}' (may need manual review)`);
        }
      }

      seenIds.add(assemblyId);
      newInputs.push(ref);
    }

    // Update inputs if changed
    if (newInputs.length !== step.input.length) {
      step.input = newInputs;
    }
  }

  // Clean up assemblies array - remove placeholders that are no longer referenced
  if (build.assemblies) {
    const referencedIds = new Set<string>();

    // Collect all referenced assembly IDs
    for (const step of build.steps) {
      if (step.input) {
        for (const ref of step.input) {
          if (ref.source.type === "in_build" && ref.source.assemblyId) {
            referencedIds.add(ref.source.assemblyId);
          }
        }
      }
      if (step.output) {
        for (const ref of step.output) {
          if (ref.source.type === "in_build" && ref.source.assemblyId) {
            referencedIds.add(ref.source.assemblyId);
          }
        }
      }
    }

    // Also include primaryOutputAssemblyId
    if (build.primaryOutputAssemblyId) {
      referencedIds.add(build.primaryOutputAssemblyId);
    }

    // Include subAssemblies references
    for (const a of build.assemblies) {
      if (a.subAssemblies) {
        for (const subId of a.subAssemblies) {
          referencedIds.add(subId);
        }
      }
      if (a.lineage?.evolvesFrom) {
        referencedIds.add(a.lineage.evolvesFrom);
      }
    }

    const originalCount = build.assemblies.length;
    build.assemblies = build.assemblies.filter((a) => {
      if (!referencedIds.has(a.id) && isPlaceholderAssembly(a.id)) {
        fixes.push(`assemblies: removed unreferenced placeholder '${a.id}'`);
        return false;
      }
      return true;
    });

    if (build.assemblies.length !== originalCount) {
      fixes.push(`assemblies: cleaned ${originalCount - build.assemblies.length} unused entries`);
    }
  }

  build.updatedAt = new Date().toISOString();
  return { build, fixes };
}

async function main() {
  const buildsDir = path.join(process.cwd(), "data/line-builds");
  const files = fs.readdirSync(buildsDir).filter((f) => f.endsWith(".json"));

  const skipBuilds = new Set(["baked-potato-mainstay-v1.json", "cheese-fries-burger-baby-8009068.json"]);

  let totalFixes = 0;
  let buildsFixed = 0;

  for (const file of files) {
    if (skipBuilds.has(file)) {
      console.log(`⏭️  Skipping ${file} (gold example)`);
      continue;
    }

    const filePath = path.join(buildsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const build: Build = JSON.parse(content);

    const { build: fixedBuild, fixes } = fixBuild(build);

    if (fixes.length > 0) {
      fs.writeFileSync(filePath, JSON.stringify(fixedBuild, null, 2) + "\n");
      console.log(`✅ ${file}: ${fixes.length} fix(es)`);
      for (const fix of fixes) {
        console.log(`   - ${fix}`);
      }
      totalFixes += fixes.length;
      buildsFixed++;
    } else {
      console.log(`✓  ${file}: no fixes needed`);
    }
  }

  console.log(`\n🎉 Orphan cleanup complete: ${totalFixes} fixes across ${buildsFixed} builds`);
}

main().catch((err) => {
  console.error("Orphan fix failed:", err);
  process.exit(1);
});
