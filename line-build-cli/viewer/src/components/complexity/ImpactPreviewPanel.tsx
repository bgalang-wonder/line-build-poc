"use client";

import React, { useState } from "react";

// Types matching the CLI types
type Rating = "low" | "medium" | "high" | "very_high";

interface BuildImpact {
  buildId: string;
  baseline: { rawScore: number; rating: Rating; rank: number };
  preview: { rawScore: number; rating: Rating; rank: number };
  delta: { rawScore: number; ratingChanged: boolean; rankShift: number };
}

interface RatingMigration {
  from: Rating;
  to: Rating;
  count: number;
  buildIds: string[];
}

interface PortfolioStats {
  buildCount: number;
  min: number;
  max: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
  stdDev: number;
}

interface StatsComparison {
  baseline: PortfolioStats;
  preview: PortfolioStats;
  delta: { mean: number; p50: number; p95: number; stdDev: number };
}

export interface WeightImpactPreview {
  buildImpacts: BuildImpact[];
  migrations: RatingMigration[];
  stats: StatsComparison;
  ratingChangedCount: number;
  rankChangedCount: number;
  calculatedAt: string;
}

type ImpactPreviewPanelProps = {
  preview: WeightImpactPreview | null;
  loading?: boolean;
  error?: string | null;
  defaultExpandMigrations?: boolean;
  defaultExpandStats?: boolean;
  defaultExpandBuilds?: boolean;
};

const RATING_LABELS: Record<Rating, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  very_high: "V.HIGH",
};

const RATING_COLORS: Record<Rating, { bg: string; text: string }> = {
  low: { bg: "bg-emerald-100", text: "text-emerald-700" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700" },
  high: { bg: "bg-orange-100", text: "text-orange-700" },
  very_high: { bg: "bg-rose-100", text: "text-rose-700" },
};

function RatingPill({ rating }: { rating: Rating }) {
  const colors = RATING_COLORS[rating];
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      {RATING_LABELS[rating]}
    </span>
  );
}

function MigrationArrow({ from, to }: { from: Rating; to: Rating }) {
  return (
    <div className="flex items-center gap-1">
      <RatingPill rating={from} />
      <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <RatingPill rating={to} />
    </div>
  );
}

function DeltaValue({ value, isGood }: { value: number; isGood?: boolean }) {
  const sign = value >= 0 ? "+" : "";
  const color = value === 0
    ? "text-neutral-500"
    : isGood !== undefined
      ? isGood
        ? "text-emerald-600"
        : "text-rose-600"
      : value > 0
        ? "text-rose-600"
        : "text-emerald-600";

  return (
    <span className={`font-mono ${color}`}>
      {sign}{value.toFixed(1)}
    </span>
  );
}

function StatRow({
  label,
  baseline,
  preview,
  delta,
}: {
  label: string;
  baseline: number;
  preview: number;
  delta: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 text-xs py-0.5">
      <span className="text-neutral-600">{label}</span>
      <span className="font-mono text-neutral-800 text-right">{baseline.toFixed(1)}</span>
      <span className="font-mono text-neutral-800 text-right">{preview.toFixed(1)}</span>
      <span className="text-right">
        <DeltaValue value={delta} />
      </span>
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-xs font-medium text-neutral-600 hover:text-neutral-800"
      >
        <span className="flex items-center gap-1.5">
          <svg
            className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs text-neutral-400">({count})</span>
        )}
      </button>
      {isOpen && <div className="pb-3">{children}</div>}
    </div>
  );
}

export function ImpactPreviewPanel({
  preview,
  loading,
  error,
  defaultExpandMigrations = true,
  defaultExpandStats = true,
  defaultExpandBuilds,
}: ImpactPreviewPanelProps) {
  if (loading) {
    return (
      <div className="p-3 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full" />
          Computing preview...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 text-xs text-rose-600 bg-rose-50 rounded">
        {error}
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="p-3 text-xs text-neutral-400 text-center">
        Adjust weights above to see impact preview
      </div>
    );
  }

  const hasMigrations = preview.migrations.length > 0;
  const hasImpact = preview.ratingChangedCount > 0 || Math.abs(preview.stats.delta.mean) > 0.1;

  return (
    <div className="space-y-3">
      {/* Summary Header */}
      <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
        <div className="text-xs">
          <span className="text-neutral-500">Impact:</span>{" "}
          <span className={`font-medium ${hasImpact ? "text-amber-600" : "text-neutral-600"}`}>
            {preview.buildImpacts.length} builds analyzed
          </span>
        </div>
        {preview.ratingChangedCount > 0 && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
            {preview.ratingChangedCount} rating{preview.ratingChangedCount !== 1 ? "s" : ""} changed
          </span>
        )}
      </div>

      {/* Rating Migrations */}
      {hasMigrations && (
        <CollapsibleSection title="Rating Migrations" count={preview.migrations.length} defaultOpen={defaultExpandMigrations}>
          <div className="space-y-2">
            {preview.migrations.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 bg-neutral-50 rounded">
                <MigrationArrow from={m.from} to={m.to} />
                <span className="text-xs font-medium text-neutral-700">
                  {m.count} build{m.count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Stats Comparison */}
      <CollapsibleSection title="Stats Comparison" defaultOpen={defaultExpandStats}>
        <div className="space-y-0.5">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-neutral-500 pb-1 border-b border-neutral-100">
            <span>Metric</span>
            <span className="text-right">Before</span>
            <span className="text-right">After</span>
            <span className="text-right">Delta</span>
          </div>
          <StatRow
            label="Mean"
            baseline={preview.stats.baseline.mean}
            preview={preview.stats.preview.mean}
            delta={preview.stats.delta.mean}
          />
          <StatRow
            label="P50"
            baseline={preview.stats.baseline.p50}
            preview={preview.stats.preview.p50}
            delta={preview.stats.delta.p50}
          />
          <StatRow
            label="P95"
            baseline={preview.stats.baseline.p95}
            preview={preview.stats.preview.p95}
            delta={preview.stats.delta.p95}
          />
          <StatRow
            label="Std Dev"
            baseline={preview.stats.baseline.stdDev}
            preview={preview.stats.preview.stdDev}
            delta={preview.stats.delta.stdDev}
          />
        </div>
      </CollapsibleSection>

      {/* Per-Build Impact */}
      <CollapsibleSection
        title="Per-Build Impact"
        count={preview.buildImpacts.length}
        defaultOpen={defaultExpandBuilds ?? preview.buildImpacts.length <= 5}
      >
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {preview.buildImpacts.slice(0, 20).map((b) => (
            <div
              key={b.buildId}
              className={`flex items-center justify-between py-1 px-2 rounded text-xs ${
                b.delta.ratingChanged ? "bg-amber-50" : "bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {b.delta.ratingChanged && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                )}
                <span className="truncate text-neutral-700" title={b.buildId}>
                  {b.buildId.slice(0, 24)}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono text-neutral-600">
                  {b.baseline.rawScore.toFixed(1)} → {b.preview.rawScore.toFixed(1)}
                </span>
                <DeltaValue value={b.delta.rawScore} />
                {b.delta.rankShift !== 0 && (
                  <span className={`text-xs ${b.delta.rankShift > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {b.delta.rankShift > 0 ? "▲" : "▼"}{Math.abs(b.delta.rankShift)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {preview.buildImpacts.length > 20 && (
            <div className="text-center text-xs text-neutral-400 py-1">
              +{preview.buildImpacts.length - 20} more builds
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
