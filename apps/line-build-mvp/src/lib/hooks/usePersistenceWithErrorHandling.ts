'use client';

/**
 * Hook: Enhanced persistence with error handling, retry logic, and recovery (benchtop-oqi)
 */

import { useCallback } from 'react';
import { LineBuild } from '../model/types';
import { LineBuildPersistence } from '../model/data/persistence';
import {
  withRetry,
  stateSnapshotManager,
  errorLogger,
  errorRecoveryManager,
} from '../error/errorRecovery';

interface UsePersistenceOptions {
  autoBackup?: boolean;
  dataDir?: string;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

/**
 * Hook for persistent operations with automatic retry and error recovery
 */
export function usePersistenceWithErrorHandling(options?: UsePersistenceOptions) {
  const persistence = new LineBuildPersistence({
    autoBackup: options?.autoBackup !== false,
    dataDir: options?.dataDir,
  });

  /**
   * Load a build with retry logic and error handling
   */
  const loadWithRetry = useCallback(
    async (buildId: string): Promise<LineBuild | null> => {
      try {
        const result = await withRetry(
          () => persistence.load(buildId),
          {
            maxAttempts: 3,
            initialDelayMs: 100,
          }
        );

        options?.onSuccess?.(`Loaded build ${buildId}`);
        return result.build;
      } catch (error) {
        const message = errorRecoveryManager.handleApiError(error, 'Persistence.load');
        options?.onError?.(message);

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'error',
          component: 'usePersistenceWithErrorHandling',
          message: `Failed to load ${buildId}`,
          context: { error: String(error) },
        });

        return null;
      }
    },
    [persistence, options]
  );

  /**
   * Save a build with retry logic, backup creation, and error handling
   */
  const saveWithRetry = useCallback(
    async (build: LineBuild): Promise<boolean> => {
      try {
        // Save snapshot before attempting save (for recovery if it fails)
        stateSnapshotManager.saveSnapshot(build);

        const result = await withRetry(
          () => persistence.save(build),
          {
            maxAttempts: 3,
            initialDelayMs: 100,
          }
        );

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'info',
          component: 'usePersistenceWithErrorHandling',
          message: `Saved build ${build.id}`,
          context: { backupFile: result.backupFile },
        });

        options?.onSuccess?.(`Saved build ${build.id}`);
        return true;
      } catch (error) {
        const message = errorRecoveryManager.handleApiError(error, 'Persistence.save');
        options?.onError?.(message);

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'error',
          component: 'usePersistenceWithErrorHandling',
          message: `Failed to save ${build.id}`,
          context: { error: String(error) },
        });

        return false;
      }
    },
    [persistence, options]
  );

  /**
   * Load all builds with graceful error handling
   */
  const loadAllWithErrorHandling = useCallback(
    async (): Promise<LineBuild[]> => {
      try {
        const result = await withRetry(
          () => persistence.loadAll(),
          {
            maxAttempts: 2,
            initialDelayMs: 100,
          }
        );

        options?.onSuccess?.(`Loaded ${result.length} builds`);
        return result;
      } catch (error) {
        const message = errorRecoveryManager.handleApiError(error, 'Persistence.loadAll');
        options?.onError?.(message);

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'error',
          component: 'usePersistenceWithErrorHandling',
          message: 'Failed to load all builds',
          context: { error: String(error) },
        });

        return [];
      }
    },
    [persistence, options]
  );

  /**
   * Delete a build with error handling
   */
  const deleteWithErrorHandling = useCallback(
    async (buildId: string): Promise<boolean> => {
      try {
        await persistence.delete(buildId);

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'info',
          component: 'usePersistenceWithErrorHandling',
          message: `Deleted build ${buildId}`,
        });

        options?.onSuccess?.(`Deleted build ${buildId}`);
        return true;
      } catch (error) {
        const message = errorRecoveryManager.handleApiError(error, 'Persistence.delete');
        options?.onError?.(message);

        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'error',
          component: 'usePersistenceWithErrorHandling',
          message: `Failed to delete ${buildId}`,
          context: { error: String(error) },
        });

        return false;
      }
    },
    [persistence, options]
  );

  /**
   * Check if build exists
   */
  const checkExists = useCallback(
    async (buildId: string): Promise<boolean> => {
      try {
        return await persistence.exists(buildId);
      } catch (error) {
        errorLogger.log({
          timestamp: new Date().toISOString(),
          severity: 'warning',
          component: 'usePersistenceWithErrorHandling',
          message: `Failed to check if ${buildId} exists`,
          context: { error: String(error) },
        });
        return false;
      }
    },
    [persistence]
  );

  return {
    loadWithRetry,
    saveWithRetry,
    loadAllWithErrorHandling,
    deleteWithErrorHandling,
    checkExists,
  };
}
