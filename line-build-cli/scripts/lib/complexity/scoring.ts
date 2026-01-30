/**
 * Complexity scoring engine.
 *
 * Combines feature extraction and structural signals with config weights
 * to produce a comprehensive complexity score report.
 */

import type { BenchTopLineBuild } from "../schema";
import type {
  StepFeatures,
  BuildFeatures,
  StructuralSignals,
  StepEffort,
  CategoryBreakdown,
  TopContributor,
  ScoreReport,
} from "./types";
import type { ComplexityConfig } from "../../../config/complexity.config";
import {
  getTechniqueWeight,
  getLocationWeight,
  getEquipmentWeight,
  getActionFamilyWeight,
  getComplexityRating,
} from "../../../config/complexity.config";
import { loadComplexityConfig } from "./config";
import { extractBuildFeatures, computeHotColdRatio } from "./features";
import { extractStructuralSignals, scoreStructuralSignals } from "./signals";

/**
 * Score a single step.
 */
export function scoreStep(
  features: StepFeatures,
  config: ComplexityConfig
): StepEffort {
  const explanation: string[] = [];

  // Location score
  const locationWeight = getLocationWeight(config, features.stationSide);
  const locationScore = locationWeight;
  explanation.push(`location(${features.stationSide}): ${locationScore.toFixed(2)}`);

  // Technique score
  const techniqueWeight = getTechniqueWeight(config, features.techniqueId);
  const techniqueScore = techniqueWeight;
  if (features.techniqueId) {
    explanation.push(`technique(${features.techniqueId}): ${techniqueScore.toFixed(2)}`);
  }

  // Equipment score
  const equipmentWeight = getEquipmentWeight(config, features.equipmentId);
  const equipmentScore = equipmentWeight;
  if (features.equipmentId) {
    explanation.push(`equipment(${features.equipmentId}): ${equipmentScore.toFixed(2)}`);
  }

  // Action family base score
  const actionFamilyWeight = getActionFamilyWeight(config, features.actionFamily);
  const actionFamilyScore = actionFamilyWeight;
  explanation.push(`actionFamily(${features.actionFamily}): ${actionFamilyScore.toFixed(2)}`);

  // Total effort = sum of all components
  const totalEffort = locationScore + techniqueScore + equipmentScore + actionFamilyScore;
  explanation.push(`total: ${totalEffort.toFixed(2)}`);

  return {
    stepId: features.stepId,
    locationScore,
    techniqueScore,
    equipmentScore,
    actionFamilyScore,
    totalEffort,
    explanation,
  };
}

/**
 * Compute category breakdown from step efforts and signals.
 */
function computeCategoryBreakdown(
  stepEfforts: StepEffort[],
  signals: StructuralSignals,
  features: BuildFeatures,
  config: ComplexityConfig
): CategoryBreakdown {
  // Sum step-level scores by category
  let locationTotal = 0;
  let techniqueTotal = 0;
  let equipmentTotal = 0;

  for (const effort of stepEfforts) {
    locationTotal += effort.locationScore;
    techniqueTotal += effort.techniqueScore;
    equipmentTotal += effort.equipmentScore;
  }

  // Apply category multipliers
  const location = locationTotal * config.categoryMultipliers.location;
  const technique = techniqueTotal * config.categoryMultipliers.technique;
  const packaging = equipmentTotal * config.categoryMultipliers.packaging;

  // Station movement = transitions * multiplier
  const stationMovement =
    signals.stationTransitions * config.categoryMultipliers.stationMovement;

  // Task count = step count * multiplier
  const taskCount = features.stepCount * config.categoryMultipliers.taskCount;

  // Structural signals score
  const structuralSignals = scoreStructuralSignals(signals);

  return {
    location,
    technique,
    equipment: packaging, // Using packaging category for equipment score
    packaging,
    stationMovement,
    taskCount,
    structuralSignals,
  };
}

/**
 * Identify top contributors to complexity.
 */
