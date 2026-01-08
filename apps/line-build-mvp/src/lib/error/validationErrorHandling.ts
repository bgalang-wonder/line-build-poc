/**
 * Validation Engine Error Handling (benchtop-ntj)
 *
 * Handles errors in structured and semantic validation engines:
 * - API timeouts and rate limiting (Gemini)
 * - Malformed rule definitions
 * - Circular dependencies in structured rules
 * - Network failures with automatic retry
 * - Graceful degradation for recoverable errors
 */

import { LineBuild, ValidationRule, StructuredValidationRule, SemanticValidationRule, ValidationResult } from '../model/types';
import { errorLogger, withRetry, RetryOptions } from './errorRecovery';

// ============================================================================
// Validation Error Types
// ============================================================================

export interface ValidationError {
  type: 'timeout' | 'api-error' | 'malformed-rule' | 'circular-dependency' | 'unknown';
  message: string;
  ruleId?: string;
  originalError?: any;
}

export interface ValidationErrorResult extends ValidationResult {
  isError: boolean;
  errorInfo?: ValidationError;
}

// ============================================================================
// Rule Validation
// ============================================================================

/**
 * Validate rule structure for malformed definitions
 */
export function validateRuleDefinition(rule: ValidationRule): ValidationError | null {
  // Check common required fields
  if (!rule.id || !rule.name || typeof rule.enabled !== 'boolean') {
    return {
      type: 'malformed-rule',
      message: 'Rule missing required fields (id, name, enabled)',
      ruleId: rule.id,
    };
  }

  // Type-specific validation
  if (rule.type === 'structured') {
    return validateStructuredRule(rule);
  } else if (rule.type === 'semantic') {
    return validateSemanticRule(rule);
  }

  return null;
}

/**
 * Validate structured rule definition
 */
function validateStructuredRule(rule: StructuredValidationRule): ValidationError | null {
  if (!rule.condition) {
    return {
      type: 'malformed-rule',
      message: 'Structured rule missing condition field',
      ruleId: rule.id,
    };
  }

  const { field, operator, value } = rule.condition;

  if (!field || !operator || value === undefined) {
    return {
      type: 'malformed-rule',
      message: 'Rule condition incomplete (missing field, operator, or value)',
      ruleId: rule.id,
    };
  }

  const validOperators = ['in', 'equals', 'notEmpty', 'greaterThan', 'lessThan'];
  if (!validOperators.includes(operator)) {
    return {
      type: 'malformed-rule',
      message: `Invalid operator: ${operator}. Must be one of: ${validOperators.join(', ')}`,
      ruleId: rule.id,
    };
  }

  if (!rule.failureMessage) {
    return {
      type: 'malformed-rule',
      message: 'Structured rule missing failureMessage',
      ruleId: rule.id,
    };
  }

  return null;
}

/**
 * Validate semantic rule definition
 */
function validateSemanticRule(rule: SemanticValidationRule): ValidationError | null {
  if (!rule.prompt || rule.prompt.trim().length === 0) {
    return {
      type: 'malformed-rule',
      message: 'Semantic rule missing or empty prompt',
      ruleId: rule.id,
    };
  }

  return null;
}

// ============================================================================
// Circular Dependency Detection (for structured rules)
// ============================================================================

/**
 * Detect circular dependencies in rule conditions
 * (if a rule condition references another rule's output recursively)
 */
export function detectCircularRuleDependencies(
  rules: StructuredValidationRule[]
): ValidationError | null {
  // For now, this is a placeholder for future enhancement
  // Circular dependencies are most relevant if rules reference each other's results
  // Current MVP doesn't have rule-to-rule references, so this is not needed yet

  return null;
}

// ============================================================================
// API Error Handling
// ============================================================================

/**
 * Detect if an error is due to API timeout/rate limiting
 */
export function isApiTimeoutError(error: any): boolean {
  if (!error) return false;

  const message = String(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('deadline exceeded') ||
    message.includes('timed out')
  );
}

/**
 * Detect if an error is due to rate limiting
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  const message = String(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('quota')
  );
}

// ============================================================================
// Error Recovery for Validation
// ============================================================================

/**
 * Create a graceful error result for validation failures
 */
