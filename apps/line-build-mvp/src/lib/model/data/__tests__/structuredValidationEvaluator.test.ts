/**
 * Unit tests for StructuredValidationEvaluator (benchtop-44m)
 *
 * Tests structured validation rule evaluation including:
 * - All 5 condition operators (equals, in, notEmpty, greaterThan, lessThan)
 * - Rule enablement and filtering by action type
 * - Nested field access via dot notation
 * - Edge cases and error handling
 * - Performance with many rules
 */

import {
  StructuredValidationEvaluator,
} from '../structuredValidationEvaluator';
import {
  LineBuild,
  WorkUnit,
  StructuredValidationRule,
  ValidationResult,
} from '../../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const createWorkUnit = (overrides: Partial<WorkUnit> = {}): WorkUnit => ({
  id: 'step-1',
  tags: {
    action: 'PREP',
    target: { bomId: '8001', name: 'Chicken' },
    time: { value: 10, unit: 'min', type: 'active' },
    phase: 'PRE_COOK',
    station: 'prep-station',
    equipment: ['cutting-board', 'knife'],
  },
  dependsOn: [],
  ...overrides,
});

const createRule = (overrides: Partial<StructuredValidationRule> = {}): StructuredValidationRule => ({
  id: 'rule-1',
  type: 'structured',
  name: 'Test Rule',
  description: 'A test validation rule',
  enabled: true,
  appliesTo: 'all',
  condition: {
    field: 'tags.action',
    operator: 'equals',
    value: 'PREP',
  },
  ...overrides,
});

