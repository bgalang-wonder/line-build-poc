/**
 * Rules Management Page (benchtop-x0c.8.1)
 * Manage validation rules (structured and semantic)
 */

'use client';

import React, { useState } from 'react';
import { Plus, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { useRulesManager } from '@/lib/hooks/useRulesManager';
import { ValidationRule } from '@/lib/model/types';
import RulesTable from '@/components/rules/RulesTable';
import RuleEditorModal from '@/components/rules/RuleEditorModal';
import { ToastContainer, ToastProps } from '@/components/ui/Toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function RulesPage() {
  // Rules manager hook
  const {
    rules,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleEnabled,
    clearError,
  } = useRulesManager();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Add a toast notification
  const addToast = (
    type: 'success' | 'error' | 'info',
    title: string,
    message: string
  ) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  // Dismiss a toast
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handle create new rule
  const handleCreate = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  // Handle edit rule
  const handleEdit = (rule: ValidationRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  // Handle save (create or update)
  const handleSave = async (rule: ValidationRule) => {
    try {
      if (editingRule) {
        await updateRule(rule.id, rule);
        addToast('success', 'Rule Updated', `"${rule.name}" has been updated.`);
      } else {
        await createRule(rule);
        addToast('success', 'Rule Created', `"${rule.name}" has been created.`);
      }
      setIsModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      addToast(
        'error',
        'Save Failed',
        err instanceof Error ? err.message : 'Failed to save rule'
      );
      throw err; // Re-throw so modal can show error
    }
  };

  // Handle delete
  const handleDelete = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    try {
      await deleteRule(ruleId);
      addToast(
        'success',
        'Rule Deleted',
        `"${rule?.name || ruleId}" has been deleted.`
      );
    } catch (err) {
      addToast(
        'error',
        'Delete Failed',
        err instanceof Error ? err.message : 'Failed to delete rule'
      );
    }
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    try {
      await toggleEnabled(ruleId);
      const newState = !rule?.enabled;
      addToast(
        'info',
        newState ? 'Rule Enabled' : 'Rule Disabled',
        `"${rule?.name || ruleId}" is now ${newState ? 'enabled' : 'disabled'}.`
      );
    } catch (err) {
      addToast(
        'error',
        'Toggle Failed',
        err instanceof Error ? err.message : 'Failed to toggle rule'
      );
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  // Count stats
  const enabledCount = rules.filter((r) => r.enabled).length;
  const structuredCount = rules.filter((r) => r.type === 'structured').length;
  const semanticCount = rules.filter((r) => r.type === 'semantic').length;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Validation Rules
          </h1>
          <p className="text-neutral-600">
            Define and manage structured and semantic validation rules for line builds.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {/* Total Rules - Neutral styling */}
          <Card variant="bordered" padding="md">
            <p className="text-sm text-neutral-500">Total Rules</p>
            <p className="text-2xl font-semibold text-neutral-900">{rules.length}</p>
          </Card>

          {/* Enabled - Success accent (left border) */}
          <Card variant="bordered" padding="md" className="border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-neutral-500">Enabled</p>
            </div>
            <p className="text-2xl font-semibold text-emerald-600">{enabledCount}</p>
          </Card>

          {/* Structured - Neutral styling */}
          <Card variant="bordered" padding="md">
            <p className="text-sm text-neutral-500">Structured</p>
            <p className="text-2xl font-semibold text-neutral-900">{structuredCount}</p>
          </Card>

          {/* Semantic - Purple accent (AI indicator) */}
          <Card variant="bordered" padding="md" className="border-l-4 border-l-purple-500">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <p className="text-sm text-neutral-500">Semantic</p>
            </div>
            <p className="text-2xl font-semibold text-purple-600">{semanticCount}</p>
          </Card>
        </div>

        {/* Main Card */}
        <Card variant="bordered" padding="none">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">
              All Rules
            </h2>
            <Button onClick={handleCreate} leftIcon={<Plus className="w-4 h-4" />}>
              Create Rule
            </Button>
          </div>

          {/* Table */}
          <RulesTable
            rules={rules}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleEnabled={handleToggleEnabled}
          />
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-sm text-neutral-500">
          <p>
            <strong>Structured rules</strong> use field-based conditions and are evaluated deterministically.
          </p>
          <p className="mt-1">
            <strong>Semantic rules</strong> use AI (Gemini) to evaluate natural language conditions.
          </p>
        </div>
      </div>

      {/* Editor Modal */}
      <RuleEditorModal
        isOpen={isModalOpen}
        rule={editingRule}
        onSave={handleSave}
        onClose={handleCloseModal}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
