import React, { useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatStepLabel } from "@/lib/stepLabel";
import type { Step, StationVisit, ValidationOutput, BenchTopLineBuild } from "@/types";

type StepInspectorProps = {
  step: Step | null;
  validation: ValidationOutput | null;
  buildId?: string;
  assemblies?: BenchTopLineBuild["assemblies"];
  visit?: StationVisit | null;
  onSelectStep?: (stepId: string) => void;
};

function formatAssemblyRef(ref: NonNullable<Step["input"]>[number], assemblies?: BenchTopLineBuild["assemblies"]): string {
  if (ref.source.type === "in_build") {
    const assemblyId = ref.source.assemblyId;
    const meta = assemblies?.find(a => a.id === assemblyId);
    const label = meta?.name || assemblyId || "unknown";
    const group = meta?.groupId ? ` (group: ${meta.groupId})` : "";
    return `in_build:${label}${group}`;
  }
  if (ref.source.type === "external_build") {
    const version = ref.source.version === undefined ? "" : `@${String(ref.source.version)}`;
    const assembly = ref.source.assemblyId ? `:${ref.source.assemblyId}` : ":primary";
    return `external_build:${ref.source.itemId}${version}${assembly}`;
  }
  return "unknown";
}

function formatFieldValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" && v.trim().length === 0) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function StepInspector({ step, validation, buildId, assemblies, visit, onSelectStep }: StepInspectorProps) {
  const messages = useMemo(() => {
    if (!validation || !step) return { hard: [], warn: [] };
    const hard = (validation.hardErrors ?? []).filter((e) => e.stepId === step.id);
    const warn = (validation.warnings ?? []).filter((e) => e.stepId === step.id);
    return { hard, warn };
  }, [step, validation]);

  const copyReference = useCallback(() => {
    if (!step) return;
    const label = formatStepLabel(step.orderIndex);
    const text = `Build: ${buildId || 'unknown'} | Step: ${label} | ID: ${step.id}`;
    navigator.clipboard.writeText(text);
  }, [step, buildId]);

  if (!step && !visit) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900">Step Inspector</div>
            <Badge variant="default">No step selected</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <div className="text-sm text-neutral-600">
            Click a step node to see structured details and validation messages.
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!step && visit) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-neutral-800 text-white text-sm font-bold px-2 py-0.5 rounded">
                {visit.stationId.replace("_", " ").toUpperCase()} {visit.visitNumber}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900 truncate">Station Visit</div>
                <div className="text-xs text-neutral-500 truncate">
                  {visit.trackId} • S{String(visit.stepRange[0] + 1).padStart(2, "0")}-S{String(visit.stepRange[1] + 1).padStart(2, "0")}
                </div>
              </div>
            </div>
            <Badge variant="default">{visit.steps.length} steps</Badge>
          </div>
        </CardHeader>
        <CardBody>
          <div className="text-xs font-semibold text-neutral-700 mb-2">Steps in this visit</div>
          <div className="space-y-2">
            {visit.steps.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <div className="text-sm text-neutral-700 truncate">
                  {formatStepLabel(s.orderIndex)} {s.action.family} — {s.instruction ?? s.notes ?? s.id}
                </div>
                <Button size="sm" variant="secondary" onClick={() => onSelectStep?.(s.id)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  // At this point, step must be defined (both early returns checked for !step)
  if (!step) return null;

  const targetLabel =
    step.target?.name || step.target?.bomUsageId || step.target?.bomComponentId || "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-neutral-800 text-white text-sm font-bold px-2 py-0.5 rounded">
              {formatStepLabel(step.orderIndex)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-900 truncate">Step Inspector</div>
              <div className="text-xs text-neutral-500 truncate">
                {step.id} • orderIndex {step.orderIndex}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={copyReference} title="Copy reference for chat">
              Copy Ref
            </Button>
            {messages.hard.length > 0 ? (
              <Badge variant="danger">{messages.hard.length} hard</Badge>
            ) : (
              <Badge variant="success">No hard errors</Badge>
            )}
            {messages.warn.length > 0 ? <Badge variant="warning">{messages.warn.length} warn</Badge> : null}
          </div>
        </div>
      </CardHeader>

      <CardBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-neutral-700 mb-2">Structured</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Action</div>
                <div className="text-neutral-900 font-medium text-right">
                  {formatFieldValue(step.action?.family)}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Target</div>
                <div className="text-neutral-900 font-medium text-right">{targetLabel}</div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Equipment</div>
                <div className="text-neutral-900 font-medium text-right">
                  {formatFieldValue(step.equipment?.applianceId)}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Time</div>
                <div className="text-neutral-900 font-medium text-right">
                  {step.time
                    ? `${formatFieldValue(step.time.durationSeconds)}s${
                        step.time.isActive === false ? " (passive)" : ""
                      }`
                    : "—"}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Depends on</div>
                <div className="text-neutral-900 font-medium text-right">
                  {(step.dependsOn ?? []).length > 0 ? (step.dependsOn ?? []).join(", ") : "—"}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Consumes</div>
                <div className="text-neutral-900 font-medium text-right flex flex-col items-end">
                  {(step.input ?? []).length > 0
                    ? (step.input ?? []).map((input, i) => (
                        <div key={i} className="flex flex-col items-end border-b border-neutral-100 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                          <span className="font-semibold text-cyan-700">{formatAssemblyRef(input, assemblies)}</span>
                          {input.from && (
                            <span className="text-[10px] text-neutral-500">
                              from: {input.from.stationId || '—'} / {input.from.sublocation?.type || '—'}
                            </span>
                          )}
                        </div>
                      ))
                    : "—"}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Produces</div>
                <div className="text-neutral-900 font-medium text-right flex flex-col items-end">
                  {(step.output ?? []).length > 0
                    ? (step.output ?? []).map((output, i) => (
                        <div key={i} className="flex flex-col items-end border-b border-neutral-100 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                          <span className="font-semibold text-green-700">{formatAssemblyRef(output, assemblies)}</span>
                          {output.to && (
                            <span className="text-[10px] text-neutral-500">
                              to: {output.to.stationId || '—'} / {output.to.sublocation?.type || '—'}
                            </span>
                          )}
                          {output.onAssembly && (
                            <span className="text-[10px] text-neutral-500 italic">
                              on: {output.onAssembly}
                            </span>
                          )}
                        </div>
                      ))
                    : "—"}
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
                  {typeof step.instruction === "string" && step.instruction.trim().length > 0
                    ? step.instruction.trim()
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="text-xs font-semibold text-neutral-700 mb-1">Notes</div>
                <div className="text-sm text-neutral-800 whitespace-pre-wrap">
                  {typeof step.notes === "string" && step.notes.trim().length > 0
                    ? step.notes.trim()
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold text-neutral-700 mb-2">Validation messages</div>

          {messages.hard.length === 0 && messages.warn.length === 0 ? (
            <div className="text-sm text-neutral-600">No validation messages for this step.</div>
          ) : (
            <div className="space-y-2">
              {messages.hard.map((e, idx) => (
                <div
                  key={`hard-${idx}-${e.ruleId}`}
                  className="rounded-lg border border-rose-200 bg-rose-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-rose-800">
                      {e.ruleId} (hard)
                    </div>
                    {e.fieldPath ? (
                      <div className="text-xs text-rose-700">{e.fieldPath}</div>
                    ) : null}
                  </div>
                  <div className="text-sm text-rose-800 mt-1">{e.message}</div>
                </div>
              ))}
              {messages.warn.map((e, idx) => (
                <div
                  key={`warn-${idx}-${e.ruleId}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-amber-800">
                      {e.ruleId} ({e.severity})
                    </div>
                    {e.fieldPath ? (
                      <div className="text-xs text-amber-700">{e.fieldPath}</div>
                    ) : null}
                  </div>
                  <div className="text-sm text-amber-800 mt-1">{e.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
