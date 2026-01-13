import React from "react";

import { Button } from "@/components/ui/Button";

type ViewMode = 'compact' | 'expanded';

export type GraphLayerTogglesProps = {
  showWorkEdges: boolean;
  showFlowEdges: boolean;
  onToggleWorkEdges: () => void;
  onToggleFlowEdges: () => void;
  viewMode?: ViewMode;
  onSetViewMode?: (mode: ViewMode) => void;
};

export function GraphLayerToggles({
  showWorkEdges,
  showFlowEdges,
  onToggleWorkEdges,
  onToggleFlowEdges,
  viewMode = 'compact',
  onSetViewMode,
}: GraphLayerTogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSetViewMode ? (
        <div className="inline-flex rounded-md overflow-hidden border border-neutral-300">
          <button
            type="button"
            onClick={() => onSetViewMode('compact')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'compact'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => onSetViewMode('expanded')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-neutral-300 ${
              viewMode === 'expanded'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Expanded
          </button>
        </div>
      ) : null}
      <div className="w-px h-5 bg-neutral-200" />
      <Button
        type="button"
        size="sm"
        variant={showWorkEdges ? "primary" : "secondary"}
        onClick={onToggleWorkEdges}
        aria-pressed={showWorkEdges}
      >
        {showWorkEdges ? "✓ " : ""}Work Edges
      </Button>
      <Button
        type="button"
        size="sm"
        variant={showFlowEdges ? "primary" : "secondary"}
        onClick={onToggleFlowEdges}
        aria-pressed={showFlowEdges}
      >
        {showFlowEdges ? "✓ " : ""}Flow Edges
      </Button>
    </div>
  );
}
