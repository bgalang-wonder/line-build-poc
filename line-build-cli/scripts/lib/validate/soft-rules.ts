import {
  type BenchTopLineBuild,
  type Step,
  type LocationRef,
} from "../schema";
import {
  getStationSide,
  VALIDATION_CONFIG,
} from "../../../config";
import {
  type ValidationError,
  getOrderedSteps,
} from "./helpers";

/**
 * Soft and strong warning validation rules (S6-S22, H26, H29-H31).
 * These don't block publication but indicate potential issues.
 */

// -----------------------------
// S20: dependsOn Without Material Input (Soft Warning)
// -----------------------------

/**
 * S20: Step has dependsOn but no input[] assembly refs.
 *
 * This can be valid (pure work constraint), but often indicates missing material flow.
 */
export function validateS20DependsOnWithoutInput(step: Step): ValidationError[] {
  if (step.exclude) return [];
  const deps = step.dependsOn ?? [];
  if (deps.length === 0) return [];
  const inputs = step.input ?? [];
  if (inputs.length > 0) return [];

  return [
    {
      severity: "soft",
      ruleId: "S20",
      message:
        "S20: step has dependsOn but no input[]. Confirm this is a work-only dependency (not missing material flow).",
      stepId: step.id,
      fieldPath: "dependsOn|input",
    },
  ];
}

// -----------------------------
// S21: Assembly Naming (Soft Warning)
// -----------------------------

/**
 * S21: Assembly IDs should be descriptive (avoid step-based placeholders).
 */
export function validateS21AssemblyNaming(build: BenchTopLineBuild): ValidationError[] {
  const warnings: ValidationError[] = [];
  const genericPattern = /^(step\\d+_v\\d+|s\\d+_v\\d+|out_.+|assembly\\d+_v\\d+|tmp_.+|generated_.+)$/i;

  const referenced = new Set<string>();
  for (const step of getOrderedSteps(build)) {
    for (const inp of step.input ?? []) {
      if (inp.source.type === "in_build") referenced.add(inp.source.assemblyId);
    }
    for (const out of step.output ?? []) {
      if (out.source.type === "in_build") referenced.add(out.source.assemblyId);
    }
  }

  const generic = [...referenced].filter((id) => genericPattern.test(id));
  if (generic.length === 0) return warnings;

  warnings.push({
    severity: "soft",
    ruleId: "S21",
    message: `S21: assembly IDs should be descriptive (avoid step-based names). Consider renaming: ${generic.slice(0, 8).join(", ")}${generic.length > 8 ? "..." : ""}`,
    fieldPath: "assemblies[].id",
  });

  return warnings;
}

// -----------------------------
// S22: Material Flow Continuity (Soft Warning)
// -----------------------------

// Storage sublocations where assemblies can originate without a producer step
const STORAGE_SUBLOCATIONS = new Set([
  "cold_storage",
  "cold_rail",
  "dry_rail",
  "freezer",
  "kit_storage",
  "ambient",
]);

function locationsMatch(from: LocationRef | undefined, to: LocationRef | undefined): boolean {
  if (!from || !to) return false;
  if (from.sublocation?.type !== to.sublocation?.type) return false;
  if (from.sublocation?.type === "equipment" || to.sublocation?.type === "equipment") {
    return from.sublocation?.equipmentId === to.sublocation?.equipmentId;
  }
  if (from.stationId && to.stationId && from.stationId !== to.stationId) return false;
  return true;
}

/**
 * S22: Inputs should align with the last known output location for the same assembly.
 * This flags potential "teleports" where an assembly appears to move without an explicit step.
 */
