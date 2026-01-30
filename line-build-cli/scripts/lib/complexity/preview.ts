/**
 * Weight Impact Preview for Complexity Scoring.
 *
 * Computes the portfolio-wide impact of weight changes without persisting.
 * Used by both the viewer UI and CLI for "what-if" analysis.
 */

import type { BenchTopLineBuild } from "../schema";
import type { ComplexityConfig } from "../../../config/complexity.config";
import type {
  ScoreReport,
  PortfolioStats,
  Rating,
  BuildImpact,
  RatingMigration,
  StatsComparison,
  WeightImpactPreview,
} from "./types";
import { scoreBuildBatch } from "./scoring";
import { computePortfolioStats, computePercentileRating } from "./normalize";
import { loadComplexityConfig } from "./config";

/**
 * Compute ranking for a set of score reports.
 * Returns array sorted by rawScore descending (highest complexity = rank 1).
 */
function computeRanking(reports: ScoreReport[]): Array<{ buildId: string; rank: number }> {
  const sorted = [...reports].sort((a, b) => b.rawScore - a.rawScore);
  return sorted.map((r, idx) => ({ buildId: r.buildId, rank: idx + 1 }));
}

/**
 * Compute rating migrations between baseline and preview.
 * Uses percentile-based ratings within each portfolio.
 */
function computeMigrations(
  baselineReports: ScoreReport[],
  previewReports: ScoreReport[]
): RatingMigration[] {
  const migrations = new Map<string, { buildIds: string[] }>();

  // Compute percentile-based ratings for each portfolio
  const baselineScores = baselineReports.map((r) => r.rawScore);
  const previewScores = previewReports.map((r) => r.rawScore);

  for (const baseline of baselineReports) {
    const preview = previewReports.find((p) => p.buildId === baseline.buildId);
    if (!preview) continue;

    // Compute ratings using percentiles within each portfolio
    const baselineRating = computePercentileRating(baseline.rawScore, baselineScores);
    const previewRating = computePercentileRating(preview.rawScore, previewScores);

    if (baselineRating !== previewRating) {
      const key = `${baselineRating}:${previewRating}`;
      const existing = migrations.get(key);
      if (existing) {
        existing.buildIds.push(baseline.buildId);
      } else {
        migrations.set(key, { buildIds: [baseline.buildId] });
      }
    }
  }

  // Convert to array
  const result: RatingMigration[] = [];
  migrations.forEach(({ buildIds }, key) => {
    const [from, to] = key.split(":") as [Rating, Rating];
    result.push({
      from,
      to,
      count: buildIds.length,
      buildIds,
    });
  });

  // Sort by count descending
  return result.sort((a, b) => b.count - a.count);
}

/**
 * Compute stats comparison between baseline and preview.
 */
function computeStatsComparison(
  baselineStats: PortfolioStats,
  previewStats: PortfolioStats
): StatsComparison {
  return {
    baseline: baselineStats,
    preview: previewStats,
    delta: {
      mean: Math.round((previewStats.mean - baselineStats.mean) * 100) / 100,
      p50: Math.round((previewStats.p50 - baselineStats.p50) * 100) / 100,
      p95: Math.round((previewStats.p95 - baselineStats.p95) * 100) / 100,
      stdDev: Math.round((previewStats.stdDev - baselineStats.stdDev) * 100) / 100,
    },
  };
}

/**
 * Compute per-build impact details.
 * Uses percentile-based ratings within each portfolio.
 */
function computeBuildImpacts(
  baselineReports: ScoreReport[],
  previewReports: ScoreReport[],
  baselineRanking: Array<{ buildId: string; rank: number }>,
  previewRanking: Array<{ buildId: string; rank: number }>
): BuildImpact[] {
  const impacts: BuildImpact[] = [];

  // Compute percentile-based ratings for each portfolio
  const baselineScores = baselineReports.map((r) => r.rawScore);
  const previewScores = previewReports.map((r) => r.rawScore);

  for (const baseline of baselineReports) {
    const preview = previewReports.find((p) => p.buildId === baseline.buildId);
    if (!preview) continue;

    const baselineRank = baselineRanking.find((r) => r.buildId === baseline.buildId)?.rank ?? 0;
    const previewRank = previewRanking.find((r) => r.buildId === baseline.buildId)?.rank ?? 0;

    // Compute ratings using percentiles within each portfolio
    const baselineRating = computePercentileRating(baseline.rawScore, baselineScores);
    const previewRating = computePercentileRating(preview.rawScore, previewScores);

    impacts.push({
      buildId: baseline.buildId,
      baseline: {
        rawScore: baseline.rawScore,
        rating: baselineRating,
        rank: baselineRank,
      },
      preview: {
        rawScore: preview.rawScore,
        rating: previewRating,
        rank: previewRank,
      },
      delta: {
        rawScore: Math.round((preview.rawScore - baseline.rawScore) * 100) / 100,
        ratingChanged: baselineRating !== previewRating,
        rankShift: baselineRank - previewRank, // Positive = moved up, negative = moved down
      },
    });
  }

  // Sort by absolute score delta descending
  return impacts.sort((a, b) => Math.abs(b.delta.rawScore) - Math.abs(a.delta.rawScore));
}

