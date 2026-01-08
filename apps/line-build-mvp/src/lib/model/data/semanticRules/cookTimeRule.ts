/**
 * Semantic Rule: Unrealistic Cook Times by Equipment (benchtop-x0c.7.3)
 *
 * Flags unrealistic cook times based on equipment type using Gemini reasoning.
 *
 * Behavior:
 * - Only applies to HEAT action types
 * - Validates equipment is from known capabilities list
 * - Uses Gemini to reason about whether cook time is realistic
 * - Returns pass/fail with culinary reasoning
 *
 * Examples of suspicious combinations:
 * - "microwave" + 45 minutes
 * - "fryer" + 2 hours
 * - "turbo" + 90 minutes
 */

import { SemanticValidationRule, WorkUnit, LineBuild, ValidationResult } from '../../types';
import { VertexAIClient } from '../../../ai/vertex/client';

// ============================================================================
// Known Equipment Capabilities
// ============================================================================

/**
 * Equipment capabilities from equipmentProfiles.ts
 * These are the valid equipment types for HEAT actions
 */
export const KNOWN_EQUIPMENT_CAPABILITIES = [
  'waterbath',
  'turbo',
  'fryer',
  'oven',
  'microwave',
  'hot_hold_wells',
  'grill',
  'flat_top',
  'steamer',
  'salamander',
] as const;

export type KnownEquipment = typeof KNOWN_EQUIPMENT_CAPABILITIES[number];

/**
 * Check if equipment string matches a known capability
 * Performs case-insensitive matching with aliases checked first
 */
export function matchEquipmentToCapability(equipment: string): KnownEquipment | null {
  const normalized = equipment.toLowerCase().trim();

  // Direct match first (exact match is highest priority)
  for (const capability of KNOWN_EQUIPMENT_CAPABILITIES) {
    if (normalized === capability) {
      return capability;
    }
  }

  // Common aliases (check before partial match to avoid false matches)
  // e.g., "speed oven" should match "turbo", not "oven"
  const aliases: Record<string, KnownEquipment> = {
    'deep fryer': 'fryer',
    'deep-fryer': 'fryer',
    'convection oven': 'oven',
    'combi oven': 'oven',
    'flat-top': 'flat_top',
    'flat top': 'flat_top',
    'flattop': 'flat_top',
    'griddle': 'flat_top',
    'char grill': 'grill',
    'chargrill': 'grill',
    'gas grill': 'grill',
    'sous vide': 'waterbath',
    'water bath': 'waterbath',
    'turbo chef': 'turbo',
    'turbochef': 'turbo',
    'speed oven': 'turbo',
    'rapid cook': 'turbo',
    'holding cabinet': 'hot_hold_wells',
    'heat lamp': 'hot_hold_wells',
    'warming drawer': 'hot_hold_wells',
  };

  for (const [alias, capability] of Object.entries(aliases)) {
    if (normalized.includes(alias)) {
      return capability;
    }
  }

  // Partial match last (e.g., "Deep fryer, 350F" -> "fryer")
  for (const capability of KNOWN_EQUIPMENT_CAPABILITIES) {
    if (normalized.includes(capability)) {
      return capability;
    }
  }

  return null;
}

// ============================================================================
// Rule Definition
// ============================================================================

/**
 * Semantic rule for validating cook times are realistic for equipment type
 */
export const COOK_TIME_RULE: SemanticValidationRule = {
  id: 'semantic-cook-time-equipment',
  type: 'semantic',
  name: 'Realistic Cook Time by Equipment',
  description: 'Flags unrealistic cook times based on equipment type (e.g., microwave for 45 minutes)',
  enabled: true,
  appliesTo: ['HEAT'],
  prompt: `Evaluate whether this cook time is realistic for the specified equipment.

Consider:
1. What is the typical cooking time range for this equipment type?
2. Is the specified time within a reasonable range, or is it suspiciously long/short?
3. Could there be a valid culinary reason for an unusual time (e.g., low-and-slow cooking)?

Equipment-specific guidance:
- Microwave: Usually 30 seconds to 10 minutes. Over 15 minutes is suspicious.
- Fryer: Usually 2-8 minutes. Over 15 minutes is suspicious.
- Turbo/Speed oven: Usually 1-10 minutes. Over 20 minutes is suspicious.
- Grill/Flat-top: Usually 3-20 minutes. Over 45 minutes is suspicious.
- Oven: Can be 5 minutes to 4+ hours depending on dish. Use culinary judgment.
- Waterbath/Sous vide: Can be 30 minutes to 72+ hours. Long times are often valid.
- Steamer: Usually 5-30 minutes. Over 60 minutes is suspicious.
- Hot hold wells: Holding time, not cooking. Any "cook time" is suspicious.

Return your assessment as JSON with pass (boolean), reasoning (string), and failures (array of strings).`,
  guidance: `You are a professional culinary consultant reviewing kitchen procedures.
Your job is to identify cook times that seem unrealistic or potentially erroneous.
Be practical - flag obvious mistakes but allow for legitimate culinary techniques.
Respond with JSON: {"pass": true|false, "reasoning": "explanation", "failures": ["specific issue 1", ...]}`,
};

// ============================================================================
// Pre-validation (Equipment Check)
// ============================================================================

/**
 * Pre-validate that equipment is from known list before AI evaluation
 * Returns early failure if equipment is unknown
 */