export function validateS22MaterialFlowContinuity(build: BenchTopLineBuild): ValidationError[] {
  if (build.status === "published") return [];
  const warnings: ValidationError[] = [];

  const outputsByAssembly = new Map<string, Array<{ stepId: string; to?: LocationRef }>>();
  for (const step of getOrderedSteps(build)) {
    for (const out of step.output ?? []) {
      if (out.source.type !== "in_build") continue;
      const list = outputsByAssembly.get(out.source.assemblyId) ?? [];
      list.push({ stepId: step.id, to: out.to });
      outputsByAssembly.set(out.source.assemblyId, list);
    }
  }

  for (const step of getOrderedSteps(build)) {
    const inputs = step.input ?? [];
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i]!;
      if (inp.source.type !== "in_build") continue;
      const producers = outputsByAssembly.get(inp.source.assemblyId) ?? [];

      if (producers.length === 0) {
        // Type A: External inputs from storage don't need a producer
        const fromSublocation = inp.from?.sublocation?.type;
        if (fromSublocation && STORAGE_SUBLOCATIONS.has(fromSublocation)) {
          continue; // Skip - expected external input from storage
        }
        warnings.push({
          severity: "soft",
          ruleId: "S22",
          message: `S22: input assembly '${inp.source.assemblyId}' has no producing step. Ensure this is intentional.`,
          stepId: step.id,
          fieldPath: `input[${i}].source`,
        });
        continue;
      }

      // Note: Multiple producers is now caught by H44 as a hard error
      if (producers.length > 1) {
        continue; // H44 handles this case
      }

      const producer = producers[0];
      const from = inp.from;
      const to = producer?.to;
      if (!from || !to) continue;
      if (!locationsMatch(from, to)) {
        // Type C: Differentiate cross-station vs same-station mismatches
        const crossStation = from.stationId !== to?.stationId;
        if (crossStation) {
          // Cross-station: informational - TRANSFER will be derived
          warnings.push({
            severity: "info",
            ruleId: "S22",
            message: `S22: input assembly '${inp.source.assemblyId}' moved between stations (${to?.stationId} → ${from.stationId}). A TRANSFER step will be derived.`,
            stepId: step.id,
            fieldPath: `input[${i}].from`,
          });
        } else {
          // Same-station: likely an error
          warnings.push({
            severity: "soft",
            ruleId: "S22",
            message: `S22: input assembly '${inp.source.assemblyId}' has sublocation mismatch at ${from.stationId} (expected: ${to?.sublocation?.type}, got: ${from.sublocation?.type}). This may be an error.`,
            stepId: step.id,
            fieldPath: `input[${i}].from`,
          });
        }
      }
    }
  }

  return warnings;
}

// -----------------------------
// S6: Primary Output Assembly Warning
// -----------------------------

export function validatePrimaryOutputAssemblyIdWarning(
  build: BenchTopLineBuild,
): ValidationError[] {
  const assemblies = build.assemblies ?? [];
  if (assemblies.length === 0) return [];
  const ids = new Set(assemblies.map((a) => a.id));

  if (!build.primaryOutputAssemblyId) {
    return [
      {
        severity: "strong",
        ruleId: "S6",
        message:
          "Primary output assembly should be set when using assemblies (primaryOutputAssemblyId missing)",
        fieldPath: "primaryOutputAssemblyId",
      },
    ];
  }
  if (!ids.has(build.primaryOutputAssemblyId)) {
    return [
      {
        severity: "strong",
        ruleId: "S6",
        message:
          "Primary output assembly should be set when using assemblies (primaryOutputAssemblyId does not resolve)",
        fieldPath: "primaryOutputAssemblyId",
      },
    ];
  }
  return [];
}

// Keep old name as alias for backwards compatibility
export const validatePrimaryOutputComponentIdWarning = validatePrimaryOutputAssemblyIdWarning;

// -----------------------------
// S15: Assembly Sublocation Warning
// -----------------------------

export function validateS15AssemblySublocation(build: BenchTopLineBuild): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const step of getOrderedSteps(build)) {
    // Check inputs for missing sublocation (station is required by H31, this is the extra detail)
    for (const inp of step.input ?? []) {
      if (inp.source.type !== "in_build") continue;
      const hasSubloc = inp.from?.sublocation?.type;
      if (inp.from?.stationId && !hasSubloc) {
        warnings.push({
          severity: "soft",
          ruleId: "S15",
          message: `S15: input assembly '${inp.source.assemblyId}' has from.stationId but missing from.sublocation`,
          stepId: step.id,
          fieldPath: "input[].from.sublocation",
        });
      }
    }

    // Check outputs for missing sublocation
    for (const out of step.output ?? []) {
      if (out.source.type !== "in_build") continue;
      const hasSubloc = out.to?.sublocation?.type;
      if (out.to?.stationId && !hasSubloc) {
        warnings.push({
          severity: "soft",
          ruleId: "S15",
          message: `S15: output assembly '${out.source.assemblyId}' has to.stationId but missing to.sublocation`,
          stepId: step.id,
          fieldPath: "output[].to.sublocation",
        });
      }
    }
  }

  return warnings;
}

