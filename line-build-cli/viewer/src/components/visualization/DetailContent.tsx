"use client";

import React, { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatStepLabel } from "@/lib/stepLabel";
import { getGroupColor } from "@/lib/componentColors";
import type { Step, StationVisit, ValidationOutput } from "@/types";
import { getDependencyStepId, isConditionalDependency } from "@/types";

type VisualizationMode = "work_order" | "material_flow" | "station_handoffs";

type Assembly = {
  id: string;
  name?: string;
  groupId?: string;
  subAssemblies?: string[];
};

type AssemblySteps = {
  producedBy: Step[];
  consumedBy: Step[];
};

export type DetailContentProps = {
  mode: VisualizationMode;
  // Work Order
  selectedStep?: Step | null;
  validation?: ValidationOutput | null;
  buildId?: string;
  // Material Flow
  selectedAssembly?: Assembly | null;
  assemblySteps?: AssemblySteps | null;
  assemblies?: Assembly[];
  groupColorMap?: Map<string, string>;
  // Station Timeline
  selectedVisit?: StationVisit | null;
  // Common
  onClose: () => void;
  onSelectStep?: (stepId: string) => void;
};

function formatAssemblyRef(
  ref: NonNullable<Step["input"]>[number],
  assemblies?: Assembly[]
): string {
  if (ref.source.type === "in_build") {
    const assemblyId = ref.source.assemblyId;
    const meta = assemblies?.find((a) => a.id === assemblyId);
    const label = meta?.name || assemblyId || "unknown";
    return label;
  }
  if (ref.source.type === "external_build") {
    const version = ref.source.version === undefined ? "" : `@${String(ref.source.version)}`;
    const assembly = ref.source.assemblyId ? `:${ref.source.assemblyId}` : ":primary";
    return `external:${ref.source.itemId}${version}${assembly}`;
  }
  return "unknown";
}

