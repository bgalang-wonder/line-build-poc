/**
 * RulesTable Component
 * Table view of all validation rules with enable/disable toggle and actions
 */

'use client';

import React, { useState } from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { ValidationRule } from '@/lib/model/types';

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteConfirmModalProps {
  ruleName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ ruleName, isOpen, onConfirm, onCancel }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Delete Rule</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete &quot;{ruleName}&quot;? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  // Format appliesTo display - handle empty arrays as 'All'
  const appliesToDisplay =
    rule.appliesTo === 'all'
      ? 'All'
      : Array.isArray(rule.appliesTo) && rule.appliesTo.length > 0
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
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Delete rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        ruleName={rule.name}
        isOpen={showDeleteModal}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </tr>
  );
}
