/**
 * Validation Orchestrator (benchtop-x0c.11.5)
 *
 * Coordinates structured and semantic validation runs.
 * - Loads validation rules from persistence
 * - Runs both evaluators concurrently where possible
 * - Combines results into BuildValidationStatus
 * - Stores last-check-result for UI display
 */

import { LineBuild, ValidationResult, BuildValidationStatus } from '../model/types';
import { StructuredValidationEvaluator } from '../model/data/structuredValidationEvaluator';
import { SemanticValidationEvaluator } from '../model/data/semanticValidationEvaluator';
import { ValidationRulesPersistence } from '../model/data/rulesPersistence';
import { VertexAIClient } from '../ai/vertex/client';

// ============================================================================
// Cache for Rules (to avoid repeated file reads)
// ============================================================================

interface RulesCache {
  timestamp: string;
  structured: any[];
  semantic: any[];
}

let rulesCache: RulesCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load validation rules from persistence with caching
 */
async function loadValidationRulesWithCache(
  rulesPersistence: ValidationRulesPersistence
): Promise<{ structured: any[]; semantic: any[] }> {
  const now = new Date().toISOString();

  // Check if cache is still valid
  if (
    rulesCache &&
    new Date(now).getTime() - new Date(rulesCache.timestamp).getTime() <
      CACHE_TTL_MS
  ) {
    return {
      structured: rulesCache.structured,
      semantic: rulesCache.semantic,
    };
  }

  // Load rules from persistence
  const allRules = await rulesPersistence.loadAll();

  const structuredRules = allRules.rules.filter(
    (r: any) => r.type === 'structured' && r.enabled
  );
  const semanticRules = allRules.rules.filter(
    (r: any) => r.type === 'semantic' && r.enabled
  );

  // Update cache
  rulesCache = {
    timestamp: now,
    structured: structuredRules,
    semantic: semanticRules,
  };

  return { structured: structuredRules, semantic: semanticRules };
}

/**
 * Clear the rules cache (e.g., after rules are updated)
 */
export function clearRulesCache(): void {
  rulesCache = null;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

export class ValidationOrchestrator {
  private rulesPersistence: ValidationRulesPersistence;
  private aiClient: VertexAIClient;

  constructor(
    rulesPersistence: ValidationRulesPersistence,
    aiClient: VertexAIClient
  ) {
    this.rulesPersistence = rulesPersistence;
    this.aiClient = aiClient;
  }

  /**
   * Run complete validation against a build
   * - Evaluates all enabled structured rules
   * - Evaluates all enabled semantic rules (in parallel where possible)
   * - Combines results into BuildValidationStatus
   * - Stores timestamp of this validation run
   *
   * @param build The LineBuild to validate
   * @returns BuildValidationStatus with combined results
   */
  async runValidation(build: LineBuild): Promise<BuildValidationStatus> {
    const startTime = new Date().toISOString();

    try {
      // Load rules with caching
      const { structured: structuredRules, semantic: semanticRules } =
        await loadValidationRulesWithCache(this.rulesPersistence);

      // Run structured validation (synchronous, no external deps)
      const structuredResults =
        StructuredValidationEvaluator.evaluateBuild(build, structuredRules);

      // Run semantic validation (async, calls Gemini)
      const semanticResults = await SemanticValidationEvaluator.evaluateBuild(
        build,
        semanticRules,
        this.aiClient
      );

      // Combine results
      const allResults = [...structuredResults, ...semanticResults];

      // Calculate summary statistics
      const passCount = allResults.filter((r) => r.pass).length;
      const failCount = allResults.filter((r) => !r.pass).length;

      // Build failures by rule for UI display
      const failuresByRule: Record<string, ValidationResult[]> = {};
      for (const result of allResults) {
        if (!result.pass) {
          if (!failuresByRule[result.ruleId]) {
            failuresByRule[result.ruleId] = [];
          }
          failuresByRule[result.ruleId].push(result);
        }
      }

      const endTime = new Date().toISOString();

      return {
        passCount,
        failCount,
        totalCount: allResults.length,
        isValid: failCount === 0,
        allResults,
        failuresByRule,
        lastCheckedAt: endTime,
        durationMs: new Date(endTime).getTime() - new Date(startTime).getTime(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown validation error';

      return {
        passCount: 0,
        failCount: 0,
        totalCount: 0,
        isValid: false,
        allResults: [],
        failuresByRule: {},
        lastCheckedAt: new Date().toISOString(),
        durationMs: new Date().getTime() - new Date(startTime).getTime(),
        error: errorMessage,
      };
    }
  }

  /**
   * Get summary statistics for a validation result
   * Useful for UI display and logging
   */
  static getSummary(status: BuildValidationStatus): {
    status: 'valid' | 'invalid' | 'error';
    passCount: number;
    failCount: number;
    totalCount: number;
    failuresByRuleCount: number;
    durationMs: number;
    error?: string;
  } {
    if (status.error) {
      return {
        status: 'error',
        passCount: status.passCount ?? 0,
        failCount: status.failCount ?? 0,
        totalCount: status.totalCount ?? 0,
        failuresByRuleCount: Object.keys(status.failuresByRule ?? {}).length,
        durationMs: status.durationMs ?? 0,
        error: status.error,
      };
    }

    return {
      status: status.isValid ? 'valid' : 'invalid',
      passCount: status.passCount ?? 0,
      failCount: status.failCount ?? 0,
      totalCount: status.totalCount ?? 0,
      failuresByRuleCount: Object.keys(status.failuresByRule ?? {}).length,
      durationMs: status.durationMs ?? 0,
    };
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let orchestratorInstance: ValidationOrchestrator | null = null;

/**
 * Get or create the singleton ValidationOrchestrator instance
 * Uses environment variables for configuration
 */
export function getValidationOrchestrator(): ValidationOrchestrator {
  if (!orchestratorInstance) {
    const rulesPersistence = ValidationRulesPersistence.getInstance();
    const aiClient = new VertexAIClient({
      project: process.env.VERTEX_AI_PROJECT || '',
      location: process.env.VERTEX_AI_LOCATION || 'us-central1',
      model: process.env.VERTEX_AI_MODEL || 'gemini-3-flash-preview',
    });

    orchestratorInstance = new ValidationOrchestrator(
      rulesPersistence,
      aiClient
    );
  }

  return orchestratorInstance;
}

/**
 * Create a new ValidationOrchestrator instance for testing
 */
export function createValidationOrchestrator(
  rulesPersistence: ValidationRulesPersistence,
  aiClient: VertexAIClient
): ValidationOrchestrator {
  return new ValidationOrchestrator(rulesPersistence, aiClient);
}
