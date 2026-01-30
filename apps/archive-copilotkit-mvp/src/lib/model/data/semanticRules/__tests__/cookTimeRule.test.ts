/**
 * Tests for Cook Time Semantic Rule (benchtop-x0c.7.3)
 *
 * Tests the semantic validation rule that flags unrealistic cook times
 * based on equipment type using Gemini reasoning.
 */

import {
  COOK_TIME_RULE,
  evaluateCookTimeRule,
  preValidateEquipment,
  matchEquipmentToCapability,
  KNOWN_EQUIPMENT_CAPABILITIES,
} from '../cookTimeRule';
import { LineBuild, WorkUnit, ValidationResult } from '../../../types';

// ============================================================================
// Mock VertexAIClient Type
// ============================================================================

type MockVertexAIClient = {
  generateContent: jest.Mock<Promise<string>, [string, string]>;
};

// ============================================================================
// Test Fixtures
// ============================================================================

const createWorkUnit = (overrides: Partial<WorkUnit> = {}): WorkUnit => ({
  id: 'step-heat-1',
  tags: {
    action: 'HEAT',
    target: { bomId: '4001001', name: 'Chicken Breast' },
    equipment: 'fryer',
    time: { value: 5, unit: 'min', type: 'active' },
    phase: 'COOK',
    station: 'Hot line',
  },
  dependsOn: [],
  ...overrides,
});

const createBuild = (overrides: Partial<LineBuild> = {}): LineBuild => ({
  id: 'build-1',
  menuItemId: '8001234',
  menuItemName: 'Grilled Chicken Bowl',
  workUnits: [createWorkUnit()],
  metadata: {
    version: 1,
    status: 'draft',
    author: 'test-user',
    sourceConversations: [],
  },
  ...overrides,
});

const createMockAIClient = (response: string): MockVertexAIClient => ({
  generateContent: jest.fn().mockResolvedValue(response),
});

// ============================================================================
// Rule Definition Tests
// ============================================================================

describe('COOK_TIME_RULE', () => {
  it('should have correct rule structure', () => {
    expect(COOK_TIME_RULE.id).toBe('semantic-cook-time-equipment');
    expect(COOK_TIME_RULE.type).toBe('semantic');
    expect(COOK_TIME_RULE.name).toBe('Realistic Cook Time by Equipment');
    expect(COOK_TIME_RULE.enabled).toBe(true);
    expect(COOK_TIME_RULE.appliesTo).toEqual(['HEAT']);
  });

  it('should have a prompt for Gemini', () => {
    expect(COOK_TIME_RULE.prompt).toBeTruthy();
    expect(COOK_TIME_RULE.prompt).toContain('cook time');
    expect(COOK_TIME_RULE.prompt).toContain('equipment');
  });

  it('should have guidance for Gemini', () => {
    expect(COOK_TIME_RULE.guidance).toBeTruthy();
    expect(COOK_TIME_RULE.guidance).toContain('culinary');
  });
});

// ============================================================================
// Equipment Matching Tests
// ============================================================================

