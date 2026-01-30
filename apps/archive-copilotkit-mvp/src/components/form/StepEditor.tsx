'use client';

import React, { useState } from 'react';
import { WorkUnit, ActionType, Phase, TimingMode, PrepType } from '@/lib/model/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import BOMAutocomplete from './BOMAutocomplete';
import DependenciesMultiSelect from './DependenciesMultiSelect';

interface StepEditorProps {
  step: WorkUnit | null;
  isLoading?: boolean;
  onChange?: (updatedStep: Partial<WorkUnit>) => void;
  allSteps?: WorkUnit[]; // For dependencies multi-select
  onSetDependencies?: (stepId: string, deps: string[]) => void; // For dependencies updates
}

interface ExpandedSections {
  [key: string]: boolean;
}

const ACTION_TYPES: ActionType[] = [
  'PREP',
  'HEAT',
  'TRANSFER',
  'ASSEMBLE',
  'PORTION',
  'PLATE',
  'FINISH',
  'QUALITY_CHECK',
];

const PHASES: Phase[] = ['PRE_COOK', 'COOK', 'POST_COOK', 'ASSEMBLY', 'PASS'];

const TIMING_MODES: TimingMode[] = ['a_la_minute', 'sandbag', 'hot_hold'];

const PREP_TYPES: PrepType[] = ['pre_service', 'order_execution'];

const TIME_UNITS = ['sec', 'min'] as const;

/**
 * StepEditor Component
 *
 * Edit form for WorkUnit properties. Displays:
 * - Core fields: action type, target item, equipment
 * - Time section: value, unit (sec/min), active/passive type
 * - Phase and timing section: phase, timing mode, prep type
 * - Station and storage section: station, storage location
 * - Boolean flags: requiresOrder, bulkPrep
 * - Collapsible advanced sections
 *
 * Acceptance Criteria:
 * ✓ Display form fields for all WorkUnit properties
 * ✓ Edit-in-place for string/number fields
 * ✓ Dropdowns for enum fields (action, phase, timing mode)
 * ✓ Toggle buttons for boolean fields
 * ✓ Field validation (required action, positive numbers)
 * ✓ Real-time state updates on field change
 * ✓ Collapsible sections for advanced fields
 * ✓ Show empty state when no step selected
 * ✓ Loading state
 */
