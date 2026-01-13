import React, { useMemo } from "react";
import type { BenchTopLineBuild, ValidationOutput } from "@/types";
import { computeBuildHealth } from "@/lib/graphMetrics";

type BuildHealthStripProps = {
  build: BenchTopLineBuild | null;
  validation: ValidationOutput | null;
};

export function BuildHealthStrip({ build, validation }: BuildHealthStripProps) {
  const metrics = useMemo(() => computeBuildHealth(build), [build]);
  
  const hardErrorCount = validation?.hardErrors?.length ?? 0;
  const warningCount = validation?.warnings?.length ?? 0;

  if (!build) return null;

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-xs">
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

      <div className="flex items-center gap-2" title="Entry points are steps with no dependencies (start points).">
        <span className="text-neutral-500 font-medium">ENTRY POINTS:</span>
        <span className={`font-bold ${metrics.entryPointPct > 30 ? 'text-amber-600' : 'text-neutral-900'}`}>
          {metrics.entryPointCount} ({metrics.entryPointPct}%)
        </span>
      </div>

      <div className="flex items-center gap-2" title="Disconnected components in the graph. Should usually be 1.">
        <span className="text-neutral-500 font-medium">COMPONENTS:</span>
        <span className={`font-bold ${metrics.connectedComponents > 1 ? 'text-amber-600' : 'text-neutral-900'}`}>
          {metrics.connectedComponents}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-neutral-500 font-medium">STEPS:</span>
        <span className="font-bold text-neutral-900">{metrics.stepCount}</span>
      </div>
    </div>
  );
}