describe('matchEquipmentToCapability', () => {
  it('should match exact equipment names', () => {
    expect(matchEquipmentToCapability('fryer')).toBe('fryer');
    expect(matchEquipmentToCapability('microwave')).toBe('microwave');
    expect(matchEquipmentToCapability('oven')).toBe('oven');
    expect(matchEquipmentToCapability('grill')).toBe('grill');
    expect(matchEquipmentToCapability('waterbath')).toBe('waterbath');
    expect(matchEquipmentToCapability('turbo')).toBe('turbo');
  });

  it('should match case-insensitively', () => {
    expect(matchEquipmentToCapability('FRYER')).toBe('fryer');
    expect(matchEquipmentToCapability('Microwave')).toBe('microwave');
    expect(matchEquipmentToCapability('OVEN')).toBe('oven');
  });

  it('should match partial equipment strings', () => {
    expect(matchEquipmentToCapability('Deep fryer, 350F')).toBe('fryer');
    expect(matchEquipmentToCapability('Convection oven, 400F')).toBe('oven');
    expect(matchEquipmentToCapability('Gas grill')).toBe('grill');
  });

  it('should match common aliases', () => {
    expect(matchEquipmentToCapability('deep fryer')).toBe('fryer');
    expect(matchEquipmentToCapability('deep-fryer')).toBe('fryer');
    expect(matchEquipmentToCapability('flat-top')).toBe('flat_top');
    expect(matchEquipmentToCapability('flat top')).toBe('flat_top');
    expect(matchEquipmentToCapability('griddle')).toBe('flat_top');
    expect(matchEquipmentToCapability('sous vide')).toBe('waterbath');
    expect(matchEquipmentToCapability('water bath')).toBe('waterbath');
    expect(matchEquipmentToCapability('turbo chef')).toBe('turbo');
    expect(matchEquipmentToCapability('turbochef')).toBe('turbo');
    expect(matchEquipmentToCapability('speed oven')).toBe('turbo');
    expect(matchEquipmentToCapability('char grill')).toBe('grill');
    expect(matchEquipmentToCapability('holding cabinet')).toBe('hot_hold_wells');
    expect(matchEquipmentToCapability('heat lamp')).toBe('hot_hold_wells');
  });

  it('should return null for unknown equipment', () => {
    expect(matchEquipmentToCapability('cutting board')).toBeNull();
    expect(matchEquipmentToCapability('mixing bowl')).toBeNull();
    expect(matchEquipmentToCapability('unknown device')).toBeNull();
    expect(matchEquipmentToCapability('')).toBeNull();
  });
});

// ============================================================================
// Pre-Validation Tests
// ============================================================================

describe('preValidateEquipment', () => {
  it('should return valid for known equipment', () => {
    const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, equipment: 'fryer' } });
    const result = preValidateEquipment(workUnit);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.equipment).toBe('fryer');
    }
  });

  it('should return valid for equipment with extra details', () => {
    const workUnit = createWorkUnit({
      tags: { ...createWorkUnit().tags, equipment: 'Deep fryer, 350F' },
    });
    const result = preValidateEquipment(workUnit);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.equipment).toBe('fryer');
    }
  });

  it('should fail for missing equipment', () => {
    const workUnit = createWorkUnit({
      tags: { ...createWorkUnit().tags, equipment: undefined },
    });
    const result = preValidateEquipment(workUnit);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.result.pass).toBe(false);
      expect(result.result.failures[0]).toContain('requires equipment');
    }
  });

  it('should fail for unknown equipment', () => {
    const workUnit = createWorkUnit({
      tags: { ...createWorkUnit().tags, equipment: 'magic cooking device' },
    });
    const result = preValidateEquipment(workUnit);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.result.pass).toBe(false);
      expect(result.result.failures[0]).toContain('Unknown equipment type');
      expect(result.result.reasoning).toContain('known equipment list');
    }
  });
});

// ============================================================================
// Evaluation Tests
// ============================================================================

