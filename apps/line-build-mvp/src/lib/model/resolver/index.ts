/**
 * WorkUnit resolver for handling overlay resolution
 * Resolves conditional overlays based on equipment profile and customization context
 *
 * Pattern: Three-phase resolution (inheritance → baseline → overlays)
 * Based on proven pattern from archive-benchtop-mvp
 */

import {
  WorkUnit,
  WorkUnitOverlay,
  ScenarioContext,
  ResolvedWorkUnit,
  FieldProvenance,
} from "../types";

/**
 * Resolve work units for a specific scenario context
 * Applies overlays based on equipment profile and customization criteria
 *
 * @param workUnits - Array of work units (possibly with overlays)
 * @param context - Scenario context (equipment profile, capabilities, customizations)
 * @returns Resolved work units with field provenance tracking
 */
export function resolveWorkUnits(
  workUnits: WorkUnit[],
  context: ScenarioContext
): ResolvedWorkUnit[] {
  return workUnits.map((unit) => resolveWorkUnit(unit, context));
}

/**
 * Resolve a single work unit by applying overlays
 *
 * Phase 1: Copy base values and mark as manual
 * Phase 2: Apply overlays (sorted by priority, lower first)
 */
function resolveWorkUnit(
  unit: WorkUnit,
  context: ScenarioContext
): ResolvedWorkUnit {
  const provenance: ResolvedWorkUnit["provenance"] = {};

  // Start with deep copy of base unit values
  let resolved: ResolvedWorkUnit = {
    ...unit,
    tags: { ...unit.tags },
    originalWorkUnitId: unit.id,
    provenance: {},
  };

  // Phase 1: Mark initial manual values (if they exist)
  if (unit.tags.equipment !== undefined) {
    provenance.equipment = { type: "manual" };
  }
  if (unit.tags.time !== undefined) {
    provenance.time = { type: "manual" };
  }
  if (unit.tags.station !== undefined) {
    provenance.station = { type: "manual" };
  }

  // Phase 2: Apply overlays (sorted by priority, lower first)
  const sortedOverlays = [...(unit.overlays || [])].sort(
    (a, b) => a.priority - b.priority
  );

  for (const overlay of sortedOverlays) {
    // Check if overlay matches the scenario context
    const matches = matchesScenario(overlay, context);

    if (matches) {
      // Apply equipment override
      if (overlay.overrides.equipment !== undefined) {
        resolved.tags.equipment = overlay.overrides.equipment;
        provenance.equipment = { type: "overlay", sourceId: overlay.id };
      }

      // Apply time override
      if (overlay.overrides.time !== undefined) {
        resolved.tags.time = overlay.overrides.time;
        provenance.time = { type: "overlay", sourceId: overlay.id };
      }

      // Apply station override
      if (overlay.overrides.station !== undefined) {
        resolved.tags.station = overlay.overrides.station;
        provenance.station = { type: "overlay", sourceId: overlay.id };
      }

      // Apply notes override
      if (overlay.overrides.notes !== undefined) {
        // Notes not on WorkUnit tags, store on provenance for reference
        provenance.notes = { type: "overlay", sourceId: overlay.id };
      }
    }
  }

  resolved.provenance = provenance;
  return resolved;
}

/**
 * Check if an overlay's predicate matches the current scenario context
 *
 * All conditions must pass:
 * - Equipment profile matches (if specified)
 * - All customization value IDs are present (if specified)
 * - Customization count meets minimum (if specified)
 */
function matchesScenario(
  overlay: WorkUnitOverlay,
  context: ScenarioContext
): boolean {
  const predicate = overlay.predicate;

  // Equipment profile must match (if specified)
  const equipmentMatch =
    predicate.equipmentProfileId === undefined ||
    predicate.equipmentProfileId === context.equipmentProfileId;

  // All customization value IDs must be present
  const customizationMatch =
    predicate.customizationValueIds === undefined ||
    predicate.customizationValueIds.every((id) =>
      context.selectedCustomizationValueIds.includes(id)
    );

  // Minimum customization count must be met
  const countMatch =
    predicate.minCustomizationCount === undefined ||
    context.customizationCount >= predicate.minCustomizationCount;

  return equipmentMatch && customizationMatch && countMatch;
}

/**
 * Resolve all work units in a line build for a scenario
 * Enables scenario preview ("what-if this equipment profile?")
 *
 * @param workUnits - The work units to resolve
 * @param scenarioName - Human-readable name of the scenario (e.g., "Waterbath Kitchen")
 * @param context - The scenario context
 * @returns Resolved work units with scenario metadata
 */
export function resolveScenario(
  workUnits: WorkUnit[],
  scenarioName: string,
  context: ScenarioContext
): { scenario: string; resolved: ResolvedWorkUnit[] } {
  return {
    scenario: scenarioName,
    resolved: resolveWorkUnits(workUnits, context),
  };
}

/**
 * Calculate field differences between two scenarios
 * Used for "what-if" scenario comparison UI
 *
 * @param baseScenario - Resolved units from base scenario
 * @param compareScenario - Resolved units from comparison scenario
 * @returns Map of field changes per work unit
 */
export function diffScenarios(
  baseScenario: ResolvedWorkUnit[],
  compareScenario: ResolvedWorkUnit[]
): Record<string, { added: string[]; removed: string[]; changed: string[] }> {
  const diffs: Record<
    string,
    { added: string[]; removed: string[]; changed: string[] }
  > = {};

  // Create map for easier lookup
  const compareMap = new Map(compareScenario.map(u => [u.originalWorkUnitId, u]));

  for (const baseUnit of baseScenario) {
    const compareUnit = compareMap.get(baseUnit.id);
    if (!compareUnit) continue;

    const unitDiffs = { added: [] as string[], removed: [] as string[], changed: [] as string[] };

    // Check equipment change
    if (baseUnit.tags.equipment !== compareUnit.tags.equipment) {
      unitDiffs.changed.push(
        `equipment: ${baseUnit.tags.equipment || "none"} → ${compareUnit.tags.equipment || "none"}`
      );
    }

    // Check time change
    const baseTimeStr = baseUnit.tags.time ? JSON.stringify(baseUnit.tags.time) : "undefined";
    const compareTimeStr = compareUnit.tags.time ? JSON.stringify(compareUnit.tags.time) : "undefined";
    if (baseTimeStr !== compareTimeStr) {
      unitDiffs.changed.push(
        `time: ${baseTimeStr} → ${compareTimeStr}`
      );
    }

    // Check station change
    if (baseUnit.tags.station !== compareUnit.tags.station) {
      unitDiffs.changed.push(
        `station: ${baseUnit.tags.station || "none"} → ${compareUnit.tags.station || "none"}`
      );
    }

    if (unitDiffs.changed.length > 0) {
      diffs[baseUnit.id] = unitDiffs;
    }
  }

  return diffs;
}
