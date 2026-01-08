/**
 * useMigrationRunner Hook
 *
 * React hook for managing migration workflow state and operations
 * Handles loading, converting, validating, and tracking progress
 */

import { useState, useCallback } from 'react';
import {
  MigrationJob,
  MigrationResult,
} from '../model/types';
import {
  getMigrationService,
  MigrationOptions,
} from '../migration/migrationService';

export interface MigrationState {
  job: MigrationJob | null;
  progress: { current: number; total: number };
  error: string | null;
  isRunning: boolean;
}

/**
 * Hook for managing migration operations
 *
 * Usage:
 * ```tsx
 * const { job, progress, error, isRunning, runMigration, reset } = useMigrationRunner();
 *
 * const handleMigrate = async (file: File) => {
 *   await runMigration(file, { confidenceThreshold: 'high' });
 * };
 *
 * return (
 *   <div>
 *     {job && (
 *       <>
 *         <p>Progress: {progress.current} / {progress.total}</p>
 *         <p>Success: {job.convertedCount}</p>
 *         <p>Review: {job.reviewQueueCount}</p>
 *       </>
 *     )}
 *     {error && <div className="error">{error}</div>}
 *   </div>
 * );
 * ```
 */
export function useMigrationRunner() {
  const [state, setState] = useState<MigrationState>({
    job: null,
    progress: { current: 0, total: 0 },
    error: null,
    isRunning: false,
  });

  /**
   * Run migration with progress tracking
   */
  const runMigration = useCallback(
    async (jsonPath: string, options?: MigrationOptions) => {
      try {
        setState((prev) => ({
          ...prev,
          error: null,
          isRunning: true,
        }));

        const service = getMigrationService();

        const job = await service.importAndConvert(
          jsonPath,
          options,
          (current, total) => {
            setState((prev) => ({
              ...prev,
              progress: { current, total },
            }));
          }
        );

        setState((prev) => ({
          ...prev,
          job,
          isRunning: false,
        }));

        return job;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown migration error';

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isRunning: false,
        }));

        throw err;
      }
    },
    []
  );

  /**
   * Get current job summary
   */
  const getSummary = useCallback(() => {
    if (!state.job) return null;

    const service = getMigrationService();
    return service.getJobSummary(state.job);
  }, [state.job]);

  /**
   * Get detailed result for specific item
   */
  const getResultDetail = useCallback(
    (index: number): MigrationResult | null => {
      return state.job?.results[index] || null;
    },
    [state.job]
  );

  /**
   * Get all successful conversions
   */
  const getSuccessfulResults = useCallback((): MigrationResult[] => {
    return state.job?.results.filter((r) => r.status === 'success') || [];
  }, [state.job]);

  /**
   * Get all results needing review
   */
  const getReviewQueueResults = useCallback((): MigrationResult[] => {
    return state.job?.results.filter((r) => r.status === 'review_needed') || [];
  }, [state.job]);

  /**
   * Get all failed results
   */
  const getFailedResults = useCallback((): MigrationResult[] => {
    return state.job?.results.filter((r) => r.status === 'failed') || [];
  }, [state.job]);

  /**
   * Reset migration state
   */
  const reset = useCallback(() => {
    setState({
      job: null,
      progress: { current: 0, total: 0 },
      error: null,
      isRunning: false,
    });
  }, []);

  return {
    // State
    job: state.job,
    progress: state.progress,
    error: state.error,
    isRunning: state.isRunning,

    // Actions
    runMigration,
    reset,

    // Queries
    getSummary,
    getResultDetail,
    getSuccessfulResults,
    getReviewQueueResults,
    getFailedResults,
  };
}
