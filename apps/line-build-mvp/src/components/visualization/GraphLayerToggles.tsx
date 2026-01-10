import React from "react";

import { Button } from "@/components/ui/Button";

export type GraphLayerTogglesProps = {
  showWorkEdges: boolean;
  showFlowEdges: boolean;
  onToggleWorkEdges: () => void;
  onToggleFlowEdges: () => void;
};

export function GraphLayerToggles({
  showWorkEdges,
  showFlowEdges,
  onToggleWorkEdges,
  onToggleFlowEdges,
}: GraphLayerTogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={showWorkEdges ? "primary" : "secondary"}
        onClick={onToggleWorkEdges}
        aria-pressed={showWorkEdges}
      >
        {showWorkEdges ? "✓ " : ""}Show Work Edges
      </Button>
      <Button
        type="button"
        size="sm"
        variant={showFlowEdges ? "primary" : "secondary"}
        onClick={onToggleFlowEdges}
        aria-pressed={showFlowEdges}
      >
        {showFlowEdges ? "✓ " : ""}Show Flow Edges
      </Button>
    </div>
  );
}

