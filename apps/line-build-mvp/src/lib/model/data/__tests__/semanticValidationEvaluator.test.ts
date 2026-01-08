/**
 * Integration tests for SemanticValidationEvaluator (benchtop-hj0)
 *
 * Tests semantic validation with mocked Gemini API including:
 * - Prompting Gemini with WorkUnit context
 * - Parsing AI responses (with various JSON formats)
 * - Error handling (API failures, malformed responses)
 * - Disabled rules and action type filtering
 * - Result aggregation and reasoning extraction
 */

import {
  SemanticValidationEvaluator,
} from '../semanticValidationEvaluator';
import {
  LineBuild,
  WorkUnit,
  SemanticValidationRule,
  ValidationResult,
} from '../../types';

// ============================================================================
// Mock VertexAIClient Type
// ============================================================================

// Create a minimal mock type for VertexAIClient that the evaluator expects
type MockVertexAIClient = {
  generateContent: (prompt: string, systemInstruction: string) => Promise<string>;
};

// ============================================================================
// Fixtures
// ============================================================================

const createWorkUnit = (overrides: Partial<WorkUnit> = {}): WorkUnit => ({
  id: 'step-1',
  tags: {
    action: 'PREP',
    target: { bomId: '8001', name: 'Chicken Breast' },
    time: { value: 15, unit: 'min', type: 'active' },
    phase: 'PRE_COOK',
    station: 'prep-station',
    equipment: ['cutting-board', 'sharp-knife'],
  },
  dependsOn: [],
  ...overrides,
});

const createRule = (overrides: Partial<SemanticValidationRule> = {}): SemanticValidationRule => ({
  id: 'srule-1',
  type: 'semantic',
  name: 'Check realistic cook time',
  description: 'Ensure cook times are realistic for the item',
  enabled: true,
  appliesTo: 'all',
  prompt: 'Is the cooking time realistic for the target item?',
  guidance: 'You are a food production expert. Evaluate if the time is realistic.',
  ...overrides,
});

const createBuild = (overrides: Partial<LineBuild> = {}): LineBuild => ({
  id: 'build-1',
  menuItemId: '8001',
  menuItemName: 'Grilled Chicken',
  status: 'draft',
  workUnits: [createWorkUnit()],
  metadata: {
    version: 1,
    status: 'draft',
    author: 'test-user',
    sourceConversations: [],
  },
  ...overrides,
});

// ============================================================================
// Test Suites
// ============================================================================

