/**
 * Portfolio normalization for complexity scoring.
 *
 * Normalizes raw scores to a 0-100 scale using portfolio p95.
 * This allows comparing builds across different scoring configs.
 */

import type { BenchTopLineBuild } from "../schema";
import type {
  ScoreReport,
  PortfolioStats,
  PortfolioScoreResult,
} from "./types";
import { scoreBuild, scoreBuildBatch } from "./scoring";
import { loadComplexityConfig } from "./config";

/**
 * Compute statistical metrics for a set of scores.
 */
export function computePortfolioStats(reports: ScoreReport[]): PortfolioStats {
  if (reports.length === 0) {
    return {
      buildCount: 0,
      min: 0,
      max: 0,
      p50: 0,
      p75: 0,
      p95: 0,
      mean: 0,
      stdDev: 0,
    };
  }

  const scores = reports.map((r) => r.rawScore).sort((a, b) => a - b);
  const n = scores.length;

  // Min/Max
  const min = scores[0]!;
  const max = scores[n - 1]!;

  // Mean
  const sum = scores.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  // Standard deviation
  const squaredDiffs = scores.map((s) => Math.pow(s - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Percentiles (linear interpolation)
  const percentile = (p: number): number => {
    const idx = (p / 100) * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return scores[lower]!;
    const frac = idx - lower;
    return scores[lower]! * (1 - frac) + scores[upper]! * frac;
  };

  return {
    buildCount: n,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    p50: Math.round(percentile(50) * 100) / 100,
    p75: Math.round(percentile(75) * 100) / 100,
    p95: Math.round(percentile(95) * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
  };
}

/**
 * Normalize a raw score to 0-100 scale using p95.
 * Scores above p95 are capped at 100.
 */
export function normalizeScore(rawScore: number, stats: PortfolioStats): number {
  if (stats.p95 === 0) return 0;
  const normalized = (rawScore / stats.p95) * 100;
  return Math.round(Math.min(normalized, 100) * 10) / 10;
}

/**
 * Apply normalization to a batch of reports.
 */
export function normalizeReports(
  reports: ScoreReport[],
  stats: PortfolioStats
): ScoreReport[] {
  return reports.map((r) => ({
    ...r,
    normalizedScore: normalizeScore(r.rawScore, stats),
  }));
}

/**
 * Compute percentile-based rating for a score within a portfolio.
 * - LOW: bottom 25% (0-25th percentile)
 * - MEDIUM: 25-50th percentile
 * - HIGH: 50-75th percentile
 * - VERY_HIGH: top 25% (75th+ percentile)
 */
export function computePercentileRating(
  score: number,
  allScores: number[]
): "low" | "medium" | "high" | "very_high" {
  if (allScores.length === 0) return "medium";

  const sorted = [...allScores].sort((a, b) => a - b);
  const n = sorted.length;

  // Find percentile position of this score
  const belowCount = sorted.filter((s) => s < score).length;
  const equalCount = sorted.filter((s) => s === score).length;
  // Use midpoint of equal values for percentile rank
  const percentileRank = ((belowCount + equalCount / 2) / n) * 100;

  if (percentileRank < 25) return "low";
  if (percentileRank < 50) return "medium";
  if (percentileRank < 75) return "high";
  return "very_high";
}

/**
 * Apply percentile-based ratings to a batch of reports.
 */
export function applyPercentileRatings(reports: ScoreReport[]): ScoreReport[] {
  const allScores = reports.map((r) => r.rawScore);
  return reports.map((r) => ({
    ...r,
    rating: computePercentileRating(r.rawScore, allScores),
  }));
}

/**
 * Score and normalize an entire portfolio of builds.
 */
export function scorePortfolio(builds: BenchTopLineBuild[]): PortfolioScoreResult {
  const config = loadComplexityConfig();

  // Score all builds
  const rawReports = scoreBuildBatch(builds, config);

  // Compute portfolio statistics
  const stats = computePortfolioStats(rawReports);

  // Normalize all scores
  const reports = normalizeReports(rawReports, stats);

  // Create ranking (highest complexity first)
  const ranking = reports
    .map((r) => ({
      buildId: r.buildId,
      rawScore: r.rawScore,
      normalizedScore: r.normalizedScore!,
      rating: r.rating,
    }))
    .sort((a, b) => b.rawScore - a.rawScore);

  return {
    reports,
    stats,
    ranking,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Score a single build with portfolio normalization.
 * Uses provided stats or scores all builds to compute stats.
 */
export function scoreBuildNormalized(
  build: BenchTopLineBuild,
  allBuilds: BenchTopLineBuild[]
): ScoreReport {
  const config = loadComplexityConfig();

  // Score all builds to get portfolio stats
  const rawReports = scoreBuildBatch(allBuilds, config);
  const stats = computePortfolioStats(rawReports);

  // Score the target build
  const report = scoreBuild(build, config);

  // Apply normalization
  return {
    ...report,
    normalizedScore: normalizeScore(report.rawScore, stats),
  };
}
