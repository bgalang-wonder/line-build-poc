/**
 * Semantic Validation Evaluator (benchtop-x0c.7.2)
 *
 * Evaluates SemanticValidationRules against LineBuild instances using Gemini.
 * Returns ValidationResult objects with reasoning from the AI model.
 *
 * This evaluator:
 * - Sends WorkUnit context and rule prompt to Gemini
 * - Parses structured pass/fail response
 * - Extracts reasoning for validation decisions
 * - Returns ValidationResult with pass, failures[], and reasoning fields
 */

import {
  LineBuild,
  WorkUnit,
  SemanticValidationRule,
  ValidationResult,
} from '../types';
import { VertexAIClient } from '../../ai/vertex/client';

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse Gemini response for validation result
 * Expected response format (either JSON or text):
 * {
 *   "pass": true|false,
 *   "reasoning": "explanation of the decision",
 *   "failures": ["optional array of specific failures"]
 * }
 *
 * @param response The raw text response from Gemini
 * @returns Parsed result or null if parsing fails
 */
function parseGeminiResponse(response: string): {
  pass: boolean;
  reasoning: string;
  failures?: string[];
} | null {
  try {
    // Try to extract JSON from response
    // Look for JSON object in curly braces
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.pass !== 'boolean') {
      return null;
    }

    return {
      pass: parsed.pass,
      reasoning: parsed.reasoning || '',
      failures: Array.isArray(parsed.failures) ? parsed.failures : [],
    };
  } catch {
    return null;
  }
}

/**
 * Build a context string for Gemini from a WorkUnit
 * Includes action, target item, timing, equipment, dependencies
 */
function buildWorkUnitContext(
  workUnit: WorkUnit,
  build: LineBuild
): string {
  const lines = [
    `Work Unit ID: ${workUnit.id}`,
    `Action: ${workUnit.tags.action}`,
    `Target: ${workUnit.tags.target.name}` +
      (workUnit.tags.target.bomId ? ` (${workUnit.tags.target.bomId})` : ''),
  ];

  if (workUnit.tags.equipment) {
    lines.push(`Equipment: ${workUnit.tags.equipment}`);
  }

  if (workUnit.tags.time) {
    const { value, unit, type } = workUnit.tags.time;
    lines.push(`Time: ${value} ${unit} (${type})`);
  }

  if (workUnit.tags.phase) {
    lines.push(`Phase: ${workUnit.tags.phase}`);
  }

  if (workUnit.tags.station) {
    lines.push(`Station: ${workUnit.tags.station}`);
  }

  if (workUnit.tags.timingMode) {
    lines.push(`Timing Mode: ${workUnit.tags.timingMode}`);
  }

  if (workUnit.dependsOn.length > 0) {
    const depNames = workUnit.dependsOn.map(
      (depId) =>
        build.workUnits.find((wu) => wu.id === depId)?.tags.action ||
        depId
    );
    lines.push(`Depends on: ${depNames.join(', ')}`);
  }

  if (workUnit.tags.requiresOrder) {
    lines.push('Requires Order: Yes');
  }

  if (workUnit.tags.bulkPrep) {
    lines.push('Bulk Prep: Yes');
  }

  return lines.join('\n');
}

// ============================================================================
// Main Evaluator
// ============================================================================