/**
 * Compute complete weight impact preview.
 *
 * @param builds - All builds in the portfolio
 * @param previewConfig - The proposed complexity config to test
 * @param baselineConfig - The baseline config (defaults to current loaded config)
 * @returns WeightImpactPreview with all impact metrics
 */
export function computeWeightImpactPreview(
  builds: BenchTopLineBuild[],
  previewConfig: ComplexityConfig,
  baselineConfig?: ComplexityConfig
): WeightImpactPreview {
  const baseline = baselineConfig ?? loadComplexityConfig();

  // Score all builds with both configs
  const baselineReports = scoreBuildBatch(builds, baseline);
  const previewReports = scoreBuildBatch(builds, previewConfig);

  // Compute portfolio stats
  const baselineStats = computePortfolioStats(baselineReports);
  const previewStats = computePortfolioStats(previewReports);

  // Compute rankings
  const baselineRanking = computeRanking(baselineReports);
  const previewRanking = computeRanking(previewReports);

  // Compute migrations (using percentile-based ratings)
  const migrations = computeMigrations(baselineReports, previewReports);

  // Compute stats comparison
  const stats = computeStatsComparison(baselineStats, previewStats);

  // Compute per-build impacts (using percentile-based ratings)
  const buildImpacts = computeBuildImpacts(
    baselineReports,
    previewReports,
    baselineRanking,
    previewRanking
  );

  // Compute summary counts
  const ratingChangedCount = buildImpacts.filter((b) => b.delta.ratingChanged).length;
  const rankChangedCount = buildImpacts.filter((b) => b.delta.rankShift !== 0).length;

  return {
    buildImpacts,
    migrations,
    stats,
    ratingChangedCount,
    rankChangedCount,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Compute weight impact preview using cached baseline scores.
 * More efficient when making multiple preview calculations with the same baseline.
 *
 * @param builds - All builds in the portfolio
 * @param previewConfig - The proposed complexity config to test
 * @param cachedBaseline - Pre-computed baseline reports and stats
 * @returns WeightImpactPreview with all impact metrics
 */
export function computeWeightImpactPreviewWithCache(
  builds: BenchTopLineBuild[],
  previewConfig: ComplexityConfig,
  cachedBaseline: {
    reports: ScoreReport[];
    stats: PortfolioStats;
    ranking: Array<{ buildId: string; rank: number }>;
  }
): WeightImpactPreview {
  // Score all builds with preview config
  const previewReports = scoreBuildBatch(builds, previewConfig);
  const previewStats = computePortfolioStats(previewReports);
  const previewRanking = computeRanking(previewReports);

  // Compute migrations (using percentile-based ratings)
  const migrations = computeMigrations(cachedBaseline.reports, previewReports);

  // Compute stats comparison
  const stats = computeStatsComparison(cachedBaseline.stats, previewStats);

  // Compute per-build impacts (using percentile-based ratings)
  const buildImpacts = computeBuildImpacts(
    cachedBaseline.reports,
    previewReports,
    cachedBaseline.ranking,
    previewRanking
  );

  // Compute summary counts
  const ratingChangedCount = buildImpacts.filter((b) => b.delta.ratingChanged).length;
  const rankChangedCount = buildImpacts.filter((b) => b.delta.rankShift !== 0).length;

  return {
    buildImpacts,
    migrations,
    stats,
    ratingChangedCount,
    rankChangedCount,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Prepare baseline cache for efficient preview calculations.
 */
export function prepareBaselineCache(
  builds: BenchTopLineBuild[],
  config?: ComplexityConfig
): {
  reports: ScoreReport[];
  stats: PortfolioStats;
  ranking: Array<{ buildId: string; rank: number }>;
} {
  const cfg = config ?? loadComplexityConfig();
  const reports = scoreBuildBatch(builds, cfg);
  const stats = computePortfolioStats(reports);
  const ranking = computeRanking(reports);

  return { reports, stats, ranking };
}
