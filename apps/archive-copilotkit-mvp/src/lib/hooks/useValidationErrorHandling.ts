'use client';

/**
 * Hook: Validation error handling and recovery (benchtop-ntj)
 */

import { useCallback, useState } from 'react';
import {
  validationEngineHealth,
  validateRuleDefinition,
  isApiTimeoutError,
  isRateLimitError,
  ValidationError,
} from '../error/validationErrorHandling';
import { ValidationRule } from '../model/types';
import { errorLogger } from '../error/errorRecovery';

interface UseValidationErrorHandlingOptions {
  onTimeoutError?: (error: any) => void;
  onRateLimitError?: (error: any) => void;
  onMalformedRule?: (error: ValidationError) => void;
}

/**
 * Hook for validation error handling and engine health monitoring
 */
export function useValidationErrorHandling(options?: UseValidationErrorHandlingOptions) {
  const [isValidationRunning, setIsValidationRunning] = useState(false);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  /**
   * Validate a rule definition before evaluation
   */
  const validateRule = useCallback(
    (rule: ValidationRule): ValidationError | null => {
      const error = validateRuleDefinition(rule);

      if (error) {
        validationEngineHealth.recordError(error);
        options?.onMalformedRule?.(error);
        setValidationError(error);

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'error',
          component: 'useValidationErrorHandling',
          message: `Malformed rule: ${error.message}`,
          context: { ruleId: error.ruleId },
        });
      }

      return error;
    },
    [options]
  );

  /**
   * Handle a validation engine error
   */
  const handleValidationError = useCallback(
    (error: any, context: string): ValidationError => {
      let validationError: ValidationError;

      if (isApiTimeoutError(error)) {
        validationError = {
          type: 'timeout',
          message: 'Validation timed out. The server took too long to respond.',
        };
        options?.onTimeoutError?.(error);
      } else if (isRateLimitError(error)) {
        validationError = {
          type: 'api-error',
          message: 'Rate limited. Please wait a moment and try again.',
        };
        options?.onRateLimitError?.(error);
      } else {
        validationError = {
          type: 'unknown',
          message: error?.message || 'Unknown validation error',
        };
      }

      validationEngineHealth.recordError(validationError);
      setValidationError(validationError);

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'error',
        component: `useValidationErrorHandling.${context}`,
        message: `Validation error: ${validationError.message}`,
        context: { errorType: validationError.type },
      });

      return validationError;
    },
    [options]
  );

  /**
   * Get validation engine health
   */
  const getEngineHealth = useCallback(() => {
    return validationEngineHealth.getHealth();
  }, []);

  /**
   * Check if validation engine is healthy
   */
  const isEngineHealthy = useCallback(() => {
    return validationEngineHealth.isHealthy();
  }, []);

  /**
   * Clear validation error
   */
  const clearError = useCallback(() => {
    setValidationError(null);
  }, []);

  /**
   * Reset engine health (after successful validation)
   */
  const resetEngineHealth = useCallback(() => {
    validationEngineHealth.reset();
  }, []);

  return {
    isValidationRunning,
    setIsValidationRunning,
    validationError,
    validateRule,
    handleValidationError,
    getEngineHealth,
    isEngineHealthy,
    clearError,
    resetEngineHealth,
  };
}
