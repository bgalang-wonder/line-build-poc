/**
 * RuleEditorModal Component
 * Modal dialog for creating and editing validation rules (structured or semantic)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  ValidationRule,
  StructuredValidationRule,
  SemanticValidationRule,
  ActionType,
} from '@/lib/model/types';
import {
  generateRuleId,
  createDefaultStructuredRule,
  createDefaultSemanticRule,
  STRUCTURED_RULE_FIELDS,
  STRUCTURED_RULE_OPERATORS,
  ACTION_TYPES,
} from '@/lib/hooks/useRulesManager';

interface RuleEditorModalProps {
  isOpen: boolean;
  rule: ValidationRule | null; // null = create new, object = edit existing
  onSave: (rule: ValidationRule) => Promise<void>;
  onClose: () => void;
}

type RuleType = 'structured' | 'semantic';

/**
 * Modal for creating/editing validation rules
 */
export default function RuleEditorModal({
  isOpen,
  rule,
  onSave,
  onClose,
}: RuleEditorModalProps) {
  // Step state for creation flow
  const [step, setStep] = useState<'type-select' | 'edit'>('edit');
  const [selectedType, setSelectedType] = useState<RuleType>('structured');

  // Form state
  const [formData, setFormData] = useState<ValidationRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize form when modal opens or rule changes
  useEffect(() => {
    if (isOpen) {
      if (rule) {
        // Editing existing rule
        setFormData(rule);
        setStep('edit');
        setSelectedType(rule.type);
      } else {
        // Creating new rule - show type selector first
        setStep('type-select');
        setFormData(null);
      }
      setValidationError(null);
    }
  }, [isOpen, rule]);

  // Handle type selection
  const handleTypeSelect = (type: RuleType) => {
    setSelectedType(type);
    const newRule =
      type === 'structured'
        ? createDefaultStructuredRule()
        : createDefaultSemanticRule();
    setFormData(newRule);
    setStep('edit');
  };

  // Handle form field changes
  const handleChange = (updates: Partial<ValidationRule>) => {
    if (!formData) return;
    setFormData({ ...formData, ...updates } as ValidationRule);
    setValidationError(null);
  };

  // Validate form before saving
  const validateForm = (): boolean => {
    if (!formData) {
      setValidationError('No rule data');
      return false;
    }

    if (!formData.name.trim()) {
      setValidationError('Rule name is required');
      return false;
    }

    if (formData.type === 'structured') {
      const structured = formData as StructuredValidationRule;
      if (!structured.condition.field) {
        setValidationError('Condition field is required');
        return false;
      }
      if (!structured.failureMessage.trim()) {
        setValidationError('Failure message is required');
        return false;
      }
    }

    if (formData.type === 'semantic') {
      const semantic = formData as SemanticValidationRule;
      if (!semantic.prompt.trim()) {
        setValidationError('Prompt is required for semantic rules');
        return false;
      }
    }

    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm() || !formData) return;

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Failed to save rule'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {rule ? 'Edit Rule' : 'Create New Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'type-select' ? (
            <TypeSelector
              selectedType={selectedType}
              onSelect={handleTypeSelect}
            />
          ) : formData ? (
            formData.type === 'structured' ? (
              <StructuredRuleForm
                rule={formData as StructuredValidationRule}
                onChange={handleChange}
              />
            ) : (
              <SemanticRuleForm
                rule={formData as SemanticValidationRule}
                onChange={handleChange}
              />
            )
          ) : null}

          {/* Validation error */}
          {validationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{validationError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          {step === 'edit' && !rule && (
            <button
              onClick={() => setStep('type-select')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {step === 'edit' && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : rule ? 'Save Changes' : 'Create Rule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Type Selector Component
// ============================================================================

interface TypeSelectorProps {
  selectedType: RuleType;
  onSelect: (type: RuleType) => void;
}

function TypeSelector({ selectedType, onSelect }: TypeSelectorProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Choose the type of validation rule you want to create:
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Structured Rule Option */}
        <button
          onClick={() => onSelect('structured')}
          className={`p-4 border-2 rounded-lg text-left transition-colors ${
            selectedType === 'structured'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
              S
            </span>
            <h3 className="font-semibold text-gray-900">Structured Rule</h3>
          </div>
          <p className="text-sm text-gray-600">
            Field-based validation using conditions like "equals", "in list", or
            "not empty". Fast and deterministic.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Example: "Action must be one of PREP, HEAT, COOK"
          </p>
        </button>

        {/* Semantic Rule Option */}
        <button
          onClick={() => onSelect('semantic')}
          className={`p-4 border-2 rounded-lg text-left transition-colors ${
            selectedType === 'semantic'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
              AI
            </span>
            <h3 className="font-semibold text-gray-900">Semantic Rule</h3>
          </div>
          <p className="text-sm text-gray-600">
            AI-powered validation using natural language prompts. Flexible but
            requires reasoning.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Example: "Check if prep steps logically precede cooking steps"
          </p>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Structured Rule Form
// ============================================================================

interface StructuredRuleFormProps {
  rule: StructuredValidationRule;
  onChange: (updates: Partial<StructuredValidationRule>) => void;
}

function StructuredRuleForm({ rule, onChange }: StructuredRuleFormProps) {
  // Handle condition changes
  const handleConditionChange = (
    updates: Partial<StructuredValidationRule['condition']>
  ) => {
    onChange({
      condition: { ...rule.condition, ...updates },
    });
  };

  // Handle appliesTo changes
  const handleAppliesToChange = (value: string) => {
    if (value === 'all') {
      onChange({ appliesTo: 'all' });
    } else {
      // Parse comma-separated action types
      const actions = value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => ACTION_TYPES.includes(s as ActionType)) as ActionType[];
      onChange({ appliesTo: actions.length > 0 ? actions : 'all' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          Structured Rule
        </span>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rule Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={rule.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="e.g., Valid Action Type"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={rule.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          rows={2}
          placeholder="Optional description of what this rule validates"
        />
      </div>

      {/* Condition */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <h4 className="font-medium text-sm text-gray-900">Condition</h4>

        {/* Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field <span className="text-red-500">*</span>
          </label>
          <select
            value={rule.condition.field}
            onChange={(e) => handleConditionChange({ field: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {STRUCTURED_RULE_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>

        {/* Operator */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operator
          </label>
          <select
            value={rule.condition.operator}
            onChange={(e) =>
              handleConditionChange({
                operator: e.target.value as StructuredValidationRule['condition']['operator'],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {STRUCTURED_RULE_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value - only show for operators that need a value */}
        {rule.condition.operator !== 'notEmpty' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value
            </label>
            {rule.condition.operator === 'in' ? (
              <textarea
                value={
                  Array.isArray(rule.condition.value)
                    ? rule.condition.value.join(', ')
                    : String(rule.condition.value || '')
                }
                onChange={(e) => {
                  const values = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  handleConditionChange({ value: values });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={2}
                placeholder="Comma-separated values, e.g., PREP, HEAT, COOK"
              />
            ) : (
              <input
                type="text"
                value={String(rule.condition.value || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  // Try to parse as number for numeric operators
                  const numVal = parseFloat(val);
                  handleConditionChange({
                    value: isNaN(numVal) ? val : numVal,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Value to compare against"
              />
            )}
          </div>
        )}
      </div>

      {/* Failure Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Failure Message <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={rule.failureMessage}
          onChange={(e) => onChange({ failureMessage: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Message shown when validation fails"
        />
      </div>

      {/* Applies To */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Applies To
        </label>
        <select
          value={rule.appliesTo === 'all' ? 'all' : 'specific'}
          onChange={(e) => {
            if (e.target.value === 'all') {
              onChange({ appliesTo: 'all' });
            } else {
              onChange({ appliesTo: [] });
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="all">All Action Types</option>
          <option value="specific">Specific Action Types</option>
        </select>

        {rule.appliesTo !== 'all' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTION_TYPES.map((action) => {
              const isSelected =
                Array.isArray(rule.appliesTo) && rule.appliesTo.includes(action);
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(rule.appliesTo)
                      ? rule.appliesTo
                      : [];
                    const updated = isSelected
                      ? current.filter((a) => a !== action)
                      : [...current, action];
                    onChange({ appliesTo: updated.length > 0 ? updated : 'all' });
                  }}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {action}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={rule.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300"
        />
        <label htmlFor="enabled" className="text-sm text-gray-700">
          Enabled
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// Semantic Rule Form
// ============================================================================

interface SemanticRuleFormProps {
  rule: SemanticValidationRule;
  onChange: (updates: Partial<SemanticValidationRule>) => void;
}

function SemanticRuleForm({ rule, onChange }: SemanticRuleFormProps) {
  return (
    <div className="space-y-6">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Semantic Rule (AI-Powered)
        </span>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rule Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={rule.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="e.g., Logical Step Order"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={rule.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          rows={2}
          placeholder="Optional description of what this rule validates"
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Validation Prompt <span className="text-red-500">*</span>
        </label>
        <textarea
          value={rule.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
          rows={6}
          placeholder="Describe what the AI should check. E.g., 'Verify that all PREP steps come before HEAT steps in the workflow.'"
        />
        <p className="text-xs text-gray-500 mt-1">
          This prompt will be sent to Gemini to evaluate each work unit.
        </p>
      </div>

      {/* Guidance */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Guidance
        </label>
        <textarea
          value={rule.guidance || ''}
          onChange={(e) => onChange({ guidance: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          rows={3}
          placeholder="Optional context or examples to help the AI make better decisions"
        />
      </div>

      {/* Applies To */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Applies To
        </label>
        <select
          value={rule.appliesTo === 'all' ? 'all' : 'specific'}
          onChange={(e) => {
            if (e.target.value === 'all') {
              onChange({ appliesTo: 'all' });
            } else {
              onChange({ appliesTo: [] });
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="all">All Action Types</option>
          <option value="specific">Specific Action Types</option>
        </select>

        {rule.appliesTo !== 'all' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {ACTION_TYPES.map((action) => {
              const isSelected =
                Array.isArray(rule.appliesTo) && rule.appliesTo.includes(action);
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(rule.appliesTo)
                      ? rule.appliesTo
                      : [];
                    const updated = isSelected
                      ? current.filter((a) => a !== action)
                      : [...current, action];
                    onChange({ appliesTo: updated.length > 0 ? updated : 'all' });
                  }}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {action}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={rule.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300"
        />
        <label htmlFor="enabled" className="text-sm text-gray-700">
          Enabled
        </label>
      </div>
    </div>
  );
}
