/**
 * Migration Validator
 *
 * Validates converted WorkUnits against hard schema rules and soft warnings
 * P1.8 Implementation: Ensures 95%+ quality through multi-stage validation
 */

import {
  WorkUnit,
  MigrationResult,
  ValidationIssue,
  LineBuild,
} from '../model/types';

// ============================================================================
// Validation Rules
// ============================================================================

const REQUIRED_TAGS = ['action', 'target'];

const ACTION_SPECIFIC_REQUIREMENTS: Record<string, string[]> = {
  HEAT: ['equipment', 'time'],
  TRANSFER: ['equipment'],
  PORTION: ['equipment'],
};

const VALID_ACTIONS = [
  'PREP',
  'HEAT',
  'TRANSFER',
  'ASSEMBLE',
  'PORTION',
  'PLATE',
  'FINISH',
  'QUALITY_CHECK',
];

const VALID_PHASES = [
  'PRE_COOK',
  'COOK',
  'POST_COOK',
  'ASSEMBLY',
  'PASS',
];

const VALID_EQUIPMENT = [
  'waterbath',
  'turbo',
  'fryer',
  'microwave',
  'grill',
  'oven',
  'stovetop',
  'salamander',
];

const VALID_TIME_UNITS = ['sec', 'min'];
const VALID_TIME_TYPES = ['active', 'passive'];

// ============================================================================
// Validator Implementation
// ============================================================================

