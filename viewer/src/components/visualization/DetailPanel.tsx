import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatStepLabel } from "@/lib/stepLabel";
import { getGroupColor } from "@/lib/componentColors";
import type { Step, StationVisit, ValidationOutput, BenchTopLineBuild } from "@/types";

type VisualizationMode = "work_order" | "material_flow" | "station_handoffs";

type Artifact = {
  id: string;
  name?: string;
  groupId?: string;
  components?: string[];
};

type ArtifactSteps = {
  producedBy: Step[];
  consumedBy: Step[];
};

export type DetailPanelProps = {
  mode: VisualizationMode;
  // Work Order
  selectedStep?: Step | null;
  validation?: ValidationOutput | null;
  buildId?: string;
  // Material Flow
  selectedArtifact?: Artifact | null;
  artifactSteps?: ArtifactSteps | null;
  artifacts?: Artifact[];
  groupColorMap?: Map<string, string>;
  // Station Timeline
  selectedVisit?: StationVisit | null;
  // Common
  onClose: () => void;
  onSelectStep?: (stepId: string) => void;
};

type PanelState = "collapsed" | "summary" | "expanded";

const COLLAPSED_HEIGHT = 32;
const SUMMARY_HEIGHT = 180;
const MIN_EXPANDED_HEIGHT = 120;

function formatArtifactRef(
  ref: NonNullable<Step["input"]>[number],
  artifacts?: Artifact[]
): string {
  if (ref.source.type === "in_build") {
    const artifactId = ref.source.artifactId;
    const meta = artifacts?.find((a) => a.id === artifactId);
    const label = meta?.name || artifactId || "unknown";
    return label;
  }
  if (ref.source.type === "external_build") {
    const version = ref.source.version === undefined ? "" : `@${String(ref.source.version)}`;
    const artifact = ref.source.artifactId ? `:${ref.source.artifactId}` : ":primary";
    return `external:${ref.source.itemId}${version}${artifact}`;
  }
  return "unknown";
}

