import React, { useMemo } from "react";
import type { BenchTopLineBuild, ValidationOutput } from "@/types";
import { computeBuildHealth } from "@/lib/graphMetrics";
import type { ScoreReport } from "@/components/complexity/ScorePanel";
import { InfoTooltip } from "@/components/ui/Tooltip";
import { formatNormalizedScore, formatRawScore } from "@/lib/complexityFormatters";

type BuildHealthStripProps = {
  build: BenchTopLineBuild | null;
  validation: ValidationOutput | null;
  complexityScore: ScoreReport | null;
  onViewIssues?: () => void;
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

const RATING_COLORS: Record<ScoreReport["rating"], string> = {
  low: "text-emerald-600",
  medium: "text-yellow-600",
  high: "text-orange-600",
  very_high: "text-rose-600",
};

const RATING_LABELS: Record<ScoreReport["rating"], string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  very_high: "V.HIGH",
};

const RATING_BG: Record<ScoreReport["rating"], string> = {
  low: "bg-emerald-50",
  medium: "bg-yellow-50",
  high: "bg-orange-50",
  very_high: "bg-rose-50",
};

export function BuildHealthStrip({ build, validation, complexityScore, onViewIssues }: BuildHealthStripProps) {
  const metrics = useMemo(() => computeBuildHealth(build), [build]);

  const hardErrorCount = validation?.hardErrors?.length ?? 0;
  const warningCount = validation?.warnings?.length ?? 0;

  if (!build) return null;

  // Determine overall status
  const isBlocked = hardErrorCount > 0;
  const hasWarnings = warningCount > 0;

  // Status section styling
  const statusBg = isBlocked ? "bg-rose-50" : hasWarnings ? "bg-amber-50" : "bg-emerald-50";
  const statusBorder = isBlocked ? "border-rose-200" : hasWarnings ? "border-amber-200" : "border-emerald-200";
  const statusColor = isBlocked ? "text-rose-600" : hasWarnings ? "text-amber-600" : "text-emerald-600";

  // Complexity section styling
  const complexityBg = complexityScore ? RATING_BG[complexityScore.rating] : "bg-neutral-50";

  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="grid grid-cols-3 divide-x divide-neutral-200">
        {/* Section 1: STATUS */}
        <div className={`p-3 ${statusBg} ${statusBorder}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
            Status
          </div>
          <div className={`text-lg font-bold ${statusColor}`}>
            {isBlocked ? "Blocked" : hasWarnings ? "Valid" : "Valid"}
            {isBlocked && (
              <span className="ml-1.5 text-xs font-medium text-rose-500">
                (cannot publish)
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-600 flex items-center gap-2">
            <span>{hardErrorCount} err · {warningCount} warn</span>
            {(hardErrorCount > 0 || warningCount > 0) && onViewIssues && (
              <button
                onClick={onViewIssues}
                className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
              >
                View Issues →
              </button>
            )}
          </div>
        </div>

        {/* Section 2: TIMING */}
        <div className="p-3 bg-white">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
            Timing
          </div>
          <div className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            {formatDuration(metrics.totalEstimatedSeconds)} total
            <InfoTooltip content="Sum of all step durations if done one-by-one" />
          </div>
          <div className="text-xs text-neutral-600 flex items-center gap-1">
            {formatDuration(metrics.criticalPathSeconds)} critical path
            <InfoTooltip content="Minimum time with parallel execution (longest chain)" />
          </div>
        </div>

        {/* Section 3: COMPLEXITY */}
        <div className={`p-3 ${complexityBg}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
            Complexity
          </div>
          {complexityScore ? (
            <>
              <div className="flex items-center gap-1">
                <div className={`text-lg font-bold ${RATING_COLORS[complexityScore.rating]}`}>
                  {formatNormalizedScore(complexityScore.normalizedScore)}{" "}
                </div>
                <InfoTooltip content={formatRawScore(complexityScore.rawScore)} />
                <span className={`text-sm font-medium ${RATING_COLORS[complexityScore.rating]}`}>
                  {RATING_LABELS[complexityScore.rating]}
                </span>
              </div>
              <div className="text-xs text-neutral-600">
                {metrics.stepCount} steps · {metrics.entryPointCount} entry
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-neutral-400 flex items-center gap-1">
                --
                <InfoTooltip content="Complexity score not calculated" />
              </div>
              <div className="text-xs text-neutral-600">
                {metrics.stepCount} steps · {metrics.entryPointCount} entry
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
