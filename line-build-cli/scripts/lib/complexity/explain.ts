/**
 * Human-readable output formatting for complexity scores.
 */

import type {
  ScoreReport,
  PortfolioScoreResult,
  StepEffort,
  CategoryBreakdown,
  PortfolioStats,
  WeightImpactPreview,
  BuildImpact,
  RatingMigration,
} from "./types";

/**
 * Format a rating with color indicator.
 */
function formatRating(rating: ScoreReport["rating"]): string {
  const indicators: Record<ScoreReport["rating"], string> = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    very_high: "VERY HIGH",
  };
  return indicators[rating];
}

/**
 * Format a score with optional normalization.
 */
function formatScore(raw: number, normalized: number | null): string {
  if (normalized !== null) {
    return `${raw.toFixed(1)} (normalized: ${normalized.toFixed(1)}/100)`;
  }
  return raw.toFixed(1);
}

/**
 * Format category breakdown as lines.
 */
function formatBreakdown(breakdown: CategoryBreakdown): string[] {
  return [
    `  Location:       ${breakdown.location.toFixed(2)}`,
    `  Technique:      ${breakdown.technique.toFixed(2)}`,
    `  Equipment:      ${breakdown.packaging.toFixed(2)}`,
    `  Station Move:   ${breakdown.stationMovement.toFixed(2)}`,
    `  Task Count:     ${breakdown.taskCount.toFixed(2)}`,
    `  Signals:        ${breakdown.structuralSignals.toFixed(2)}`,
  ];
}

/**
 * Format the full score report for human output.
 */
export function formatScoreReport(report: ScoreReport): string[] {
  const lines: string[] = [];

  // Header
  lines.push(`=== Complexity Score: ${report.buildId} ===`);
  lines.push("");

  // Overall score
  lines.push(`Score: ${formatScore(report.rawScore, report.normalizedScore)}`);
  lines.push(`Rating: ${formatRating(report.rating)}`);
  lines.push(`Hot/Cold Ratio: ${(report.hotRatio * 100).toFixed(0)}% hot`);
  lines.push("");

  // Category breakdown
  lines.push("Category Breakdown:");
  lines.push(...formatBreakdown(report.breakdown));
  lines.push("");

  // Structural signals
  lines.push("Structural Signals:");
  lines.push(`  Grouping bounces:    ${report.signals.groupingBounces}`);
  lines.push(`  Station bounces:     ${report.signals.stationBounces}`);
  lines.push(`  Merge points:        ${report.signals.mergePointCount}`);
  lines.push(`  Deep merges (3+):    ${report.signals.deepMergeCount}`);
  lines.push(`  Entry points:        ${report.signals.parallelEntryPoints}`);
  lines.push(`  Short equip steps:   ${report.signals.shortEquipmentSteps}`);
  lines.push(`  Back-to-back equip:  ${report.signals.backToBackEquipment}`);
  lines.push(`  Transfers:           ${report.signals.transferCount}`);
  lines.push(`  Station transitions: ${report.signals.stationTransitions}`);
  lines.push("");

  // Top contributors
  lines.push("Top Contributors:");
  for (const c of report.topContributors) {
    const typeLabel = c.type === "step" ? "step" : "signal";
    lines.push(`  [${typeLabel}] ${c.source}: +${c.contribution.toFixed(2)}`);
  }
  lines.push("");

  // Build summary
  lines.push("Build Summary:");
  lines.push(`  Steps: ${report.features.stepCount}`);
  lines.push(`  Hot side: ${report.features.hotSideStepCount}`);
  lines.push(`  Cold side: ${report.features.coldSideStepCount}`);
  lines.push(`  Expo: ${report.features.expoStepCount}`);
  lines.push(`  Vending: ${report.features.vendingStepCount}`);
  lines.push(`  Unique stations: ${report.features.uniqueStations.join(", ")}`);
  lines.push(`  Unique equipment: ${report.features.uniqueEquipment.join(", ") || "none"}`);
  lines.push("");

  // Metadata
  lines.push(`Calculated: ${report.calculatedAt}`);
  lines.push(`Config version: ${report.configVersion}`);

  return lines;
}

