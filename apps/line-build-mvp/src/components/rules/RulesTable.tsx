/**
 * RulesTable Component
 * Table view of all validation rules with enable/disable toggle and actions
 */

'use client';

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ValidationRule } from '@/lib/model/types';

interface RulesTableProps {
  rules: ValidationRule[];
  isLoading: boolean;
  onEdit: (rule: ValidationRule) => void;
  onDelete: (ruleId: string) => void;
  onToggleEnabled: (ruleId: string) => void;
}

/**
 * Table displaying all validation rules
 */
export default function RulesTable({
  rules,
  isLoading,
  onEdit,
  onDelete,
  onToggleEnabled,
}: RulesTableProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading rules...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-gray-500 mb-2">No validation rules yet</p>
          <p className="text-sm text-gray-400">
            Create your first rule to start validating line builds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Applies To
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Enabled
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onEdit={() => onEdit(rule)}
              onDelete={() => onDelete(rule.id)}
              onToggleEnabled={() => onToggleEnabled(rule.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// RuleRow Component
// ============================================================================

interface RuleRowProps {
  rule: ValidationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}

function RuleRow({ rule, onEdit, onDelete, onToggleEnabled }: RuleRowProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${rule.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  // Format appliesTo display
  const appliesToDisplay =
    rule.appliesTo === 'all'
      ? 'All'
      : Array.isArray(rule.appliesTo)
        ? rule.appliesTo.length > 2
          ? `${rule.appliesTo.slice(0, 2).join(', ')} +${rule.appliesTo.length - 2}`
          : rule.appliesTo.join(', ')
        : 'All';

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
      {/* Name */}
      <td className="px-6 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{rule.name}</p>
          {rule.description && (
            <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
              {rule.description}
            </p>
          )}
        </div>
      </td>

      {/* Type Badge */}
      <td className="px-6 py-4">
        {rule.type === 'structured' ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Structured
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Semantic
          </span>
        )}
      </td>

      {/* Applies To */}
      <td className="px-6 py-4">
        <span className="text-sm text-gray-600">{appliesToDisplay}</span>
      </td>

      {/* Enabled Toggle */}
      <td className="px-6 py-4 text-center">
        <button
          onClick={onToggleEnabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            rule.enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={rule.enabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              rule.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Edit rule"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Delete rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
