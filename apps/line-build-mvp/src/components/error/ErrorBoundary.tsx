'use client';

/**
 * Error Boundary Component (benchtop-oqi)
 *
 * React Error Boundary that catches rendering errors and provides recovery UI
 */

import React, { ReactNode } from 'react';
import { errorLogger, errorRecoveryManager, stateSnapshotManager } from '@/lib/error/errorRecovery';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onRecover?: () => void;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showRecoveryUI: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showRecoveryUI: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    errorLogger.log({
      timestamp: new Date().toISOString(),
      severity: 'error',
      component: 'ErrorBoundary',
      message: `React error: ${error.message}`,
      stack: error.stack,
      context: { errorInfo },
    });

    this.setState({ errorInfo, showRecoveryUI: !!stateSnapshotManager.getSnapshot() });
  }

  handleRecover = async () => {
    const recovered = await errorRecoveryManager.recoverFromStateCorruption((build) => {
      // Reset the error boundary
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showRecoveryUI: false,
      });

      // Call parent's recovery handler if provided
      this.props.onRecover?.();
    });

    if (!recovered) {
      // No snapshot to recover, just clear the error
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showRecoveryUI: false,
      });
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h1 className="text-xl font-semibold text-red-900">Application Error</h1>
            </div>

            <p className="text-gray-700 mb-4">
              Something went wrong. We've logged the error and will work to fix it.
            </p>

            {this.state.error && (
              <details className="mb-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
                <summary className="font-semibold cursor-pointer mb-2">Error Details</summary>
                <pre className="whitespace-pre-wrap break-words overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:\n'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              {this.state.showRecoveryUI && (
                <button
                  onClick={this.handleRecover}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Recover from Backup
                </button>
              )}

              <button
                onClick={this.handleRefresh}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 transition-colors"
              >
                Refresh Page
              </button>
            </div>

            {this.props.fallback}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