export default function StepEditor({ step, isLoading = false, onChange, allSteps = [], onSetDependencies }: StepEditorProps) {
  const [expanded, setExpanded] = useState<ExpandedSections>({
    timing: true,
    phase: false,
    station: false,
    flags: false,
  });

  const toggleExpanded = (section: string) => {
    setExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleChange = (updates: Partial<WorkUnit>) => {
    onChange?.(updates);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading step...</p>
        </div>
      </div>
    );
  }

  // Empty state - no step selected
  if (!step) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-500">No step selected</p>
          <p className="text-xs text-gray-400 mt-1">Select a step from the list to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-sm">{step.id}</h2>
        <p className="text-xs text-gray-500 mt-1">{step.tags.action}</p>
      </div>

      {/* Form - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-6">
          {/* Core Section */}
          <section>
            <h3 className="font-semibold text-sm mb-3 text-gray-900">Core</h3>
            <div className="space-y-4">
              {/* Action Type - Required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={step.tags.action}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: { ...step.tags, action: e.target.value as ActionType },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {ACTION_TYPES.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Item - BOMAutocomplete */}
              <div>
                <BOMAutocomplete
                  selectedBomId={step.tags.target.bomId}
                  onChange={(bomId, bomName) => {
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        target: { ...step.tags.target, bomId, name: bomName },
                      },
                    });
                  }}
                  filterByType={['40']} // Show consumables only
                />
              </div>

              {/* Manual Item Name - For custom items without BOM */}
              {!step.tags.target.bomId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Item Name <span className="text-gray-500 text-xs">(if no BOM match)</span>
                  </label>
                  <input
                    type="text"
                    value={step.tags.target.name}
                    onChange={(e) =>
                      handleChange({
                        ...step,
                        tags: {
                          ...step.tags,
                          target: { ...step.tags.target, name: e.target.value },
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="e.g., Grilled Chicken"
                  />
                </div>
              )}

              {/* Equipment - Optional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment
                </label>
                <input
                  type="text"
                  value={step.tags.equipment || ''}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: { ...step.tags, equipment: e.target.value || undefined },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Grill, Oven"
                />
              </div>
            </div>
          </section>

          {/* Timing Section - Collapsible */}
          <CollapsibleSection
            title="Timing"
            isExpanded={expanded.timing || false}
            onToggle={() => toggleExpanded('timing')}
          >
            <div className="space-y-4">
              {step.tags.time ? (
                <>
                  {/* Duration Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={step.tags.time.value}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val >= 0) {
                            handleChange({
                              ...step,
                              tags: {
                                ...step.tags,
                                time: { ...step.tags.time!, value: val },
                              },
                            });
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="0"
                        min="0"
                      />
                      <select
                        value={step.tags.time.unit}
                        onChange={(e) =>
                          handleChange({
                            ...step,
                            tags: {
                              ...step.tags,
                              time: {
                                ...step.tags.time!,
                                unit: e.target.value as 'sec' | 'min',
                              },
                            },
                          })
                        }
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {TIME_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Time Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleChange({
                            ...step,
                            tags: {
                              ...step.tags,
                              time: { ...step.tags.time!, type: 'active' },
                            },
                          })
                        }
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          step.tags.time.type === 'active'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() =>
                          handleChange({
                            ...step,
                            tags: {
                              ...step.tags,
                              time: { ...step.tags.time!, type: 'passive' },
                            },
                          })
                        }
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          step.tags.time.type === 'passive'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Passive
                      </button>
                    </div>
                  </div>

                  {/* Remove time button */}
                  <button
                    onClick={() =>
                      handleChange({
                        ...step,
                        tags: { ...step.tags, time: undefined },
                      })
                    }
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove Time
                  </button>
                </>
              ) : (
                <button
                  onClick={() =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        time: { value: 0, unit: 'min', type: 'active' },
                      },
                    })
                  }
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Time
                </button>
              )}
            </div>
          </CollapsibleSection>

          {/* Phase & Timing Mode Section - Collapsible */}
          <CollapsibleSection
            title="Phase & Timing"
            isExpanded={expanded.phase || false}
            onToggle={() => toggleExpanded('phase')}
          >
            <div className="space-y-4">
              {/* Phase */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phase
                </label>
                <select
                  value={step.tags.phase || ''}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        phase: (e.target.value as Phase) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">No Phase</option>
                  {PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timing Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timing Mode
                </label>
                <select
                  value={step.tags.timingMode || ''}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        timingMode: (e.target.value as TimingMode) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">No Timing Mode</option>
                  {TIMING_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prep Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prep Type
                </label>
                <select
                  value={step.tags.prepType || ''}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        prepType: (e.target.value as PrepType) || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">No Prep Type</option>
                  {PREP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CollapsibleSection>

          {/* Station & Storage Section - Collapsible */}
          <CollapsibleSection
            title="Station & Storage"
            isExpanded={expanded.station || false}
            onToggle={() => toggleExpanded('station')}
          >
            <div className="space-y-4">
              {/* Station */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Station
                </label>
                <input
                  type="text"
                  value={step.tags.station || ''}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: { ...step.tags, station: e.target.value || undefined },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Line 1, Station A"
                />
              </div>

              {/* Storage Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={step.tags.storageLocation || ''}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        storageLocation: e.target.value || undefined,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="e.g., Cold Storage, Dry Goods"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Flags Section - Collapsible */}
          <CollapsibleSection
            title="Flags"
            isExpanded={expanded.flags || false}
            onToggle={() => toggleExpanded('flags')}
          >
            <div className="space-y-3">
              {/* Requires Order */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={step.tags.requiresOrder || false}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        requiresOrder: e.target.checked || undefined,
                      },
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Requires Order</span>
              </label>

              {/* Bulk Prep */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={step.tags.bulkPrep || false}
                  onChange={(e) =>
                    handleChange({
                      ...step,
                      tags: {
                        ...step.tags,
                        bulkPrep: e.target.checked || undefined,
                      },
                    })
                  }
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Bulk Prep</span>
              </label>
            </div>
          </CollapsibleSection>

          {/* Dependencies Section */}
          {allSteps.length > 1 && (
            <div>
              <DependenciesMultiSelect
                currentStepId={step.id}
                currentDependencies={step.dependsOn || []}
                allSteps={allSteps}
                onChange={(updatedDeps) => {
                  onSetDependencies?.(step.id, updatedDeps);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CollapsibleSection - Reusable collapsible section component
 */
interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full font-semibold text-sm text-gray-900 hover:text-gray-700 transition-colors"
      >
        {title}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>
      {isExpanded && <div className="mt-3">{children}</div>}
    </div>
  );
}