describe('evaluateCookTimeRule', () => {
  describe('Action Type Filtering', () => {
    it('should skip non-HEAT actions', async () => {
      const workUnit = createWorkUnit({
        tags: { ...createWorkUnit().tags, action: 'PREP' },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient('{}');

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('only applies to HEAT');
      expect(mockClient.generateContent).not.toHaveBeenCalled();
    });

    it('should process HEAT actions', async () => {
      const workUnit = createWorkUnit();
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient(
        JSON.stringify({ pass: true, reasoning: 'Time is appropriate', failures: [] })
      );

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(mockClient.generateContent).toHaveBeenCalled();
    });
  });

  describe('Equipment Validation', () => {
    it('should fail early for missing equipment', async () => {
      const workUnit = createWorkUnit({
        tags: { ...createWorkUnit().tags, equipment: undefined },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient('{}');

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('requires equipment');
      expect(mockClient.generateContent).not.toHaveBeenCalled();
    });

    it('should fail early for unknown equipment', async () => {
      const workUnit = createWorkUnit({
        tags: { ...createWorkUnit().tags, equipment: 'unknown device' },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient('{}');

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('Unknown equipment');
      expect(mockClient.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('Time Validation', () => {
    it('should fail for missing time', async () => {
      const workUnit = createWorkUnit({
        tags: { ...createWorkUnit().tags, time: undefined },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient('{}');

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('requires cooking time');
      expect(mockClient.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('AI Evaluation', () => {
    it('should pass when Gemini approves cook time', async () => {
      const workUnit = createWorkUnit({
        tags: {
          ...createWorkUnit().tags,
          equipment: 'fryer',
          time: { value: 5, unit: 'min', type: 'active' },
        },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient(
        JSON.stringify({
          pass: true,
          reasoning: '5 minutes is a typical frying time for chicken',
          failures: [],
        })
      );

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('typical frying time');
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when Gemini flags unrealistic cook time', async () => {
      const workUnit = createWorkUnit({
        tags: {
          ...createWorkUnit().tags,
          equipment: 'microwave',
          time: { value: 45, unit: 'min', type: 'active' },
        },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient(
        JSON.stringify({
          pass: false,
          reasoning: '45 minutes is extremely long for microwave cooking',
          failures: ['Microwave time exceeds typical range of 30 seconds to 10 minutes'],
        })
      );

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.reasoning).toContain('extremely long');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('exceeds typical range');
    });

    it('should include context in Gemini prompt', async () => {
      const workUnit = createWorkUnit({
        id: 'step-fry-fish',
        tags: {
          action: 'HEAT',
          target: { bomId: '4001005', name: 'Cod Fillet' },
          equipment: 'Deep fryer, 350F',
          time: { value: 4, unit: 'min', type: 'active' },
          phase: 'COOK',
          station: 'Fry station',
        },
        dependsOn: [],
      });
      const build = createBuild({
        menuItemName: 'Crispy Fish Tacos',
        workUnits: [workUnit],
      });
      const mockClient = createMockAIClient(
        JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
      );

      await evaluateCookTimeRule(workUnit, build, mockClient as any);

      const prompt = mockClient.generateContent.mock.calls[0][0];
      expect(prompt).toContain('Crispy Fish Tacos');
      expect(prompt).toContain('Cod Fillet');
      expect(prompt).toContain('Deep fryer, 350F');
      expect(prompt).toContain('fryer'); // normalized
      expect(prompt).toContain('4 min');
      expect(prompt).toContain('COOK');
    });

    it('should handle seconds conversion', async () => {
      const workUnit = createWorkUnit({
        tags: {
          ...createWorkUnit().tags,
          equipment: 'microwave',
          time: { value: 90, unit: 'sec', type: 'active' },
        },
      });
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient(
        JSON.stringify({ pass: true, reasoning: '90 seconds is reasonable', failures: [] })
      );

      await evaluateCookTimeRule(workUnit, build, mockClient as any);

      const prompt = mockClient.generateContent.mock.calls[0][0];
      expect(prompt).toContain('1.5 minutes');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed Gemini response', async () => {
      const workUnit = createWorkUnit();
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient('This is not valid JSON');

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('could not parse');
    });

    it('should handle Gemini API error', async () => {
      const workUnit = createWorkUnit();
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient: MockVertexAIClient = {
        generateContent: jest.fn().mockRejectedValue(new Error('API timeout')),
      };

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('API timeout');
      expect(result.reasoning).toContain('error');
    });

    it('should handle missing pass field in response', async () => {
      const workUnit = createWorkUnit();
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient(
        JSON.stringify({ reasoning: 'No pass field', failures: [] })
      );

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('could not parse');
    });
  });

  describe('Result Structure', () => {
    it('should return correct result structure', async () => {
      const workUnit = createWorkUnit();
      const build = createBuild({ workUnits: [workUnit] });
      const mockClient = createMockAIClient(
        JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
      );

      const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

      expect(result.ruleId).toBe('semantic-cook-time-equipment');
      expect(result.ruleName).toBe('Realistic Cook Time by Equipment');
      expect(result.ruleType).toBe('semantic');
      expect(result.workUnitId).toBe(workUnit.id);
      expect(typeof result.pass).toBe('boolean');
      expect(Array.isArray(result.failures)).toBe(true);
      expect(typeof result.timestamp).toBe('string');
    });
  });
});

// ============================================================================
// Realistic Scenario Tests
// ============================================================================

describe('Realistic Scenarios', () => {
  it('should pass realistic fryer time for fish', async () => {
    const workUnit = createWorkUnit({
      tags: {
        action: 'HEAT',
        target: { bomId: '4001005', name: 'Cod Fillet' },
        equipment: 'Deep fryer, 350F',
        time: { value: 4, unit: 'min', type: 'active' },
        phase: 'COOK',
        station: 'Hot line',
      },
      dependsOn: [],
    });
    const build = createBuild({ workUnits: [workUnit] });
    const mockClient = createMockAIClient(
      JSON.stringify({
        pass: true,
        reasoning: '4 minutes is appropriate for frying cod fillets to golden crispy',
        failures: [],
      })
    );

    const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

    expect(result.pass).toBe(true);
  });

  it('should flag 2-hour microwave time', async () => {
    const workUnit = createWorkUnit({
      tags: {
        action: 'HEAT',
        target: { name: 'Something suspicious' },
        equipment: 'microwave',
        time: { value: 120, unit: 'min', type: 'active' },
        phase: 'COOK',
        station: 'Hot line',
      },
      dependsOn: [],
    });
    const build = createBuild({ workUnits: [workUnit] });
    const mockClient = createMockAIClient(
      JSON.stringify({
        pass: false,
        reasoning: '2 hours in a microwave is highly unusual and likely an error',
        failures: ['Microwave cooking for 120 minutes is unrealistic'],
      })
    );

    const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

    expect(result.pass).toBe(false);
    expect(result.failures[0]).toContain('unrealistic');
  });

  it('should allow long waterbath/sous vide times', async () => {
    const workUnit = createWorkUnit({
      tags: {
        action: 'HEAT',
        target: { name: 'Beef Short Ribs' },
        equipment: 'sous vide',
        time: { value: 48, unit: 'min', type: 'passive' }, // Note: this should be hours in reality
        phase: 'COOK',
        station: 'Waterbath station',
      },
      dependsOn: [],
    });
    const build = createBuild({ workUnits: [workUnit] });
    const mockClient = createMockAIClient(
      JSON.stringify({
        pass: true,
        reasoning: 'Sous vide cooking can take extended periods for tough cuts',
        failures: [],
      })
    );

    const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

    expect(result.pass).toBe(true);
  });

  it('should flag cook time for hot hold wells', async () => {
    const workUnit = createWorkUnit({
      tags: {
        action: 'HEAT',
        target: { name: 'Prepared Dish' },
        equipment: 'hot_hold_wells',
        time: { value: 30, unit: 'min', type: 'active' },
        phase: 'COOK',
        station: 'Hot hold',
      },
      dependsOn: [],
    });
    const build = createBuild({ workUnits: [workUnit] });
    const mockClient = createMockAIClient(
      JSON.stringify({
        pass: false,
        reasoning: 'Hot hold wells are for holding already-cooked food, not cooking',
        failures: ['Hot hold wells should not be used for cooking, only for holding'],
      })
    );

    const result = await evaluateCookTimeRule(workUnit, build, mockClient as any);

    expect(result.pass).toBe(false);
  });
});

// ============================================================================
// Known Equipment Capabilities Tests
// ============================================================================

describe('KNOWN_EQUIPMENT_CAPABILITIES', () => {
  it('should include all expected equipment types', () => {
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('waterbath');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('turbo');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('fryer');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('oven');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('microwave');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('hot_hold_wells');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('grill');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('flat_top');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('steamer');
    expect(KNOWN_EQUIPMENT_CAPABILITIES).toContain('salamander');
  });
});
