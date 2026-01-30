"use client";

import React from "react";
import { formatNormalizedScore, formatRawScore, formatRatingLabel, getRatingRange } from "@/lib/complexityFormatters";

// Score report type (matching the CLI types)
export interface ScoreReport {
  buildId: string;
  rawScore: number;
  normalizedScore: number | null;
  rating: "low" | "medium" | "high" | "very_high";
  hotRatio: number;
  breakdown: {
    location: number;
    technique: number;
    equipment: number;
    packaging: number;
    stationMovement: number;
    taskCount: number;
    structuralSignals: number;
  };
  topContributors: Array<{
    source: string;
    type: "step" | "signal";
    contribution: number;
    explanation: string;
  }>;
  signals: {
    groupingBounces: number;
    stationBounces: number;
    mergePointCount: number;
    deepMergeCount: number;
    parallelEntryPoints: number;
    shortEquipmentSteps: number;
    backToBackEquipment: number;
    transferCount: number;
    stationTransitions: number;
  };
  features: {
    stepCount: number;
    hotSideStepCount: number;
    coldSideStepCount: number;
    expoStepCount: number;
    vendingStepCount: number;
  };
  calculatedAt: string;
  configVersion: string;
}

type ScorePanelProps = {
  report: ScoreReport | null;
  loading?: boolean;
  error?: string | null;
};

const RATING_COLORS: Record<ScoreReport["rating"], { bg: string; text: string; label: string }> = {
  low: { bg: "bg-emerald-100", text: "text-emerald-700", label: "LOW" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700", label: "MEDIUM" },
  high: { bg: "bg-orange-100", text: "text-orange-700", label: "HIGH" },
  very_high: { bg: "bg-rose-100", text: "text-rose-700", label: "VERY HIGH" },
};

function RatingBadge({ rating }: { rating: ScoreReport["rating"] }) {
  const colors = RATING_COLORS[rating];
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}

function CategoryBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-neutral-600 truncate">{label}</span>
      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-neutral-500 font-mono">{value.toFixed(1)}</span>
    </div>
  );
}

function HotColdRatioBar({ ratio }: { ratio: number }) {
  const hotPct = ratio * 100;
  const coldPct = 100 - hotPct;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>Cold Side ({coldPct.toFixed(0)}%)</span>
        <span>Hot Side ({hotPct.toFixed(0)}%)</span>
      </div>
      <div className="h-3 bg-blue-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-blue-400"
          style={{ width: `${coldPct}%` }}
        />
        <div
          className="h-full bg-orange-400"
          style={{ width: `${hotPct}%` }}
        />
      </div>
    </div>
  );
}

function SignalsSection({ signals }: { signals: ScoreReport["signals"] }) {
  const items = [
    { label: "Grouping Bounces", value: signals.groupingBounces, warn: true },
    { label: "Station Bounces", value: signals.stationBounces, warn: true },
    { label: "Merge Points", value: signals.mergePointCount, warn: false },
    { label: "Deep Merges (3+)", value: signals.deepMergeCount, warn: true },
    { label: "Entry Points", value: signals.parallelEntryPoints, warn: false },
    { label: "Station Transitions", value: signals.stationTransitions, warn: false },
    { label: "Transfers", value: signals.transferCount, warn: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between">
          <span className="text-neutral-600">{item.label}</span>
          <span
            className={`font-mono ${
              item.warn && item.value > 0 ? "text-amber-600 font-bold" : "text-neutral-800"
            }`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopContributors({
  contributors,
  onSelectStep,
}: {
  contributors: ScoreReport["topContributors"];
  onSelectStep?: (stepId: string) => void;
}) {
  return (
    <div className="space-y-1">
      {contributors.slice(0, 5).map((c, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 text-xs p-1.5 rounded ${
            c.type === "step" && onSelectStep
              ? "hover:bg-neutral-100 cursor-pointer"
              : ""
          }`}
          onClick={() => {
            if (c.type === "step" && onSelectStep) {
              onSelectStep(c.source);
            }
          }}
        >
          <span
            className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
              c.type === "step" ? "bg-primary-100 text-primary-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {c.type === "step" ? "S" : "!"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{c.source}</div>
          </div>
          <span className="font-mono text-neutral-600">+{c.contribution.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function ScorePanel({ report, loading, error }: ScorePanelProps) {
  if (loading) {
    return (
      <div className="p-4 text-sm text-neutral-500 flex items-center justify-center h-full">
        <div className="animate-pulse">Calculating complexity...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-rose-600">
        Error: {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-4 text-sm text-neutral-500 flex items-center justify-center h-full">
        Select a build to view complexity score
      </div>
    );
  }

  // Calculate max for category bars
  const categoryMax = Math.max(
    report.breakdown.location,
    report.breakdown.technique,
    report.breakdown.stationMovement,
    report.breakdown.structuralSignals,
    report.breakdown.taskCount,
    20
  );

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Header with score and rating */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-neutral-900">
            {formatNormalizedScore(report.normalizedScore)}
          </div>
          <div className="text-sm text-neutral-500 mt-1">
            {formatRawScore(report.rawScore)}
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            {formatRatingLabel(report.rating)} range ({getRatingRange(report.rating)})
          </div>
        </div>
        <RatingBadge rating={report.rating} />
      </div>

      {/* Hot/Cold Ratio */}
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase mb-2">Work Distribution</h3>
        <HotColdRatioBar ratio={report.hotRatio} />
      </div>

      {/* Category Breakdown */}
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase mb-2">Score Breakdown</h3>
        <div className="space-y-2">
          <CategoryBar label="Location" value={report.breakdown.location} max={categoryMax} color="bg-blue-400" />
          <CategoryBar label="Technique" value={report.breakdown.technique} max={categoryMax} color="bg-purple-400" />
          <CategoryBar label="Station Movement" value={report.breakdown.stationMovement} max={categoryMax} color="bg-orange-400" />
          <CategoryBar label="Signals" value={report.breakdown.structuralSignals} max={categoryMax} color="bg-rose-400" />
          <CategoryBar label="Task Count" value={report.breakdown.taskCount} max={categoryMax} color="bg-neutral-400" />
        </div>
      </div>

      {/* Structural Signals */}
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase mb-2">Structural Signals</h3>
        <SignalsSection signals={report.signals} />
      </div>

      {/* Top Contributors */}
      <div>
        <h3 className="text-xs font-medium text-neutral-500 uppercase mb-2">Top Contributors</h3>
        <TopContributors contributors={report.topContributors} />
      </div>

      {/* Build Summary */}
      <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-200">
        <div className="flex justify-between">
          <span>Total Steps</span>
          <span className="font-mono">{report.features.stepCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Config Version</span>
          <span className="font-mono">{report.configVersion}</span>
        </div>
      </div>
    </div>
  );
}
