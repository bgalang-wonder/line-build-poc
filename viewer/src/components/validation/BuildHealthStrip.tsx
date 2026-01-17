import React, { useMemo } from "react";
import type { BenchTopLineBuild, ValidationOutput } from "@/types";
import { computeBuildHealth } from "@/lib/graphMetrics";

type BuildHealthStripProps = {
  build: BenchTopLineBuild | null;
  validation: ValidationOutput | null;
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

export function BuildHealthStrip({ build, validation }: BuildHealthStripProps) {
  const metrics = useMemo(() => computeBuildHealth(build), [build]);
  
  const hardErrorCount = validation?.hardErrors?.length ?? 0;
  const warningCount = validation?.warnings?.length ?? 0;

  if (!build) return null;

  const statusColor = hardErrorCount > 0 
    ? 'bg-rose-50 border-rose-200' 
    : warningCount > 0 
      ? 'bg-amber-50 border-amber-200' 
      : 'bg-emerald-50 border-emerald-200';

  return (
    <div className={`flex items-center justify-between px-4 py-2 border-b text-xs transition-colors ${statusColor}`}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 font-medium">STATUS:</span>
          <span className={`font-bold uppercase ${hardErrorCount > 0 ? 'text-rose-600' : warningCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {hardErrorCount > 0 ? 'Blocked' : warningCount > 0 ? 'Ready (Warn)' : 'Ready'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-500 font-medium">ERRORS:</span>
          <span className={`font-bold ${hardErrorCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {hardErrorCount}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 font-medium">WARNINGS:</span>
          <span className={`font-bold ${warningCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {warningCount}
          </span>
        </div>

        <div className="w-px h-3 bg-neutral-300" />

        <div className="flex items-center gap-2" title="Sum of all step durations if done one at a time (no parallelization)">
          <span className="text-neutral-500 font-medium">SEQUENTIAL:</span>
          <span className="font-bold text-neutral-900">{formatDuration(metrics.totalEstimatedSeconds)}</span>
        </div>

        <div className="flex items-center gap-2" title="Minimum end-to-end time with parallel work (longest path through the graph)">
          <span className="text-neutral-500 font-medium">PARALLEL:</span>
          <span className="font-bold text-orange-600">{formatDuration(metrics.criticalPathSeconds)}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2" title="Entry points are steps with no dependencies (start points).">
          <span className="text-neutral-500 font-medium">ENTRY:</span>
          <span className={`font-bold ${metrics.entryPointPct > 30 ? 'text-amber-600' : 'text-neutral-900'}`}>
            {metrics.entryPointCount} ({metrics.entryPointPct}%)
          </span>
        </div>

        <div className="flex items-center gap-2" title="Disconnected components in the graph. Should usually be 1.">
          <span className="text-neutral-500 font-medium">CLUSTERS:</span>
          <span className={`font-bold ${metrics.connectedComponents > 1 ? 'text-amber-600' : 'text-neutral-900'}`}>
            {metrics.connectedComponents}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-neutral-500 font-medium">STEPS:</span>
          <span className="font-bold text-neutral-900">{metrics.stepCount}</span>
        </div>
      </div>
    </div>
  );
}
