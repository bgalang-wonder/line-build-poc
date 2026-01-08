'use client';

/**
 * Publish Button with Validation Gating (benchtop-x0c.6.4)
 *
 * Handles Draft→Active transition with validation gating.
 * Enforces: No validation failures required to publish.
 * Allows: Always demote Active→Draft for editing.
 */

import React from 'react';
import {
  LineBuild,
  BuildValidationStatus,
} from '@/lib/model/types';
import {
  BuildStatusManager,
  getPossibleTransitions,
} from '@/lib/model/data/statusManager';
import {
  CheckCircle2,
  AlertCircle,
  Loader,
  Lock,
  LockOpen,
} from 'lucide-react';

// ============================================================================
// Type Definitions
// ============================================================================

export interface PublishButtonProps {
  build: LineBuild;
  validationStatus?: BuildValidationStatus | null;
  onPublish?: (build: LineBuild) => void | Promise<void>;
  onDemote?: (build: LineBuild) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

// ============================================================================
// Dialog Component
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm mx-auto">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-sm text-gray-600 mb-6">{message}</p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                isDangerous
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Publish Button Component
// ============================================================================

export function PublishButton({
  build,
  validationStatus,
  onPublish,
  onDemote,
  isLoading = false,
  disabled = false,
}: PublishButtonProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<
    'publish' | 'demote' | null
  >(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const currentStatus = build.metadata.status;
  const possibleTransitions = getPossibleTransitions(currentStatus);
  const canPublish =
    possibleTransitions.includes('active') &&
    BuildStatusManager.canTransition(
      currentStatus,
      'active',
      validationStatus
    );
  const canDemote =
    possibleTransitions.includes('draft') &&
    BuildStatusManager.canTransition(
      currentStatus,
      'draft',
      validationStatus
    );

  // Get transition result for detailed messaging
  const publishResult =
    possibleTransitions.includes('active')
      ? BuildStatusManager.transitionTo(currentStatus, 'active', validationStatus)
      : null;
  const demoteResult =
    possibleTransitions.includes('draft')
      ? BuildStatusManager.transitionTo(currentStatus, 'draft', validationStatus)
      : null;

  const handlePublishClick = () => {
    setConfirmAction('publish');
    setShowConfirm(true);
  };

  const handleDemoteClick = () => {
    setConfirmAction('demote');
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    try {
      setIsProcessing(true);
      setShowConfirm(false);

      if (confirmAction === 'publish' && onPublish) {
        await onPublish(build);
      } else if (confirmAction === 'demote' && onDemote) {
        await onDemote(build);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setConfirmAction(null);
  };

  // Determine UI based on current status
  if (currentStatus === 'draft') {
    return (
      <>
        <div className="space-y-3">
          {/* Publish button */}
          <div>
            <button
              onClick={handlePublishClick}
              disabled={!canPublish || disabled || isLoading || isProcessing}
              className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                canPublish
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Publishing...
                </>
              ) : canPublish ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Publish to Active
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Cannot Publish
                </>
              )}
            </button>

            {/* Publish blocking message */}
            {!canPublish && publishResult?.reason && (
              <p className="mt-2 text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{publishResult.reason}</span>
              </p>
            )}

            {/* Publish ready message */}
            {canPublish && validationStatus?.failureCount === 0 && (
              <p className="mt-2 text-xs text-emerald-600 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>All validations passed. Ready to publish.</span>
              </p>
            )}

            {/* Validation info */}
            {validationStatus && validationStatus.failureCount > 0 && (
              <p className="mt-2 text-xs text-amber-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {validationStatus.failureCount} validation issue
                  {validationStatus.failureCount !== 1 ? 's' : ''} to fix before
                  publishing
                </span>
              </p>
            )}
          </div>

          {/* No validation message */}
          {!validationStatus && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <p className="font-semibold mb-1">Validation Required</p>
              <p>Run validation before publishing to check for issues.</p>
            </div>
          )}
        </div>

        {/* Publish confirmation dialog */}
        <ConfirmDialog
          isOpen={showConfirm && confirmAction === 'publish'}
          title="Publish to Active?"
          message={
            validationStatus?.failureCount === 0
              ? 'This line build will be marked as active and ready for production use.'
              : 'Publish with validation issues? (This should not happen if validation is working correctly.)'
          }
          confirmText="Publish"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </>
    );
  }

  // Active status
  if (currentStatus === 'active') {
    return (
      <>
        <div className="space-y-3">
          {/* Active status badge */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Active & Published
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              This line build is ready for production use.
            </p>
          </div>

          {/* Demote button */}
          <button
            onClick={handleDemoteClick}
            disabled={disabled || isLoading || isProcessing}
            className="w-full px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Demoting...
              </>
            ) : (
              <>
                <LockOpen className="w-4 h-4" />
                Demote to Draft
              </>
            )}
          </button>

          {/* Demote info */}
          <p className="text-xs text-gray-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Demote to draft to make edits. No validation checks required.
            </span>
          </p>
        </div>

        {/* Demote confirmation dialog */}
        <ConfirmDialog
          isOpen={showConfirm && confirmAction === 'demote'}
          title="Demote to Draft?"
          message="You can edit the line build in draft mode. It will need to pass validation again before publishing."
          confirmText="Demote"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </>
    );
  }

  // Fallback
  return null;
}
