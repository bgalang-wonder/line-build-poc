import React, { useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Step, ValidationOutput } from "@/components/visualization/DAGVisualization";

type StepInspectorProps = {
  step: Step | null;
  validation: ValidationOutput | null;
};

function formatArtifactRef(ref: NonNullable<Step["consumes"]>[number]): string {
  if (ref.source.type === "in_build") {
    return `in_build:${ref.source.artifactId}`;
  }
  const version = ref.source.version === undefined ? "" : `@${String(ref.source.version)}`;
  const artifact = ref.source.artifactId ? `:${ref.source.artifactId}` : ":primary";
  return `external_build:${ref.source.itemId}${version}${artifact}`;
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

export function StepInspector({ step, validation }: StepInspectorProps) {
  const messages = useMemo(() => {
    if (!validation || !step) return { hard: [], warn: [] };
    const hard = (validation.hardErrors ?? []).filter((e) => e.stepId === step.id);
    const warn = (validation.warnings ?? []).filter((e) => e.stepId === step.id);
    return { hard, warn };
  }, [step, validation]);

  if (!step) {
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

  const targetLabel =
    step.target?.name || step.target?.bomUsageId || step.target?.bomComponentId || "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900 truncate">Step Inspector</div>
            <div className="text-xs text-neutral-500 truncate">
              {step.id} • orderIndex {step.orderIndex}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <div className="text-neutral-900 font-medium text-right">
                  {(step.consumes ?? []).length > 0
                    ? (step.consumes ?? []).map(formatArtifactRef).join(", ")
                    : "—"}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-neutral-500">Produces</div>
                <div className="text-neutral-900 font-medium text-right">
                  {(step.produces ?? []).length > 0
                    ? (step.produces ?? []).map(formatArtifactRef).join(", ")
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
                  className="rounded-lg border border-danger-200 bg-danger-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-danger-800">
                      {e.ruleId} (hard)
                    </div>
                    {e.fieldPath ? (
                      <div className="text-xs text-danger-700">{e.fieldPath}</div>
                    ) : null}
                  </div>
                  <div className="text-sm text-danger-800 mt-1">{e.message}</div>
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

