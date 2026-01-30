/**
 * RulesTable Component
 * Table view of all validation rules with enable/disable toggle and actions
 */

'use client';

import React, { useState } from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { ValidationRule } from '@/lib/model/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';

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
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <ModalBody>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-neutral-900">Delete Rule</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Are you sure you want to delete &quot;{ruleName}&quot;? This action cannot be undone.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete
        </Button>
      </ModalFooter>
    </Modal>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
          <p className="text-sm text-neutral-500">Loading rules...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-neutral-500 mb-2">No validation rules yet</p>
          <p className="text-sm text-neutral-400">
            Create your first rule to start validating line builds
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow noHover>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Applies To</TableHead>
          <TableHead className="text-center">Enabled</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onEdit={() => onEdit(rule)}
            onDelete={() => onDelete(rule.id)}
            onToggleEnabled={() => onToggleEnabled(rule.id)}
          />
        ))}
      </TableBody>
    </Table>
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
    <TableRow className={isDeleting ? 'opacity-50' : ''}>
      {/* Name */}
      <TableCell>
        <div>
          <p className="text-sm font-medium text-neutral-900">{rule.name}</p>
          {rule.description && (
            <p className="text-xs text-neutral-500 mt-1 truncate max-w-xs">
              {rule.description}
            </p>
          )}
        </div>
      </TableCell>

      {/* Type Badge */}
      <TableCell>
        {rule.type === 'structured' ? (
          <Badge variant="success">Structured</Badge>
        ) : (
          <Badge className="bg-purple-50 text-purple-700 border-purple-200">Semantic</Badge>
        )}
      </TableCell>

      {/* Applies To */}
      <TableCell>
        <span className="text-sm text-neutral-600">{appliesToDisplay}</span>
      </TableCell>

      {/* Enabled Toggle - Keep existing toggle switch (it's good) */}
      <TableCell className="text-center">
        <button
          onClick={onToggleEnabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            rule.enabled ? 'bg-indigo-600' : 'bg-neutral-200'
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
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            title="Edit rule"
            className="p-2"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            title="Delete rule"
            className="p-2 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        ruleName={rule.name}
        isOpen={showDeleteModal}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </TableRow>
  );
}