export function createValidationErrorResult(
  ruleId: string,
  ruleName: string,
  workUnitId: string,
  error: ValidationError | Error | string
): ValidationErrorResult {
  let errorInfo: ValidationError;

  if (typeof error === 'string') {
    errorInfo = {
      type: 'unknown',
      message: error,
      ruleId,
    };
  } else if ('type' in error) {
    errorInfo = error;
  } else {
    errorInfo = {
      type: 'unknown',
      message: error.message || 'Unknown error',
      ruleId,
      originalError: error,
    };
  }

  return {
    ruleId,
    ruleName,
    ruleType: 'structured',
    workUnitId,
    pass: false,
    failures: [
      `Validation error (${errorInfo.type}): ${errorInfo.message}`,
    ],
    reasoning: `The validation engine encountered an error: ${errorInfo.message}. Please retry or contact support.`,
    timestamp: new Date().toISOString(),
    isError: true,
    errorInfo,
  };
}

// ============================================================================
// Wrapped Evaluation with Retry Logic
// ============================================================================

/**
 * Options for validation error handling
 */
export interface ValidationErrorHandlingOptions extends RetryOptions {
  onRetry?: (attempt: number, error: any) => void;
  onTimeout?: (error: any) => void;
  fallbackToSkip?: boolean; // If true, skip rule on failure instead of returning error
}

/**
 * Wrap a validation function with error handling and retry logic
 */
export async function withValidationErrorHandling<T>(
  fn: () => Promise<T>,
  ruleId: string,
  ruleName: string,
  options?: ValidationErrorHandlingOptions
): Promise<T | ValidationErrorResult> {
  const retryOptions: RetryOptions = {
    maxAttempts: options?.maxAttempts || 2,
    initialDelayMs: options?.initialDelayMs || 100,
    maxDelayMs: options?.maxDelayMs || 3000,
    shouldRetry: (error) => {
      // Retry on timeout and rate limiting errors
      if (isApiTimeoutError(error) || isRateLimitError(error)) {
        options?.onRetry?.(1, error);
        return true;
      }

      // Don't retry on malformed rules
      if (String(error).includes('malformed') || String(error).includes('invalid')) {
        return false;
      }

      return false;
    },
  };

  try {
    return await withRetry(fn, retryOptions);
  } catch (error) {
    // Log the error
    if (isApiTimeoutError(error)) {
      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'warning',
        component: 'ValidationErrorHandling',
        message: `Validation timeout for rule ${ruleId}: ${ruleName}`,
        context: { error: String(error) },
      });

      options?.onTimeout?.(error);

      // Return timeout error result
      return createValidationErrorResult(
        ruleId,
        ruleName,
        'unknown',
        {
          type: 'timeout',
          message: 'Validation timed out. Please retry or check the server status.',
          ruleId,
          originalError: error,
        }
      );
    }

    // Handle other errors
    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: 'error',
      component: 'ValidationErrorHandling',
      message: `Validation failed for rule ${ruleId}: ${ruleName}`,
      context: { error: String(error) },
    });

    return createValidationErrorResult(
      ruleId,
      ruleName,
      'unknown',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

// ============================================================================
// Validation Engine Health Monitoring
// ============================================================================

export interface ValidationEngineHealth {
  lastError?: ValidationError;
  errorCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  lastErrorTime?: string;
}

class ValidationEngineHealthMonitor {
  private health: ValidationEngineHealth = {
    errorCount: 0,
    timeoutCount: 0,
    rateLimitCount: 0,
  };

  recordError(error: ValidationError | Error | string) {
    let validationError: ValidationError;

    if (typeof error === 'string') {
      validationError = { type: 'unknown', message: error };
    } else if ('type' in error) {
      validationError = error;
    } else {
      validationError = {
        type: 'unknown',
        message: error.message || 'Unknown',
      };
    }

    this.health.lastError = validationError;
    this.health.errorCount++;
    this.health.lastErrorTime = new Date().toISOString();

    if (validationError.type === 'timeout') {
      this.health.timeoutCount++;
    } else if (validationError.type === 'api-error') {
      this.health.rateLimitCount++;
    }

    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: 'warning',
      component: 'ValidationEngineHealth',
      message: `Validation engine error: ${validationError.type}`,
      context: {
        errorMessage: validationError.message,
        totalErrors: this.health.errorCount,
        timeouts: this.health.timeoutCount,
      },
    });
  }

  getHealth(): ValidationEngineHealth {
    return { ...this.health };
  }

  isHealthy(): boolean {
    // Consider unhealthy if too many recent errors
    // (threshold: more than 3 errors in last call sequence)
    return this.health.errorCount < 3;
  }

  reset() {
    this.health = {
      errorCount: 0,
      timeoutCount: 0,
      rateLimitCount: 0,
    };
  }
}

export const validationEngineHealth = new ValidationEngineHealthMonitor();