// Keep old name as alias for backwards compatibility
export const validateS15ComponentSublocation = validateS15AssemblySublocation;

// -----------------------------
// S16a: Grouping-Level Bouncing (Strong)
// -----------------------------

/**
 * S16a: Grouping-level bouncing (strong warning).
 * Detects when a build leaves a grouping (hot_side, cold_side, vending) and returns to it.
 * This indicates inefficient workflow across major kitchen areas.
 */
export function validateS16aGroupingBouncing(build: BenchTopLineBuild): ValidationError[] {
  const steps = getOrderedSteps(build);
  const stepsByTrack = new Map<string, Step[]>();
  for (const step of steps) {
    const trackId = step.trackId ?? "default";
    if (!stepsByTrack.has(trackId)) stepsByTrack.set(trackId, []);
    stepsByTrack.get(trackId)!.push(step);
  }

  const warnings: ValidationError[] = [];

  for (const [trackId, trackSteps] of Array.from(stepsByTrack.entries())) {
    const groupingVisits = new Map<string, number[]>(); // groupingId -> array of visit indices
    let currentGrouping = "";
    let visitCount = 0;

    for (const step of trackSteps) {
      // Use explicit groupingId if set, otherwise derive from stationId
      const groupingId = step.groupingId ?? getStationSide(step.stationId);
      if (groupingId !== currentGrouping) {
        currentGrouping = groupingId;
        visitCount++;
        if (!groupingVisits.has(groupingId)) groupingVisits.set(groupingId, []);
        groupingVisits.get(groupingId)!.push(visitCount);
      }
    }

    for (const [groupingId, visits] of Array.from(groupingVisits.entries())) {
      if (visits.length > 1) {
        // Grouping was revisited. Find the first step of the revisit.
        let currentGroupingInScan = "";
        let currentVisitNum = 0;

        for (const step of trackSteps) {
          const gId = step.groupingId ?? getStationSide(step.stationId);
          if (gId !== currentGroupingInScan) {
            currentGroupingInScan = gId;
            currentVisitNum++;
          }

          if (gId === groupingId && currentVisitNum === visits[1]) {
            warnings.push({
              severity: "strong",
              ruleId: "S16a",
              message: `S16a: grouping bouncing detected for '${groupingId}' in track '${trackId}'. The build leaves this kitchen area and returns to it later, which is inefficient.`,
              stepId: step.id,
              fieldPath: "groupingId",
            });
            break; // Only report once per grouping per track.
          }
        }
      }
    }
  }

  return warnings;
}

// -----------------------------
// S16b: Station-Level Bouncing (Soft)
// -----------------------------

/**
 * S16b: Station-level bouncing within same grouping (soft warning).
 * Detects when a build leaves a station and returns to it while staying in the same grouping.
 * This is less severe than grouping bouncing but still indicates potential inefficiency.
 */
