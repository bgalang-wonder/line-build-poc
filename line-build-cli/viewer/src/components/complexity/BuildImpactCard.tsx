"use client";

import React from "react";
import { formatNormalizedScore, formatRawScore, getScoreTooltip } from "@/lib/complexityFormatters";
import { InfoTooltip } from "@/components/ui/Tooltip";

type Rating = "low" | "medium" | "high" | "very_high";

type BuildImpactCardProps = {
  buildId: string;
  baseline: { rawScore: number; normalizedScore?: number | null; rating: Rating; rank: number } | null;
  preview: { rawScore: number; normalizedScore?: number | null; rating: Rating; rank: number } | null;
  loading?: boolean;
};

const RATING_LABELS: Record<Rating, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  very_high: "VERY HIGH",
};

const RATING_COLORS: Record<Rating, { bg: string; text: string; border: string }> = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  medium: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  very_high: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

function RatingBadge({ rating, size = "sm" }: { rating: Rating; size?: "sm" | "md" }) {
  const colors = RATING_COLORS[rating];
  const sizeClasses = size === "sm"
    ? "px-1.5 py-0.5 text-xs"
    : "px-2 py-1 text-sm";
  return (
    <span className={`${sizeClasses} rounded font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
      {RATING_LABELS[rating]}
    </span>
  );
}

function DeltaIndicator({ value, showSign = true }: { value: number; showSign?: boolean }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  // For complexity scores, higher = worse, so positive delta is bad
  const color = isZero
    ? "text-neutral-500"
    : isPositive
      ? "text-rose-600"
      : "text-emerald-600";

  const sign = showSign && value > 0 ? "+" : "";

  return (
    <span className={`font-mono font-medium ${color}`}>
      ({sign}{value.toFixed(1)})
    </span>
  );
}

function RankShift({ shift }: { shift: number }) {
  if (shift === 0) {
    return <span className="text-neutral-500 text-xs">(no change)</span>;
  }

  // Positive rank shift means moving UP in rank (better = lower number)
  const isImproved = shift > 0;
  const color = isImproved ? "text-emerald-600" : "text-rose-600";
  const arrow = isImproved ? "▲" : "▼";

  return (
    <span className={`${color} font-medium`}>
      {arrow}{Math.abs(shift)}
    </span>
  );
}

export function BuildImpactCard({ buildId, baseline, preview, loading }: BuildImpactCardProps) {
  if (loading) {
    return (
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div className="flex items-center gap-2 text-neutral-500">
          <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full" />
          <span className="text-sm">Computing impact...</span>
        </div>
      </div>
    );
  }

  if (!baseline || !preview) {
    return (
      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div className="text-xs font-medium text-neutral-500 uppercase mb-2">This Build</div>
        <div className="text-sm text-neutral-400">
          Adjust weights to see impact preview
        </div>
      </div>
    );
  }

  const scoreDelta = preview.rawScore - baseline.rawScore;
  const normalizedDelta = (preview.normalizedScore ?? 0) - (baseline.normalizedScore ?? 0);
  const rankShift = baseline.rank - preview.rank; // Higher rank number is worse, so improvement = baseline - preview
  const ratingChanged = baseline.rating !== preview.rating;

  // Determine card styling based on impact severity
  const hasSignificantImpact = Math.abs(scoreDelta) > 1 || ratingChanged;
  const cardBorder = hasSignificantImpact
    ? ratingChanged
      ? "border-amber-300"
      : "border-primary-200"
    : "border-neutral-200";
  const cardBg = hasSignificantImpact
    ? ratingChanged
      ? "bg-amber-50"
      : "bg-primary-50"
    : "bg-neutral-50";

  return (
    <div className={`p-4 ${cardBg} border ${cardBorder} rounded-lg`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          This Build
        </div>
        {ratingChanged && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Rating Change
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">Score</span>
          <div className="flex items-center gap-2">
            <InfoTooltip content={formatRawScore(baseline.rawScore)}>
              <span className="font-mono text-neutral-800">
                {formatNormalizedScore(baseline.normalizedScore ?? null)}
              </span>
            </InfoTooltip>
            <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <InfoTooltip content={formatRawScore(preview.rawScore)}>
              <span className="font-mono text-neutral-900 font-medium">
                {formatNormalizedScore(preview.normalizedScore ?? null)}
              </span>
            </InfoTooltip>
            <DeltaIndicator value={normalizedDelta} />
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">Rating</span>
          <div className="flex items-center gap-2">
            <RatingBadge rating={baseline.rating} />
            <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <RatingBadge rating={preview.rating} />
          </div>
        </div>

        {/* Rank */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">Rank</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-neutral-800">
              #{baseline.rank}
            </span>
            <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-mono text-neutral-900 font-medium">
              #{preview.rank}
            </span>
            <RankShift shift={rankShift} />
          </div>
        </div>
      </div>
    </div>
  );
}