describe('SemanticValidationEvaluator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateRule - AI integration', () => {
    it('should call Gemini with proper context and prompts', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({ pass: true, reasoning: 'Time is realistic', failures: [] })
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      await SemanticValidationEvaluator.evaluateRule(rule, workUnit, build, mockInstance as any);

      expect(mockInstance.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Grilled Chicken'),
        expect.any(String)
      );

      // Verify context includes WorkUnit details
      const callArg = mockInstance.generateContent.mock.calls[0][0];
      expect(callArg).toContain('Chicken Breast');
      expect(callArg).toContain('15 min');
      expect(callArg).toContain('PREP');
    });

    it('should handle successful Gemini response with pass=true', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({
            pass: true,
            reasoning: 'Cook time is appropriate for chicken breast',
            failures: [],
          })
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.reasoning).toContain('appropriate');
      expect(result.ruleType).toBe('semantic');
      expect(result.workUnitId).toBe(workUnit.id);
    });

    it('should handle successful Gemini response with pass=false', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({
            pass: false,
            reasoning: 'Cook time is too short for chicken breast',
            failures: ['15 minutes is insufficient for safe cooking'],
          })
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('insufficient');
      expect(result.reasoning).toContain('too short');
    });

    it('should parse Gemini response with markdown-wrapped JSON', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          `Here is the validation result:
\`\`\`json
{
  "pass": true,
  "reasoning": "Time is realistic",
  "failures": []
}
\`\`\``
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('realistic');
    });

    it('should extract JSON from plaintext response', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          'The validation passed. {"pass": true, "reasoning": "All checks passed", "failures": []}'
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
    });

    it('should handle malformed JSON response gracefully', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          'This is not valid JSON at all'
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('error');
    });

    it('should handle API timeout errors', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockRejectedValue(
          new Error('API request timeout after 30s')
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('timeout');
      expect(result.reasoning).toContain('error');
    });

    it('should handle missing fields in Gemini response', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({
            pass: true,
            // reasoning is missing
          })
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
      expect(result.reasoning).toBe('');
    });
  });

  describe('evaluateRule - rule enablement and filtering', () => {
    it('should skip disabled rules without calling Gemini', async () => {
      const mockInstance = {
        generateContent: jest.fn(),
      };

      const rule = createRule({ enabled: false });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('disabled');
      expect(mockInstance.generateContent).not.toHaveBeenCalled();
    });

    it('should skip rules that do not apply to action type', async () => {
      const mockInstance = {
        generateContent: jest.fn(),
      };

      const rule = createRule({
        appliesTo: ['COOK', 'ASSEMBLE'],
      });
      const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'PREP' } });
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
      expect(result.reasoning).toContain('does not apply');
      expect(mockInstance.generateContent).not.toHaveBeenCalled();
    });

    it('should apply rules matching the action type', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
        ),
      };

      const rule = createRule({
        appliesTo: ['PREP', 'COOK'],
      });
      const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'PREP' } });
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(true);
      expect(mockInstance.generateContent).toHaveBeenCalled();
    });

    it('should apply rule when appliesTo is "all"', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
        ),
      };

      const rule = createRule({ appliesTo: 'all' });
      const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'ANY_ACTION' } });
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(mockInstance.generateContent).toHaveBeenCalled();
    });
  });

  describe('evaluateBuild', () => {
    it('should evaluate all rules against all work units sequentially', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
        ),
      };

      const rules: SemanticValidationRule[] = [
        createRule({ id: 'rule-1' }),
        createRule({ id: 'rule-2' }),
      ];
      const workUnit1 = createWorkUnit({ id: 'step-1' });
      const workUnit2 = createWorkUnit({ id: 'step-2' });
      const build = createBuild({ workUnits: [workUnit1, workUnit2] });

      const results = await SemanticValidationEvaluator.evaluateBuild(
        build,
        rules,
        mockInstance as any
      );

      // 2 rules × 2 work units = 4 results
      expect(results).toHaveLength(4);
      // Should call Gemini 4 times (once per rule-workunit combination)
      expect(mockInstance.generateContent).toHaveBeenCalledTimes(4);
    });

    it('should return results with correct structure', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({
            pass: true,
            reasoning: 'All good',
            failures: [],
          })
        ),
      };

      const rule = createRule();
      const build = createBuild();

      const results = await SemanticValidationEvaluator.evaluateBuild(
        build,
        [rule],
        mockInstance as any
      );

      const result = results[0];
      expect(result).toHaveProperty('ruleId', rule.id);
      expect(result).toHaveProperty('ruleName', rule.name);
      expect(result).toHaveProperty('ruleType', 'semantic');
      expect(result).toHaveProperty('workUnitId');
      expect(result).toHaveProperty('pass');
      expect(result).toHaveProperty('failures');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('timestamp');
    });

    it('should continue evaluating on individual rule failures', async () => {
      const mockInstance = {
        generateContent: jest
          .fn()
          .mockResolvedValueOnce(
            JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
          )
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValueOnce(
            JSON.stringify({ pass: false, reasoning: 'Failed', failures: ['Issue'] })
          ),
      };

      const rules = [
        createRule({ id: 'rule-1' }),
        createRule({ id: 'rule-2' }),
        createRule({ id: 'rule-3' }),
      ];
      const build = createBuild();

      const results = await SemanticValidationEvaluator.evaluateBuild(
        build,
        rules,
        mockInstance as any
      );

      expect(results).toHaveLength(3);
      // First should pass
      expect(results[0].pass).toBe(true);
      // Second should have error
      expect(results[1].pass).toBe(false);
      expect(results[1].reasoning).toContain('error');
      // Third should have failed validation
      expect(results[2].pass).toBe(false);
    });
  });

  describe('summarizeResults', () => {
    it('should count passes and failures correctly', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'semantic',
          workUnitId: 'step-1',
          pass: true,
          failures: [],
          reasoning: 'All good',
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-2',
          ruleName: 'Rule 2',
          ruleType: 'semantic',
          workUnitId: 'step-1',
          pass: false,
          failures: ['Issue detected'],
          reasoning: 'Time is too short',
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'semantic',
          workUnitId: 'step-2',
          pass: true,
          failures: [],
          reasoning: 'Equipment is correct',
          timestamp: new Date().toISOString(),
        },
      ];

      const summary = SemanticValidationEvaluator.summarizeResults(results);

      expect(summary.passCount).toBe(2);
      expect(summary.failCount).toBe(1);
      expect(Object.keys(summary.failuresByWorkUnit)).toContain('step-1');
      expect(summary.failuresByWorkUnit['step-1']).toHaveLength(1);
    });

    it('should calculate average reasoning length', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'semantic',
          workUnitId: 'step-1',
          pass: true,
          failures: [],
          reasoning: '12345', // 5 chars
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-2',
          ruleName: 'Rule 2',
          ruleType: 'semantic',
          workUnitId: 'step-1',
          pass: true,
          failures: [],
          reasoning: '1234567890', // 10 chars
          timestamp: new Date().toISOString(),
        },
      ];

      const summary = SemanticValidationEvaluator.summarizeResults(results);

      // Average of 5 and 10 = 7.5
      expect(summary.avgReasoningLength).toBe(7.5);
    });

    it('should group failures by work unit', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'semantic',
          workUnitId: 'step-1',
          pass: false,
          failures: ['Failure 1'],
          reasoning: 'Failed',
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-2',
          ruleName: 'Rule 2',
          ruleType: 'semantic',
          workUnitId: 'step-1',
          pass: false,
          failures: ['Failure 2'],
          reasoning: 'Failed',
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'semantic',
          workUnitId: 'step-2',
          pass: false,
          failures: ['Failure 3'],
          reasoning: 'Failed',
          timestamp: new Date().toISOString(),
        },
      ];

      const summary = SemanticValidationEvaluator.summarizeResults(results);

      expect(summary.failuresByWorkUnit['step-1']).toHaveLength(2);
      expect(summary.failuresByWorkUnit['step-2']).toHaveLength(1);
    });

    it('should handle empty results', () => {
      const summary = SemanticValidationEvaluator.summarizeResults([]);

      expect(summary.passCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(summary.avgReasoningLength).toBe(0);
      expect(Object.keys(summary.failuresByWorkUnit)).toHaveLength(0);
    });
  });

  describe('Realistic scenarios', () => {
    it('should validate multiple work units with realistic timing rule', async () => {
      const mockInstance = {
        generateContent: jest
          .fn()
          .mockResolvedValueOnce(
            JSON.stringify({
              pass: true,
              reasoning: '15 minutes is realistic for prep of chicken breast',
              failures: [],
            })
          )
          .mockResolvedValueOnce(
            JSON.stringify({
              pass: false,
              reasoning: '2 minutes is too short for grilling chicken to 165F internal temp',
              failures: ['Cook time insufficient for food safety'],
            })
          ),
      };

      const rule = createRule({
        name: 'Realistic cook time',
        prompt: 'Is the cooking time realistic and safe for the target item?',
      });

      const prepStep = createWorkUnit({
        id: 'step-1',
        tags: {
          ...createWorkUnit().tags,
          action: 'PREP',
          time: { value: 15, unit: 'min', type: 'active' },
        },
      });

      const cookStep = createWorkUnit({
        id: 'step-2',
        tags: {
          ...createWorkUnit().tags,
          action: 'COOK',
          time: { value: 2, unit: 'min', type: 'active' },
        },
      });

      const build = createBuild({ workUnits: [prepStep, cookStep] });

      const results = await SemanticValidationEvaluator.evaluateBuild(
        build,
        [rule],
        mockInstance as any
      );

      expect(results).toHaveLength(2);
      expect(results[0].pass).toBe(true);
      expect(results[0].reasoning).toContain('realistic');
      expect(results[1].pass).toBe(false);
      expect(results[1].failures[0]).toContain('insufficient');
    });

    it('should include work unit context in Gemini prompts', async () => {
      const mockInstance: MockVertexAIClient = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({ pass: true, reasoning: 'OK', failures: [] })
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit({
        id: 'step-grill',
        tags: {
          ...createWorkUnit().tags,
          action: 'COOK',
          target: { bomId: '8001', name: 'Grilled Chicken' },
          equipment: ['gas-grill', 'meat-thermometer'],
          dependsOn: [],
        },
      });
      const build = createBuild({ workUnits: [workUnit] });

      await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      const prompt = mockInstance.generateContent.mock.calls[0][0];
      expect(prompt).toContain('Grilled Chicken');
      expect(prompt).toContain('gas-grill');
      expect(prompt).toContain('COOK');
      expect(prompt).toContain('step-grill');
    });
  });

  describe('Error handling with various API responses', () => {
    it('should handle API returning non-boolean pass field', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockResolvedValue(
          JSON.stringify({
            pass: 'yes', // Should be boolean
            reasoning: 'All good',
            failures: [],
          })
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('error');
    });

    it('should handle API returning null response', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockResolvedValue(null),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('error');
    });

    it('should handle network errors gracefully', async () => {
      const mockInstance = {
        generateContent: jest.fn().mockRejectedValue(
          new Error('Network request failed: ECONNREFUSED')
        ),
      };

      const rule = createRule();
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = await SemanticValidationEvaluator.evaluateRule(
        rule,
        workUnit,
        build,
        mockInstance as any
      );

      expect(result.pass).toBe(false);
      expect(result.reasoning).toContain('error');
    });
  });
});