export function validateS16bStationBouncing(build: BenchTopLineBuild): ValidationError[] {
  const steps = getOrderedSteps(build);
  const stepsByTrack = new Map<string, Step[]>();
  for (const step of steps) {
    const trackId = step.trackId ?? "default";
    if (!stepsByTrack.has(trackId)) stepsByTrack.set(trackId, []);
    stepsByTrack.get(trackId)!.push(step);
  }

  const warnings: ValidationError[] = [];

  for (const [trackId, trackSteps] of Array.from(stepsByTrack.entries())) {
    const stationVisits = new Map<string, number[]>(); // stationId -> array of visit indices
    let currentStation = "";
    let visitCount = 0;

    for (const step of trackSteps) {
      const stationId = step.stationId ?? "other";
      if (stationId !== currentStation) {
        currentStation = stationId;
        visitCount++;
        if (!stationVisits.has(stationId)) stationVisits.set(stationId, []);
        stationVisits.get(stationId)!.push(visitCount);
      }
    }

    for (const [stationId, visits] of Array.from(stationVisits.entries())) {
      if (visits.length > 1) {
        // Station was revisited. Check if it's within the same grouping (soft) or across groupings (already caught by S16a).
        let currentStationInScan = "";
        let currentVisitNum = 0;

        for (const step of trackSteps) {
          const sId = step.stationId ?? "other";
          if (sId !== currentStationInScan) {
            currentStationInScan = sId;
            currentVisitNum++;
          }

          if (sId === stationId && currentVisitNum === visits[1]) {
            // Check if the intermediate steps stayed within the same grouping
            // (if they left the grouping, S16a already catches it at a higher level)
            const groupingAtRevisit = step.groupingId ?? getStationSide(step.stationId);
            const firstVisitIdx = visits[0];
            const secondVisitIdx = visits[1];

            // Find if we left the grouping between visits
            let leftGrouping = false;
            let scanVisitNum = 0;
            let scanStation = "";
            for (const scanStep of trackSteps) {
              const scanStationId = scanStep.stationId ?? "other";
              if (scanStationId !== scanStation) {
                scanStation = scanStationId;
                scanVisitNum++;
              }
              if (scanVisitNum > firstVisitIdx && scanVisitNum < secondVisitIdx) {
                const scanGrouping = scanStep.groupingId ?? getStationSide(scanStep.stationId);
                if (scanGrouping !== groupingAtRevisit) {
                  leftGrouping = true;
                  break;
                }
              }
            }

            // Only report S16b if we stayed within the same grouping (S16a handles cross-grouping bouncing)
            if (!leftGrouping) {
              warnings.push({
                severity: "soft",
                ruleId: "S16b",
                message: `S16b: station bouncing detected for station '${stationId}' in track '${trackId}'. The build leaves this station and returns to it later within the same grouping.`,
                stepId: step.id,
                fieldPath: "stationId",
              });
            }
            break; // Only report once per station per track.
          }
        }
      }
    }
  }

  return warnings;
}

// -----------------------------
// S17: Derived WorkLocation Review
// -----------------------------

export function validateS17DerivedSublocation(step: Step): ValidationError[] {
  if (step.provenance?.workLocation?.type === "inferred") {
    return [
      {
        severity: "info",
        ruleId: "S17",
        message: `S17: workLocation '${step.workLocation?.type}' was derived (review recommended)`,
        stepId: step.id,
        fieldPath: "workLocation",
      },
    ];
  }
  return [];
}

// -----------------------------
// S18: Derived Output Destination Review
// -----------------------------

export function validateS18DerivedOutputDestination(step: Step): ValidationError[] {
  if (step.provenance?.to?.type === "inferred") {
    return [
      {
        severity: "info",
        ruleId: "S18",
        message: `S18: output destination was derived (review recommended)`,
        stepId: step.id,
        fieldPath: "to",
      },
    ];
  }
  return [];
}

// -----------------------------
// H26: Graph Connectivity (Soft Warning)
// -----------------------------

export function validateH26GraphConnectivity(build: BenchTopLineBuild): ValidationError[] {
  const steps = getOrderedSteps(build);
  if (steps.length <= 1) return [];
  const entryPoints = steps.filter((s) => (s.dependsOn ?? []).length === 0);
  const dependentCount = steps.length - entryPoints.length;
  const ratioDependent = dependentCount / steps.length;
  const threshold = VALIDATION_CONFIG.graphConnectivityThreshold;
  if (ratioDependent >= threshold) return [];
  return [
    {
      severity: "soft",
      ruleId: "H26",
      message: `H26: graph appears under-specified (only ${(ratioDependent * 100).toFixed(0)}% of steps have dependsOn). Confirm which steps truly can start immediately.`,
      fieldPath: "steps[].dependsOn",
    },
  ];
}

// -----------------------------
// H29: Merge Roles Required (Strong Warning)
// -----------------------------

