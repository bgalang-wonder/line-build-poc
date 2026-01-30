import React from "react";
import { CheckIcon } from "@heroicons/react/20/solid";

import { Button } from "@/components/ui/Button";

export type VisualizationMode = 'work_order' | 'material_flow' | 'station_handoffs';
export type ViewMode = 'compact' | 'expanded';

export type ModeSelectorProps = {
  mode: VisualizationMode;
  onSetMode: (mode: VisualizationMode) => void;
};

export type ModeOptionsProps = {
  mode: VisualizationMode;

  // View mode (all modes)
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;

  // Work Order mode options
  showCriticalPath: boolean;
  onToggleCriticalPath: () => void;
  showSwimlanes: boolean;
  onToggleSwimlanes: () => void;
  showTransfers?: boolean;
  onToggleTransfers?: () => void;
  transferCount?: number;

  // Material Flow specific
  selectedGroupIds?: string[];
  availableGroupIds?: string[];
  groupColorMap?: Map<string, string>;
  groupNodeCounts?: Map<string, number>;
  onToggleGroupId?: (groupId: string) => void;
  onSelectAllGroups?: () => void;
  onSelectNoGroups?: () => void;
  showAssemblyPoints?: boolean;
  onToggleAssemblyPoints?: () => void;
  highlightMergesOnly?: boolean;
  onToggleHighlightMergesOnly?: () => void;
  mergeCount?: number;
  showKitchenLayout?: boolean;
  onToggleKitchenLayout?: () => void;
};

// Keep the old combined props for backward compatibility during transition
export type GraphLayerTogglesProps = ModeSelectorProps & ModeOptionsProps;

const MODE_LABELS: Record<VisualizationMode, { label: string; description: string }> = {
  work_order: {
    label: 'Work Order',
    description: 'Task sequence & dependencies',
  },
  material_flow: {
    label: 'Material Flow',
    description: 'How components combine into sub-assemblies',
  },
  station_handoffs: {
    label: 'Station Timeline',
    description: 'Physical movement through stations',
  },
};

/**
 * Mode selector tabs - sits at the top of the visualization
 */