/**
 * Format step-level effort ledger.
 */
export function formatStepLedger(stepEfforts: StepEffort[]): string[] {
  const lines: string[] = [];
  lines.push("=== Step Effort Ledger ===");
  lines.push("");

  // Header
  lines.push(
    "Step ID".padEnd(20) +
    "Location".padStart(10) +
    "Technique".padStart(10) +
    "Equipment".padStart(10) +
    "Action".padStart(10) +
    "Total".padStart(10)
  );
  lines.push("-".repeat(70));

  // Rows
  for (const e of stepEfforts) {
    lines.push(
      e.stepId.padEnd(20) +
      e.locationScore.toFixed(2).padStart(10) +
      e.techniqueScore.toFixed(2).padStart(10) +
      e.equipmentScore.toFixed(2).padStart(10) +
      e.actionFamilyScore.toFixed(2).padStart(10) +
      e.totalEffort.toFixed(2).padStart(10)
    );
  }

  lines.push("-".repeat(70));

  // Total
  const totalEffort = stepEfforts.reduce((sum, e) => sum + e.totalEffort, 0);
  lines.push(
    "TOTAL".padEnd(20) +
    "".padStart(10) +
    "".padStart(10) +
    "".padStart(10) +
    "".padStart(10) +
    totalEffort.toFixed(2).padStart(10)
  );

  return lines;
}

/**
 * Format portfolio statistics.
 */
export function formatPortfolioStats(stats: PortfolioStats): string[] {
  return [
    "Portfolio Statistics:",
    `  Builds: ${stats.buildCount}`,
    `  Min: ${stats.min.toFixed(1)}`,
    `  Max: ${stats.max.toFixed(1)}`,
    `  Mean: ${stats.mean.toFixed(1)}`,
    `  Std Dev: ${stats.stdDev.toFixed(1)}`,
    `  P50 (median): ${stats.p50.toFixed(1)}`,
    `  P75: ${stats.p75.toFixed(1)}`,
    `  P95: ${stats.p95.toFixed(1)}`,
  ];
}

/**
 * Format portfolio ranking table.
 */
export function formatPortfolioRanking(result: PortfolioScoreResult): string[] {
  const lines: string[] = [];
  lines.push("=== Portfolio Complexity Ranking ===");
  lines.push("");

  // Stats
  lines.push(...formatPortfolioStats(result.stats));
  lines.push("");

  // Ranking header
  lines.push(
    "Rank".padEnd(6) +
    "Build ID".padEnd(30) +
    "Raw".padStart(10) +
    "Normalized".padStart(12) +
    "Rating".padStart(12)
  );
  lines.push("-".repeat(70));

  // Rows
  for (let i = 0; i < result.ranking.length; i++) {
    const r = result.ranking[i]!;
    lines.push(
      `#${i + 1}`.padEnd(6) +
      r.buildId.slice(0, 28).padEnd(30) +
      r.rawScore.toFixed(1).padStart(10) +
      r.normalizedScore.toFixed(1).padStart(12) +
      formatRating(r.rating).padStart(12)
    );
  }

  lines.push("");
  lines.push(`Calculated: ${result.calculatedAt}`);

  return lines;
}

/**
 * Format a compact single-line summary for a score report.
 */
export function formatScoreSummary(report: ScoreReport): string {
  const score = report.normalizedScore !== null
    ? `${report.normalizedScore.toFixed(1)}/100`
    : `${report.rawScore.toFixed(1)} raw`;
  return `${report.buildId}: ${score} (${formatRating(report.rating)})`;
}

/**
 * Format a weight impact preview for human output.
 */