export function validateH29MergeRoles(build: BenchTopLineBuild): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const step of getOrderedSteps(build)) {
    const inputs = step.input ?? [];
    const outputs = step.output ?? [];

    // Only applies to merge steps: 2+ inputs, at least 1 output
    if (inputs.length < 2 || outputs.length < 1) continue;

    // Check that all inputs have role defined
    const missingRoles = inputs.filter((inp) => !inp.role);
    if (missingRoles.length > 0) {
      warnings.push({
        severity: "strong",
        ruleId: "H29",
        message: `H29: merge step has ${inputs.length} inputs but ${missingRoles.length} are missing role (base/added)`,
        stepId: step.id,
        fieldPath: "input[].role",
      });
      continue;
    }

    // Check that exactly one input is "base"
    const baseCount = inputs.filter((inp) => inp.role === "base").length;
    if (baseCount !== 1) {
      warnings.push({
        severity: "strong",
        ruleId: "H29",
        message: `H29: merge step should have exactly 1 base input, found ${baseCount}`,
        stepId: step.id,
        fieldPath: "input[].role",
      });
    }
  }

  return warnings;
}

// -----------------------------
// H30: Lineage for 1:1 Transformations (Strong Warning)
// -----------------------------

export function validateH30Lineage(build: BenchTopLineBuild): ValidationError[] {
  const warnings: ValidationError[] = [];
  const assemblies = build.assemblies ?? [];
  const assemblyById = new Map(assemblies.map((a) => [a.id, a]));

  for (const step of getOrderedSteps(build)) {
    const inputs = step.input ?? [];
    const outputs = step.output ?? [];

    // Only applies to 1:1 transformations: exactly 1 input, exactly 1 output
    if (inputs.length !== 1 || outputs.length !== 1) continue;

    const inputRef = inputs[0]!;
    const outputRef = outputs[0]!;

    // Only check in_build refs
    if (inputRef.source.type !== "in_build" || outputRef.source.type !== "in_build") continue;

    const inputAssemblyId = inputRef.source.assemblyId;
    const outputAssemblyId = outputRef.source.assemblyId;

    // Same assembly evolving is fine
    if (inputAssemblyId === outputAssemblyId) continue;

    const outputAssembly = assemblyById.get(outputAssemblyId);
    if (!outputAssembly) continue; // C3 will catch missing assemblies

    // Check that output assembly has lineage.evolvesFrom pointing to input
    if (!outputAssembly.lineage?.evolvesFrom) {
      warnings.push({
        severity: "strong",
        ruleId: "H30",
        message: `H30: 1:1 transformation output '${outputAssemblyId}' should have lineage.evolvesFrom='${inputAssemblyId}'`,
        stepId: step.id,
        fieldPath: "assemblies[].lineage.evolvesFrom",
      });
    }
  }

  return warnings;
}

// -----------------------------
// H31: Assembly Ref Locations (Soft Warning)
// -----------------------------

export function validateH31AssemblyRefLocations(step: Step): ValidationError[] {
  const errors: ValidationError[] = [];
  const inputs = step.input ?? [];
  const outputs = step.output ?? [];

  // Check all inputs have from.stationId
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i]!;
    const hasFrom = inp.from?.stationId;
    if (!hasFrom) {
      const assemblyLabel = inp.source.type === "in_build"
        ? inp.source.assemblyId
        : `external:${inp.source.itemId}`;
      errors.push({
        severity: "soft",
        ruleId: "H31",
        message: `H31: input[${i}] (${assemblyLabel}) requires from.stationId`,
        stepId: step.id,
        fieldPath: `input[${i}].from.stationId`,
      });
    }
  }

  // Check all outputs have to.stationId
  for (let i = 0; i < outputs.length; i++) {
    const out = outputs[i]!;
    const hasTo = out.to?.stationId;
    if (!hasTo) {
      const assemblyLabel = out.source.type === "in_build"
        ? out.source.assemblyId
        : `external:${out.source.itemId}`;
      errors.push({
        severity: "soft",
        ruleId: "H31",
        message: `H31: output[${i}] (${assemblyLabel}) requires to.stationId`,
        stepId: step.id,
        fieldPath: `output[${i}].to.stationId`,
      });
    }
  }

  return errors;
}

