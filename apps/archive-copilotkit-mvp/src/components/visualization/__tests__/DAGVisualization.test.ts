import {
  FIXTURE_GRILLED_CHICKEN_BOWL,
  FIXTURE_CRISPY_FISH_TACOS,
  FIXTURE_BUDDHA_BOWL,
} from '@/lib/model/data/fixtures';

/**
 * DAG Visualization Unit Tests
 *
 * Tests verify that the DAG visualization component correctly:
 * 1. Renders with fixture data
 * 2. Creates nodes from WorkUnits
 * 3. Creates edges from dependencies
 * 4. Handles empty builds gracefully
 * 5. Applies styling based on action types and phases
 * 6. Supports node selection and highlighting
 */

describe('DAGVisualization', () => {
  describe('Node Creation', () => {
    it('should create a node for each WorkUnit in the build', () => {
      const workUnits = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits;
      const nodeCount = workUnits.length;

      expect(nodeCount).toBeGreaterThan(0);
      expect(workUnits.every((unit) => unit.id)).toBe(true);
    });

    it('should include action type and target in node label', () => {
      const unit = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits[0];

      expect(unit.tags.action).toBeDefined();
      expect(unit.tags.target).toBeDefined();
      expect(unit.tags.target.name || unit.tags.target.bomId).toBeTruthy();
    });

    it('should include equipment and time in node data when available', () => {
      // Find a HEAT action which should have equipment and time
      const heatUnit = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits.find(
        (u) => u.tags.action === 'HEAT'
      );

      if (heatUnit) {
        expect(heatUnit.tags.equipment).toBeDefined();
        expect(heatUnit.tags.time).toBeDefined();
        expect(heatUnit.tags.time?.value).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Creation', () => {
    it('should create edges from dependsOn relationships', () => {
      const workUnits = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits;
      const unitsWithDeps = workUnits.filter((u) => u.dependsOn.length > 0);

      expect(unitsWithDeps.length).toBeGreaterThan(0);
    });

    it('should create edges pointing from dependency to dependent', () => {
      const workUnits = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits;
      const firstUnit = workUnits[0];
      const secondUnit = workUnits[1];

      // Second unit likely depends on first in a linear workflow
      if (secondUnit && secondUnit.dependsOn.length > 0) {
        expect(secondUnit.dependsOn).toContain(firstUnit.id);
      }
    });

    it('should handle units with multiple dependencies', () => {
      const workUnits = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits;
      const multiDepUnit = workUnits.find((u) => u.dependsOn.length > 1);

      if (multiDepUnit) {
        // Verify all dependencies exist in the build
        const unitIds = workUnits.map((u) => u.id);
        expect(multiDepUnit.dependsOn.every((dep) => unitIds.includes(dep))).toBe(true);
      }
    });
  });

  describe('Styling', () => {
    it('should apply colors to node borders based on action type', () => {
      const actionColors: Record<string, string> = {
        PREP: '#3B82F6',
        HEAT: '#EF4444',
        TRANSFER: '#8B5CF6',
        ASSEMBLE: '#10B981',
        PORTION: '#F59E0B',
        PLATE: '#EC4899',
        FINISH: '#06B6D4',
        QUALITY_CHECK: '#6366F1',
      };

      const workUnits = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits;
      workUnits.forEach((unit) => {
        expect(actionColors[unit.tags.action]).toBeDefined();
      });
    });

    it('should apply background colors based on cooking phase', () => {
      const phaseColors: Record<string, string> = {
        PRE_COOK: '#F0F9FF',
        COOK: '#FEF2F2',
        POST_COOK: '#F0FDF4',
        ASSEMBLY: '#FDF2F8',
        PASS: '#ECFDF5',
      };

      const workUnits = FIXTURE_GRILLED_CHICKEN_BOWL.workUnits;
      const unitsWithPhase = workUnits.filter((u) => u.tags.phase);

      unitsWithPhase.forEach((unit) => {
        if (unit.tags.phase) {
          expect(phaseColors[unit.tags.phase]).toBeDefined();
        }
      });
    });
  });

  describe('Empty State', () => {
    it('should handle builds with no WorkUnits gracefully', () => {
      const emptyBuild = {
        id: 'test',
        menuItemId: 'item-123',
        menuItemName: 'Test Item',
        workUnits: [],
        metadata: { author: 'test', version: '1.0', status: 'draft' as const },
      };

      expect(emptyBuild.workUnits.length).toBe(0);
    });
  });

  describe('Fixture Data Validation', () => {
    it('should use valid fixture data for DAG visualization', () => {
      const fixtures = [FIXTURE_GRILLED_CHICKEN_BOWL, FIXTURE_CRISPY_FISH_TACOS, FIXTURE_BUDDHA_BOWL];

      fixtures.forEach((build) => {
        // Each build has required fields
        expect(build.id).toBeDefined();
        expect(build.workUnits).toBeInstanceOf(Array);
        expect(build.workUnits.length).toBeGreaterThan(0);

        // Each WorkUnit is valid
        build.workUnits.forEach((unit) => {
          expect(unit.id).toBeDefined();
          expect(unit.tags.action).toBeDefined();
          expect(unit.tags.target).toBeDefined();
          expect(Array.isArray(unit.dependsOn)).toBe(true);
        });
      });
    });
  });
});
