/**
 * Tests for Complexity Scoring Engine
 */

import {
  scoreLineBuild,
  scoreWorkUnit,
  scoreLineBuildFiltered,
  ComplexityScore,
} from '../complexityEngine';
import { LineBuild, WorkUnit } from '../../model/types';

// Helper to create a simple work unit
function createWorkUnit(overrides?: Partial<WorkUnit>): WorkUnit {
  return {
    id: 'test-wu-1',
    tags: {
      action: 'PREP',
      target: { name: 'chicken' },
      ...overrides?.tags,
    },
    dependsOn: [],
    ...overrides,
  };
}

// Helper to create a line build
function createLineBuild(workUnits: WorkUnit[]): LineBuild {
  return {
    id: 'test-build-1',
    menuItemId: '80-1234',
    menuItemName: 'Test Dish',
    workUnits,
    metadata: {
      author: 'test',
      version: 1,
      status: 'draft',
    },
  };
}

describe('Complexity Scoring Engine', () => {
  describe('scoreWorkUnit', () => {
    it('should score a simple prep step as low complexity', () => {
      const wu = createWorkUnit({
        tags: {
          action: 'PREP',
          target: { name: 'chicken' },
        },
      });

      const score = scoreWorkUnit(wu);

      expect(score.overall).toBeLessThan(40);
      expect(score.reasoning).toBeDefined();
      expect(score.timestamp).toBeDefined();
    });

    it('should score a heat step with equipment and time as higher complexity', () => {
      const wu = createWorkUnit({
        tags: {
          action: 'HEAT',
          target: { name: 'chicken' },
          equipment: 'waterbath',
          time: { value: 10, unit: 'min', type: 'active' },
        },
      });

      const score = scoreWorkUnit(wu);

      expect(score.overall).toBeGreaterThan(30);
      expect(score.factors.timeBreakdown).toBeGreaterThan(10);
    });
  });

  describe('scoreLineBuild', () => {
    it('should handle empty build', () => {
      const build = createLineBuild([]);
      const score = scoreLineBuild(build);

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it('should score single action build as simple', () => {
      const wu = createWorkUnit({
        tags: {
          action: 'PREP',
          target: { name: 'chicken' },
        },
      });

      const build = createLineBuild([wu]);
      const score = scoreLineBuild(build);

      expect(score.factors.workVariety).toBeLessThan(20);
      expect(score.reasoning).toContain('Simple');
    });

    it('should score multi-action build as more complex', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: { action: 'PREP', target: { name: 'chicken' } },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: { action: 'HEAT', target: { name: 'chicken' }, equipment: 'waterbath' },
        }),
        createWorkUnit({
          id: 'wu-3',
          tags: { action: 'TRANSFER', target: { name: 'sauce' } },
        }),
        createWorkUnit({
          id: 'wu-4',
          tags: { action: 'ASSEMBLE', target: { name: 'plate' } },
        }),
      ];

      const build = createLineBuild(workUnits);
      const score = scoreLineBuild(build);

      expect(score.factors.workVariety).toBeGreaterThan(20);
    });

    it('should account for equipment variety', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: { action: 'HEAT', target: { name: 'chicken' }, equipment: 'waterbath' },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: { action: 'HEAT', target: { name: 'sauce' }, equipment: 'turbo' },
        }),
      ];

      const build = createLineBuild(workUnits);
      const score = scoreLineBuild(build);

      expect(score.factors.equipmentVariety).toBeGreaterThan(5);
    });

    it('should account for time breakdown', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            time: { value: 30, unit: 'min', type: 'active' },
          },
        }),
      ];

      const build = createLineBuild(workUnits);
      const score = scoreLineBuild(build);

      expect(score.factors.timeBreakdown).toBeGreaterThan(30);
    });

    it('should produce consistent scores', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            equipment: 'waterbath',
            time: { value: 10, unit: 'min', type: 'active' },
            phase: 'COOK',
          },
        }),
      ];

      const build = createLineBuild(workUnits);

      const score1 = scoreLineBuild(build);
      const score2 = scoreLineBuild(build);

      expect(score1.overall).toBe(score2.overall);
      expect(score1.factors).toEqual(score2.factors);
    });

    it('should integrate active vs passive time correctly', () => {
      const activeTimeUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            time: { value: 10, unit: 'min', type: 'active' },
          },
        }),
      ];

      const passiveTimeUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            time: { value: 10, unit: 'min', type: 'passive' },
          },
        }),
      ];

      const activeBuild = createLineBuild(activeTimeUnits);
      const passiveBuild = createLineBuild(passiveTimeUnits);

      const activeScore = scoreLineBuild(activeBuild);
      const passiveScore = scoreLineBuild(passiveBuild);

      // Active time should score higher (more complex)
      expect(activeScore.factors.timeBreakdown).toBeGreaterThan(
        passiveScore.factors.timeBreakdown
      );
    });
  });

  describe('scoreLineBuildFiltered', () => {
    it('should filter out pre-service prep with exclude_prep', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'PORTION',
            target: { name: 'chicken' },
            prepType: 'pre_service',
          },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            prepType: 'order_execution',
          },
        }),
      ];

      const build = createLineBuild(workUnits);

      const filtered = scoreLineBuildFiltered(build, 'exclude_prep');

      // Should only score the non-prep item
      expect(filtered.factors.workVariety).toBeLessThan(
        scoreLineBuild(build).factors.workVariety
      );
    });

    it('should include only pre-service prep with prep_only', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'PORTION',
            target: { name: 'chicken' },
            prepType: 'pre_service',
          },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            prepType: 'order_execution',
          },
        }),
      ];

      const build = createLineBuild(workUnits);

      const prepOnly = scoreLineBuildFiltered(build, 'prep_only');

      expect(prepOnly.factors.workVariety).toBeLessThan(
        scoreLineBuild(build).factors.workVariety
      );
    });

    it('should include all prep with include_prep (default)', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'PORTION',
            target: { name: 'chicken' },
            prepType: 'pre_service',
          },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            prepType: 'order_execution',
          },
        }),
      ];

      const build = createLineBuild(workUnits);

      const included = scoreLineBuildFiltered(build, 'include_prep');
      const fullBuild = scoreLineBuild(build);

      expect(included.overall).toBe(fullBuild.overall);
    });
  });

  describe('Score bounds and sanity checks', () => {
    it('scores should always be between 0 and 100', () => {
      const testCases = [
        [],
        [createWorkUnit()],
        [
          createWorkUnit({ tags: { action: 'PREP', target: { name: 'a' } } }),
          createWorkUnit({ tags: { action: 'HEAT', target: { name: 'b' } } }),
          createWorkUnit({ tags: { action: 'TRANSFER', target: { name: 'c' } } }),
          createWorkUnit({ tags: { action: 'ASSEMBLE', target: { name: 'd' } } }),
          createWorkUnit({ tags: { action: 'PLATE', target: { name: 'e' } } }),
          createWorkUnit({ tags: { action: 'FINISH', target: { name: 'f' } } }),
          createWorkUnit({ tags: { action: 'QUALITY_CHECK', target: { name: 'g' } } }),
        ],
      ];

      for (const units of testCases) {
        const build = createLineBuild(units);
        const score = scoreLineBuild(build);

        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(100);

        for (const [key, value] of Object.entries(score.factors)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should have valid reasoning for all scores', () => {
      const wu = createWorkUnit();
      const score = scoreWorkUnit(wu);

      expect(score.reasoning).toBeDefined();
      expect(score.reasoning.length).toBeGreaterThan(0);
      expect(score.reasoning).toMatch(/\./); // Should end with period
    });
  });

  describe('Real-world scenarios', () => {
    it('should score a simple chicken dish reasonably', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'PREP',
            target: { name: 'chicken', bomId: '40-1234' },
          },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken', bomId: '40-1234' },
            equipment: 'waterbath',
            time: { value: 5, unit: 'min', type: 'active' },
            phase: 'COOK',
          },
        }),
        createWorkUnit({
          id: 'wu-3',
          tags: {
            action: 'PLATE',
            target: { name: 'chicken', bomId: '40-1234' },
          },
        }),
      ];

      const build = createLineBuild(workUnits);
      const score = scoreLineBuild(build);

      // Should be moderately complex
      expect(score.overall).toBeGreaterThan(20);
      expect(score.overall).toBeLessThan(60);
    });

    it('should score a complex multi-station dish higher', () => {
      const workUnits = [
        createWorkUnit({
          id: 'wu-1',
          tags: {
            action: 'PREP',
            target: { name: 'sauce' },
            station: 'cold-side',
            prepType: 'pre_service',
          },
        }),
        createWorkUnit({
          id: 'wu-2',
          tags: {
            action: 'PREP',
            target: { name: 'chicken' },
            station: 'prep',
            prepType: 'pre_service',
          },
        }),
        createWorkUnit({
          id: 'wu-3',
          tags: {
            action: 'HEAT',
            target: { name: 'chicken' },
            equipment: 'turbo',
            time: { value: 8, unit: 'min', type: 'active' },
            station: 'hot-side',
            phase: 'COOK',
          },
        }),
        createWorkUnit({
          id: 'wu-4',
          tags: {
            action: 'TRANSFER',
            target: { name: 'sauce' },
            station: 'expo',
          },
        }),
        createWorkUnit({
          id: 'wu-5',
          tags: {
            action: 'ASSEMBLE',
            target: { name: 'plate' },
            station: 'expo',
          },
        }),
        createWorkUnit({
          id: 'wu-6',
          tags: {
            action: 'FINISH',
            target: { name: 'plate' },
            station: 'expo',
          },
        }),
      ];

      const build = createLineBuild(workUnits);
      const score = scoreLineBuild(build);

      // Should be more complex than simple dish
      expect(score.overall).toBeGreaterThan(50);
    });
  });
});
