/**
 * Resolver unit and integration tests
 * Tests overlay matching, priority-based resolution, and scenario diffing
 */

import {
  resolveWorkUnits,
  resolveScenario,
  diffScenarios,
} from "../index";
import {
  WorkUnit,
  ScenarioContext,
  ResolvedWorkUnit,
} from "../../types";

// Test fixtures

const waterbathContext: ScenarioContext = {
  equipmentProfileId: "profile_waterbath",
  capabilities: ["waterbath", "portion_scale"],
  selectedCustomizationValueIds: [],
  customizationCount: 0,
};

const turboContext: ScenarioContext = {
  equipmentProfileId: "profile_turbo",
  capabilities: ["turbo", "portion_scale"],
  selectedCustomizationValueIds: [],
  customizationCount: 0,
};

const customizationContext: ScenarioContext = {
  equipmentProfileId: "profile_waterbath",
  capabilities: ["waterbath", "portion_scale"],
  selectedCustomizationValueIds: ["custom_add_sauce"],
  customizationCount: 1,
};

// Base work unit without overlays
const baseWorkUnit: WorkUnit = {
  id: "wu1",
  tags: {
    action: "HEAT",
    target: { bomId: "40-123", name: "chicken breast" },
    equipment: "waterbath",
    time: { value: 5, unit: "min", type: "active" },
    phase: "COOK",
    station: "hot-side",
  },
  dependsOn: [],
};

// Work unit with equipment overlay
const unitWithEquipmentOverlay: WorkUnit = {
  id: "wu2",
  tags: {
    action: "HEAT",
    target: { bomId: "40-123", name: "chicken breast" },
    equipment: "waterbath", // default
    time: { value: 5, unit: "min", type: "active" },
    phase: "COOK",
    station: "hot-side",
  },
  dependsOn: [],
  overlays: [
    {
      id: "overlay1",
      predicate: {
        equipmentProfileId: "profile_turbo",
      },
      overrides: {
        equipment: "turbo",
        time: { value: 3, unit: "min", type: "active" },
      },
      priority: 1,
    },
  ],
};

// Work unit with multiple overlays (priority-based)
const unitWithPriorityOverlays: WorkUnit = {
  id: "wu3",
  tags: {
    action: "HEAT",
    target: { bomId: "40-123", name: "chicken breast" },
    equipment: "waterbath",
    time: { value: 5, unit: "min", type: "active" },
    phase: "COOK",
    station: "hot-side",
  },
  dependsOn: [],
  overlays: [
    {
      id: "overlay_low",
      predicate: { equipmentProfileId: "profile_turbo" },
      overrides: { equipment: "turbo", time: { value: 3, unit: "min", type: "active" } },
      priority: 1, // Applied first
    },
    {
      id: "overlay_high",
      predicate: {
        equipmentProfileId: "profile_turbo",
        customizationValueIds: ["custom_add_sauce"],
      },
      overrides: { time: { value: 4, unit: "min", type: "active" } }, // Overrides lower priority
      priority: 2, // Applied second (higher priority wins)
    },
  ],
};

// Work unit with customization overlay
const unitWithCustomizationOverlay: WorkUnit = {
  id: "wu4",
  tags: {
    action: "ASSEMBLE",
    target: { bomId: "40-456", name: "bowl" },
    equipment: undefined,
    phase: "ASSEMBLY",
    station: "cold-side",
  },
  dependsOn: [],
  overlays: [
    {
      id: "overlay_sauce",
      predicate: {
        customizationValueIds: ["custom_add_sauce"],
      },
      overrides: {
        station: "pass", // Move to pass if sauce is added
      },
      priority: 1,
    },
  ],
};

