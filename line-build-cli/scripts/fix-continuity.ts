#!/usr/bin/env npx tsx
/**
 * Fix H43 continuity issues by updating consumer input[].from to match producer output[].to
 *
 * The principle: For material flow continuity, the consumer must "pull" from where the producer "put" the item.
 * This means: consumer.input[].from === producer.output[].to
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
  groupingId?: string;
  toolId?: string;
  cookingPhase?: string;
  equipment?: { applianceId?: string };
  time?: { durationSeconds?: number; isActive?: boolean };
  quantity?: { value?: number; unit?: string };
  container?: { type?: string; name?: string };
  storageLocation?: { type?: string };
  notes?: string;
  from?: Location;
  to?: Location;
  sublocation?: Sublocation;
  input?: AssemblyRef[];
  output?: AssemblyRef[];
  dependsOn?: string[];
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
  itemId?: string;
  name?: string;
  version?: number;
  status?: string;
  primaryOutputAssemblyId?: string;
  assemblies?: Assembly[];
  steps: Step[];
  bom?: any[];
  createdAt?: string;
  updatedAt?: string;
}

// Deep clone a location
function cloneLocation(loc: Location): Location {
  return {
    stationId: loc.stationId,
    sublocation: loc.sublocation
      ? {
          type: loc.sublocation.type,
          ...(loc.sublocation.equipmentId ? { equipmentId: loc.sublocation.equipmentId } : {}),
        }
      : undefined,
  };
}

// Build a map of assemblyId -> producer step and output location
function buildProducerMap(steps: Step[]): Map<string, { step: Step; outputRef: AssemblyRef }> {
  const map = new Map<string, { step: Step; outputRef: AssemblyRef }>();

  for (const step of steps) {
    if (step.output) {
      for (const outputRef of step.output) {
        if (outputRef.source.type === "in_build" && outputRef.source.assemblyId) {
          map.set(outputRef.source.assemblyId, { step, outputRef });
        }
      }
    }
  }

  return map;
}

// Fix continuity for a single build
function fixBuildContinuity(build: Build): { build: Build; fixes: number } {
  const producerMap = buildProducerMap(build.steps);
  let fixes = 0;

  for (const step of build.steps) {
    if (step.input) {
      for (const inputRef of step.input) {
        if (inputRef.source.type === "in_build" && inputRef.source.assemblyId) {
          const producer = producerMap.get(inputRef.source.assemblyId);

          if (producer && producer.outputRef.to) {
            // Check if locations match
            const producerTo = producer.outputRef.to;
            const consumerFrom = inputRef.from;

            const producerLoc = `${producerTo.stationId}/${producerTo.sublocation?.type}${producerTo.sublocation?.equipmentId ? `(${producerTo.sublocation.equipmentId})` : ""}`;
            const consumerLoc = consumerFrom
              ? `${consumerFrom.stationId}/${consumerFrom.sublocation?.type}${consumerFrom.sublocation?.equipmentId ? `(${consumerFrom.sublocation.equipmentId})` : ""}`
              : "undefined";

            if (producerLoc !== consumerLoc) {
              // Fix: update consumer input.from to match producer output.to
              inputRef.from = cloneLocation(producerTo);
              fixes++;
            }
          }
        }
      }
    }
  }

  build.updatedAt = new Date().toISOString();
  return { build, fixes };
}

// Main execution
async function main() {
  const buildsDir = path.join(process.cwd(), "data/line-builds");
  const files = fs.readdirSync(buildsDir).filter((f) => f.endsWith(".json"));

  // Valid builds to skip
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

    const { build: fixedBuild, fixes } = fixBuildContinuity(build);

    if (fixes > 0) {
      fs.writeFileSync(filePath, JSON.stringify(fixedBuild, null, 2) + "\n");
      console.log(`✅ ${file}: ${fixes} continuity fix(es)`);
      totalFixes += fixes;
      buildsFixed++;
    } else {
      console.log(`✓  ${file}: no fixes needed`);
    }
  }

  console.log(`\n🎉 Continuity fixes complete: ${totalFixes} fixes across ${buildsFixed} builds`);
}

main().catch((err) => {
  console.error("Continuity fix failed:", err);
  process.exit(1);
});