export function formatWeightImpactPreview(preview: WeightImpactPreview): string[] {
  const lines: string[] = [];

  // Header
  lines.push("=== Weight Impact Preview ===");
  lines.push("");

  // Summary stats
  lines.push("Summary:");
  lines.push(`  Builds analyzed: ${preview.buildImpacts.length}`);
  lines.push(`  Rating changes: ${preview.ratingChangedCount}`);
  lines.push(`  Rank changes: ${preview.rankChangedCount}`);
  lines.push("");

  // Rating migrations
  if (preview.migrations.length > 0) {
    lines.push("Rating Migrations:");
    for (const m of preview.migrations) {
      lines.push(`  ${formatRating(m.from)} -> ${formatRating(m.to)}: ${m.count} build(s)`);
      if (m.buildIds.length <= 3) {
        lines.push(`    [${m.buildIds.join(", ")}]`);
      } else {
        lines.push(`    [${m.buildIds.slice(0, 3).join(", ")}, ...]`);
      }
    }
    lines.push("");
  } else {
    lines.push("Rating Migrations: None");
    lines.push("");
  }

  // Stats comparison
  lines.push("Portfolio Stats Comparison:");
  lines.push("  Metric".padEnd(15) + "Baseline".padStart(12) + "Preview".padStart(12) + "Delta".padStart(10));
  lines.push("  " + "-".repeat(46));

  const { stats } = preview;
  const formatDelta = (d: number) => (d >= 0 ? `+${d.toFixed(1)}` : d.toFixed(1));

  lines.push(
    "  Mean".padEnd(15) +
    stats.baseline.mean.toFixed(1).padStart(12) +
    stats.preview.mean.toFixed(1).padStart(12) +
    formatDelta(stats.delta.mean).padStart(10)
  );
  lines.push(
    "  P50 (median)".padEnd(15) +
    stats.baseline.p50.toFixed(1).padStart(12) +
    stats.preview.p50.toFixed(1).padStart(12) +
    formatDelta(stats.delta.p50).padStart(10)
  );
  lines.push(
    "  P95".padEnd(15) +
    stats.baseline.p95.toFixed(1).padStart(12) +
    stats.preview.p95.toFixed(1).padStart(12) +
    formatDelta(stats.delta.p95).padStart(10)
  );
  lines.push(
    "  Std Dev".padEnd(15) +
    stats.baseline.stdDev.toFixed(1).padStart(12) +
    stats.preview.stdDev.toFixed(1).padStart(12) +
    formatDelta(stats.delta.stdDev).padStart(10)
  );
  lines.push("");

  // Top impacted builds (top 10 by absolute delta)
  const topImpacts = preview.buildImpacts.slice(0, 10);
  if (topImpacts.length > 0) {
    lines.push("Top Impacted Builds:");
    lines.push(
      "  Build ID".padEnd(30) +
      "Before".padStart(10) +
      "After".padStart(10) +
      "Delta".padStart(10) +
      "Rank Δ".padStart(8)
    );
    lines.push("  " + "-".repeat(65));

    for (const b of topImpacts) {
      const ratingChange = b.delta.ratingChanged ? " *" : "";
      const rankChange = b.delta.rankShift > 0 ? `+${b.delta.rankShift}` :
                        b.delta.rankShift < 0 ? `${b.delta.rankShift}` : "-";
      lines.push(
        `  ${b.buildId.slice(0, 28).padEnd(28)}${ratingChange}` +
        b.baseline.rawScore.toFixed(1).padStart(10) +
        b.preview.rawScore.toFixed(1).padStart(10) +
        formatDelta(b.delta.rawScore).padStart(10) +
        rankChange.padStart(8)
      );
    }

    if (preview.buildImpacts.length > 10) {
      lines.push(`  ... and ${preview.buildImpacts.length - 10} more`);
    }
    lines.push("");
    lines.push("  * = rating changed");
  }

  lines.push("");
  lines.push(`Calculated: ${preview.calculatedAt}`);

  return lines;
}

/**
 * Format a compact preview summary for quick CLI output.
 */
export function formatPreviewSummary(preview: WeightImpactPreview): string {
  const parts: string[] = [];

  parts.push(`${preview.buildImpacts.length} builds`);

  if (preview.ratingChangedCount > 0) {
    parts.push(`${preview.ratingChangedCount} rating changes`);
  }

  const { delta } = preview.stats;
  if (Math.abs(delta.mean) >= 0.1) {
    const sign = delta.mean >= 0 ? "+" : "";
    parts.push(`mean ${sign}${delta.mean.toFixed(1)}`);
  }

  return parts.join(", ");
}
