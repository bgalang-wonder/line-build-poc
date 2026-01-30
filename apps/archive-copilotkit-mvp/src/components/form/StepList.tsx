'use client';

import React, { useState } from 'react';
import { LineBuild, WorkUnit } from '@/lib/model/types';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface StepListProps {
  build: LineBuild | null;
  isLoading?: boolean;
  selectedStepId?: string;
  onStepSelect?: (stepId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

interface ExpandedState {
  [stepId: string]: boolean;
}

/**
 * StepList Component
 *
 * Displays all WorkUnits (steps) from a loaded line build in a vertical list.
 * Each step shows:
 * - Drag handle for reordering
 * - ID + action type
 * - Target item name / BOM name
 * - Dependencies badge (if any)
 * - Collapsible details showing all WorkUnit tags
 *
 * Acceptance Criteria:
 * - Display all steps in vertical list with ID, action, target item
 * - Show dependencies badge (e.g., "depends on 2", "blocks 1")
 * - Collapsible/expandable to show WorkUnit tag details
 * - Click step to select for editing in step editor (parent handles selection)
 * - Show empty state when no line build loaded
 * - Show loading state while fetching
 * - Auto-scroll capable (overflow-y: auto)
 * - Highlight selected step visually
 * - Drag-and-drop reordering via drag handle
 */
export default function StepList({
  build,
  isLoading = false,
  selectedStepId,
  onStepSelect,
  onReorder,
}: StepListProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Configure sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleExpanded = (stepId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && build) {
      const oldIndex = build.workUnits.findIndex((wu) => wu.id === active.id);
      const newIndex = build.workUnits.findIndex((wu) => wu.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder?.(oldIndex, newIndex);
      }
    }
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

  const stepIds = build.workUnits.map((wu) => wu.id);

  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-sm">{build.menuItemName}</h2>
        <p className="text-xs text-gray-500 mt-1">{build.workUnits.length} steps</p>
      </div>

      {/* Steps list - scrollable with drag-and-drop */}
      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-gray-200">
              {build.workUnits.map((step) => (
                <SortableStepListItem
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
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

/**
 * SortableStepListItem - Individual sortable step in the list
 */
interface SortableStepListItemProps {
  step: WorkUnit;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  allSteps: WorkUnit[];
}

function SortableStepListItem({
  step,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  allSteps,
}: SortableStepListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // Find steps that depend on this one
  const dependentsIds = allSteps
    .filter((s) => s.dependsOn.includes(step.id))
    .map((s) => s.id);

  const hasDependencies = step.dependsOn.length > 0 || dependentsIds.length > 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`transition-colors ${
        isDragging ? 'shadow-lg bg-white' : ''
      } ${
        isSelected
          ? 'bg-blue-50 border-l-4 border-l-blue-500'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* Main step header */}
      <div className="flex items-start">
        {/* Drag handle */}
        <button
          className="px-2 py-4 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors touch-none"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>

        {/* Clickable content area */}
        <div
          className="flex-1 px-2 py-3 cursor-pointer flex items-start justify-between gap-2"
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
      </div>

      {/* Expanded details - WorkUnit tags */}
      {isExpanded && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 ml-8">
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

// Export the original StepListItem for backwards compatibility with tests
// that might be testing the non-sortable version
export { SortableStepListItem as StepListItem };
