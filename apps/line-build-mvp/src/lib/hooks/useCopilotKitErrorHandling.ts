'use client';

/**
 * Hook: CopilotKit error handling and connection monitoring (benchtop-oqi)
 */

import { useEffect, useState } from 'react';
import {
  copilotKitConnectionManager,
  CopilotKitError,
  errorLogger,
} from '../error/errorRecovery';

interface UseCopilotKitErrorHandlingOptions {
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: CopilotKitError) => void;
}

/**
 * Hook for monitoring CopilotKit connection and handling errors
 */
export function useCopilotKitErrorHandling(options?: UseCopilotKitErrorHandlingOptions) {
  const [isConnected, setIsConnected] = useState(
    copilotKitConnectionManager.getConnected()
  );

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribe = copilotKitConnectionManager.onConnectionChange((connected) => {
      setIsConnected(connected);
      options?.onConnectionChange?.(connected);
    });

    return () => {
      unsubscribe();
    };
  }, [options]);

  /**
   * Record an error from CopilotKit operations
   */
  const recordError = (error: CopilotKitError) => {
    copilotKitConnectionManager.recordError(error);
    options?.onError?.(error);
  };

  /**
   * Record successful CopilotKit operation
   */
  const recordSuccess = () => {
    copilotKitConnectionManager.recordSuccess();
  };

  /**
   * Handle fetch errors with proper CopilotKit error typing
   */
  const handleFetchError = (
    error: any,
    context: string
  ): CopilotKitError => {
    let type: CopilotKitError['type'] = 'other';

    if (error?.message?.includes('Connection refused')) {
      type = 'connection';
    } else if (error?.message?.includes('timeout')) {
      type = 'timeout';
    } else if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
      type = 'malformed-response';
    }

    const copilotError: CopilotKitError = {
      type,
      message: error?.message || 'Unknown error',
      originalError: error,
    };

    recordError(copilotError);

    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: 'error',
      component: `CopilotKit.${context}`,
      message: `Error: ${copilotError.message}`,
      context: { errorType: type },
    });

    return copilotError;
  };

  return {
    isConnected,
    recordError,
    recordSuccess,
    handleFetchError,
  };
}
