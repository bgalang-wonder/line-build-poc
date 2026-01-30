#!/usr/bin/env npx tsx
/**
 * Migrate a build from artifactId/artifacts to assemblyId/assemblies
 */
import * as fs from "fs";
import * as path from "path";

const buildId = process.argv[2];
if (!buildId) {
  console.error("Usage: npx tsx scripts/migrate-artifact-to-assembly.ts <buildId>");
  process.exit(1);
}

const buildPath = path.join(__dirname, `../data/line-builds/${buildId}.json`);
if (!fs.existsSync(buildPath)) {
  console.error(`Build not found: ${buildPath}`);
  process.exit(1);
}

const content = fs.readFileSync(buildPath, "utf-8");
let build = JSON.parse(content);

let changed = false;

// Migrate artifacts -> assemblies
if (build.artifacts && !build.assemblies) {
  build.assemblies = build.artifacts;
  delete build.artifacts;
  changed = true;
  console.log("Migrated artifacts -> assemblies");
}

// Migrate components -> subAssemblies in assemblies
for (const asm of build.assemblies ?? []) {
  if (asm.components && !asm.subAssemblies) {
    asm.subAssemblies = asm.components;
    delete asm.components;
    changed = true;
  }
}

// Migrate artifactId -> assemblyId in all steps
for (const step of build.steps ?? []) {
  for (const inp of step.input ?? []) {
    if (inp.source?.artifactId) {
      inp.source.assemblyId = inp.source.artifactId;
      delete inp.source.artifactId;
      changed = true;
    }
  }
  for (const out of step.output ?? []) {
    if (out.source?.artifactId) {
      out.source.assemblyId = out.source.artifactId;
      delete out.source.artifactId;
      changed = true;
    }
  }
}

if (changed) {
  fs.writeFileSync(buildPath, JSON.stringify(build, null, 2) + "\n");
  console.log(`Migrated ${buildId}`);
} else {
  console.log(`No changes needed for ${buildId}`);
}
