/**
 * Normalized Validation Result Schema (benchtop-x0c.7.4)
 *
 * This document defines the standardized schema for validation results
 * produced by both validation engines (structured and semantic).
 *
 * Both the structured evaluator (benchtop-x0c.7.1) and semantic validator (benchtop-x0c.7.2)
 * return results conforming to this schema, enabling consistent aggregation and UI display.
 */

import { ValidationResult, ValidationResultSet, BuildValidationStatus } from '../types';

// ============================================================================
// Normalized ValidationResult Schema
// ============================================================================

/**
 * ValidationResult: Standard output format for all validation rule evaluations
 *
 * Schema:
 * ```json
 * {
 *   "ruleId": "string (UUID)",
 *   "ruleName": "string (human-readable rule name)",
 *   "ruleType": "structured" | "semantic",
 *   "workUnitId": "string (UUID of evaluated WorkUnit)",
 *   "pass": "boolean (true if validation passed)",
 *   "failures": ["string (failure reason 1)", "string (failure reason 2)"],
 *   "reasoning": "string (explanation from Gemini - semantic rules only)",
 *   "timestamp": "ISO 8601 string (when validation was performed)"
 * }
 * ```
 *
 * Field Descriptions:
 * - ruleId: Unique identifier for the validation rule (from ValidationRule.id)
 * - ruleName: Human-readable rule name (from StructuredValidationRule.name or SemanticValidationRule.name)
 * - ruleType: Type of validation engine ("structured" or "semantic")
 * - workUnitId: The WorkUnit being evaluated by this rule
 * - pass: Boolean indicating validation success (true = passed, false = failed)
 * - failures: Array of specific failure reasons (e.g., ["action 'PREP' not in allowed set", "equipment is missing"])
 *   - Empty array [] if pass is true
 *   - Can contain multiple reasons if multiple conditions failed
 * - reasoning: Explanation text from Gemini AI (ONLY populated for semantic rules)
 *   - Undefined/omitted for structured rules (no reasoning needed)
 *   - Provides context and interpretation for why the rule passed or failed
 * - timestamp: ISO 8601 formatted timestamp indicating when validation was performed
 *
 * Usage Examples:
 *
 * Structured Rule Result (e.g., "action must be valid"):
 * ```json
 * {
 *   "ruleId": "rule-123",
 *   "ruleName": "Valid Action Type",
 *   "ruleType": "structured",
 *   "workUnitId": "step-456",
 *   "pass": true,
 *   "failures": [],
 *   "timestamp": "2026-01-08T12:34:56.789Z"
 * }
 * ```
 *
 * Semantic Rule Result with Failure (e.g., "cook times are realistic"):
 * ```json
 * {
 *   "ruleId": "rule-789",
 *   "ruleName": "Realistic Cook Time",
 *   "ruleType": "semantic",
 *   "workUnitId": "step-456",
 *   "pass": false,
 *   "failures": ["Cook time of 120 minutes seems excessive for HEAT action"],
 *   "reasoning": "The system evaluated the 120-minute heat time against typical equipment capabilities and found it unrealistic. Standard equipment typically handles this action in 30-45 minutes.",
 *   "timestamp": "2026-01-08T12:34:57.789Z"
 * }
 * ```
 *
 * Semantic Rule Result with Pass:
 * ```json
 * {
 *   "ruleId": "rule-789",
 *   "ruleName": "Realistic Cook Time",
 *   "ruleType": "semantic",
 *   "workUnitId": "step-456",
 *   "pass": true,
 *   "failures": [],
 *   "reasoning": "The 30-minute heat time is realistic for standard commercial equipment and matches typical production patterns.",
 *   "timestamp": "2026-01-08T12:34:57.789Z"
 * }
 * ```
 */

// ============================================================================
// Aggregation Schema
// ============================================================================

/**
 * ValidationResultSet: Collection of results from a validation run
 *
 * Used when running validation on an entire LineBuild.
 * Contains all ValidationResult objects produced in a single validation run.
 *
 * Schema:
 * ```json
 * {
 *   "buildId": "string (UUID of LineBuild)",
 *   "timestamp": "ISO 8601 string",
 *   "results": [ValidationResult, ValidationResult, ...]
 * }
 * ```
 */

/**
 * BuildValidationStatus: Summary of validation state
 *
 * Aggregated status showing whether build has passed validation.
 * Used by UI to determine if Draft→Active transition is allowed.
 *
 * Schema:
 * ```json
 * {
 *   "buildId": "string (UUID of LineBuild)",
 *   "isDraft": "boolean",
 *   "hasStructuredFailures": "boolean",
 *   "hasSemanticFailures": "boolean",
 *   "failureCount": "number (count of failed validations)",
 *   "lastChecked": "ISO 8601 string (when validation last ran)",
 *   "results": [ValidationResult, ValidationResult, ...]
 * }
 * ```
 *
 * Interpretation:
 * - Draft→Active transition allowed only if:
 *   - isDraft is true AND
 *   - hasStructuredFailures is false AND
 *   - hasSemanticFailures is false
 * - UI shows failure count and last checked time to inform user
 */

// ============================================================================
// Validation Engine Contract
// ============================================================================

/**
 * Interface that all validation engines must implement
 *
 * Both structured and semantic validators must produce results
 * conforming to the ValidationResult schema above.
 */
export interface ValidationEngine {
  /**
   * Evaluate a single rule against a WorkUnit
   * @param rule The validation rule to evaluate
   * @param workUnit The WorkUnit being validated
   * @param build The full LineBuild context
   * @returns ValidationResult conforming to normalized schema
   */
  evaluateRule(
    rule: any, // ValidationRule
    workUnit: any, // WorkUnit
    build: any // LineBuild
  ): Promise<ValidationResult>;

  /**
   * Evaluate all rules for a build
   * @param build The LineBuild to validate
   * @param rules The validation rules to apply
   * @returns Array of ValidationResult objects
   */
  evaluateBuild(build: any, rules: any[]): Promise<ValidationResult[]>;
}

// ============================================================================
// Type Exports (re-exported from types.ts for convenience)
// ============================================================================

export type { ValidationResult, ValidationResultSet, BuildValidationStatus } from '../types';
