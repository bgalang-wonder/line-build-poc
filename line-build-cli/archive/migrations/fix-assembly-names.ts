#!/usr/bin/env npx tsx
/**
 * Fix S21 assembly naming warnings by replacing placeholder names (step3_v1, etc.)
 * with descriptive state names derived from step instructions.
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

// Check if assembly ID is a placeholder name
function isPlaceholderName(id: string): boolean {
  // Matches: step1_v1, step12_v1, out_s3, etc.
  return /^step\d+_v\d+$/i.test(id) || /^out_s\d+$/i.test(id);
}

// Generate a descriptive assembly ID from step instruction
function generateDescriptiveName(step: Step, existingIds: Set<string>): string {
  const instruction = step.instruction.toLowerCase();
  const actionFamily = step.action.family.toLowerCase();

  // Extract the main subject from instruction
  let subject = "";

  // Common patterns to extract subject
  const patterns = [
    // "Place X from Y" or "Get X from Y"
    /(?:place|get|retrieve|grab)\s+(.+?)(?:\s+from|\s+to|\s+on|\s+in|$)/i,
    // "Add X to Y" or "Fill X"
    /(?:add|fill|portion|pour)\s+(.+?)(?:\s+to|\s+from|\s+on|\s+in|$)/i,
    // "Cook X" or "Heat X" or "Fry X"
    /(?:cook|heat|fry|bake|toast|grill|press)\s+(.+?)(?:\s+in|\s+for|\s+on|$)/i,
    // "Open X" or "Cut X"
    /(?:open|cut|slice|dice|chop)\s+(.+?)(?:\s+from|\s+to|$)/i,
    // "Apply X" or "Wrap X"
    /(?:apply|wrap|fold|roll|close|seal|lid)\s+(.+?)(?:\s+to|\s+from|$)/i,
    // "Pass X to Y"
    /(?:pass)\s+(.+?)(?:\s+to|$)/i,
    // Fallback: first noun-like phrase
    /^(?:the\s+)?(.+?)(?:\s+(?:from|to|in|on|for|with)|$)/i,
  ];

  for (const pattern of patterns) {
    const match = instruction.match(pattern);
    if (match && match[1]) {
      subject = match[1].trim();
      break;
    }
  }

  // If no subject found, use action family + step number
  if (!subject) {
    subject = `${actionFamily}_output`;
  }

  // Clean up and format
  subject = subject
    .replace(/[^a-z0-9\s]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase()
    .substring(0, 30);

  // Add action context if helpful
  let baseName = subject;

  // Add state suffix based on action
  const stateSuffixes: Record<string, string> = {
    HEAT: "_cooked",
    PREP: "_prepped",
    PORTION: "_portioned",
    ASSEMBLE: "_assembled",
    COMBINE: "_combined",
    PACKAGING: "_packaged",
    CHECK: "_checked",
  };

  // Don't add suffix if subject already implies state
  const stateWords = ["cooked", "prepped", "portioned", "assembled", "combined", "packaged", "pressed", "toasted", "grilled", "fried", "baked", "opened", "cut", "sliced"];
  const hasStateWord = stateWords.some((word) => subject.includes(word));

  if (!hasStateWord && stateSuffixes[step.action.family]) {
    baseName = subject + stateSuffixes[step.action.family];
  }

  // Make unique by adding version suffix
  let candidateId = `${baseName}_v1`;
  let version = 1;

  while (existingIds.has(candidateId)) {
    version++;
    candidateId = `${baseName}_v${version}`;
  }

  return candidateId;
}

// Fix assembly names in a build
function fixAssemblyNames(build: Build): { build: Build; renames: number } {
  const renames: Array<{ oldId: string; newId: string }> = [];
  const existingIds = new Set<string>();

  // Collect all existing assembly IDs
  if (build.assemblies) {
    for (const a of build.assemblies) {
      if (!isPlaceholderName(a.id)) {
        existingIds.add(a.id);
      }
    }
  }

  // Also collect non-placeholder IDs from steps
  for (const step of build.steps) {
    if (step.output) {
      for (const ref of step.output) {
        if (ref.source.type === "in_build" && ref.source.assemblyId && !isPlaceholderName(ref.source.assemblyId)) {
          existingIds.add(ref.source.assemblyId);
        }
      }
    }
    if (step.input) {
      for (const ref of step.input) {
        if (ref.source.type === "in_build" && ref.source.assemblyId && !isPlaceholderName(ref.source.assemblyId)) {
          existingIds.add(ref.source.assemblyId);
        }
      }
    }
  }

  // Find placeholder names and generate new names
  for (const step of build.steps) {
    if (step.output) {
      for (const ref of step.output) {
        if (ref.source.type === "in_build" && ref.source.assemblyId && isPlaceholderName(ref.source.assemblyId)) {
          const oldId = ref.source.assemblyId;

          // Check if we already renamed this
          const existingRename = renames.find((r) => r.oldId === oldId);
          if (existingRename) {
            continue;
          }

          const newId = generateDescriptiveName(step, existingIds);
          existingIds.add(newId);
          renames.push({ oldId, newId });
        }
      }
    }
  }

  if (renames.length === 0) {
    return { build, renames: 0 };
  }

  // Apply renames throughout the build
  const renameMap = new Map(renames.map((r) => [r.oldId, r.newId]));

  // Rename in steps
  for (const step of build.steps) {
    if (step.output) {
      for (const ref of step.output) {
        if (ref.source.type === "in_build" && ref.source.assemblyId) {
          const newId = renameMap.get(ref.source.assemblyId);
          if (newId) {
            ref.source.assemblyId = newId;
          }
        }
      }
    }
    if (step.input) {
      for (const ref of step.input) {
        if (ref.source.type === "in_build" && ref.source.assemblyId) {
          const newId = renameMap.get(ref.source.assemblyId);
          if (newId) {
            ref.source.assemblyId = newId;
          }
        }
      }
    }
  }

  // Rename in assemblies array
  if (build.assemblies) {
    for (const assembly of build.assemblies) {
      const newId = renameMap.get(assembly.id);
      if (newId) {
        assembly.id = newId;
        // Also update the name to be more descriptive
        assembly.name = newId.replace(/_/g, " ").replace(/ v\d+$/, "");
      }

      // Update subAssemblies references
      if (assembly.subAssemblies) {
        assembly.subAssemblies = assembly.subAssemblies.map((subId) => renameMap.get(subId) || subId);
      }

      // Update lineage references
      if (assembly.lineage?.evolvesFrom) {
        const newEvolvesFrom = renameMap.get(assembly.lineage.evolvesFrom);
        if (newEvolvesFrom) {
          assembly.lineage.evolvesFrom = newEvolvesFrom;
        }
      }
    }
  }

  // Update primaryOutputAssemblyId
  if (build.primaryOutputAssemblyId) {
    const newPrimaryId = renameMap.get(build.primaryOutputAssemblyId);
    if (newPrimaryId) {
      build.primaryOutputAssemblyId = newPrimaryId;
    }
  }

  build.updatedAt = new Date().toISOString();
  return { build, renames: renames.length };
}

// Main execution
async function main() {
  const buildsDir = path.join(process.cwd(), "data/line-builds");
  const files = fs.readdirSync(buildsDir).filter((f) => f.endsWith(".json"));

  // Valid builds to skip
  const skipBuilds = new Set(["baked-potato-mainstay-v1.json", "cheese-fries-burger-baby-8009068.json"]);

  let totalRenames = 0;
  let buildsFixed = 0;

  for (const file of files) {
    if (skipBuilds.has(file)) {
      console.log(`⏭️  Skipping ${file} (gold example)`);
      continue;
    }

    const filePath = path.join(buildsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const build: Build = JSON.parse(content);

    const { build: fixedBuild, renames } = fixAssemblyNames(build);

    if (renames > 0) {
      fs.writeFileSync(filePath, JSON.stringify(fixedBuild, null, 2) + "\n");
      console.log(`✅ ${file}: ${renames} assembly name(s) improved`);
      totalRenames += renames;
      buildsFixed++;
    } else {
      console.log(`✓  ${file}: no placeholder names found`);
    }
  }

  console.log(`\n🎉 Assembly naming complete: ${totalRenames} renames across ${buildsFixed} builds`);
}

main().catch((err) => {
  console.error("Assembly naming fix failed:", err);
  process.exit(1);
});
