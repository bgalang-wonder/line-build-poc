#!/usr/bin/env npx tsx
/**
 * Fix all remaining errors in beef-barbacoa-quesadilla-8006896:
 * - H33: Change techniqueId "retrieve" to "get" for PREP steps
 * - H38: Remove authored TRANSFER step-3, rewire material flow
 * - H39: Add step.from/step.to with sublocation.type for all steps
 * - H41: Add output assembly to step-12 (spray Vegalene)
 */
import * as fs from "fs";
import * as path from "path";

const buildPath = path.join(__dirname, "../data/line-builds/beef-barbacoa-quesadilla-8006896.json");
const build = JSON.parse(fs.readFileSync(buildPath, "utf-8"));

// Track changes
const changes: string[] = [];

// Step locations based on CSV data and kitchen logic
// Format: { from: { stationId?, sublocation: { type, equipmentId? } }, to: { stationId?, sublocation: { type, equipmentId? } } }
const stepLocations: Record<string, {
  from?: { stationId?: string; sublocation: { type: string; equipmentId?: string } };
  to?: { stationId?: string; sublocation: { type: string; equipmentId?: string } };
}> = {
  // Step 1: Retrieve brisket from cold storage → waterbath
  "step-1": {
    from: { stationId: "hot_side", sublocation: { type: "cold_storage" } },
    to: { stationId: "hot_side", sublocation: { type: "equipment", equipmentId: "waterbath" } }
  },
  // Step 2: Cook in waterbath
  "step-2": {
    from: { stationId: "hot_side", sublocation: { type: "equipment", equipmentId: "waterbath" } },
    to: { stationId: "hot_side", sublocation: { type: "equipment", equipmentId: "waterbath" } }
  },
  // Step 3 will be REMOVED (TRANSFER)
  // Step 4: Retrieve foil from dry rail
  "step-4": {
    from: { stationId: "garnish", sublocation: { type: "dry_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 5: Retrieve tortilla from dry rail
  "step-5": {
    from: { stationId: "garnish", sublocation: { type: "dry_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 6: Assemble tortilla on foil
  "step-6": {
    from: { stationId: "garnish", sublocation: { type: "work_surface" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 7: Open brisket pouch (comes from waterbath via material flow)
  "step-7": {
    from: { stationId: "garnish", sublocation: { type: "work_surface" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 8: Spread brisket on tortilla
  "step-8": {
    from: { stationId: "garnish", sublocation: { type: "work_surface" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 9: Portion cheese from cold rail
  "step-9": {
    from: { stationId: "garnish", sublocation: { type: "cold_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 10: Portion onion from cold rail
  "step-10": {
    from: { stationId: "garnish", sublocation: { type: "cold_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 11: Fold quesadilla
  "step-11": {
    from: { stationId: "garnish", sublocation: { type: "work_surface" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 12: Spray press with Vegalene (from dry rail)
  "step-12": {
    from: { stationId: "hot_side", sublocation: { type: "dry_rail" } },
    to: { stationId: "hot_side", sublocation: { type: "equipment", equipmentId: "press" } }
  },
  // Step 13: Press quesadilla
  "step-13": {
    from: { stationId: "garnish", sublocation: { type: "work_surface" } },
    to: { stationId: "hot_side", sublocation: { type: "equipment", equipmentId: "press" } }
  },
  // Step 14: Cut quesadilla at press station
  "step-14": {
    from: { stationId: "hot_side", sublocation: { type: "equipment", equipmentId: "press" } },
    to: { stationId: "hot_side", sublocation: { type: "work_surface" } }
  },
  // Step 15: Retrieve 28oz container from packaging
  "step-15": {
    from: { stationId: "garnish", sublocation: { type: "packaging" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 16: Place quesadilla in container
  "step-16": {
    from: { stationId: "hot_side", sublocation: { type: "work_surface" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 17: Portion lime from cold rail
  "step-17": {
    from: { stationId: "garnish", sublocation: { type: "cold_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 18: Apply lid
  "step-18": {
    from: { stationId: "garnish", sublocation: { type: "dry_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 19: Apply sleeve
  "step-19": {
    from: { stationId: "garnish", sublocation: { type: "dry_rail" } },
    to: { stationId: "garnish", sublocation: { type: "work_surface" } }
  },
  // Step 20: Pass to expo
  "step-20": {
    from: { stationId: "garnish", sublocation: { type: "work_surface" } },
    to: { stationId: "expo", sublocation: { type: "window_shelf" } }
  },
  // Step 21: Retrieve salsa from cold storage (vending)
  "step-21": {
    from: { stationId: "vending", sublocation: { type: "cold_storage" } },
    to: { stationId: "vending", sublocation: { type: "work_surface" } }
  },
  // Step 22: Pass salsa to expo
  "step-22": {
    from: { stationId: "vending", sublocation: { type: "work_surface" } },
    to: { stationId: "expo", sublocation: { type: "window_shelf" } }
  }
};

// 1. Fix H33: Change techniqueId "retrieve" to "get" for PREP steps
for (const step of build.steps) {
  if (step.action?.family === "PREP" && step.action?.techniqueId === "retrieve") {
    step.action.techniqueId = "get";
    changes.push(`[H33] ${step.id}: Changed techniqueId from 'retrieve' to 'get'`);
  }
}

// 2. Fix H38: Remove TRANSFER step-3 and rewire material flow
const transferStepIndex = build.steps.findIndex((s: any) => s.id === "step-3");
if (transferStepIndex !== -1) {
  const transferStep = build.steps[transferStepIndex];

  // Get the output assembly of step-3 (brisket_cooked_at_other)
  // Step 7 depends on step-3 and consumes brisket_cooked_at_other
  // We need to rewire step-7 to consume brisket_cooked directly from waterbath

  // Remove step-3
  build.steps.splice(transferStepIndex, 1);
  changes.push(`[H38] Removed authored TRANSFER step-3`);

  // Update step-7 to consume brisket_cooked directly (from waterbath equipment)
  const step7 = build.steps.find((s: any) => s.id === "step-7");
  if (step7) {
    // Update input to reference brisket_cooked instead of brisket_cooked_at_other
    for (const inp of step7.input ?? []) {
      if (inp.source?.assemblyId === "brisket_cooked_at_other") {
        inp.source.assemblyId = "brisket_cooked";
        inp.from = {
          stationId: "hot_side",
          sublocation: { type: "equipment", equipmentId: "waterbath" }
        };
        changes.push(`[H38] step-7: Updated input to consume 'brisket_cooked' from waterbath`);
      }
    }
    // Update dependsOn: remove step-3, add step-2
    step7.dependsOn = step7.dependsOn?.filter((d: string) => d !== "step-3") ?? [];
    if (!step7.dependsOn.includes("step-2")) {
      step7.dependsOn.push("step-2");
      changes.push(`[H38] step-7: Updated dependsOn to reference step-2 instead of step-3`);
    }
  }

  // Remove the now-orphan assembly brisket_cooked_at_other
  build.assemblies = build.assemblies?.filter((a: any) => a.id !== "brisket_cooked_at_other") ?? [];
  changes.push(`[H38] Removed orphan assembly 'brisket_cooked_at_other'`);
}

// 3. Fix H39: Add step.from and step.to with sublocation for all remaining steps
for (const step of build.steps) {
  const loc = stepLocations[step.id];
  if (loc) {
    if (loc.from && !step.from?.sublocation?.type) {
      step.from = loc.from;
      changes.push(`[H39] ${step.id}: Added step.from with sublocation`);
    }
    if (loc.to && !step.to?.sublocation?.type) {
      step.to = loc.to;
      changes.push(`[H39] ${step.id}: Added step.to with sublocation`);
    }
  }
}

// 4. Fix H41: Add output assembly to step-12 (spray Vegalene)
const step12 = build.steps.find((s: any) => s.id === "step-12");
if (step12 && (!step12.output || step12.output.length === 0)) {
  // Add an output representing the prepared press
  step12.output = [{
    source: { type: "in_build", assemblyId: "press_prepared" },
    to: {
      stationId: "hot_side",
      sublocation: { type: "equipment", equipmentId: "press" }
    }
  }];
  changes.push(`[H41] step-12: Added output assembly 'press_prepared'`);

  // Also add input for the Vegalene from dry rail
  step12.input = [{
    source: { type: "in_build", assemblyId: "vegalene" },
    from: {
      stationId: "hot_side",
      sublocation: { type: "dry_rail" }
    }
  }];
  changes.push(`[H41] step-12: Added input assembly 'vegalene' from dry rail`);

  // Add assembly definitions
  const hasPressPrepared = build.assemblies?.some((a: any) => a.id === "press_prepared");
  const hasVegalene = build.assemblies?.some((a: any) => a.id === "vegalene");

  if (!hasPressPrepared) {
    build.assemblies = build.assemblies ?? [];
    build.assemblies.push({
      id: "press_prepared",
      name: "Press (prepared)",
      groupId: "equipment"
    });
    changes.push(`[H41] Added assembly 'press_prepared'`);
  }

  if (!hasVegalene) {
    build.assemblies = build.assemblies ?? [];
    build.assemblies.push({
      id: "vegalene",
      name: "Vegalene",
      groupId: "supplies"
    });
    changes.push(`[H41] Added assembly 'vegalene'`);
  }

  // Update step-13 to depend on step-12 (the press prep)
  const step13 = build.steps.find((s: any) => s.id === "step-13");
  if (step13 && !step13.dependsOn?.includes("step-12")) {
    step13.dependsOn = step13.dependsOn ?? [];
    step13.dependsOn.push("step-12");
    changes.push(`[H41] step-13: Added dependency on step-12`);
  }
}

// 5. Renumber orderIndex after removing step-3
build.steps.forEach((step: any, index: number) => {
  step.orderIndex = index;
});
changes.push(`Renumbered all orderIndex values`);

// Save
fs.writeFileSync(buildPath, JSON.stringify(build, null, 2) + "\n");

console.log(`Fixed ${changes.length} issues:\n`);
changes.forEach(c => console.log(`  ${c}`));
console.log(`\nBuild saved: ${buildPath}`);
