#!/usr/bin/env npx tsx
/**
 * Fix H44 multiple producer issues in a build
 * Changes the second producer's output to a unique assembly ID
 */
import * as fs from "fs";
import * as path from "path";

const buildId = process.argv[2];
if (!buildId) {
  console.error("Usage: npx tsx scripts/fix-h44-multiple-producers.ts <buildId>");
  process.exit(1);
}

const buildPath = path.join(__dirname, `../data/line-builds/${buildId}.json`);
if (!fs.existsSync(buildPath)) {
  console.error(`Build not found: ${buildPath}`);
  process.exit(1);
}

const build = JSON.parse(fs.readFileSync(buildPath, "utf-8"));

// Find all assembly outputs
const outputsByAssembly = new Map<string, Array<{ stepId: string; stepIndex: number }>>();
for (let i = 0; i < build.steps.length; i++) {
  const step = build.steps[i];
  for (const out of step.output ?? []) {
    const assemblyId = out.source?.assemblyId;
    if (!assemblyId) continue;
    const list = outputsByAssembly.get(assemblyId) ?? [];
    list.push({ stepId: step.id, stepIndex: i });
    outputsByAssembly.set(assemblyId, list);
  }
}

// Find and fix multiple producers
let changed = false;
for (const [assemblyId, producers] of outputsByAssembly) {
  if (producers.length > 1) {
    console.log(`Assembly '${assemblyId}' has ${producers.length} producers: ${producers.map(p => p.stepId).join(", ")}`);

    // For each producer after the first, rename the output
    for (let i = 1; i < producers.length; i++) {
      const producer = producers[i];
      const step = build.steps[producer.stepIndex];
      const newAssemblyId = `${assemblyId}_at_${step.stationId || 'unknown'}`;

      // Update output
      for (const out of step.output ?? []) {
        if (out.source?.assemblyId === assemblyId) {
          out.source.assemblyId = newAssemblyId;
          console.log(`  Fixed ${step.id}: output changed to '${newAssemblyId}'`);
          changed = true;
        }
      }

      // Update downstream consumers
      for (let j = producer.stepIndex + 1; j < build.steps.length; j++) {
        const downstream = build.steps[j];
        for (const inp of downstream.input ?? []) {
          if (inp.source?.assemblyId === assemblyId) {
            // Check if this step depends on the renamed producer
            if (downstream.dependsOn?.includes(step.id)) {
              inp.source.assemblyId = newAssemblyId;
              console.log(`  Updated ${downstream.id}: input changed to '${newAssemblyId}'`);
              changed = true;
            }
          }
        }
      }

      // Add assembly definition if needed
      const assemblies = build.assemblies ?? [];
      const exists = assemblies.some((a: any) => a.id === newAssemblyId);
      if (!exists) {
        const original = assemblies.find((a: any) => a.id === assemblyId);
        assemblies.push({
          id: newAssemblyId,
          name: `${original?.name ?? assemblyId} at ${step.stationId || 'unknown'}`,
          groupId: original?.groupId ?? "default",
          lineage: { evolvesFrom: assemblyId }
        });
        build.assemblies = assemblies;
        console.log(`  Added assembly: ${newAssemblyId}`);
        changed = true;
      }
    }
  }
}

if (changed) {
  fs.writeFileSync(buildPath, JSON.stringify(build, null, 2) + "\n");
  console.log(`\nBuild saved: ${buildPath}`);
} else {
  console.log("No H44 issues found");
}
