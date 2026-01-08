'use client';

/**
 * Validation Checklist Panel (benchtop-x0c.6.1)
 *
 * Displays validation results as a read-only checklist.
 * Shows overall build validation status and per-rule results.
 * Supports both structured and semantic validation results.
 */

import React from 'react';
import { BuildValidationStatus, ValidationResult } from '@/lib/model/types';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ValidationChecklistPanelProps {
  validationStatus?: BuildValidationStatus;
  isLoading?: boolean;
  onRunValidation?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a timestamp to readable time format
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  } catch {
    return 'Unknown time';
  }
}

/**
 * Get color/styling for a validation result
 */
function getResultStyling(result: ValidationResult): {
  bgColor: string;
  borderColor: string;
  icon: React.ReactElement;
  label: string;
} {
  if (result.pass) {
    return {
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      label: 'Pass',
    };
  }

  return {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: <AlertCircle className="w-5 h-5 text-red-600" />,
    label: 'Fail',
  };
}

/**
 * Group validation results by WorkUnit ID
 */
function groupResultsByWorkUnit(
  results: ValidationResult[]
): Record<string, ValidationResult[]> {
  const grouped: Record<string, ValidationResult[]> = {};

  for (const result of results) {
    if (!grouped[result.workUnitId]) {
      grouped[result.workUnitId] = [];
    }
    grouped[result.workUnitId].push(result);
  }

  return grouped;
}

/**
 * Determine overall status badge color
 */
function getStatusBadgeColor(status: BuildValidationStatus): string {
  if (status.hasStructuredFailures || status.hasSemanticFailures) {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
}

/**
 * Get status badge text
 */
function getStatusBadgeText(status: BuildValidationStatus): string {
  if (status.hasStructuredFailures || status.hasSemanticFailures) {
    return `${status.failureCount} Issue${status.failureCount !== 1 ? 's' : ''}`;
  }
  return 'All Clear';
}

// ============================================================================
// Result Item Component
// ============================================================================

interface ValidationResultItemProps {
  result: ValidationResult;
  expanded: boolean;
  onToggle: () => void;
}

function ValidationResultItem({
  result,
  expanded,
  onToggle,
}: ValidationResultItemProps) {
  const { bgColor, borderColor, icon, label } = getResultStyling(result);

  return (
    <div className={`border rounded-lg p-3 ${bgColor} ${borderColor}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex-shrink-0 mt-0.5">{icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{result.ruleName}</span>
            <span
              className={`text-xs px-2 py-1 rounded ${
                result.pass
                  ? 'bg-emerald-200 text-emerald-800'
                  : 'bg-red-200 text-red-800'
              }`}
            >
              {label}
            </span>
            {result.ruleType === 'semantic' && (
              <span className="text-xs px-2 py-1 rounded bg-blue-200 text-blue-800">
                AI
              </span>
            )}
          </div>

          {/* Failures - shown even when collapsed if there are any */}
          {!result.pass && result.failures.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.failures.map((failure, idx) => (
                <div key={idx} className="text-xs text-gray-700">
                  • {failure}
                </div>
              ))}
            </div>
          )}
        </div>

        {(result.reasoning || result.failures.length > 1) && (
          <div className="flex-shrink-0">
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (result.reasoning || result.failures.length > 1) && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          {result.reasoning && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">
                Reasoning:
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">
                {result.reasoning}
              </p>
            </div>
          )}

          {result.failures.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">
                Issues:
              </p>
              <ul className="text-xs text-gray-700 space-y-1">
                {result.failures.map((failure, idx) => (
                  <li key={idx}>• {failure}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        {formatTimestamp(result.timestamp)}
      </div>
    </div>
  );
}

// ============================================================================
// Validation Checklist Panel
// ============================================================================

export function ValidationChecklistPanel({
  validationStatus,
  isLoading = false,
  onRunValidation,
}: ValidationChecklistPanelProps) {
  const [expandedResults, setExpandedResults] = React.useState<
    Record<string, boolean>
  >({});

  const toggleExpanded = (resultId: string) => {
    setExpandedResults((prev) => ({
      ...prev,
      [resultId]: !prev[resultId],
    }));
  };

  // Empty state: no validation results
  if (!validationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="mb-4 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-sm text-gray-600 mb-4">
          No validation results yet. Run validation to check your build.
        </p>
        {onRunValidation && (
          <button
            onClick={onRunValidation}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Running...' : 'Run Validation'}
          </button>
        )}
      </div>
    );
  }

  // Empty WorkUnits: no steps to validate
  if (!validationStatus.results || validationStatus.results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="mb-4 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-sm text-gray-600 mb-4">
          No work units to validate. Add steps to your line build first.
        </p>
      </div>
    );
  }

  const groupedResults = groupResultsByWorkUnit(validationStatus.results);
  const statusColor = getStatusBadgeColor(validationStatus);
  const statusText = getStatusBadgeText(validationStatus);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header with overall status */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">Validation</h2>
          {onRunValidation && (
            <button
              onClick={onRunValidation}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Running...' : 'Re-run'}
            </button>
          )}
        </div>

        {/* Status badge */}
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${statusColor}`}>
          {statusText}
        </div>

        {/* Last checked time */}
        {validationStatus.lastChecked && (
          <p className="mt-2 text-xs text-gray-500">
            Last checked: {formatTimestamp(validationStatus.lastChecked)}
          </p>
        )}

        {/* Draft/Active status */}
        <p className="mt-2 text-xs text-gray-600">
          Status: {validationStatus.isDraft ? 'Draft' : 'Active'}
          {!validationStatus.isDraft &&
            !validationStatus.hasStructuredFailures &&
            !validationStatus.hasSemanticFailures && (
              <span className="ml-2 text-emerald-600">✓ Ready to publish</span>
            )}
          {!validationStatus.isDraft &&
            (validationStatus.hasStructuredFailures ||
              validationStatus.hasSemanticFailures) && (
              <span className="ml-2 text-red-600">
                Demote to draft to make changes
              </span>
            )}
        </p>
      </div>

      {/* Results list - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Object.entries(groupedResults).map(([workUnitId, results]) => (
          <div key={workUnitId}>
            {/* WorkUnit header */}
            <div className="text-xs font-semibold text-gray-700 mb-2 px-1">
              Step {workUnitId.slice(0, 8)}
            </div>

            {/* Results for this WorkUnit */}
            <div className="space-y-2">
              {results.map((result) => (
                <ValidationResultItem
                  key={`${result.ruleId}-${result.workUnitId}`}
                  result={result}
                  expanded={
                    expandedResults[`${result.ruleId}-${result.workUnitId}`] ||
                    false
                  }
                  onToggle={() =>
                    toggleExpanded(`${result.ruleId}-${result.workUnitId}`)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <p className="text-xs text-gray-600">Running validation...</p>
          </div>
        </div>
      )}
    </div>
  );
}