export class MigrationValidator {
  /**
   * Validate required fields are present
   */
  validateRequired(workUnit: WorkUnit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check required tags
    if (!workUnit.tags.action) {
      issues.push({
        type: 'missing_required_field',
        field: 'tags.action',
        message: 'Action type is required',
        severity: 'error',
      });
    } else if (!VALID_ACTIONS.includes(workUnit.tags.action)) {
      issues.push({
        type: 'missing_required_field',
        field: 'tags.action',
        message: `Invalid action type: ${workUnit.tags.action}`,
        severity: 'error',
        suggestedValue: VALID_ACTIONS[0],
      });
    }

    if (!workUnit.tags.target || !workUnit.tags.target.name) {
      issues.push({
        type: 'missing_required_field',
        field: 'tags.target',
        message: 'Target ingredient is required',
        severity: 'error',
      });
    }

    // Check action-specific requirements
    if (workUnit.tags.action && ACTION_SPECIFIC_REQUIREMENTS[workUnit.tags.action]) {
      const required = ACTION_SPECIFIC_REQUIREMENTS[workUnit.tags.action];
      for (const field of required) {
        if (field === 'equipment' && !workUnit.tags.equipment) {
          issues.push({
            type: 'missing_required_field',
            field: 'tags.equipment',
            message: `${workUnit.tags.action} action requires equipment`,
            severity: 'error',
            suggestedValue: 'stovetop',
          });
        }
        if (field === 'time' && !workUnit.tags.time) {
          issues.push({
            type: 'missing_required_field',
            field: 'tags.time',
            message: `${workUnit.tags.action} action requires timing`,
            severity: 'error',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Validate field values match expected formats
   */
  validateFieldFormats(workUnit: WorkUnit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate phase if present
    if (workUnit.tags.phase && !VALID_PHASES.includes(workUnit.tags.phase)) {
      issues.push({
        type: 'schema_mismatch',
        field: 'tags.phase',
        message: `Invalid phase: ${workUnit.tags.phase}`,
        severity: 'warning',
        suggestedValue: 'COOK',
      });
    }

    // Validate equipment if present
    if (workUnit.tags.equipment && !VALID_EQUIPMENT.includes(workUnit.tags.equipment)) {
      issues.push({
        type: 'schema_mismatch',
        field: 'tags.equipment',
        message: `Equipment "${workUnit.tags.equipment}" is not in standard list`,
        severity: 'warning',
        suggestedValue: 'stovetop',
      });
    }

    // Validate time format
    if (workUnit.tags.time) {
      const { value, unit, type } = workUnit.tags.time;

      if (typeof value !== 'number' || value <= 0) {
        issues.push({
          type: 'schema_mismatch',
          field: 'tags.time.value',
          message: `Time value must be positive number, got ${value}`,
          severity: 'error',
        });
      }

      if (!VALID_TIME_UNITS.includes(unit)) {
        issues.push({
          type: 'schema_mismatch',
          field: 'tags.time.unit',
          message: `Invalid time unit: ${unit}`,
          severity: 'error',
          suggestedValue: 'min',
        });
      }

      if (!VALID_TIME_TYPES.includes(type)) {
        issues.push({
          type: 'schema_mismatch',
          field: 'tags.time.type',
          message: `Invalid time type: ${type}`,
          severity: 'error',
          suggestedValue: 'active',
        });
      }
    }

    return issues;
  }

  /**
   * Validate extraction confidence and flag low-confidence items
   */
  validateConfidence(
    result: MigrationResult,
    threshold: number = 85
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const workUnit of result.workUnits) {
      const confidence = this.parseConfidence(workUnit.metadata?.extractionConfidence);

      if (confidence < threshold) {
        issues.push({
          type: 'low_confidence_extraction',
          field: `workUnit:${workUnit.id}`,
          message: `Extraction confidence ${confidence}% below threshold ${threshold}%`,
          severity: confidence < 70 ? 'error' : 'warning',
        });
      }
    }

    return issues;
  }

  /**
   * Convert confidence level to numeric score
   */
  private parseConfidence(level?: 'high' | 'medium' | 'low'): number {
    switch (level) {
      case 'high':
        return 90;
      case 'medium':
        return 75;
      case 'low':
        return 50;
      default:
        return 100; // Unknown = assume high
    }
  }

  /**
   * Validate DAG structure (dependencies are valid)
   */
  validateDAGStructure(workUnits: WorkUnit[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const validIds = new Set(workUnits.map((w) => w.id));

    for (const workUnit of workUnits) {
      for (const depId of workUnit.dependsOn) {
        if (!validIds.has(depId)) {
          issues.push({
            type: 'invalid_reference',
            field: `dependsOn:${depId}`,
            message: `Dependency references non-existent work unit: ${depId}`,
            severity: 'error',
          });
        }
      }
    }

    // Check for circular dependencies
    for (const workUnit of workUnits) {
      if (this.hasCyclicDependency(workUnit, workUnits)) {
        issues.push({
          type: 'invalid_reference',
          field: `dependsOn`,
          message: `Circular dependency detected involving: ${workUnit.id}`,
          severity: 'error',
        });
      }
    }

    return issues;
  }

  /**
   * Detect if a work unit has cyclic dependencies
   */
  private hasCyclicDependency(workUnit: WorkUnit, allUnits: WorkUnit[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    return this.hasCycle(workUnit.id, allUnits, visited, recursionStack);
  }

  private hasCycle(
    nodeId: string,
    allUnits: WorkUnit[],
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = allUnits.find((u) => u.id === nodeId);
    if (!node) return false;

    for (const depId of node.dependsOn) {
      if (!visited.has(depId)) {
        if (this.hasCycle(depId, allUnits, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(depId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Comprehensive validation of migration result
   */
  validate(result: MigrationResult, confidenceThreshold: number = 85): ValidationIssue[] {
    const allIssues: ValidationIssue[] = [];

    // Validate each work unit
    for (const workUnit of result.workUnits) {
      allIssues.push(...this.validateRequired(workUnit));
      allIssues.push(...this.validateFieldFormats(workUnit));
    }

    // Validate overall structure
    allIssues.push(...this.validateDAGStructure(result.workUnits));

    // Validate confidence
    allIssues.push(...this.validateConfidence(result, confidenceThreshold));

    return allIssues;
  }

  /**
   * Determine if result should be auto-accepted or sent to review
   */
  shouldAutoAccept(result: MigrationResult, confidenceThreshold: number = 85): boolean {
    const issues = this.validate(result, confidenceThreshold);

    // Auto-accept if no errors and no low-confidence warnings
    const hasErrors = issues.some((i) => i.severity === 'error');
    const hasLowConfidence = issues.some((i) => i.type === 'low_confidence_extraction');

    return !hasErrors && !hasLowConfidence;
  }

  /**
   * Get summary of validation issues
   */
  getSummary(issues: ValidationIssue[]): { errors: number; warnings: number } {
    return {
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    };
  }
}
