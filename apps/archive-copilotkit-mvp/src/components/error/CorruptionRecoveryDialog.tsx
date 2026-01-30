'use client';

/**
 * Corruption Recovery Dialog Component (benchtop-u2x)
 *
 * Presents recovery options when JSON corruption is detected
 */

import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Trash2, HelpCircle } from 'lucide-react';
import {
  corruptionRecoveryManager,
  RecoveryResult,
} from '@/lib/error/corruptionRecovery';

interface CorruptionRecoveryDialogProps {
  buildId: string;
  isOpen: boolean;
  onClose: () => void;
  onRecovered: (result: RecoveryResult) => void;
  onError: (error: string) => void;
}

export function CorruptionRecoveryDialog({
  buildId,
  isOpen,
  onClose,
  onRecovered,
  onError,
}: CorruptionRecoveryDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState<'none' | 'backup' | 'reset'>(
    'none'
  );

  if (!isOpen) return null;

  const handleRecoverFromBackup = async () => {
    setIsLoading(true);
    setRecoveryAttempt('backup');
    try {
      const result = await corruptionRecoveryManager.attemptRecovery(buildId);
      if (result.success) {
        onRecovered(result);
        onClose();
      } else {
        onError(result.error || 'Recovery failed');
      }
    } catch (error) {
      onError(`Recovery error: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToEmpty = async () => {
    if (!window.confirm('Reset to empty draft? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setRecoveryAttempt('reset');
    try {
      const result = await corruptionRecoveryManager.resetCorruptedFile(buildId);
      if (result.success) {
        onRecovered(result);
        onClose();
      } else {
        onError(result.error || 'Reset failed');
      }
    } catch (error) {
      onError(`Reset error: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <h2 className="text-lg font-semibold text-gray-900">Corrupted File Detected</h2>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-600 mb-6">
          The file for <code className="bg-gray-100 px-2 py-1 rounded text-xs">{buildId}</code> appears
          to be corrupted. Choose how to recover:
        </p>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {/* Option 1: Restore from Backup */}
          <button
            onClick={handleRecoverFromBackup}
            disabled={isLoading}
            className="w-full p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Restore from Backup</h3>
                <p className="text-xs text-gray-600 mt-1">
                  {isLoading && recoveryAttempt === 'backup'
                    ? 'Restoring...'
                    : 'Recover the last known-good version'}
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Reset to Empty */}
          <button
            onClick={handleResetToEmpty}
            disabled={isLoading}
            className="w-full p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Reset to Empty Draft</h3>
                <p className="text-xs text-gray-600 mt-1">
                  {isLoading && recoveryAttempt === 'reset'
                    ? 'Resetting...'
                    : 'Start fresh with an empty line build'}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
          <div className="flex gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900">
              We automatically create backups when you save. If a backup exists, you can recover
              your recent changes.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
