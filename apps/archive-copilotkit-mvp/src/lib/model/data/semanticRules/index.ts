/**
 * Semantic Validation Rules Registry
 *
 * Central export for all semantic validation rules.
 * Each rule uses Gemini to reason about recipe/workflow validity.
 */

import { SemanticValidationRule } from '../../types';
import { COOK_TIME_RULE } from './cookTimeRule';

// ============================================================================
// All Semantic Rules
// ============================================================================

/**
 * Registry of all semantic validation rules
 * Add new rules here as they are created
 */
export const SEMANTIC_RULES: SemanticValidationRule[] = [
  COOK_TIME_RULE,
];

/**
 * Get all enabled semantic rules
 */
export function getEnabledSemanticRules(): SemanticValidationRule[] {
  return SEMANTIC_RULES.filter((rule) => rule.enabled);
}

/**
 * Get a semantic rule by ID
 */
export function getSemanticRuleById(ruleId: string): SemanticValidationRule | undefined {
  return SEMANTIC_RULES.find((rule) => rule.id === ruleId);
}

// ============================================================================
// Re-exports
// ============================================================================

export { COOK_TIME_RULE } from './cookTimeRule';
export {
  evaluateCookTimeRule,
  preValidateEquipment,
  matchEquipmentToCapability,
  KNOWN_EQUIPMENT_CAPABILITIES,
  type KnownEquipment,
} from './cookTimeRule';