// Keep old name as alias for backwards compatibility
export const validateH31ComponentRefLocations = validateH31AssemblyRefLocations;

// -----------------------------
// S23: Implicit Transfer Warning
// -----------------------------

/**
 * S23: Detects steps that input from a different station than they operate at.
 * This effectively hides a transfer inside the step, preventing consistent transfer derivation.
 *
 * When a step at station B inputs from station A (and it's not a storage retrieval),
 * the transfer is "hidden" inside the step rather than being derived separately.
 * This causes inconsistent transfer counting for complexity scoring.
 *
 * Fix: Change input.from to match the step's station, which will trigger a derived transfer.
 */
export function validateS23ImplicitTransfer(step: Step): ValidationError[] {
  // Ignore TRANSFER steps (they ARE the transfer)
  if (step.action.family === "TRANSFER") return [];

  const warnings: ValidationError[] = [];
  const currentStation = step.stationId;
  if (!currentStation || currentStation === "other") return [];

  for (let i = 0; i < (step.input ?? []).length; i++) {
    const inp = step.input![i]!;
    const fromStation = inp.from?.stationId;
    const fromSubloc = inp.from?.sublocation?.type;

    if (fromStation && fromStation !== currentStation) {
      // It's a cross-station input. Check if it's a valid storage retrieval.
      if (fromSubloc && STORAGE_SUBLOCATIONS.has(fromSubloc)) {
        continue; // Valid retrieval (e.g., get from cold storage at another station)
      }

      warnings.push({
        severity: "soft",
        ruleId: "S23",
        message: `S23: step at '${currentStation}' inputs from '${fromStation}'. This hides a transfer inside the step. Fix: set input.from.stationId='${currentStation}' to trigger derived transfer.`,
        stepId: step.id,
        fieldPath: `input[${i}].from.stationId`,
      });
    }
  }

  return warnings;
}

// -----------------------------
// S45: Missing Tributary Source (Soft Warning)
// -----------------------------

// Patterns that indicate an ingredient source in the instruction
const TRIBUTARY_SOURCE_PATTERNS = [
  /from steam well/i,
  /from cold rail/i,
  /from dry rail/i,
  /from cold storage/i,
  /from sauce warmer/i,
  /from hot well/i,
];

// Action families that typically add ingredients to an existing assembly
const INGREDIENT_ADD_FAMILIES = new Set(["PORTION", "ASSEMBLE", "COMBINE"]);

/**
 * S45: PORTION/ASSEMBLE/COMBINE instruction mentions "from X" but output[].from is missing.
 *
 * When a step adds an ingredient from a specific location (e.g., "Place Protein from Steam Well"),
 * the output should have a `from` field to indicate where the ingredient came from.
 * This enables the viewer to render tributary edges showing ingredient sources.
 *
 * Fix: Add output[].from with the appropriate stationId and sublocation.
 * Use `npx tsx scripts/fix-tributary-sources.ts --apply` to auto-fix.
 */
export function validateS45MissingTributarySource(step: Step): ValidationError[] {
  // Only check PORTION/ASSEMBLE/COMBINE steps
  if (!INGREDIENT_ADD_FAMILIES.has(step.action.family)) return [];

  // Must have inputs (it's adding to something)
  if (!step.input || step.input.length === 0) return [];

  // Must have outputs
  if (!step.output || step.output.length === 0) return [];

  // Check if instruction mentions a source
  const instruction = step.instruction ?? "";
  const mentionsSource = TRIBUTARY_SOURCE_PATTERNS.some((p) => p.test(instruction));
  if (!mentionsSource) return [];

  // Check if any output is missing from
  const missingFrom = step.output.filter(
    (out) => out.source.type === "in_build" && !out.from
  );
  if (missingFrom.length === 0) return [];

  return [
    {
      severity: "soft",
      ruleId: "S45",
      message: `S45: instruction mentions ingredient source but output[].from is missing. Add output[].from to enable tributary edges in viewer.`,
      stepId: step.id,
      fieldPath: "output[].from",
    },
  ];
}