export function DetailPanel({
  mode,
  selectedStep,
  validation,
  buildId,
  selectedArtifact,
  artifactSteps,
  artifacts,
  groupColorMap,
  selectedVisit,
  onClose,
  onSelectStep,
}: DetailPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("summary");
  const [expandedHeight, setExpandedHeight] = useState(300);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Determine if we have anything to show
  const hasContent = selectedStep || selectedArtifact || selectedVisit;

  // Auto-expand when something is selected
  useEffect(() => {
    if (hasContent && panelState === "collapsed") {
      setPanelState("summary");
    }
  }, [hasContent, panelState]);

  // Reset to collapsed when nothing is selected
  useEffect(() => {
    if (!hasContent) {
      setPanelState("collapsed");
    }
  }, [hasContent]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = panelRef.current?.offsetHeight ?? SUMMARY_HEIGHT;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(
        MIN_EXPANDED_HEIGHT,
        Math.min(window.innerHeight * 0.5, startHeight.current + delta)
      );
      setExpandedHeight(newHeight);
      if (panelState !== "expanded") {
        setPanelState("expanded");
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelState]);

  // Compute height based on state
  const currentHeight = useMemo(() => {
    switch (panelState) {
      case "collapsed":
        return COLLAPSED_HEIGHT;
      case "summary":
        return SUMMARY_HEIGHT;
      case "expanded":
        return expandedHeight;
    }
  }, [panelState, expandedHeight]);

  // Validation messages for step
  const messages = useMemo(() => {
    if (!validation || !selectedStep) return { hard: [], warn: [] };
    const hard = (validation.hardErrors ?? []).filter((e) => e.stepId === selectedStep.id);
    const warn = (validation.warnings ?? []).filter((e) => e.stepId === selectedStep.id);
    return { hard, warn };
  }, [selectedStep, validation]);

  const copyReference = useCallback(() => {
    if (!selectedStep) return;
    const label = formatStepLabel(selectedStep.orderIndex);
    const text = `Build: ${buildId || "unknown"} | Step: ${label} | ID: ${selectedStep.id}`;
    navigator.clipboard.writeText(text);
  }, [selectedStep, buildId]);

  // Get summary text for collapsed state
  const getSummaryText = () => {
    if (selectedStep) {
      const label = formatStepLabel(selectedStep.orderIndex);
      return `${label} ${selectedStep.action.family} — ${selectedStep.target?.name || selectedStep.instruction?.slice(0, 30) || selectedStep.id}`;
    }
    if (selectedArtifact) {
      return `${selectedArtifact.name || selectedArtifact.id}${selectedArtifact.groupId ? ` (${selectedArtifact.groupId})` : ""}`;
    }
    if (selectedVisit) {
      return `${selectedVisit.stationId.replace("_", " ").toUpperCase()} ${selectedVisit.visitNumber} — ${selectedVisit.steps.length} steps`;
    }
    return "No selection";
  };

  // Render Work Order (Step) content
  const renderStepContent = () => {
    if (!selectedStep) return null;

    const targetLabel =
      selectedStep.target?.name ||
      selectedStep.target?.bomUsageId ||
      selectedStep.target?.bomComponentId ||
      "—";

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-neutral-700 mb-2">Structured</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Action</div>
              <div className="text-neutral-900 font-medium text-right">{selectedStep.action?.family}</div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Target</div>
              <div className="text-neutral-900 font-medium text-right">{targetLabel}</div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Equipment</div>
              <div className="text-neutral-900 font-medium text-right">
                {selectedStep.equipment?.applianceId || "—"}
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Time</div>
              <div className="text-neutral-900 font-medium text-right">
                {selectedStep.time
                  ? `${selectedStep.time.durationSeconds}s${selectedStep.time.isActive === false ? " (passive)" : ""}`
                  : "—"}
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Depends on</div>
              <div className="text-neutral-900 font-medium text-right">
                {(selectedStep.dependsOn ?? []).length > 0 ? (selectedStep.dependsOn ?? []).join(", ") : "—"}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-neutral-700 mb-2">Instruction / Notes</div>
          <div className="space-y-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-xs font-semibold text-neutral-700 mb-1">Instruction</div>
              <div className="text-sm text-neutral-800 whitespace-pre-wrap">
                {typeof selectedStep.instruction === "string" && selectedStep.instruction.trim().length > 0
                  ? selectedStep.instruction.trim()
                  : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="text-xs font-semibold text-neutral-700 mb-1">Notes</div>
              <div className="text-sm text-neutral-800 whitespace-pre-wrap">
                {typeof selectedStep.notes === "string" && selectedStep.notes.trim().length > 0
                  ? selectedStep.notes.trim()
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Validation messages */}
        {(messages.hard.length > 0 || messages.warn.length > 0) && (
          <div className="lg:col-span-2">
            <div className="text-xs font-semibold text-neutral-700 mb-2">Validation messages</div>
            <div className="space-y-2">
              {messages.hard.map((e, idx) => (
                <div key={`hard-${idx}-${e.ruleId}`} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-rose-800">{e.ruleId} (hard)</div>
                    {e.fieldPath ? <div className="text-xs text-rose-700">{e.fieldPath}</div> : null}
                  </div>
                  <div className="text-sm text-rose-800 mt-1">{e.message}</div>
                </div>
              ))}
              {messages.warn.map((e, idx) => (
                <div key={`warn-${idx}-${e.ruleId}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-amber-800">{e.ruleId} ({e.severity})</div>
                    {e.fieldPath ? <div className="text-xs text-amber-700">{e.fieldPath}</div> : null}
                  </div>
                  <div className="text-sm text-amber-800 mt-1">{e.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Material Flow (Artifact) content
  const renderArtifactContent = () => {
    if (!selectedArtifact) return null;

    const colorMap = groupColorMap ?? new Map<string, string>();
    const groupColor = getGroupColor(selectedArtifact.groupId, colorMap);

    // Get base components recursively
    const getBaseComponents = (
      artifactId: string,
      visited = new Set<string>()
    ): Array<{ id: string; name: string; color: string }> => {
      if (visited.has(artifactId)) return [];
      visited.add(artifactId);

      const art = artifacts?.find((a) => a.id === artifactId);
      if (!art) return [{ id: artifactId, name: artifactId, color: "#6B7280" }];

      if (!art.components || art.components.length === 0) {
        return [{ id: art.id, name: art.name || art.id, color: getGroupColor(art.groupId, colorMap) }];
      }

      const results: Array<{ id: string; name: string; color: string }> = [];
      for (const cid of art.components) {
        results.push(...getBaseComponents(cid, visited));
      }
      return results;
    };

    const baseComponents = selectedArtifact.components?.length
      ? Array.from(new Map(selectedArtifact.components.flatMap((cid) => getBaseComponents(cid)).map((c) => [c.id, c])).values())
      : [];

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: groupColor }}
          />
          <div>
            <div className="font-semibold text-neutral-900">{selectedArtifact.name || selectedArtifact.id}</div>
            <div className="text-xs text-neutral-500">Group: {selectedArtifact.groupId || "none"}</div>
          </div>
        </div>

        {/* Base Components */}
        {baseComponents.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">
              CONTAINS ({baseComponents.length} base ingredient{baseComponents.length !== 1 ? "s" : ""})
            </div>
            <div className="flex flex-wrap gap-2">
              {baseComponents.map((comp) => (
                <span
                  key={comp.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-50 border border-neutral-200 text-xs"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: comp.color }} />
                  {comp.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Produced By */}
        {artifactSteps?.producedBy && artifactSteps.producedBy.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">PRODUCED BY</div>
            <div className="space-y-1">
              {artifactSteps.producedBy.map((step) => (
                <button
                  key={step.id}
                  onClick={() => onSelectStep?.(step.id)}
                  className="w-full text-left p-2 rounded bg-green-50 border border-green-200 hover:bg-green-100 transition text-sm"
                >
                  <span className="font-mono text-green-700">{formatStepLabel(step.orderIndex)}</span>{" "}
                  <span className="text-neutral-600">({step.action.family})</span> —{" "}
                  <span className="text-neutral-800">{step.instruction?.slice(0, 50) || step.notes?.slice(0, 50) || step.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Consumed By */}
        {artifactSteps?.consumedBy && artifactSteps.consumedBy.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">CONSUMED BY</div>
            <div className="space-y-1">
              {artifactSteps.consumedBy.map((step) => (
                <button
                  key={step.id}
                  onClick={() => onSelectStep?.(step.id)}
                  className="w-full text-left p-2 rounded bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition text-sm"
                >
                  <span className="font-mono text-cyan-700">{formatStepLabel(step.orderIndex)}</span>{" "}
                  <span className="text-neutral-600">({step.action.family})</span> —{" "}
                  <span className="text-neutral-800">{step.instruction?.slice(0, 50) || step.notes?.slice(0, 50) || step.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Station Timeline (Visit) content
  const renderVisitContent = () => {
    if (!selectedVisit) return null;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-neutral-800 text-white text-sm font-bold px-2 py-0.5 rounded">
            {selectedVisit.stationId.replace("_", " ").toUpperCase()} {selectedVisit.visitNumber}
          </div>
          <div>
            <div className="text-sm text-neutral-500">
              {selectedVisit.trackId} • S{String(selectedVisit.stepRange[0] + 1).padStart(2, "0")}-S
              {String(selectedVisit.stepRange[1] + 1).padStart(2, "0")}
            </div>
          </div>
          <Badge variant="default">{selectedVisit.steps.length} steps</Badge>
        </div>

        {/* Steps in this visit */}
        <div>
          <div className="text-xs font-semibold text-neutral-700 mb-2">Steps in this visit</div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {selectedVisit.steps.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded bg-neutral-50 border border-neutral-200">
                <div className="text-sm text-neutral-700 truncate">
                  {formatStepLabel(s.orderIndex)} {s.action.family} — {s.instruction ?? s.notes ?? s.id}
                </div>
                <Button size="sm" variant="secondary" onClick={() => onSelectStep?.(s.id)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={panelRef}
      className="border-t border-neutral-200 bg-white flex flex-col transition-all duration-200"
      style={{ height: currentHeight, minHeight: COLLAPSED_HEIGHT }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-2 cursor-ns-resize flex items-center justify-center hover:bg-neutral-100 transition-colors group"
      >
        <div className="w-12 h-1 rounded-full bg-neutral-300 group-hover:bg-neutral-400 transition-colors" />
      </div>

      {/* Header Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-neutral-100 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Step badge for Work Order mode */}
          {mode === "work_order" && selectedStep && (
            <div className="bg-neutral-800 text-white text-xs font-bold px-2 py-0.5 rounded">
              {formatStepLabel(selectedStep.orderIndex)}
            </div>
          )}

          {/* Summary text */}
          <div className="text-sm font-medium text-neutral-800 truncate">{getSummaryText()}</div>

          {/* Validation badges for Work Order */}
          {mode === "work_order" && selectedStep && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {messages.hard.length > 0 ? (
                <Badge variant="danger">{messages.hard.length} error{messages.hard.length !== 1 ? "s" : ""}</Badge>
              ) : (
                <Badge variant="success">Valid</Badge>
              )}
              {messages.warn.length > 0 && <Badge variant="warning">{messages.warn.length} warn</Badge>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Copy Reference (Work Order only) */}
          {mode === "work_order" && selectedStep && (
            <Button size="sm" variant="secondary" onClick={copyReference} title="Copy reference for chat">
              Copy Ref
            </Button>
          )}

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setPanelState(panelState === "collapsed" ? "summary" : "collapsed")}
            className="p-1.5 hover:bg-neutral-100 rounded transition-colors text-neutral-500 hover:text-neutral-700"
            title={panelState === "collapsed" ? "Expand panel" : "Collapse panel"}
          >
            {panelState === "collapsed" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 rounded transition-colors text-neutral-500 hover:text-neutral-700"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content Area (hidden when collapsed) */}
      {panelState !== "collapsed" && (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {mode === "work_order" && renderStepContent()}
          {mode === "material_flow" && renderArtifactContent()}
          {mode === "station_handoffs" && renderVisitContent()}

          {/* Empty state */}
          {!hasContent && (
            <div className="h-full flex items-center justify-center text-neutral-400 text-sm">
              Click a {mode === "material_flow" ? "artifact" : mode === "station_handoffs" ? "visit" : "step"} to see details
            </div>
          )}
        </div>
      )}
    </div>
  );
}
