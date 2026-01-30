'use client';

/**
 * Check My Work Button (benchtop-x0c.6.2)
 *
 * Triggers validation orchestration to run both structured and semantic validators.
 * Features:
 * - Labeled "Check my work" with icon
 * - Disabled when validation already running
 * - Shows spinner while running
 * - Disabled while running
 * - After completion, displays success/error toast with result count
 * - Integrates with validation orchestrator (benchtop-x0c.11.5)
 */

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { LineBuild, BuildValidationStatus } from '@/lib/model/types';
import { useValidationRunner } from '@/lib/hooks/useValidationRunner';
import { v4 as uuidv4 } from 'uuid';

export interface CheckMyWorkButtonProps {
  build: LineBuild | null;
  isRunning?: boolean;
  onValidationComplete?: (status: BuildValidationStatus) => void;
  onToast?: (toast: {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }) => void;
}

export function CheckMyWorkButton({
  build,
  isRunning = false,
  onValidationComplete,
  onToast,
}: CheckMyWorkButtonProps) {
  const { runValidation } = useValidationRunner();

  const handleClick = async () => {
    if (!build || isRunning) return;

    try {
      // Run validation through orchestrator
      const result = await runValidation(build);

      // Determine status message and type
      if (result.error) {
        onToast?.({
          id: uuidv4(),
          type: 'error',
          title: 'Validation Error',
          message: result.error,
        });
      } else if (result.isValid) {
        onToast?.({
          id: uuidv4(),
          type: 'success',
          title: 'All Clear!',
          message: `✓ All ${result.totalCount} checks passed. Ready to publish.`,
        });
      } else {
        const pluralIssues = result.failCount !== 1 ? 'issues' : 'issue';
        onToast?.({
          id: uuidv4(),
          type: 'error',
          title: `${result.failCount} ${pluralIssues} found`,
          message: `${result.passCount} passed, ${result.failCount} failed. Check the panel for details.`,
        });
      }

      // Notify parent of completion
      onValidationComplete?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Validation failed';
      onToast?.({
        id: uuidv4(),
        type: 'error',
        title: 'Validation Error',
        message: errorMessage,
      });
    }
  };

  const isDisabled = !build || isRunning;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        w-full px-4 py-3 rounded-lg font-medium text-sm
        flex items-center justify-center gap-2
        transition-colors duration-200
        ${
          isDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        }
      `}
    >
      {isRunning ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          <span>Running validation...</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-4 h-4" />
          <span>Check my work</span>
        </>
      )}
    </button>
  );
}
