/**
 * Structured Validation Evaluator (benchtop-x0c.7.1)
 *
 * Evaluates StructuredValidationRules against LineBuild instances.
 * Returns ValidationResult objects conforming to the normalized schema.
 *
 * This evaluator handles condition-based validation:
 * - Field-based rules with operators: equals, in, notEmpty, greaterThan, lessThan
 * - Applies to specific action types or all actions
 * - No external dependencies (pure function evaluation)
 */

import {
  LineBuild,
  WorkUnit,
  StructuredValidationRule,
  ValidationResult,
} from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a nested field value from an object using dot notation
 * @param obj The object to access
 * @param path Dot notation path (e.g., "tags.action" or "tags.time.value")
 * @returns The field value or undefined if not found
 */
function getNestedField(obj: any, path: string): unknown {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Evaluate a single condition against a WorkUnit
 * @param workUnit The WorkUnit to evaluate
 * @param condition The condition from the validation rule
 * @returns { pass: boolean, failure?: string }
 */
function evaluateCondition(
  workUnit: WorkUnit,
  condition: {
    field: string;
    operator: 'in' | 'equals' | 'notEmpty' | 'greaterThan' | 'lessThan';
    value: unknown;
  }
): { pass: boolean; failure?: string } {
  const fieldValue = getNestedField(workUnit, condition.field);

  switch (condition.operator) {
    case 'equals': {
      const passed = fieldValue === condition.value;
      return {
        pass: passed,
        failure: passed
          ? undefined
          : `${condition.field} must equal ${JSON.stringify(condition.value)}, but got ${JSON.stringify(fieldValue)}`,
      };
    }

    case 'in': {
      if (!Array.isArray(condition.value)) {
        return {
          pass: false,
          failure: `Validation rule error: 'in' operator requires array value, got ${typeof condition.value}`,
        };
      }
      const passed = (condition.value as unknown[]).includes(fieldValue);
      return {
        pass: passed,
        failure: passed
          ? undefined
          : `${condition.field} must be one of ${JSON.stringify(condition.value)}, but got ${JSON.stringify(fieldValue)}`,
      };
    }

    case 'notEmpty': {
      const isEmpty =
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0);
      const passed = !isEmpty;
      return {
        pass: passed,
        failure: passed ? undefined : `${condition.field} is required but is empty`,
      };
    }

    case 'greaterThan': {
      if (typeof fieldValue !== 'number' || typeof condition.value !== 'number') {
        return {
          pass: false,
          failure: `${condition.field} must be a number to use 'greaterThan' operator`,
        };
      }
      const passed = (fieldValue as number) > (condition.value as number);
      return {
        pass: passed,
        failure: passed
          ? undefined
          : `${condition.field} must be > ${condition.value}, but got ${fieldValue}`,
      };
    }

    case 'lessThan': {
      if (typeof fieldValue !== 'number' || typeof condition.value !== 'number') {
        return {
          pass: false,
          failure: `${condition.field} must be a number to use 'lessThan' operator`,
        };
      }
      const passed = (fieldValue as number) < (condition.value as number);
      return {
        pass: passed,
        failure: passed
          ? undefined
          : `${condition.field} must be < ${condition.value}, but got ${fieldValue}`,
      };
    }

    default:
      return {
        pass: false,
        failure: `Unknown operator: ${(condition as any).operator}`,
      };
  }
}

/**
 * Check if a rule applies to a specific WorkUnit
 * @param rule The validation rule
 * @param workUnit The WorkUnit to check
 * @returns true if the rule applies to this WorkUnit
 */
function ruleAppliesToWorkUnit(
  rule: StructuredValidationRule,
  workUnit: WorkUnit
): boolean {
  if (!rule.appliesTo) {
    return true; // No restriction = applies to all
  }

  if (rule.appliesTo === 'all') {
    return true;
  }

  // appliesTo is an array of action types
  return (rule.appliesTo as string[]).includes(workUnit.tags.action);
}

// ============================================================================
// Main Evaluator
// ============================================================================

export class StructuredValidationEvaluator {
  /**
   * Evaluate a single validation rule against a WorkUnit
   * @param rule The StructuredValidationRule to evaluate
   * @param workUnit The WorkUnit being validated
   * @param build The full LineBuild context
   * @returns ValidationResult conforming to normalized schema
   */
  static evaluateRule(
    rule: StructuredValidationRule,
    workUnit: WorkUnit,
    build: LineBuild
  ): ValidationResult {
    const timestamp = new Date().toISOString();

    // If rule is disabled, skip it (return pass)
    if (!rule.enabled) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'structured',
        workUnitId: workUnit.id,
        pass: true,
        failures: [],
        timestamp,
      };
    }

    // If rule doesn't apply to this WorkUnit's action type, skip it (return pass)
    if (!ruleAppliesToWorkUnit(rule, workUnit)) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'structured',
        workUnitId: workUnit.id,
        pass: true,
        failures: [],
        timestamp,
      };
    }

    // Evaluate the condition
    const { pass, failure } = evaluateCondition(workUnit, rule.condition);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: 'structured',
      workUnitId: workUnit.id,
      pass,
      failures: failure ? [failure] : [],
      timestamp,
    };
  }

  /**
   * Evaluate all enabled structured rules for a build
   * @param build The LineBuild to validate
   * @param rules The validation rules to apply
   * @returns Array of ValidationResult objects for all rules and WorkUnits
   */
  static evaluateBuild(
    build: LineBuild,
    rules: StructuredValidationRule[]
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    // For each WorkUnit in the build
    for (const workUnit of build.workUnits) {
      // For each rule
      for (const rule of rules) {
        const result = this.evaluateRule(rule, workUnit, build);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get a summary of validation results
   * @param results The validation results to summarize
   * @returns { passCount, failCount, failuresByWorkUnit }
   */
  static summarizeResults(results: ValidationResult[]): {
    passCount: number;
    failCount: number;
    failuresByWorkUnit: Record<string, ValidationResult[]>;
  } {
    const failuresByWorkUnit: Record<string, ValidationResult[]> = {};
    let passCount = 0;
    let failCount = 0;

    for (const result of results) {
      if (result.pass) {
        passCount++;
      } else {
        failCount++;
        if (!failuresByWorkUnit[result.workUnitId]) {
          failuresByWorkUnit[result.workUnitId] = [];
        }
        failuresByWorkUnit[result.workUnitId].push(result);
      }
    }

    return { passCount, failCount, failuresByWorkUnit };
  }
}
