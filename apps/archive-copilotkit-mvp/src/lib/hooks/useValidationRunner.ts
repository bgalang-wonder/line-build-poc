/**
 * useValidationRunner Hook (benchtop-x0c.11.5)
 *
 * Provides validation running capability for UI components.
 * - Runs validation through ValidationOrchestrator
 * - Updates editor store with results
 * - Manages loading/error states
 * - Persists last-check-result to storage
 */

'use client';

import { useCallback, useState } from 'react';
import { LineBuild, BuildValidationStatus } from '../model/types';
import {
  getValidationOrchestrator,
  clearRulesCache,
} from '../validation/orchestrator';
import { useEditorStore } from '../model/store/editorStore';
import { LineBuildPersistence } from '../model/data/persistence';

interface UseValidationRunnerResult {
  isRunning: boolean;
  error: string | null;
  runValidation: (build: LineBuild) => Promise<BuildValidationStatus>;
  clearError: () => void;
}

/**
 * Hook to run validation and update editor store
 */
export function useValidationRunner(): UseValidationRunnerResult {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValidationStatus = useEditorStore(
    (state) => state.setValidationStatus
  );
  const setValidationRunning = useEditorStore(
    (state) => state.setValidationRunning
  );

  const runValidation = useCallback(
    async (build: LineBuild): Promise<BuildValidationStatus> => {
      try {
        setError(null);
        setIsRunning(true);
        setValidationRunning(true);

        // Get orchestrator and run validation
        const orchestrator = getValidationOrchestrator();
        const validationResult = await orchestrator.runValidation(build);

        // Update store with results
        setValidationStatus(validationResult);

        // Persist last-check-result to storage
        try {
          const persistence = LineBuildPersistence.getInstance();
          await persistence.saveLastCheckResult(build.id, validationResult);
        } catch (persistError) {
          console.warn(
            'Failed to persist validation result:',
            persistError
          );
          // Continue anyway - in-memory result is still valid
        }

        setIsRunning(false);
        setValidationRunning(false);

        return validationResult;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Validation failed';
        setError(errorMessage);
        setIsRunning(false);
        setValidationRunning(false);

        // Return error status
        return {
          passCount: 0,
          failCount: 0,
          totalCount: 0,
          isValid: false,
          allResults: [],
          failuresByRule: {},
          lastCheckedAt: new Date().toISOString(),
          durationMs: 0,
          error: errorMessage,
        };
      }
    },
    [setValidationStatus, setValidationRunning]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRunning,
    error,
    runValidation,
    clearError,
  };
}

/**
 * Hook to reload last-check-result from storage
 * Useful when switching between builds
 */
export function useLoadLastCheckResult() {
  return useCallback(async (buildId: string) => {
    try {
      const persistence = LineBuildPersistence.getInstance();
      const result = await persistence.loadLastCheckResult(buildId);
      return result;
    } catch (error) {
      console.warn('Failed to load last check result:', error);
      return null;
    }
  }, []);
}
