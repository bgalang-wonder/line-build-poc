#!/usr/bin/env npx tsx
/**
 * Migration script to update line builds to new material-flow rules (H38-H42, H33)
 *
 * Transformations:
 * - H38: Convert authored TRANSFER steps to PREP/get or CHECK
 * - H39: Add step-level from/to with sublocation.type
 * - H40: Add input[].from and output[].to with sublocation.type
 * - H41: Ensure every step has output[]
 * - H33: Fix invalid techniqueId (retrieve -> get)
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

interface Assembly {
  id: string;
  name: string;
  groupId?: string;
  lineage?: { evolvesFrom?: string };
  subAssemblies?: string[];
}

interface Step {
  id: string;
  orderIndex: number;
  trackId?: string;
  action: {
    family: string;
    techniqueId?: string;
  };
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
  provenance?: any;
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

// Helper to infer sublocation type from step context
function inferSublocationTypeFromStep(step: Step): string {
  // Station-based inference
  if (step.stationId === "expo") {
    return "window_shelf";
  }

  // Vending station only allows "equipment" sublocation
  if (step.stationId === "vending") {
    return "equipment";
  }

  // Equipment-based inference - only if we have an applianceId
  if (step.equipment?.applianceId) {
    return "equipment";
  }

  // Storage-based inference
  if (step.storageLocation?.type) {
    const storageType = step.storageLocation.type;
    if (storageType === "cold_storage" || storageType === "cold_rail" || storageType === "dry_rail") {
      return storageType;
    }
  }

  // Action family inference
  if (step.action.family === "PACKAGING" && step.container) {
    return "packaging";
  }

  // Default to work_surface
  return "work_surface";
}

// Helper to derive from location
function deriveFromLocation(step: Step): Location {
  const stationId = step.stationId || "other";
  let sublocationType = step.sublocation?.type || inferSublocationTypeFromStep(step);

  // For retrieval steps, from is typically storage
  if (step.action.family === "PREP" && step.action.techniqueId === "get") {
    if (step.storageLocation?.type) {
      sublocationType = step.storageLocation.type;
    } else if (step.instruction.toLowerCase().includes("cold")) {
      sublocationType = "cold_storage";
    } else if (step.instruction.toLowerCase().includes("dry")) {
      sublocationType = "dry_rail";
    } else if (step.instruction.toLowerCase().includes("packaging")) {
      sublocationType = "packaging";
    }
  }

  const loc: Location = {
    stationId,
    sublocation: { type: sublocationType },
  };

  // Add equipmentId if relevant
  if (sublocationType === "equipment" && step.equipment?.applianceId) {
    loc.sublocation!.equipmentId = step.equipment.applianceId;
  }

  return loc;
}

// Helper to derive to location
function deriveToLocation(step: Step): Location {
  const stationId = step.stationId || "other";
  let sublocationType = step.sublocation?.type || inferSublocationTypeFromStep(step);

  // For expo handoff, to is window_shelf
  if (step.stationId === "expo") {
    sublocationType = "window_shelf";
  }

  const loc: Location = {
    stationId,
    sublocation: { type: sublocationType },
  };

  // Add equipmentId if relevant
  if (sublocationType === "equipment" && step.equipment?.applianceId) {
    loc.sublocation!.equipmentId = step.equipment.applianceId;
  }

  return loc;
}

// Generate assembly ID from step
function generateAssemblyId(step: Step, version: string = "v1"): string {
  // Extract main component from instruction
  const instruction = step.instruction.toLowerCase();

  // Try to extract component name
  let component = "";

  // Common patterns: "Place X", "Get X", "Fill X", "Add X"
  const placeMatch = instruction.match(/(?:place|get|retrieve)\s+(.+?)(?:\s+from|\s+to|$)/i);
  const fillMatch = instruction.match(/(?:fill|add|portion)\s+(.+?)(?:\s+from|\s+to|$)/i);
  const cookMatch = instruction.match(/(?:cook|heat|fry)\s+(.+?)(?:\s+in|\s+for|$)/i);

  if (placeMatch) {
    component = placeMatch[1];
  } else if (fillMatch) {
    component = fillMatch[1];
  } else if (cookMatch) {
    component = cookMatch[1];
  } else {
    // Fallback: use step id
    component = step.id;
  }

  // Clean up and format
  component = component
    .replace(/[^a-z0-9\s]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase()
    .substring(0, 30);

  return `${component}_${version}`;
}

// Transform a TRANSFER step to appropriate family
function transformTransferStep(step: Step): Step {
  const newStep = { ...step };
  const instruction = step.instruction.toLowerCase();

  // Pass to expo -> CHECK
  if (instruction.includes("pass") && (instruction.includes("expo") || step.stationId === "expo")) {
    newStep.action = { family: "CHECK" };
    delete newStep.action.techniqueId;
  }
  // Place from storage -> PREP/get
  else if (instruction.includes("place") || instruction.includes("get") || instruction.includes("retrieve")) {
    newStep.action = { family: "PREP", techniqueId: "get" };
  }
  // Default to PREP/get
  else {
    newStep.action = { family: "PREP", techniqueId: "get" };
  }

  return newStep;
}

// Fix invalid techniqueId values
function fixTechniqueId(step: Step): Step {
  const newStep = { ...step };

  if (newStep.action.techniqueId === "retrieve") {
    newStep.action.techniqueId = "get";
  }

  // Remove techniqueId from CHECK steps
  if (newStep.action.family === "CHECK" && newStep.action.techniqueId) {
    delete newStep.action.techniqueId;
  }

  // Remove invalid techniqueIds (pass, place) for non-TRANSFER
  if (newStep.action.family !== "TRANSFER") {
    if (newStep.action.techniqueId === "pass" || newStep.action.techniqueId === "place") {
      if (newStep.action.family === "PREP") {
        newStep.action.techniqueId = "get";
      } else {
        delete newStep.action.techniqueId;
      }
    }
  }

  return newStep;
}

// Fix location sublocation for assembly refs
function fixAssemblyRefLocation(loc: Location | undefined, step: Step): Location {
  if (!loc || !loc.sublocation) {
    return deriveToLocation(step);
  }

  // Vending station only allows equipment sublocation with vending equipmentId
  if (loc.stationId === "vending" || step.stationId === "vending") {
    return {
      stationId: "vending",
      sublocation: { type: "equipment", equipmentId: "vending" },
    };
  }

  // If sublocation.type is 'equipment' but no equipmentId, fix it
  if (loc.sublocation.type === "equipment" && !loc.sublocation.equipmentId) {
    if (step.equipment?.applianceId) {
      return {
        ...loc,
        sublocation: { type: "equipment", equipmentId: step.equipment.applianceId },
      };
    } else {
      return {
        ...loc,
        sublocation: { type: "work_surface" },
      };
    }
  }

  return loc;
}

// Add material flow (input/output) to a step
function addMaterialFlow(
  step: Step,
  prevOutputAssemblyId: string | null,
  assemblies: Map<string, Assembly>
): { step: Step; outputAssemblyId: string } {
  const newStep = { ...step };

  // Generate assembly ID for this step's output
  const outputAssemblyId = generateAssemblyId(step);

  // Ensure output array exists and has material flow
  if (!newStep.output || newStep.output.length === 0) {
    const toLocation = deriveToLocation(step);
    newStep.output = [
      {
        source: { type: "in_build", assemblyId: outputAssemblyId },
        to: fixAssemblyRefLocation(toLocation, step),
      },
    ];
  } else {
    // Ensure existing outputs have to locations and fix equipment sublocation
    newStep.output = newStep.output.map((out) => {
      if (!out.to) {
        out.to = deriveToLocation(step);
      }
      out.to = fixAssemblyRefLocation(out.to, step);
      return out;
    });
  }

  // Ensure input array exists for steps with dependencies
  if (!newStep.input) {
    newStep.input = [];
  }

  // Add input from previous step if this step has dependencies
  if (prevOutputAssemblyId && newStep.dependsOn && newStep.dependsOn.length > 0 && newStep.input.length === 0) {
    const fromLocation = deriveFromLocation(step);
    newStep.input = [
      {
        source: { type: "in_build", assemblyId: prevOutputAssemblyId },
        from: fixAssemblyRefLocation(fromLocation, step),
      },
    ];
  } else if (newStep.input.length > 0) {
    // Ensure existing inputs have from locations and fix equipment sublocation
    newStep.input = newStep.input.map((inp) => {
      if (!inp.from) {
        inp.from = deriveFromLocation(step);
      }
      inp.from = fixAssemblyRefLocation(inp.from, step);
      return inp;
    });
  }

  // Create assembly if it doesn't exist
  if (!assemblies.has(outputAssemblyId)) {
    assemblies.set(outputAssemblyId, {
      id: outputAssemblyId,
      name: step.instruction.substring(0, 50),
      groupId: step.trackId || "main",
    });
  }

  return { step: newStep, outputAssemblyId };
}

// Fix sublocation: equipment type requires equipmentId
function fixEquipmentSublocation(loc: Location | undefined, step: Step): Location {
  if (!loc || !loc.sublocation) {
    return deriveToLocation(step);
  }

  // Vending station only allows equipment sublocation with vending equipmentId
  if (loc.stationId === "vending" || step.stationId === "vending") {
    return {
      stationId: "vending",
      sublocation: { type: "equipment", equipmentId: "vending" },
    };
  }

  // If sublocation.type is 'equipment' but no equipmentId, fix it
  if (loc.sublocation.type === "equipment" && !loc.sublocation.equipmentId) {
    // If step has equipment, use that
    if (step.equipment?.applianceId) {
      loc.sublocation.equipmentId = step.equipment.applianceId;
    } else {
      // Otherwise change to work_surface
      loc.sublocation.type = "work_surface";
    }
  }

  return loc;
}

// Fix step-level from/to locations (H39)
function fixStepLocations(step: Step): Step {
  const newStep = { ...step };

  // Ensure from has sublocation
  if (!newStep.from || !newStep.from.sublocation?.type) {
    newStep.from = deriveFromLocation(step);
  }

  // Ensure to has sublocation
  if (!newStep.to || !newStep.to.sublocation?.type) {
    newStep.to = deriveToLocation(step);
  }

  // Remove empty from/to objects
  if (newStep.from && Object.keys(newStep.from).length === 0) {
    newStep.from = deriveFromLocation(step);
  }
  if (newStep.to && Object.keys(newStep.to).length === 0) {
    newStep.to = deriveToLocation(step);
  }

  // Fix equipment sublocation without equipmentId
  newStep.from = fixEquipmentSublocation(newStep.from, step);
  newStep.to = fixEquipmentSublocation(newStep.to, step);

  // Also fix legacy sublocation field
  if (newStep.sublocation) {
    // Vending station requires equipment sublocation with vending equipmentId
    if (newStep.stationId === "vending") {
      newStep.sublocation = { type: "equipment", equipmentId: "vending" };
    } else if (newStep.sublocation.type === "equipment" && !newStep.sublocation.equipmentId) {
      if (step.equipment?.applianceId) {
        newStep.sublocation.equipmentId = step.equipment.applianceId;
      } else {
        newStep.sublocation.type = "work_surface";
      }
    }
  }

  return newStep;
}

// Infer groupingId from station
function inferGroupingId(step: Step): string {
  if (step.groupingId) return step.groupingId;

  const stationId = step.stationId || "";

  // Hot side equipment
  const hotSideStations = [
    "fryer",
    "waterbath",
    "turbo",
    "toaster",
    "salamander",
    "clamshell_grill",
    "press",
    "induction",
    "conveyor",
    "hot_box",
    "hot_well",
    "rice_cooker",
    "pasta_cooker",
    "pizza_oven",
    "pizza_conveyor_oven",
    "steam_well",
    "sauce_warmer",
  ];

  if (hotSideStations.includes(stationId)) {
    return "hot_side";
  }

  if (stationId === "vending") {
    return "vending";
  }

  // Cold side by default
  return "cold_side";
}

// Main migration function for a single build
function migrateBuild(build: Build): Build {
  const newBuild: Build = {
    ...build,
    assemblies: build.assemblies || [],
    steps: [],
  };

  const assemblies = new Map<string, Assembly>();

  // Initialize assemblies from existing
  if (build.assemblies) {
    for (const a of build.assemblies) {
      assemblies.set(a.id, a);
    }
  }

  // Group steps by track
  const stepsByTrack = new Map<string, Step[]>();
  for (const step of build.steps) {
    const trackId = step.trackId || "main";
    if (!stepsByTrack.has(trackId)) {
      stepsByTrack.set(trackId, []);
    }
    stepsByTrack.get(trackId)!.push(step);
  }

  // Sort steps within each track by orderIndex
  for (const steps of stepsByTrack.values()) {
    steps.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  // Process each track
  const processedSteps: Step[] = [];
  const stepOutputMap = new Map<string, string>(); // stepId -> outputAssemblyId

  for (const [trackId, steps] of stepsByTrack) {
    let prevOutputAssemblyId: string | null = null;

    for (const step of steps) {
      let newStep = { ...step };

      // 1. Transform TRANSFER steps (H38)
      if (newStep.action.family === "TRANSFER") {
        newStep = transformTransferStep(newStep);
      }

      // 2. Fix techniqueId (H33)
      newStep = fixTechniqueId(newStep);

      // 3. Fix step-level from/to (H39)
      newStep = fixStepLocations(newStep);

      // 4. Add material flow (H41, H40)
      const { step: stepWithFlow, outputAssemblyId } = addMaterialFlow(newStep, prevOutputAssemblyId, assemblies);
      newStep = stepWithFlow;

      // 5. Infer groupingId
      newStep.groupingId = inferGroupingId(newStep);

      // Track output for next step
      stepOutputMap.set(newStep.id, outputAssemblyId);
      prevOutputAssemblyId = outputAssemblyId;

      // Remove provenance (not needed in final output)
      delete newStep.provenance;

      processedSteps.push(newStep);
    }
  }

  // Second pass: fix inputs based on dependsOn
  for (const step of processedSteps) {
    if (step.dependsOn && step.dependsOn.length > 0 && step.input && step.input.length === 0) {
      // Get first dependency's output assembly
      const depId = step.dependsOn[0];
      const depOutput = stepOutputMap.get(depId);
      if (depOutput) {
        step.input = [
          {
            source: { type: "in_build", assemblyId: depOutput },
            from: step.from || deriveFromLocation(step),
          },
        ];
      }
    }

    // Handle merge steps (multiple dependencies)
    if (step.dependsOn && step.dependsOn.length > 1 && step.input) {
      const existingIds = new Set(step.input.map((i) => i.source.assemblyId));

      for (let i = 0; i < step.dependsOn.length; i++) {
        const depId = step.dependsOn[i];
        const depOutput = stepOutputMap.get(depId);

        if (depOutput && !existingIds.has(depOutput)) {
          step.input.push({
            source: { type: "in_build", assemblyId: depOutput },
            from: step.from || deriveFromLocation(step),
            role: i === 0 ? "base" : "added",
          });
          existingIds.add(depOutput);
        }
      }

      // Add roles if we have multiple inputs
      if (step.input.length > 1) {
        step.input[0].role = "base";
        for (let i = 1; i < step.input.length; i++) {
          if (!step.input[i].role) {
            step.input[i].role = "added";
          }
        }
      }
    }
  }

  newBuild.steps = processedSteps;
  newBuild.assemblies = Array.from(assemblies.values());

  // Set primaryOutputAssemblyId from last step of main track
  const mainTrackSteps = processedSteps.filter((s) => (s.trackId || "main") === "main");
  if (mainTrackSteps.length > 0) {
    const lastMainStep = mainTrackSteps[mainTrackSteps.length - 1];
    if (lastMainStep.output && lastMainStep.output.length > 0) {
      const lastOutput = lastMainStep.output[0].source;
      if (lastOutput.type === "in_build" && lastOutput.assemblyId) {
        newBuild.primaryOutputAssemblyId = lastOutput.assemblyId;
      }
    }
  }

  // Update timestamp
  newBuild.updatedAt = new Date().toISOString();

  return newBuild;
}

// Main execution
async function main() {
  const buildsDir = path.join(process.cwd(), "data/line-builds");
  const files = fs.readdirSync(buildsDir).filter((f) => f.endsWith(".json"));

  // Valid builds to skip
  const skipBuilds = new Set(["baked-potato-mainstay-v1.json", "cheese-fries-burger-baby-8009068.json"]);

  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    if (skipBuilds.has(file)) {
      console.log(`⏭️  Skipping ${file} (already valid)`);
      skipped++;
      continue;
    }

    const filePath = path.join(buildsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const build: Build = JSON.parse(content);

    console.log(`📝 Migrating ${file}...`);

    const migratedBuild = migrateBuild(build);

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(migratedBuild, null, 2) + "\n");

    processed++;
    console.log(`   ✅ Done (${migratedBuild.steps.length} steps, ${migratedBuild.assemblies?.length || 0} assemblies)`);
  }

  console.log(`\n🎉 Migration complete: ${processed} builds processed, ${skipped} skipped`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
