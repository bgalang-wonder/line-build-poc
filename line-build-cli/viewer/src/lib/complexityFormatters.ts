/**
 * Complexity Score Display Formatters
 *
 * Utilities for formatting complexity scores with normalized scores as primary
 * and raw scores as secondary (on hover/tooltip).
 *
 * Strategy: Stakeholder clarity even over absolute precision
 * - Primary: Normalized score (0-100) - meets user expectations
 * - Secondary: Raw score - preserves absolute meaning for power users
 */

export type Rating = "low" | "medium" | "high" | "very_high";

/**
 * Format normalized score as primary display: "68.5/100"
 *
 * @param score - Normalized score (0-100 scale), or null if unavailable
 * @returns Formatted string like "68.5/100" or "--" if null
 */
export function formatNormalizedScore(score: number | null): string {
  if (score === null) return "--";
  // Cap at 100 for display (edge case: scores can exceed 100 in rare cases)
  const capped = Math.min(score, 100);
  return `${capped.toFixed(1)}/100`;
}

/**
 * Format raw score for tooltip/secondary display: "Raw: 25.3"
 *
 * @param score - Raw absolute complexity score
 * @returns Formatted string like "Raw score: 25.3"
 */
export function formatRawScore(score: number): string {
  return `Raw score: ${score.toFixed(1)}`;
}

/**
 * Get tooltip content showing both raw and normalized scores
 *
 * @param raw - Raw absolute score
 * @param normalized - Normalized score (0-100), or null if unavailable
 * @returns Formatted tooltip text
 */
export function getScoreTooltip(raw: number, normalized: number | null): string {
  if (normalized === null) {
    return `Raw score: ${raw.toFixed(1)} (normalized score not available)`;
  }
  return `Raw score: ${raw.toFixed(1)} | Normalized: ${normalized.toFixed(1)}/100`;
}

/**
 * Format rating label for display: "Low" / "Medium" / "High" / "Very High"
 *
 * @param rating - Rating enum value
 * @returns Capitalized rating label
 */
export function formatRatingLabel(rating: Rating): string {
  const labels: Record<Rating, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    very_high: "Very High"
  };
  return labels[rating];
}

/**
 * Get normalized score range for a rating tier
 *
 * @param rating - Rating enum value
 * @returns Score range string like "0-20" or "75+"
 */
export function getRatingRange(rating: Rating): string {
  const ranges: Record<Rating, string> = {
    low: "0-20",
    medium: "21-45",
    high: "46-75",
    very_high: "75+"
  };
  return ranges[rating];
}

/**
 * Short rating labels for compact display: "LOW" / "MED" / "HIGH" / "V.HIGH"
 *
 * @param rating - Rating enum value
 * @returns Uppercase abbreviated label
 */
export function formatRatingShort(rating: Rating): string {
  const labels: Record<Rating, string> = {
    low: "LOW",
    medium: "MED",
    high: "HIGH",
    very_high: "V.HIGH"
  };
  return labels[rating];
}
