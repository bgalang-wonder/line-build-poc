'use client';

import React, { useState } from 'react';
import { LineBuild, WorkUnit } from '@/lib/model/types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StepListProps {
  build: LineBuild | null;
  isLoading?: boolean;
  selectedStepId?: string;
  onStepSelect?: (stepId: string) => void;
}

interface ExpandedState {
  [stepId: string]: boolean;
}

/**
 * StepList Component
 *
 * Displays all WorkUnits (steps) from a loaded line build in a vertical list.
 * Each step shows:
 * - ID + action type
 * - Target item name / BOM name
 * - Dependencies badge (if any)
 * - Collapsible details showing all WorkUnit tags
 *
 * Acceptance Criteria:
 * ✓ Display all steps in vertical list with ID, action, target item
 * ✓ Show dependencies badge (e.g., "→ step-2, step-5")
 * ✓ Collapsible/expandable to show WorkUnit tag details
 * ✓ Click step to select for editing in step editor (parent handles selection)
 * ✓ Show empty state when no line build loaded
 * ✓ Show loading state while fetching
 * ✓ Auto-scroll capable (overflow-y: auto)
 * ✓ Highlight selected step visually
 */
export default function StepList({
  build,
  isLoading = false,
  selectedStepId,
  onStepSelect,
}: StepListProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const toggleExpanded = (stepId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading line build...</p>
        </div>
      </div>
    );
  }

  // Empty state - no build loaded
  if (!build) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-500">No line build loaded</p>
          <p className="text-xs text-gray-400 mt-1">Select or create a line build to get started</p>
        </div>
      </div>
    );
  }

  // Empty steps - build has no steps yet
  if (build.workUnits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-500">No steps yet</p>
          <p className="text-xs text-gray-400 mt-1">Add the first step using the form or chat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-sm">{build.menuItemName}</h2>
        <p className="text-xs text-gray-500 mt-1">{build.workUnits.length} steps</p>
      </div>

      {/* Steps list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-200">
          {build.workUnits.map((step) => (
            <StepListItem
              key={step.id}
              step={step}
              isSelected={selectedStepId === step.id}
              isExpanded={expanded[step.id] || false}
              onSelect={() => onStepSelect?.(step.id)}
              onToggleExpand={() => toggleExpanded(step.id)}
              allSteps={build.workUnits}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * StepListItem - Individual step in the list
 */
interface StepListItemProps {
  step: WorkUnit;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  allSteps: WorkUnit[];
}

function StepListItem({
  step,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  allSteps,
}: StepListItemProps) {
  // Find steps that depend on this one
  const dependentsIds = allSteps
    .filter((s) => s.dependsOn.includes(step.id))
    .map((s) => s.id);

  const hasDependencies = step.dependsOn.length > 0 || dependentsIds.length > 0;

  return (
    <li
      className={`transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-50 border-l-4 border-l-blue-500'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* Main step header - clickable */}
      <div
        className="px-4 py-3 flex items-start justify-between gap-2"
        onClick={onSelect}
      >
        <div className="flex-1 min-w-0">
          {/* Step ID and action */}
          <div className="flex items-center gap-2 mb-1">
            <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
              {step.id}
            </code>
            <span className="text-sm font-medium text-gray-900">
              {step.tags.action}
            </span>
          </div>

          {/* Target item name / BOM name */}
          <p className="text-sm text-gray-700 truncate">
            {step.tags.target.name}
            {step.tags.target.bomId && (
              <span className="text-xs text-gray-500 ml-1">
                ({step.tags.target.bomId})
              </span>
            )}
          </p>

          {/* Dependencies badge */}
          {hasDependencies && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {step.dependsOn.length > 0 && (
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-200">
                  depends on {step.dependsOn.length}
                </span>
              )}
              {dependentsIds.length > 0 && (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200">
                  blocks {dependentsIds.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Expanded details - WorkUnit tags */}
      {isExpanded && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <div className="space-y-2 text-sm">
            {/* Equipment */}
            {step.tags.equipment && (
              <div>
                <span className="text-gray-600 font-medium">Equipment:</span>
                <span className="text-gray-700 ml-2">{step.tags.equipment}</span>
              </div>
            )}

            {/* Time */}
            {step.tags.time && (
              <div>
                <span className="text-gray-600 font-medium">Time:</span>
                <span className="text-gray-700 ml-2">
                  {step.tags.time.value} {step.tags.time.unit} (
                  {step.tags.time.type})
                </span>
              </div>
            )}

            {/* Phase */}
            {step.tags.phase && (
              <div>
                <span className="text-gray-600 font-medium">Phase:</span>
                <span className="text-gray-700 ml-2">{step.tags.phase}</span>
              </div>
            )}

            {/* Station */}
            {step.tags.station && (
              <div>
                <span className="text-gray-600 font-medium">Station:</span>
                <span className="text-gray-700 ml-2">{step.tags.station}</span>
              </div>
            )}

            {/* Timing Mode */}
            {step.tags.timingMode && (
              <div>
                <span className="text-gray-600 font-medium">Timing:</span>
                <span className="text-gray-700 ml-2">{step.tags.timingMode}</span>
              </div>
            )}

            {/* Prep Type */}
            {step.tags.prepType && (
              <div>
                <span className="text-gray-600 font-medium">Prep:</span>
                <span className="text-gray-700 ml-2">{step.tags.prepType}</span>
              </div>
            )}

            {/* Storage Location */}
            {step.tags.storageLocation && (
              <div>
                <span className="text-gray-600 font-medium">Storage:</span>
                <span className="text-gray-700 ml-2">{step.tags.storageLocation}</span>
              </div>
            )}

            {/* Boolean flags */}
            <div className="flex gap-2 flex-wrap">
              {step.tags.requiresOrder && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Requires Order
                </span>
              )}
              {step.tags.bulkPrep && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  Bulk Prep
                </span>
              )}
            </div>

            {/* Dependencies list when expanded */}
            {step.dependsOn.length > 0 && (
              <div>
                <span className="text-gray-600 font-medium">Depends on:</span>
                <div className="text-gray-700 ml-2 mt-1 space-y-1">
                  {step.dependsOn.map((depId) => (
                    <div key={depId} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                      {depId}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blocking steps when expanded */}
            {dependentsIds.length > 0 && (
              <div>
                <span className="text-gray-600 font-medium">Blocks:</span>
                <div className="text-gray-700 ml-2 mt-1 space-y-1">
                  {dependentsIds.map((depId) => (
                    <div key={depId} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                      {depId}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