export class SemanticValidationEvaluator {
  /**
   * Evaluate a single semantic validation rule against a WorkUnit
   * @param rule The SemanticValidationRule to evaluate
   * @param workUnit The WorkUnit being validated
   * @param build The full LineBuild context
   * @param aiClient The Vertex AI client for Gemini calls
   * @returns ValidationResult with reasoning from Gemini
   */
  static async evaluateRule(
    rule: SemanticValidationRule,
    workUnit: WorkUnit,
    build: LineBuild,
    aiClient: VertexAIClient
  ): Promise<ValidationResult> {
    const timestamp = new Date().toISOString();

    // If rule is disabled, skip it (return pass)
    if (!rule.enabled) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'semantic',
        workUnitId: workUnit.id,
        pass: true,
        failures: [],
        reasoning: 'Rule is disabled',
        timestamp,
      };
    }

    // Check if rule applies to this WorkUnit's action type
    if (rule.appliesTo && rule.appliesTo !== 'all') {
      if (
        !Array.isArray(rule.appliesTo) ||
        !rule.appliesTo.includes(workUnit.tags.action)
      ) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: 'semantic',
          workUnitId: workUnit.id,
          pass: true,
          failures: [],
          reasoning: `Rule does not apply to ${workUnit.tags.action} actions`,
          timestamp,
        };
      }
    }

    try {
      // Build the prompt with WorkUnit context
      const context = buildWorkUnitContext(workUnit, build);

      const systemInstruction =
        rule.guidance ||
        `You are a food production line validation expert. Evaluate the provided work unit against the validation rule.
Respond with JSON: {"pass": true|false, "reasoning": "explanation", "failures": ["specific issue 1", ...]}
Be concise but specific in your reasoning.`;

      const userPrompt = `
Menu Item: ${build.menuItemName}
${context}

Validation Rule: ${rule.name}
${rule.prompt}

Evaluate this work unit against the rule. Return JSON with pass (boolean), reasoning (string), and failures (array of strings).`;

      const response = await aiClient.generateContent(
        userPrompt,
        systemInstruction
      );

      // Parse Gemini response
      const parsed = parseGeminiResponse(response);

      if (!parsed) {
        // If parsing fails, return an error result
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: 'semantic',
          workUnitId: workUnit.id,
          pass: false,
          failures: ['Validation engine error: could not parse AI response'],
          reasoning:
            'The semantic validation engine encountered an error while processing the AI response.',
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'semantic',
        workUnitId: workUnit.id,
        pass: parsed.pass,
        failures: parsed.failures || [],
        reasoning: parsed.reasoning || '',
        timestamp,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'semantic',
        workUnitId: workUnit.id,
        pass: false,
        failures: [
          `Validation error: ${errorMessage}`,
        ],
        reasoning: `The semantic validation engine encountered an error: ${errorMessage}`,
        timestamp,
      };
    }
  }

  /**
   * Evaluate all enabled semantic rules for a build
   * @param build The LineBuild to validate
   * @param rules The semantic validation rules to apply
   * @param aiClient The Vertex AI client for Gemini calls
   * @returns Array of ValidationResult objects with reasoning
   */
  static async evaluateBuild(
    build: LineBuild,
    rules: SemanticValidationRule[],
    aiClient: VertexAIClient
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // For each WorkUnit in the build
    for (const workUnit of build.workUnits) {
      // For each rule
      for (const rule of rules) {
        const result = await this.evaluateRule(rule, workUnit, build, aiClient);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get a summary of semantic validation results
   * @param results The validation results to summarize
   * @returns { passCount, failCount, failuresByWorkUnit, avgReasoningLength }
   */
  static summarizeResults(results: ValidationResult[]): {
    passCount: number;
    failCount: number;
    failuresByWorkUnit: Record<string, ValidationResult[]>;
    avgReasoningLength: number;
  } {
    const failuresByWorkUnit: Record<string, ValidationResult[]> = {};
    let passCount = 0;
    let failCount = 0;
    let totalReasoningLength = 0;

    for (const result of results) {
      if (result.pass) {
        passCount++;
      } else {
        failCount++;
        if (!failuresByWorkUnit[result.workUnitId]) {
          failuresByWorkUnit[result.workUnitId] = [];
        }
        failuresByWorkUnit[result.workUnitId].push(result);
      }

      if (result.reasoning) {
        totalReasoningLength += result.reasoning.length;
      }
    }

    const avgReasoningLength =
      results.length > 0 ? totalReasoningLength / results.length : 0;

    return { passCount, failCount, failuresByWorkUnit, avgReasoningLength };
  }
}
