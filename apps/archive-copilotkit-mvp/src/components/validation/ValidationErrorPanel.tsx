'use client';

/**
 * Validation Error Panel Component (benchtop-ntj)
 *
 * Displays validation-specific errors and recovery options
 */

import React from 'react';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { ValidationError } from '@/lib/error/validationErrorHandling';

interface ValidationErrorPanelProps {
  error: ValidationError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

export function ValidationErrorPanel({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
}: ValidationErrorPanelProps) {
  if (!error) return null;

  const getErrorColor = () => {
    switch (error.type) {
      case 'timeout':
        return 'bg-orange-50 border-orange-200';
      case 'api-error':
        return 'bg-red-50 border-red-200';
      case 'malformed-rule':
        return 'bg-yellow-50 border-yellow-200';
      case 'circular-dependency':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getErrorIcon = () => {
    switch (error.type) {
      case 'timeout':
      case 'api-error':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'malformed-rule':
      case 'circular-dependency':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'timeout':
        return 'Validation Timeout';
      case 'api-error':
        return 'API Error';
      case 'malformed-rule':
        return 'Invalid Rule Definition';
      case 'circular-dependency':
        return 'Circular Dependency Detected';
      default:
        return 'Validation Error';
    }
  };

  const getRecoveryMessage = () => {
    switch (error.type) {
      case 'timeout':
        return 'The validation engine took too long to respond. Please try again or check your server connection.';
      case 'api-error':
        return 'The API encountered an error. Please wait a moment and try again.';
      case 'malformed-rule':
        return 'The validation rule is not properly defined. Please check and fix the rule definition.';
      case 'circular-dependency':
        return 'Circular dependency detected in validation rules. Please resolve the circular reference.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  return (
    <div className={`p-4 border rounded-lg ${getErrorColor()}`}>
      <div className="flex items-start gap-3">
        {getErrorIcon()}
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">{getErrorTitle()}</h3>
          <p className="text-xs text-gray-700 mb-3">{error.message}</p>
          <p className="text-xs text-gray-600 mb-4">{getRecoveryMessage()}</p>

          {/* Actions */}
          <div className="flex gap-2">
            {(error.type === 'timeout' || error.type === 'api-error') && onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRetrying && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Engine Health Status Indicator
 */
interface ValidationEngineStatusProps {
  isHealthy: boolean;
  errorCount?: number;
}

export function ValidationEngineStatus({
  isHealthy,
  errorCount = 0,
}: ValidationEngineStatusProps) {
  if (isHealthy && errorCount === 0) return null;

  return (
    <div className={`p-2 px-3 rounded text-xs flex items-center gap-2 ${
      isHealthy ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    }`}>
      <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-yellow-600' : 'bg-red-600'}`} />
      {isHealthy ? (
        <span>{errorCount} error(s). Validation engine degraded.</span>
      ) : (
        <span>Validation engine experiencing issues.</span>
      )}
    </div>
  );
}