const createBuild = (overrides: Partial<LineBuild> = {}): LineBuild => ({
  id: 'build-1',
  menuItemId: '8001',
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

describe('StructuredValidationEvaluator', () => {
  describe('evaluateRule - equals operator', () => {
    it('should pass when field equals expected value', () => {
      const rule = createRule({
        condition: {
          field: 'tags.action',
          operator: 'equals',
          value: 'PREP',
        },
      });
      const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'PREP' } });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.ruleType).toBe('structured');
      expect(result.workUnitId).toBe(workUnit.id);
    });

    it('should fail when field does not equal expected value', () => {
      const rule = createRule({
        condition: {
          field: 'tags.action',
          operator: 'equals',
          value: 'COOK',
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('tags.action');
      expect(result.failures[0]).toContain('COOK');
    });

    it('should handle nested field access for equals', () => {
      const rule = createRule({
        condition: {
          field: 'tags.time.value',
          operator: 'equals',
          value: 10,
        },
      });
      const workUnit = createWorkUnit({
        tags: {
          ...createWorkUnit().tags,
          time: { value: 10, unit: 'min', type: 'active' },
        },
      });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
    });
  });

  describe('evaluateRule - in operator', () => {
    it('should pass when field is in the allowed array', () => {
      const rule = createRule({
        condition: {
          field: 'tags.action',
          operator: 'in',
          value: ['PREP', 'COOK', 'ASSEMBLE'],
        },
      });
      const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'PREP' } });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when field is not in the allowed array', () => {
      const rule = createRule({
        condition: {
          field: 'tags.action',
          operator: 'in',
          value: ['COOK', 'ASSEMBLE'],
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('must be one of');
    });

    it('should fail gracefully when in operator value is not an array', () => {
      const rule = createRule({
        condition: {
          field: 'tags.action',
          operator: 'in',
          value: 'PREP', // Invalid: should be array
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('Validation rule error');
    });
  });

  describe('evaluateRule - notEmpty operator', () => {
    it('should pass when field has a value', () => {
      const rule = createRule({
        condition: {
          field: 'tags.station',
          operator: 'notEmpty',
          value: null, // notEmpty ignores value
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when field is empty string', () => {
      const rule = createRule({
        condition: {
          field: 'tags.station',
          operator: 'notEmpty',
          value: null,
        },
      });
      const workUnit = createWorkUnit({
        tags: { ...createWorkUnit().tags, station: '' },
      });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('required');
    });

    it('should fail when field is null or undefined', () => {
      const rule = createRule({
        condition: {
          field: 'tags.nonexistent',
          operator: 'notEmpty',
          value: null,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
    });

    it('should fail when field is empty array', () => {
      const rule = createRule({
        condition: {
          field: 'tags.equipment',
          operator: 'notEmpty',
          value: null,
        },
      });
      const workUnit = createWorkUnit({
        tags: { ...createWorkUnit().tags, equipment: [] },
      });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
    });
  });

  describe('evaluateRule - greaterThan operator', () => {
    it('should pass when field is greater than threshold', () => {
      const rule = createRule({
        condition: {
          field: 'tags.time.value',
          operator: 'greaterThan',
          value: 5,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when field is not greater than threshold', () => {
      const rule = createRule({
        condition: {
          field: 'tags.time.value',
          operator: 'greaterThan',
          value: 15,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('must be >');
    });

    it('should fail when field is not a number', () => {
      const rule = createRule({
        condition: {
          field: 'tags.action',
          operator: 'greaterThan',
          value: 5,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('must be a number');
    });
  });

  describe('evaluateRule - lessThan operator', () => {
    it('should pass when field is less than threshold', () => {
      const rule = createRule({
        condition: {
          field: 'tags.time.value',
          operator: 'lessThan',
          value: 15,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
    });

    it('should fail when field is not less than threshold', () => {
      const rule = createRule({
        condition: {
          field: 'tags.time.value',
          operator: 'lessThan',
          value: 5,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('must be <');
    });
  });

  describe('evaluateRule - rule enablement', () => {
    it('should return pass when rule is disabled', () => {
      const rule = createRule({
        enabled: false,
        condition: {
          field: 'tags.action',
          operator: 'equals',
          value: 'NONEXISTENT',
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should evaluate rule when enabled is true', () => {
      const rule = createRule({
        enabled: true,
        condition: {
          field: 'tags.action',
          operator: 'equals',
          value: 'NONEXISTENT',
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
    });
  });

  describe('evaluateRule - appliesTo filtering', () => {
    it('should apply rule to all actions when appliesTo is "all"', () => {
      const rule = createRule({
        appliesTo: 'all',
        condition: {
          field: 'tags.action',
          operator: 'notEmpty',
          value: null,
        },
      });
      const workUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'COOK' } });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
    });

    it('should apply rule to matching action types', () => {
      const rule = createRule({
        appliesTo: ['PREP', 'ASSEMBLE'],
        condition: {
          field: 'tags.station',
          operator: 'notEmpty',
          value: null,
        },
      });
      const prepWorkUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'PREP' } });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, prepWorkUnit, build);

      expect(result.pass).toBe(true);
    });

    it('should skip rule for non-matching action types', () => {
      const rule = createRule({
        appliesTo: ['ASSEMBLE'],
        condition: {
          field: 'tags.action',
          operator: 'equals',
          value: 'NONEXISTENT',
        },
      });
      const cookWorkUnit = createWorkUnit({ tags: { ...createWorkUnit().tags, action: 'COOK' } });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, cookWorkUnit, build);

      expect(result.pass).toBe(true); // Rule doesn't apply, so pass
      expect(result.failures).toHaveLength(0);
    });

    it('should apply rule when appliesTo is undefined', () => {
      const rule = createRule({
        appliesTo: undefined,
        condition: {
          field: 'tags.action',
          operator: 'notEmpty',
          value: null,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
    });
  });

  describe('evaluateBuild', () => {
    it('should evaluate all rules against all work units', () => {
      const rules: StructuredValidationRule[] = [
        createRule({
          id: 'rule-1',
          condition: {
            field: 'tags.action',
            operator: 'equals',
            value: 'PREP',
          },
        }),
        createRule({
          id: 'rule-2',
          condition: {
            field: 'tags.station',
            operator: 'notEmpty',
            value: null,
          },
        }),
      ];
      const workUnit1 = createWorkUnit({ id: 'step-1', tags: { ...createWorkUnit().tags, action: 'PREP' } });
      const workUnit2 = createWorkUnit({ id: 'step-2', tags: { ...createWorkUnit().tags, action: 'COOK' } });
      const build = createBuild({ workUnits: [workUnit1, workUnit2] });

      const results = StructuredValidationEvaluator.evaluateBuild(build, rules);

      // 2 rules × 2 work units = 4 results
      expect(results).toHaveLength(4);
      expect(results.every((r) => r.ruleType === 'structured')).toBe(true);
    });

    it('should return empty array when no rules provided', () => {
      const build = createBuild();
      const results = StructuredValidationEvaluator.evaluateBuild(build, []);

      expect(results).toHaveLength(0);
    });

    it('should return results with correct structure', () => {
      const rule = createRule();
      const build = createBuild();

      const results = StructuredValidationEvaluator.evaluateBuild(build, [rule]);

      expect(results).toHaveLength(1);
      const result = results[0];
      expect(result).toHaveProperty('ruleId', rule.id);
      expect(result).toHaveProperty('ruleName', rule.name);
      expect(result).toHaveProperty('ruleType', 'structured');
      expect(result).toHaveProperty('workUnitId');
      expect(result).toHaveProperty('pass');
      expect(result).toHaveProperty('failures');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('summarizeResults', () => {
    it('should count passes and failures correctly', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'structured',
          workUnitId: 'step-1',
          pass: true,
          failures: [],
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-2',
          ruleName: 'Rule 2',
          ruleType: 'structured',
          workUnitId: 'step-1',
          pass: false,
          failures: ['Some failure message'],
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'structured',
          workUnitId: 'step-2',
          pass: true,
          failures: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const summary = StructuredValidationEvaluator.summarizeResults(results);

      expect(summary.passCount).toBe(2);
      expect(summary.failCount).toBe(1);
      expect(Object.keys(summary.failuresByWorkUnit)).toContain('step-1');
      expect(summary.failuresByWorkUnit['step-1']).toHaveLength(1);
    });

    it('should group failures by work unit', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'structured',
          workUnitId: 'step-1',
          pass: false,
          failures: ['Failure 1'],
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-2',
          ruleName: 'Rule 2',
          ruleType: 'structured',
          workUnitId: 'step-1',
          pass: false,
          failures: ['Failure 2'],
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'structured',
          workUnitId: 'step-2',
          pass: false,
          failures: ['Failure 3'],
          timestamp: new Date().toISOString(),
        },
      ];

      const summary = StructuredValidationEvaluator.summarizeResults(results);

      expect(summary.failuresByWorkUnit['step-1']).toHaveLength(2);
      expect(summary.failuresByWorkUnit['step-2']).toHaveLength(1);
    });

    it('should handle empty results', () => {
      const summary = StructuredValidationEvaluator.summarizeResults([]);

      expect(summary.passCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(Object.keys(summary.failuresByWorkUnit)).toHaveLength(0);
    });

    it('should handle all passing results', () => {
      const results: ValidationResult[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Rule 1',
          ruleType: 'structured',
          workUnitId: 'step-1',
          pass: true,
          failures: [],
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-2',
          ruleName: 'Rule 2',
          ruleType: 'structured',
          workUnitId: 'step-1',
          pass: true,
          failures: [],
          timestamp: new Date().toISOString(),
        },
      ];

      const summary = StructuredValidationEvaluator.summarizeResults(results);

      expect(summary.passCount).toBe(2);
      expect(summary.failCount).toBe(0);
      expect(Object.keys(summary.failuresByWorkUnit)).toHaveLength(0);
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle deeply nested field access', () => {
      const rule = createRule({
        condition: {
          field: 'tags.time.value',
          operator: 'greaterThan',
          value: 0,
        },
      });
      const workUnit = createWorkUnit({
        tags: {
          ...createWorkUnit().tags,
          time: { value: 5, unit: 'min', type: 'active' },
        },
      });
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(true);
    });

    it('should handle missing nested fields gracefully', () => {
      const rule = createRule({
        condition: {
          field: 'tags.nonexistent.nested.field',
          operator: 'notEmpty',
          value: null,
        },
      });
      const workUnit = createWorkUnit();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, workUnit, build);

      expect(result.pass).toBe(false);
      expect(result.failures[0]).toContain('required');
    });

    it('should have timestamp in all results', () => {
      const rule = createRule();
      const build = createBuild();

      const result = StructuredValidationEvaluator.evaluateRule(rule, createWorkUnit(), build);

      expect(result.timestamp).toBeTruthy();
      const date = new Date(result.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Performance with many rules', () => {
    it('should efficiently evaluate 100 rules against 10 work units', () => {
      const rules: StructuredValidationRule[] = Array.from({ length: 100 }, (_, i) =>
        createRule({
          id: `rule-${i}`,
          condition: {
            field: 'tags.action',
            operator: 'equals',
            value: 'PREP',
          },
        })
      );
      const workUnits: WorkUnit[] = Array.from({ length: 10 }, (_, i) =>
        createWorkUnit({ id: `step-${i}` })
      );
      const build = createBuild({ workUnits });

      const startTime = performance.now();
      const results = StructuredValidationEvaluator.evaluateBuild(build, rules);
      const endTime = performance.now();

      // 100 rules × 10 work units = 1000 results
      expect(results).toHaveLength(1000);
      // Should complete in reasonable time (< 500ms)
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});
