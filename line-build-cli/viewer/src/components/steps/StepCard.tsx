import React, { useState } from "react";
import type { Step, DependencyRef } from "@/types";
import { getDependencyStepId } from "@/types";
import { formatStepLabel } from "@/lib/stepLabel";

// Action family color mapping
const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PREP: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  HEAT: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  TRANSFER: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  COMBINE: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  ASSEMBLE: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  PORTION: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  CHECK: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  PACKAGING: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  OTHER: { bg: "bg-neutral-50", text: "text-neutral-700", border: "border-neutral-200" },
};

// Equipment icons (simplified unicode/emoji representations)
const EQUIPMENT_ICONS: Record<string, string> = {
  fryer: "\ud83c\udf73",
  waterbath: "\ud83c\udf21\ufe0f",
  turbo: "\ud83c\udf2c\ufe0f",
  toaster: "\ud83c\udf5e",
  salamander: "\ud83d\udd25",
  clamshell_grill: "\ud83c\udf56",
  press: "\ud83e\uddca",
  induction: "\u26a1",
  conveyor: "\u27a1\ufe0f",
  hot_box: "\ud83d\udce6",
  hot_well: "\u2668\ufe0f",
  other: "\ud83d\udd27",
};

function formatDuration(seconds: number | undefined, isActive?: boolean): string {
  if (!seconds) return "\u2014";
  if (seconds < 60) return `${seconds}s${isActive === false ? " (passive)" : ""}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  return `${timeStr}${isActive === false ? " (passive)" : ""}`;
}

function getDependencyIds(deps: DependencyRef[] | undefined): string[] {
  if (!deps || deps.length === 0) return [];
  return deps.map(getDependencyStepId);
}

type StepCardProps = {
  step: Step;
  isSelected: boolean;
  hasError: boolean;
  errorCount: number;
  onSelect: () => void;
  onDependencyClick?: (stepId: string) => void;
};

export function StepCard({
  step,
  isSelected,
  hasError,
  errorCount,
  onSelect,
  onDependencyClick,
}: StepCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = ACTION_COLORS[step.action.family] ?? ACTION_COLORS.OTHER;
  const depIds = getDependencyIds(step.dependsOn);
  const equipmentId = step.equipment?.applianceId;
  const equipmentIcon = equipmentId ? EQUIPMENT_ICONS[equipmentId] ?? EQUIPMENT_ICONS.other : null;
  const isEntryPoint = depIds.length === 0;

  // Show details row when selected, hovered, or has equipment/time info to show
  const hasEquipmentOrTime = equipmentIcon || step.time || step.stationId;
  const showDetailsRow = isSelected || isHovered;

  // Build instruction/target summary
  const summary = step.instruction || step.target?.name || step.notes || "\u2014";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        rounded-lg border cursor-pointer transition-all duration-150
        ${isSelected
          ? "ring-2 ring-primary-500 border-primary-300 bg-primary-50/50"
          : hasError
            ? "border-rose-300 bg-rose-50/30 hover:bg-rose-50/50"
            : "border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300"
        }
      `}
    >
      {/* Line 1: Step #, Action Family badge, Technique */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <span className="font-mono text-xs font-bold text-neutral-500">
          #{formatStepLabel(step.orderIndex)}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors.bg} ${colors.text} ${colors.border} border`}
        >
          {step.action.family}
        </span>
        {step.action.techniqueId && (
          <span className="text-xs text-neutral-600 font-medium">
            {step.action.techniqueId}
          </span>
        )}
        {/* Error badge */}
        {hasError && (
          <span className="ml-auto bg-rose-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
            {errorCount}
          </span>
        )}
        {/* Entry point indicator */}
        {isEntryPoint && !hasError && (
          <span className="ml-auto text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            ENTRY
          </span>
        )}
      </div>

      {/* Line 2: Instruction/target summary */}
      <div className="px-3 pb-1">
        <p className="text-sm text-neutral-700 truncate" title={summary}>
          {summary}
        </p>
      </div>

      {/* Line 3: Equipment + Time + Station - collapsed by default, shown on hover/select */}
      {hasEquipmentOrTime && (
        <div className={`overflow-hidden transition-all duration-150 ${showDetailsRow ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex items-center gap-3 px-3 pb-2 text-xs text-neutral-500">
            {equipmentIcon && (
              <span className="flex items-center gap-1" title={equipmentId}>
                <span>{equipmentIcon}</span>
                <span>{equipmentId}</span>
              </span>
            )}
            {step.time && (
              <span className="flex items-center gap-1" title="Duration">
                <span>{formatDuration(step.time.durationSeconds, step.time.isActive)}</span>
              </span>
            )}
            {step.stationId && (
              <span className="text-neutral-400">{step.stationId}</span>
            )}
          </div>
        </div>
      )}

      {/* Line 4: Dependencies - clear link affordance with arrow icon */}
      {depIds.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              depends:
            </span>
            {depIds.slice(0, 3).map((depId) => (
              <button
                key={depId}
                onClick={(e) => {
                  e.stopPropagation();
                  onDependencyClick?.(depId);
                }}
                className="text-[10px] font-mono text-primary-600 hover:text-primary-800 underline decoration-dotted hover:decoration-solid cursor-pointer transition-all"
                title={`Jump to step ${depId.replace("step-", "")}`}
              >
                #{depId.replace("step-", "")}
              </button>
            ))}
            {depIds.length > 3 && (
              <span className="text-[10px] text-neutral-400">
                +{depIds.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