export function ModeSelector({ mode, onSetMode }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
      {(Object.keys(MODE_LABELS) as VisualizationMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onSetMode(m)}
          title={MODE_LABELS[m].description}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            mode === m
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
          }`}
        >
          {MODE_LABELS[m].label}
        </button>
      ))}
    </div>
  );
}

/**
 * Mode-specific options bar - sits below the graph
 */
export function ModeOptions({
  mode,
  viewMode,
  onSetViewMode,
  showCriticalPath,
  onToggleCriticalPath,
  showSwimlanes,
  onToggleSwimlanes,
  showTransfers = false,
  onToggleTransfers,
  transferCount = 0,
  selectedGroupIds = [],
  availableGroupIds = [],
  groupColorMap,
  groupNodeCounts,
  onToggleGroupId,
  onSelectAllGroups,
  onSelectNoGroups,
  showAssemblyPoints = true,
  onToggleAssemblyPoints,
  highlightMergesOnly = false,
  onToggleHighlightMergesOnly,
  mergeCount = 0,
  showKitchenLayout = false,
  onToggleKitchenLayout,
}: ModeOptionsProps) {
  const allSelected = selectedGroupIds.length === availableGroupIds.length && availableGroupIds.length > 0;
  const noneSelected = selectedGroupIds.length === 0;
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-neutral-50 border-t border-neutral-200">
      {/* View Mode Toggle - all modes */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Detail:</span>
        <div className="inline-flex rounded-md overflow-hidden border border-neutral-300">
          <button
            type="button"
            onClick={() => onSetViewMode('compact')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'compact'
                ? 'bg-neutral-800 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('expanded')}
            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-neutral-300 ${
              viewMode === 'expanded'
                ? 'bg-neutral-800 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Expanded
          </button>
        </div>
      </div>

      {/* Work Order Options */}
      {mode === 'work_order' && (
        <>
          <div className="w-px h-5 bg-neutral-300" />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={showCriticalPath ? "primary" : "secondary"}
              onClick={onToggleCriticalPath}
              aria-pressed={showCriticalPath}
            >
              {showCriticalPath ? "✓ " : ""}Critical Path
            </Button>
            {onToggleTransfers && (
              <Button
                type="button"
                size="sm"
                variant={showTransfers ? "primary" : "secondary"}
                onClick={onToggleTransfers}
                aria-pressed={showTransfers}
                aria-label={showTransfers ? "Hide transfers" : "Show transfers"}
                disabled={transferCount === 0}
                title={transferCount === 0 ? "No transfers in this build" : `Show ${transferCount} derived transfers`}
              >
                {showTransfers ? "✓ " : ""}Transfers{transferCount > 0 ? ` (${transferCount})` : ""}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Material Flow Options */}
      {mode === 'material_flow' && (
        <>
          <div className="w-px h-5 bg-neutral-300" />
          <div className="flex items-center gap-2">
            {onToggleAssemblyPoints && (
              <Button
                type="button"
                size="sm"
                variant={showAssemblyPoints ? "primary" : "secondary"}
                onClick={onToggleAssemblyPoints}
                aria-pressed={showAssemblyPoints}
              >
                {showAssemblyPoints ? "✓ " : ""}Merge Points
              </Button>
            )}
            {onToggleHighlightMergesOnly && mergeCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant={highlightMergesOnly ? "primary" : "secondary"}
                onClick={onToggleHighlightMergesOnly}
                aria-pressed={highlightMergesOnly}
                title="Dim non-merge nodes to focus on convergence points"
              >
                {highlightMergesOnly ? "✓ " : ""}Focus Merges ({mergeCount})
              </Button>
            )}
            {onToggleKitchenLayout && (
              <Button
                type="button"
                size="sm"
                variant={showKitchenLayout ? "primary" : "secondary"}
                onClick={onToggleKitchenLayout}
                aria-pressed={showKitchenLayout}
                title="Align artifacts by equipment lanes"
              >
                {showKitchenLayout ? "✓ " : ""}Kitchen Layout
              </Button>
            )}
          </div>

          {/* Group Filter */}
          {availableGroupIds.length > 0 && onToggleGroupId && (
            <>
              <div className="w-px h-5 bg-neutral-300" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">Groups:</span>

                {/* Preset buttons */}
                {onSelectAllGroups && onSelectNoGroups && (
                  <>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={allSelected ? "primary" : "secondary"}
                        onClick={onSelectAllGroups}
                        aria-label={`Select all ${availableGroupIds.length} groups`}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={noneSelected ? "primary" : "secondary"}
                        onClick={onSelectNoGroups}
                        aria-label="Deselect all groups"
                      >
                        None
                      </Button>
                    </div>
                    <div className="w-px h-4 bg-neutral-300" />
                  </>
                )}

                {/* Group pills with checkmarks and counts */}
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {availableGroupIds.map((groupId) => {
                    const isSelected = selectedGroupIds.includes(groupId);
                    const color = groupColorMap?.get(groupId) || '#6B7280';
                    const nodeCount = groupNodeCounts?.get(groupId) || 0;

                    return (
                      <button
                        key={groupId}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`${groupId} group${nodeCount > 0 ? `, ${nodeCount} nodes` : ''}`}
                        onClick={() => onToggleGroupId(groupId)}
                        className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-all ${
                          isSelected
                            ? 'border-transparent text-white'
                            : 'border-neutral-300 text-neutral-500 bg-white hover:bg-neutral-50 opacity-50'
                        }`}
                        style={isSelected ? { backgroundColor: color } : {}}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3" aria-hidden="true" />}
                        <span>{groupId}</span>
                        {nodeCount > 0 && (
                          <span className="opacity-75">({nodeCount})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Station Timeline Options */}
      {mode === 'station_handoffs' && (
        <>
          <div className="w-px h-5 bg-neutral-300" />
          <span className="text-xs text-neutral-500">
            Shows station visits as nodes, with track lanes for parallel work
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Combined component for backward compatibility
 * @deprecated Use ModeSelector and ModeOptions separately
 */
export function GraphLayerToggles(props: GraphLayerTogglesProps) {
  return (
    <div className="flex flex-col gap-2">
      <ModeSelector mode={props.mode} onSetMode={props.onSetMode} />
      <ModeOptions {...props} />
    </div>
  );
}