export function preValidateEquipment(
  workUnit: WorkUnit
): { valid: true; equipment: KnownEquipment } | { valid: false; result: ValidationResult } {
  const timestamp = new Date().toISOString();

  // Check if equipment is specified
  if (!workUnit.tags.equipment) {
    return {
      valid: false,
      result: {
        ruleId: COOK_TIME_RULE.id,
        ruleName: COOK_TIME_RULE.name,
        ruleType: 'semantic',
        workUnitId: workUnit.id,
        pass: false,
        failures: ['HEAT action requires equipment to be specified'],
        reasoning: 'Cannot validate cook time without knowing the equipment type. Please specify the equipment used for this heating step.',
        timestamp,
      },
    };
  }

  // Check if equipment matches known capabilities
  const matchedEquipment = matchEquipmentToCapability(workUnit.tags.equipment);

  if (!matchedEquipment) {
    return {
      valid: false,
      result: {
        ruleId: COOK_TIME_RULE.id,
        ruleName: COOK_TIME_RULE.name,
        ruleType: 'semantic',
        workUnitId: workUnit.id,
        pass: false,
        failures: [`Unknown equipment type: "${workUnit.tags.equipment}"`],
        reasoning: `Equipment "${workUnit.tags.equipment}" is not in the known equipment list. Valid options include: ${KNOWN_EQUIPMENT_CAPABILITIES.join(', ')}. Please use a recognized equipment type.`,
        timestamp,
      },
    };
  }

  return { valid: true, equipment: matchedEquipment };
}

// ============================================================================
// Evaluation Function
// ============================================================================

/**
 * Evaluate cook time rule for a work unit
 *
 * @param workUnit The WorkUnit to validate
 * @param build The full LineBuild context
 * @param aiClient The Vertex AI client for Gemini calls
 * @returns ValidationResult with reasoning
 */
export async function evaluateCookTimeRule(
  workUnit: WorkUnit,
  build: LineBuild,
  aiClient: VertexAIClient
): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();

  // Skip non-HEAT actions
  if (workUnit.tags.action !== 'HEAT') {
    return {
      ruleId: COOK_TIME_RULE.id,
      ruleName: COOK_TIME_RULE.name,
      ruleType: 'semantic',
      workUnitId: workUnit.id,
      pass: true,
      failures: [],
      reasoning: 'Rule only applies to HEAT actions',
      timestamp,
    };
  }

  // Pre-validate equipment
  const equipmentCheck = preValidateEquipment(workUnit);
  if (!equipmentCheck.valid) {
    return equipmentCheck.result;
  }

  // Check if time is specified
  if (!workUnit.tags.time) {
    return {
      ruleId: COOK_TIME_RULE.id,
      ruleName: COOK_TIME_RULE.name,
      ruleType: 'semantic',
      workUnitId: workUnit.id,
      pass: false,
      failures: ['HEAT action requires cooking time to be specified'],
      reasoning: 'Cannot validate cook time without a time value. Please specify the cooking duration.',
      timestamp,
    };
  }

  // Build context for Gemini
  const { equipment } = equipmentCheck;
  const { value, unit, type } = workUnit.tags.time;
  const timeInMinutes = unit === 'sec' ? value / 60 : value;

  const context = `
Menu Item: ${build.menuItemName}
Work Unit: ${workUnit.id}
Action: ${workUnit.tags.action}
Target: ${workUnit.tags.target.name}${workUnit.tags.target.bomId ? ` (BOM: ${workUnit.tags.target.bomId})` : ''}
Equipment: ${workUnit.tags.equipment} (normalized: ${equipment})
Cook Time: ${value} ${unit} (${timeInMinutes.toFixed(1)} minutes, ${type} time)
Phase: ${workUnit.tags.phase || 'unspecified'}
Station: ${workUnit.tags.station || 'unspecified'}
`.trim();

  try {
    const response = await aiClient.generateContent(
      `${COOK_TIME_RULE.prompt}\n\nWork Unit Context:\n${context}`,
      COOK_TIME_RULE.guidance || ''
    );

    // Parse Gemini response
    const parsed = parseGeminiResponse(response);

    if (!parsed) {
      return {
        ruleId: COOK_TIME_RULE.id,
        ruleName: COOK_TIME_RULE.name,
        ruleType: 'semantic',
        workUnitId: workUnit.id,
        pass: false,
        failures: ['Validation engine error: could not parse AI response'],
        reasoning: 'The semantic validation engine encountered an error while processing the AI response.',
        timestamp,
      };
    }

    return {
      ruleId: COOK_TIME_RULE.id,
      ruleName: COOK_TIME_RULE.name,
      ruleType: 'semantic',
      workUnitId: workUnit.id,
      pass: parsed.pass,
      failures: parsed.failures || [],
      reasoning: parsed.reasoning || '',
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      ruleId: COOK_TIME_RULE.id,
      ruleName: COOK_TIME_RULE.name,
      ruleType: 'semantic',
      workUnitId: workUnit.id,
      pass: false,
      failures: [`Validation error: ${errorMessage}`],
      reasoning: `The semantic validation engine encountered an error: ${errorMessage}`,
      timestamp,
    };
  }
}

// ============================================================================
// Response Parsing (shared with semanticValidationEvaluator)
// ============================================================================

/**
 * Parse Gemini response for validation result
 */
function parseGeminiResponse(response: string): {
  pass: boolean;
  reasoning: string;
  failures?: string[];
} | null {
  try {
    // Try to extract JSON from response
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

// ============================================================================
// Export
// ============================================================================

export default COOK_TIME_RULE;
