/**
 * Complexity Scoring System (CSMS) - Public API
 *
 * This module provides build complexity scoring with:
 * - Config-driven weights (no hardcoded values in scoring logic)
 * - Separation of feature extraction and scoring
 * - Full explainability (every score has derivation trail)
 * - Hot/cold work separation
 * - Structural signal detection (bouncing, merges, etc.)
 * - Portfolio normalization
 *
 * Usage:
 *   import { scoreBuild, scorePortfolio, loadComplexityConfig } from "./complexity";
 *
 *   const report = scoreBuild(build);
 *   console.log(report.rating, report.rawScore);
 */

// Config
export {
  loadComplexityConfig,
  saveComplexityConfig,
  resetComplexityConfig,
  hasJsonConfigOverride,
  getJsonConfigPath,
  clearConfigCache,
  ComplexityConfigSchema,
} from "./config";

// Types (re-export all)
export type {
  StepFeatures,
  BuildFeatures,
  StructuralSignals,
  SignalDetail,
  StepEffort,
  CategoryBreakdown,
  TopContributor,
  ScoreReport,
  PortfolioStats,
  PortfolioScoreResult,
  ScoreReceipt,
  PortfolioReceipt,
  Rating,
  BuildImpact,
  RatingMigration,
  StatsComparison,
  WeightImpactPreview,
} from "./types";

// Config types
export type {
  ComplexityConfig,
  SignalName,
  TechniqueWeights,
  LocationWeights,
  EquipmentWeights,
  RatingThresholds,
  CategoryMultipliers,
} from "../../../config/complexity.config";

// Config helpers
export {
  DEFAULT_COMPLEXITY_CONFIG,
  getTechniqueWeight,
  getLocationWeight,
  getEquipmentWeight,
  getSignalWeight,
  getActionFamilyWeight,
  getComplexityRating,
} from "../../../config/complexity.config";

// Mapping utilities
export {
  canonicalizeTechnique,
  canonicalizeLocation,
  isHotSide,
  isColdSide,
  isExpoSide,
  isVendingSide,
} from "./mapping";

// Feature extraction
export {
  extractStepFeatures,
  extractBuildFeatures,
  computeHotColdRatio,
} from "./features";

// Structural signals
export {
  countGroupingBounces,
  countStationBounces,
  countMergePoints,
  countDeepMerges,
  countParallelEntryPoints,
  countShortEquipmentSteps,
  countBackToBackEquipment,
  countTransfers,
  countStationTransitions,
  extractStructuralSignals,
  scoreStructuralSignals,
} from "./signals";

// Scoring engine
export {
  scoreStep,
  scoreBuild,
  scoreBuildBatch,
} from "./scoring";

// Normalization
export {
  computePortfolioStats,
  normalizeScore,
  normalizeReports,
  scorePortfolio,
  scoreBuildNormalized,
  computePercentileRating,
  applyPercentileRatings,
} from "./normalize";

// Explanation/formatting
export {
  formatScoreReport,
  formatStepLedger,
  formatPortfolioStats,
  formatPortfolioRanking,
  formatScoreSummary,
  formatWeightImpactPreview,
  formatPreviewSummary,
} from "./explain";

// Preview
export {
  computeWeightImpactPreview,
  computeWeightImpactPreviewWithCache,
  prepareBaselineCache,
} from "./preview";