export function DetailContent({
  mode,
  selectedStep,
  validation,
  buildId,
  selectedAssembly,
  assemblySteps,
  assemblies,
  groupColorMap,
  selectedVisit,
  onClose,
  onSelectStep,
}: DetailContentProps) {
  // Determine if we have anything to show
  const hasContent = selectedStep || selectedAssembly || selectedVisit;

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

  // Render Work Order (Step) content
  const renderStepContent = () => {
    if (!selectedStep) return null;

    const targetLabel =
      selectedStep.target?.name ||
      selectedStep.target?.bomUsageId ||
      selectedStep.target?.bomComponentId ||
      "—";

    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-neutral-800 text-white text-xs font-bold px-2 py-0.5 rounded">
              {formatStepLabel(selectedStep.orderIndex)}
            </div>
            <div className="text-sm font-medium text-neutral-800 truncate">
              {selectedStep.action.family} — {selectedStep.target?.name || selectedStep.instruction?.slice(0, 30) || selectedStep.id}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {messages.hard.length > 0 ? (
                <Badge variant="danger">{messages.hard.length} error{messages.hard.length !== 1 ? "s" : ""}</Badge>
              ) : (
                <Badge variant="success">Valid</Badge>
              )}
              {messages.warn.length > 0 && <Badge variant="warning">{messages.warn.length} warn</Badge>}
            </div>
            <Button size="sm" variant="secondary" onClick={copyReference} title="Copy reference for chat">
              Copy Ref
            </Button>
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

        {/* Structured Data */}
        <div className="space-y-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Track</div>
            <div className="text-neutral-900 font-medium text-right">{selectedStep.trackId || "—"}</div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Action</div>
            <div className="text-neutral-900 font-medium text-right">
              {selectedStep.action?.family}
              {selectedStep.action?.techniqueId && (
                <span className="text-neutral-500 ml-1">({selectedStep.action.techniqueId})</span>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Target</div>
            <div className="text-neutral-900 font-medium text-right">{targetLabel}</div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Grouping</div>
            <div className="text-neutral-900 font-medium text-right">{selectedStep.groupingId?.replace(/_/g, " ") || "—"}</div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Station</div>
            <div className="text-neutral-900 font-medium text-right">{selectedStep.stationId || "—"}</div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Equipment</div>
            <div className="text-neutral-900 font-medium text-right">
              {selectedStep.equipment?.applianceId || "—"}
            </div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Tool</div>
            <div className="text-neutral-900 font-medium text-right">{selectedStep.toolId || "—"}</div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Phase</div>
            <div className="text-neutral-900 font-medium text-right">{selectedStep.cookingPhase || "—"}</div>
          </div>
          {selectedStep.container && (
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Container</div>
              <div className="text-neutral-900 font-medium text-right">
                {selectedStep.container.type}
                {selectedStep.container.name && ` (${selectedStep.container.name})`}
                {selectedStep.container.size && ` - ${selectedStep.container.size}`}
              </div>
            </div>
          )}
          {selectedStep.storageLocation && (
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">Storage</div>
              <div className="text-neutral-900 font-medium text-right">
                {selectedStep.storageLocation.type.replace(/_/g, " ")}
              </div>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Sublocation</div>
            <div className="text-neutral-900 font-medium text-right">
              {selectedStep.sublocation?.type ? (
                <>
                  {selectedStep.sublocation.type.replace(/_/g, " ")}
                  {selectedStep.sublocation.equipmentId && ` (${selectedStep.sublocation.equipmentId})`}
                  {selectedStep.provenance?.sublocation?.type === "inferred" && (
                    <span className="ml-1 text-neutral-400 italic text-xs">(derived)</span>
                  )}
                </>
              ) : "—"}
            </div>
          </div>
          {(selectedStep.from?.stationId || selectedStep.from?.sublocation?.type) && (
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">From (Loc)</div>
              <div className="text-neutral-900 font-medium text-right text-xs">
                 {selectedStep.from.stationId?.replace(/_/g, " ")}
                 {selectedStep.from.sublocation?.type && ` / ${selectedStep.from.sublocation.type.replace(/_/g, " ")}`}
              </div>
            </div>
          )}
          {(selectedStep.to?.stationId || selectedStep.to?.sublocation?.type) && (
            <div className="flex items-start justify-between gap-3">
              <div className="text-neutral-500">To (Loc)</div>
              <div className="text-neutral-900 font-medium text-right text-xs">
                 {selectedStep.to.stationId?.replace(/_/g, " ")}
                 {selectedStep.to.sublocation?.type && ` / ${selectedStep.to.sublocation.type.replace(/_/g, " ")}`}
              </div>
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Time</div>
            <div className="text-neutral-900 font-medium text-right">
              {selectedStep.time
                ? `${selectedStep.time.durationSeconds}s${selectedStep.time.isActive === false ? " (passive)" : ""}`
                : "—"}
            </div>
          </div>
          {selectedStep.quantity && (
             <div className="flex items-start justify-between gap-3">
               <div className="text-neutral-500">Quantity</div>
               <div className="text-neutral-900 font-medium text-right">
                 {selectedStep.quantity.value} {selectedStep.quantity.unit}
               </div>
             </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="text-neutral-500">Depends on</div>
            <div className="text-neutral-900 font-medium text-right">
              {(selectedStep.dependsOn ?? []).length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {(selectedStep.dependsOn ?? []).map((depRef) => {
                    const depId = getDependencyStepId(depRef);
                    const isConditional = isConditionalDependency(depRef);
                    return (
                      <button
                        key={depId}
                        onClick={() => onSelectStep?.(depId)}
                        className={`hover:underline transition-colors ${isConditional ? 'text-purple-600 hover:text-purple-800' : 'text-primary-600 hover:text-primary-800'}`}
                        title={isConditional ? `Go to ${depId} (conditional)` : `Go to ${depId}`}
                      >
                        {depId}{isConditional && <span className="text-[10px] ml-0.5">?</span>}
                      </button>
                    );
                  })}
                </span>
              ) : (
                <span className="text-neutral-400 italic">none (entry point)</span>
              )}
            </div>
          </div>
        </div>

        {/* Material Flow - Inputs & Outputs with locations */}
        {((selectedStep.input ?? []).length > 0 || (selectedStep.output ?? []).length > 0) && (
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">Material Flow</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Inputs */}
              {(selectedStep.input ?? []).length > 0 && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3">
                  <div className="text-xs font-semibold text-cyan-700 mb-2 flex items-center gap-1">
                    <span>←</span> INPUTS
                  </div>
                  <div className="space-y-2">
                    {(selectedStep.input ?? []).map((inp, idx) => {
                      const artifactLabel = inp.source.type === "in_build"
                        ? (assemblies?.find(a => a.id === inp.source.assemblyId)?.name || inp.source.assemblyId)
                        : `external:${inp.source.itemId}`;
                      const fromLoc = inp.from;
                      const hasFrom = fromLoc?.stationId || fromLoc?.sublocation?.type;
                      return (
                        <div key={idx} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-neutral-800">{artifactLabel}</span>
                            {inp.role && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${inp.role === 'base' ? 'bg-neutral-200 text-neutral-600' : 'bg-cyan-200 text-cyan-700'}`}>
                                {inp.role}
                              </span>
                            )}
                          </div>
                          {hasFrom ? (
                            <div className="text-xs text-cyan-600 mt-0.5">
                              from: {fromLoc?.stationId?.replace(/_/g, " ") || "?"}
                              {fromLoc?.sublocation?.type && ` / ${fromLoc.sublocation.type.replace(/_/g, " ")}`}
                              {fromLoc?.sublocation?.equipmentId && ` (${fromLoc.sublocation.equipmentId})`}
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-400 italic mt-0.5">from: not specified</div>
                          )}
                          {inp.quantity && (
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {inp.quantity.value} {inp.quantity.unit}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outputs */}
              {(selectedStep.output ?? []).length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                  <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                    <span>→</span> OUTPUTS
                  </div>
                  <div className="space-y-2">
                    {(selectedStep.output ?? []).map((out, idx) => {
                      const artifactLabel = out.source.type === "in_build"
                        ? (assemblies?.find(a => a.id === out.source.assemblyId)?.name || out.source.assemblyId)
                        : `external:${out.source.itemId}`;
                      const toLoc = out.to;
                      const hasTo = toLoc?.stationId || toLoc?.sublocation?.type;
                      return (
                        <div key={idx} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-neutral-800">{artifactLabel}</span>
                            {out.role && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${out.role === 'base' ? 'bg-neutral-200 text-neutral-600' : 'bg-green-200 text-green-700'}`}>
                                {out.role}
                              </span>
                            )}
                          </div>
                          {hasTo ? (
                            <div className="text-xs text-green-600 mt-0.5">
                              to: {toLoc?.stationId?.replace(/_/g, " ") || "?"}
                              {toLoc?.sublocation?.type && ` / ${toLoc.sublocation.type.replace(/_/g, " ")}`}
                              {toLoc?.sublocation?.equipmentId && ` (${toLoc.sublocation.equipmentId})`}
                              {selectedStep?.provenance?.to?.type === "inferred" && (
                                <span className="ml-1 text-neutral-400 italic">(derived)</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-neutral-400 italic mt-0.5">to: not specified</div>
                          )}
                          {out.quantity && (
                            <div className="text-xs text-neutral-500 mt-0.5">
                              {out.quantity.value} {out.quantity.unit}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instruction & Notes */}
        <div className="space-y-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-xs font-semibold text-neutral-700 mb-1">Instruction</div>
            <div className="text-sm text-neutral-800 whitespace-pre-wrap">
              {typeof selectedStep.instruction === "string" && selectedStep.instruction.trim().length > 0
                ? selectedStep.instruction.trim()
                : "—"}
            </div>
          </div>
          {selectedStep.notes && (
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="text-xs font-semibold text-neutral-700 mb-1">Notes</div>
              <div className="text-sm text-neutral-800 whitespace-pre-wrap">
                {selectedStep.notes.trim()}
              </div>
            </div>
          )}
        </div>

        {/* Validation messages */}
        {(messages.hard.length > 0 || messages.warn.length > 0) && (
          <div>
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

  // Render Material Flow (Assembly) content
  const renderArtifactContent = () => {
    if (!selectedAssembly) return null;

    const colorMap = groupColorMap ?? new Map<string, string>();
    const groupColor = getGroupColor(selectedAssembly.groupId, colorMap);

    // Get base components recursively
    const getBaseComponents = (
      assemblyId: string,
      visited = new Set<string>()
    ): Array<{ id: string; name: string; color: string }> => {
      if (visited.has(assemblyId)) return [];
      visited.add(assemblyId);

      const asm = assemblies?.find((a) => a.id === assemblyId);
      if (!asm) return [{ id: assemblyId, name: assemblyId, color: "#6B7280" }];

      if (!asm.subAssemblies || asm.subAssemblies.length === 0) {
        return [{ id: asm.id, name: asm.name || asm.id, color: getGroupColor(asm.groupId, colorMap) }];
      }

      const results: Array<{ id: string; name: string; color: string }> = [];
      for (const cid of asm.subAssemblies) {
        results.push(...getBaseComponents(cid, visited));
      }
      return results;
    };

    const baseComponents = selectedAssembly.subAssemblies?.length
      ? Array.from(new Map(selectedAssembly.subAssemblies.flatMap((cid) => getBaseComponents(cid)).map((c) => [c.id, c])).values())
      : [];

    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: groupColor }}
            />
            <div>
              <div className="font-semibold text-neutral-900">{selectedAssembly.name || selectedAssembly.id}</div>
              <div className="text-xs text-neutral-500">Group: {selectedAssembly.groupId || "none"}</div>
            </div>
          </div>
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
        {assemblySteps?.producedBy && assemblySteps.producedBy.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">PRODUCED BY</div>
            <div className="space-y-1">
              {assemblySteps.producedBy.map((step) => (
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
        {assemblySteps?.consumedBy && assemblySteps.consumedBy.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">CONSUMED BY</div>
            <div className="space-y-1">
              {assemblySteps.consumedBy.map((step) => (
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
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
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

        {/* Steps in this visit */}
        <div>
          <div className="text-xs font-semibold text-neutral-700 mb-2">Steps in this visit</div>
          <div className="space-y-2">
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

  if (!hasContent) {
    return null;
  }

  return (
    <>
      {mode === "work_order" && renderStepContent()}
      {mode === "material_flow" && renderArtifactContent()}
      {mode === "station_handoffs" && renderVisitContent()}
    </>
  );
}
