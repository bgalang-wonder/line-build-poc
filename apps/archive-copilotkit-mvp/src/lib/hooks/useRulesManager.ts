/**
 * Hook for managing validation rules
 * Provides CRUD operations and state management for the Rules Manager UI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ValidationRule,
  StructuredValidationRule,
  SemanticValidationRule,
  ActionType,
} from '@/lib/model/types';
import {
  ValidationRulesPersistence,
  getRulesPersistence,
} from '@/lib/model/data/rulesPersistence';
import { clearRulesCache } from '@/lib/validation/orchestrator';

export interface UseRulesManagerResult {
  // State
  rules: ValidationRule[];
  isLoading: boolean;
  error: string | null;

  // CRUD operations
  loadRules: () => Promise<void>;
  createRule: (rule: ValidationRule) => Promise<void>;
  updateRule: (ruleId: string, updates: Partial<ValidationRule>) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  toggleEnabled: (ruleId: string) => Promise<void>;

  // Utilities
  clearError: () => void;
}

/**
 * Hook for managing validation rules with persistence
 */
export function useRulesManager(): UseRulesManagerResult {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get persistence instance
  const persistence = getRulesPersistence();

  /**
   * Load all rules from persistence
   */
  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await persistence.loadAll();
      setRules(result.rules);
    } catch (err) {
      // If file doesn't exist yet, start with empty rules
      if (String(err).includes('File not found') || String(err).includes('ENOENT')) {
        setRules([]);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load rules');
      }
    } finally {
      setIsLoading(false);
    }
  }, [persistence]);

  /**
   * Create a new rule
   */
  const createRule = useCallback(
    async (rule: ValidationRule) => {
      setError(null);

      try {
        await persistence.saveRule(rule);
        clearRulesCache(); // Clear cache so orchestrator picks up new rule
        await loadRules(); // Refresh the list
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create rule');
        throw err;
      }
    },
    [persistence, loadRules]
  );

  /**
   * Update an existing rule
   */
  const updateRule = useCallback(
    async (ruleId: string, updates: Partial<ValidationRule>) => {
      setError(null);

      try {
        await persistence.updateRule(ruleId, updates);
        clearRulesCache();
        await loadRules();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update rule');
        throw err;
      }
    },
    [persistence, loadRules]
  );

  /**
   * Delete a rule
   */
  const deleteRule = useCallback(
    async (ruleId: string) => {
      setError(null);

      try {
        await persistence.deleteRule(ruleId);
        clearRulesCache();
        await loadRules();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete rule');
        throw err;
      }
    },
    [persistence, loadRules]
  );

  /**
   * Toggle a rule's enabled state
   */
  const toggleEnabled = useCallback(
    async (ruleId: string) => {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) {
        setError(`Rule not found: ${ruleId}`);
        return;
      }

      await updateRule(ruleId, { enabled: !rule.enabled });
    },
    [rules, updateRule]
  );

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules,
    isLoading,
    error,
    loadRules,
    createRule,
    updateRule,
    deleteRule,
    toggleEnabled,
    clearError,
  };
}

// ============================================================================
// Helper functions for creating rules
// ============================================================================

/**
 * Generate a unique rule ID
 */
export function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a default structured rule
 */
export function createDefaultStructuredRule(): StructuredValidationRule {
  return {
    id: generateRuleId(),
    type: 'structured',
    name: '',
    description: '',
    enabled: true,
    condition: {
      field: 'tags.action',
      operator: 'in',
      value: ['PREP', 'HEAT', 'TRANSFER', 'ASSEMBLE', 'PORTION', 'PLATE', 'FINISH', 'QUALITY_CHECK'],
    },
    failureMessage: 'Validation failed',
    appliesTo: 'all',
  };
}

/**
 * Create a default semantic rule
 */
export function createDefaultSemanticRule(): SemanticValidationRule {
  return {
    id: generateRuleId(),
    type: 'semantic',
    name: '',
    description: '',
    enabled: true,
    prompt: '',
    guidance: '',
    appliesTo: 'all',
  };
}

/**
 * Available field paths for structured rules
 */
export const STRUCTURED_RULE_FIELDS = [
  { value: 'tags.action', label: 'Action Type' },
  { value: 'tags.target.name', label: 'Target Name' },
  { value: 'tags.target.bomId', label: 'BOM ID' },
  { value: 'tags.equipment', label: 'Equipment' },
  { value: 'tags.time.value', label: 'Time Value' },
  { value: 'tags.time.unit', label: 'Time Unit' },
  { value: 'tags.time.type', label: 'Time Type' },
  { value: 'tags.phase', label: 'Phase' },
  { value: 'tags.station', label: 'Station' },
  { value: 'tags.timingMode', label: 'Timing Mode' },
  { value: 'tags.prepType', label: 'Prep Type' },
  { value: 'tags.storageLocation', label: 'Storage Location' },
  { value: 'tags.requiresOrder', label: 'Requires Order' },
  { value: 'tags.bulkPrep', label: 'Bulk Prep' },
  { value: 'dependsOn', label: 'Dependencies' },
];

/**
 * Available operators for structured rules
 */
export const STRUCTURED_RULE_OPERATORS = [
  { value: 'in', label: 'Is One Of' },
  { value: 'equals', label: 'Equals' },
  { value: 'notEmpty', label: 'Is Not Empty' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
];

/**
 * Action types for the appliesTo field
 */
export const ACTION_TYPES: ActionType[] = [
  'PREP',
  'HEAT',
  'TRANSFER',
  'ASSEMBLE',
  'PORTION',
  'PLATE',
  'FINISH',
  'QUALITY_CHECK',
];