function findTopContributors(
  stepEfforts: StepEffort[],
  signals: StructuralSignals,
  config: ComplexityConfig,
  limit: number = 5
): TopContributor[] {
  const contributors: TopContributor[] = [];

  // Add step contributions
  for (const effort of stepEfforts) {
    contributors.push({
      source: effort.stepId,
      type: "step",
      contribution: effort.totalEffort,
      explanation: effort.explanation.join(", "),
    });
  }

  // Add signal contributions
  if (signals.groupingBounces > 0) {
    contributors.push({
      source: "groupingBounces",
      type: "signal",
      contribution: signals.groupingBounces * config.signals.groupingBounces,
      explanation: `${signals.groupingBounces} grouping bounce(s) x ${config.signals.groupingBounces}`,
    });
  }

  if (signals.stationBounces > 0) {
    contributors.push({
      source: "stationBounces",
      type: "signal",
      contribution: signals.stationBounces * config.signals.stationBounces,
      explanation: `${signals.stationBounces} station bounce(s) x ${config.signals.stationBounces}`,
    });
  }

  if (signals.mergePointCount > 0) {
    contributors.push({
      source: "mergePoints",
      type: "signal",
      contribution: signals.mergePointCount * config.signals.mergePointCount,
      explanation: `${signals.mergePointCount} merge point(s) x ${config.signals.mergePointCount}`,
    });
  }

  if (signals.deepMergeCount > 0) {
    contributors.push({
      source: "deepMerges",
      type: "signal",
      contribution: signals.deepMergeCount * config.signals.deepMergeCount,
      explanation: `${signals.deepMergeCount} deep merge(s) x ${config.signals.deepMergeCount}`,
    });
  }

  if (signals.transferCount > 0) {
    contributors.push({
      source: "transfers",
      type: "signal",
      contribution: signals.transferCount * config.signals.transferCount,
      explanation: `${signals.transferCount} transfer(s) x ${config.signals.transferCount}`,
    });
  }

  // Sort by contribution and take top N
  return contributors
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit);
}

/**
 * Score a complete build.
 *
 * This is the main entry point for complexity scoring.
 */
export function scoreBuild(
  build: BenchTopLineBuild,
  config?: ComplexityConfig
): ScoreReport {
  const cfg = config ?? loadComplexityConfig();

  // Extract features
  const features = extractBuildFeatures(build);

  // Extract structural signals
  const signals = extractStructuralSignals(build);

  // Score each step
  const stepEfforts = features.stepFeatures.map((sf) => scoreStep(sf, cfg));

  // Compute category breakdown
  const breakdown = computeCategoryBreakdown(stepEfforts, signals, features, cfg);

  // Compute raw score (sum of all categories)
  const rawScore =
    breakdown.location +
    breakdown.technique +
    breakdown.packaging +
    breakdown.stationMovement +
    breakdown.taskCount +
    breakdown.structuralSignals;

  // Get rating
  const rating = getComplexityRating(cfg, rawScore);

  // Compute hot/cold ratio
  const hotRatio = computeHotColdRatio(features);

  // Find top contributors
  const topContributors = findTopContributors(stepEfforts, signals, cfg);

  return {
    buildId: build.id,
    rawScore: Math.round(rawScore * 100) / 100,
    normalizedScore: null, // Set by portfolio scoring
    rating,
    hotRatio: Math.round(hotRatio * 100) / 100,
    breakdown,
    topContributors,
    signals,
    features,
    stepEfforts,
    calculatedAt: new Date().toISOString(),
    configVersion: cfg.version,
  };
}

/**
 * Score multiple builds (for portfolio analysis).
 * Does not normalize scores - use scorePortfolio for that.
 */
export function scoreBuildBatch(
  builds: BenchTopLineBuild[],
  config?: ComplexityConfig
): ScoreReport[] {
  const cfg = config ?? loadComplexityConfig();
  return builds.map((b) => scoreBuild(b, cfg));
}
