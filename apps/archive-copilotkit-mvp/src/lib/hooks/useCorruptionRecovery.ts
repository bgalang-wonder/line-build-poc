'use client';

/**
 * Hook: Corruption recovery detection and handling (benchtop-u2x)
 */

import { useCallback, useState } from 'react';
import { LineBuild } from '../model/types';
import { corruptionRecoveryManager, RecoveryResult } from '../error/corruptionRecovery';
import { errorLogger } from '../error/errorRecovery';

interface UseCorruptionRecoveryOptions {
  onCorruptionDetected?: (buildId: string) => void;
  onRecovered?: (result: RecoveryResult) => void;
  onRecoveryError?: (error: string) => void;
}

/**
 * Hook for detecting and handling JSON corruption
 */
export function useCorruptionRecovery(options?: UseCorruptionRecoveryOptions) {
  const [isCorrupted, setIsCorrupted] = useState(false);
  const [corruptedBuildId, setCorruptedBuildId] = useState<string | null>(null);

  /**
   * Detect if an error is due to JSON corruption
   */
  const isCorruptionError = (error: any): boolean => {
    if (!error) return false;

    const message = String(error).toLowerCase();
    return (
      message.includes('json') ||
      message.includes('parse') ||
      message.includes('corrupt') ||
      message.includes('unexpected token')
    );
  };

  /**
   * Handle a potential corruption scenario
   */
  const handleCorruption = useCallback(
    (buildId: string, error: any) => {
      if (!isCorruptionError(error)) return;

      setIsCorrupted(true);
      setCorruptedBuildId(buildId);

      errorLogger.log({
        timestamp: new Date().toISOString(),
        severity: 'error',
        component: 'useCorruptionRecovery',
        message: `Corruption detected in ${buildId}: ${String(error)}`,
        context: { buildId },
      });

      options?.onCorruptionDetected?.(buildId);
    },
    [options]
  );

  /**
   * Attempt automatic recovery
   */
  const attemptRecovery = useCallback(
    async (buildId: string): Promise<RecoveryResult | null> => {
      try {
        const result = await corruptionRecoveryManager.attemptRecovery(buildId);

        if (result.success) {
          setIsCorrupted(false);
          setCorruptedBuildId(null);
          options?.onRecovered?.(result);
        } else {
          options?.onRecoveryError?.(result.error || 'Recovery failed');
        }

        return result;
      } catch (error) {
        const errorMsg = `Recovery failed: ${String(error)}`;
        options?.onRecoveryError?.(errorMsg);
        return null;
      }
    },
    [options]
  );

  /**
   * Reset corrupted file to empty
   */
  const resetCorruptedFile = useCallback(
    async (buildId: string): Promise<LineBuild | null> => {
      try {
        const result = await corruptionRecoveryManager.resetCorruptedFile(buildId);

        if (result.success) {
          setIsCorrupted(false);
          setCorruptedBuildId(null);
          options?.onRecovered?.(result);
          return result.build || null;
        } else {
          options?.onRecoveryError?.(result.error || 'Reset failed');
          return null;
        }
      } catch (error) {
        const errorMsg = `Reset failed: ${String(error)}`;
        options?.onRecoveryError?.(errorMsg);
        return null;
      }
    },
    [options]
  );

  /**
   * Close corruption dialog and reset state
   */
  const dismissCorruptionDialog = useCallback(() => {
    setIsCorrupted(false);
    setCorruptedBuildId(null);
  }, []);

  /**
   * Get corruption history for a build
   */
  const getCorruptionHistory = useCallback((buildId: string) => {
    return corruptionRecoveryManager.getCorruptionHistory(buildId);
  }, []);

  return {
    isCorrupted,
    corruptedBuildId,
    isCorruptionError,
    handleCorruption,
    attemptRecovery,
    resetCorruptedFile,
    dismissCorruptionDialog,
    getCorruptionHistory,
  };
}