describe("Resolver", () => {
  describe("resolveWorkUnits", () => {
    it("should return unit unchanged when no overlays match", () => {
      const resolved = resolveWorkUnits([baseWorkUnit], waterbathContext);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].tags.equipment).toBe("waterbath");
      expect(resolved[0].tags.time).toEqual({
        value: 5,
        unit: "min",
        type: "active",
      });
      expect(resolved[0].provenance.equipment?.type).toBe("manual");
    });

    it("should apply overlay when equipment profile matches", () => {
      const resolved = resolveWorkUnits(
        [unitWithEquipmentOverlay],
        turboContext
      );

      expect(resolved[0].tags.equipment).toBe("turbo");
      expect(resolved[0].tags.time).toEqual({
        value: 3,
        unit: "min",
        type: "active",
      });
      expect(resolved[0].provenance.equipment?.type).toBe("overlay");
      expect(resolved[0].provenance.equipment?.sourceId).toBe("overlay1");
    });

    it("should not apply overlay when equipment profile doesn't match", () => {
      const resolved = resolveWorkUnits(
        [unitWithEquipmentOverlay],
        waterbathContext
      );

      expect(resolved[0].tags.equipment).toBe("waterbath");
      expect(resolved[0].provenance.equipment?.type).toBe("manual");
    });

    it("should apply overlays in priority order (lower first)", () => {
      const resolved = resolveWorkUnits(
        [unitWithPriorityOverlays],
        turboContext
      );

      // First overlay applied: equipment → turbo, time → 3 min
      // Second overlay (customization) not matched: no change
      expect(resolved[0].tags.equipment).toBe("turbo");
      expect(resolved[0].tags.time?.value).toBe(3);
    });

    it("should apply higher priority overlay over lower when both match", () => {
      const resolved = resolveWorkUnits(
        [unitWithPriorityOverlays],
        { ...turboContext, selectedCustomizationValueIds: ["custom_add_sauce"], customizationCount: 1 }
      );

      // First overlay: time → 3 min
      // Second overlay: time → 4 min (overrides first)
      expect(resolved[0].tags.time?.value).toBe(4);
      expect(resolved[0].provenance.time?.sourceId).toBe("overlay_high");
    });

    it("should apply customization overlay when customization is present", () => {
      const resolved = resolveWorkUnits(
        [unitWithCustomizationOverlay],
        customizationContext
      );

      expect(resolved[0].tags.station).toBe("pass");
      expect(resolved[0].provenance.station?.type).toBe("overlay");
    });

    it("should not apply customization overlay when customization is absent", () => {
      const resolved = resolveWorkUnits(
        [unitWithCustomizationOverlay],
        waterbathContext
      );

      expect(resolved[0].tags.station).toBe("cold-side");
      expect(resolved[0].provenance.station?.type).toBe("manual");
    });

    it("should track originalWorkUnitId on resolved units", () => {
      const resolved = resolveWorkUnits([baseWorkUnit], waterbathContext);

      expect(resolved[0].originalWorkUnitId).toBe("wu1");
    });

    it("should handle multiple work units independently", () => {
      const units = [baseWorkUnit, unitWithEquipmentOverlay];
      const resolved = resolveWorkUnits(units, turboContext);

      expect(resolved).toHaveLength(2);
      expect(resolved[0].tags.equipment).toBe("waterbath"); // No overlay
      expect(resolved[1].tags.equipment).toBe("turbo"); // Overlay applied
    });

    it("should preserve all other fields when resolving", () => {
      const resolved = resolveWorkUnits([baseWorkUnit], waterbathContext);

      expect(resolved[0].id).toBe(baseWorkUnit.id);
      expect(resolved[0].tags.action).toBe("HEAT");
      expect(resolved[0].tags.target).toEqual(baseWorkUnit.tags.target);
      expect(resolved[0].tags.phase).toBe("COOK");
      expect(resolved[0].dependsOn).toEqual([]);
    });
  });

  describe("resolveScenario", () => {
    it("should return scenario name and resolved units", () => {
      const result = resolveScenario(
        [baseWorkUnit],
        "Waterbath Kitchen",
        waterbathContext
      );

      expect(result.scenario).toBe("Waterbath Kitchen");
      expect(result.resolved).toHaveLength(1);
    });

    it("should apply overlays within scenario", () => {
      const result = resolveScenario(
        [unitWithEquipmentOverlay],
        "Turbo Kitchen",
        turboContext
      );

      expect(result.resolved[0].tags.equipment).toBe("turbo");
    });
  });

  describe("diffScenarios", () => {
    it("should identify equipment changes", () => {
      const base = resolveWorkUnits([unitWithEquipmentOverlay], waterbathContext);
      const compare = resolveWorkUnits(
        [unitWithEquipmentOverlay],
        turboContext
      );

      const diffs = diffScenarios(base, compare);

      // Should have at least one changed field
      expect(Object.keys(diffs).length).toBeGreaterThan(0);
      const firstDiff = Object.values(diffs)[0];
      expect(firstDiff.changed).toContainEqual(
        expect.stringContaining("equipment")
      );
    });

    it("should identify time changes", () => {
      const base = resolveWorkUnits([unitWithEquipmentOverlay], waterbathContext);
      const compare = resolveWorkUnits(
        [unitWithEquipmentOverlay],
        turboContext
      );

      const diffs = diffScenarios(base, compare);

      const firstDiff = Object.values(diffs)[0];
      expect(firstDiff.changed).toContainEqual(
        expect.stringContaining("time")
      );
    });

    it("should identify station changes", () => {
      const base = resolveWorkUnits(
        [unitWithCustomizationOverlay],
        waterbathContext
      );
      const compare = resolveWorkUnits(
        [unitWithCustomizationOverlay],
        customizationContext
      );

      const diffs = diffScenarios(base, compare);

      // Should have changes
      expect(Object.keys(diffs).length).toBeGreaterThan(0);
      const firstDiff = Object.values(diffs)[0];
      expect(firstDiff.changed).toContainEqual(
        expect.stringContaining("station")
      );
    });

    it("should return empty diffs when scenarios are identical", () => {
      const resolved = resolveWorkUnits([baseWorkUnit], waterbathContext);
      const diffs = diffScenarios(resolved, resolved);

      expect(Object.keys(diffs)).toHaveLength(0);
    });

    it("should handle multiple changes per work unit", () => {
      const base = resolveWorkUnits([unitWithEquipmentOverlay], waterbathContext);
      const compare = resolveWorkUnits(
        [unitWithEquipmentOverlay],
        turboContext
      );

      const diffs = diffScenarios(base, compare);

      const firstDiff = Object.values(diffs)[0];
      expect(firstDiff.changed.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle units with no overlays", () => {
      const resolved = resolveWorkUnits([baseWorkUnit], turboContext);

      expect(resolved[0].tags.equipment).toBe("waterbath");
    });

    it("should handle units with empty overlays array", () => {
      const unit: WorkUnit = { ...baseWorkUnit, overlays: [] };
      const resolved = resolveWorkUnits([unit], turboContext);

      expect(resolved[0].tags.equipment).toBe("waterbath");
    });

    it("should handle overlay with no predicate conditions", () => {
      const unit: WorkUnit = {
        id: "wu_unconditioned",
        tags: { action: "HEAT", target: { name: "test" } },
        dependsOn: [],
        overlays: [
          {
            id: "overlay_uncond",
            predicate: {}, // No conditions = always matches
            overrides: { equipment: "any_equipment" },
            priority: 1,
          },
        ],
      };

      const resolved = resolveWorkUnits([unit], waterbathContext);

      expect(resolved[0].tags.equipment).toBe("any_equipment");
    });

    it("should preserve undefined fields", () => {
      const unit: WorkUnit = {
        id: "wu_minimal",
        tags: { action: "PREP", target: { name: "ingredient" } },
        dependsOn: [],
      };

      const resolved = resolveWorkUnits([unit], waterbathContext);

      expect(resolved[0].tags.equipment).toBeUndefined();
      expect(resolved[0].tags.time).toBeUndefined();
      expect(resolved[0].tags.station).toBeUndefined();
    });
  });

  describe("Provenance tracking", () => {
    it("should mark manual fields", () => {
      const resolved = resolveWorkUnits([baseWorkUnit], waterbathContext);

      expect(resolved[0].provenance.equipment?.type).toBe("manual");
      expect(resolved[0].provenance.time?.type).toBe("manual");
      expect(resolved[0].provenance.station?.type).toBe("manual");
    });

    it("should mark overlay-sourced fields with overlay ID", () => {
      const resolved = resolveWorkUnits(
        [unitWithEquipmentOverlay],
        turboContext
      );

      expect(resolved[0].provenance.equipment?.type).toBe("overlay");
      expect(resolved[0].provenance.equipment?.sourceId).toBe("overlay1");
    });

    it("should not include provenance for unset fields", () => {
      const unit: WorkUnit = {
        id: "wu_no_station",
        tags: { action: "HEAT", target: { name: "test" }, equipment: "waterbath" },
        dependsOn: [],
      };

      const resolved = resolveWorkUnits([unit], waterbathContext);

      expect(resolved[0].provenance.station).toBeUndefined();
    });
  });
});
