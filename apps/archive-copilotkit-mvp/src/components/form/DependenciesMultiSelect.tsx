'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WorkUnit } from '@/lib/model/types';
import { X, ChevronDown } from 'lucide-react';

interface DependenciesMultiSelectProps {
  currentStepId: string;
  currentDependencies: string[];
  allSteps: WorkUnit[];
  onChange?: (updatedDependencies: string[]) => void;
}

/**
 * DependenciesMultiSelect Component
 *
 * Multi-select dropdown for managing step dependencies (dependsOn array).
 * Features:
 * - Shows all steps except current one
 * - Selected dependencies displayed as removable chips
 * - Searchable autocomplete dropdown
 * - Validation: prevents self-references and circular dependencies
 * - Real-time state updates via onChange callback
 *
 * Acceptance Criteria:
 * ✓ Render multi-select with all other steps (exclude current)
 * ✓ Display selected dependencies as removable chips
 * ✓ Autocomplete dropdown filtering by step ID
 * ✓ Add/remove via dropdown or chip deletion button
 * ✓ Validate no self-references
 * ✓ Validate no circular dependencies
 * ✓ Real-time state updates on change
 * ✓ Show dependency count badge
 */
export default function DependenciesMultiSelect({
  currentStepId,
  currentDependencies,
  allSteps,
  onChange,
}: DependenciesMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter available steps (exclude current step and already selected)
  const availableSteps = allSteps.filter(
    (step) => step.id !== currentStepId && !currentDependencies.includes(step.id)
  );

  // Filter by search query
  const filteredSteps = availableSteps.filter(
    (step) =>
      step.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.tags.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Check for circular dependencies
   * If adding 'targetId' would create a circular dependency, return error message
   */
  const checkCircularDependency = (targetId: string): string | null => {
    // Build a dependency graph to detect cycles
    // If any step that depends on current step also has targetId in its deps, that's a cycle
    // Or if targetId depends on current step

    // Check if targetId depends on currentStepId (direct or indirect)
    const hasDependencyPath = (from: string, to: string, visited = new Set<string>()): boolean => {
      if (from === to) return true;
      if (visited.has(from)) return false;
      visited.add(from);

      const fromStep = allSteps.find((s) => s.id === from);
      if (!fromStep) return false;

      return fromStep.dependsOn.some((depId) => hasDependencyPath(depId, to, visited));
    };

    // If targetId depends on currentStep, adding current -> targetId creates cycle
    if (hasDependencyPath(targetId, currentStepId)) {
      return `Cannot add: ${targetId} depends on ${currentStepId} (would create circular dependency)`;
    }

    return null;
  };

  /**
   * Handle adding a dependency
   */
  const handleAddDependency = (stepId: string) => {
    // Validate: self-reference
    if (stepId === currentStepId) {
      setError('Cannot depend on yourself');
      return;
    }

    // Validate: circular dependency
    const circularError = checkCircularDependency(stepId);
    if (circularError) {
      setError(circularError);
      return;
    }

    // Validate: already selected
    if (currentDependencies.includes(stepId)) {
      setError('Already selected');
      return;
    }

    // Add dependency
    const updatedDependencies = [...currentDependencies, stepId];
    onChange?.(updatedDependencies);
    setError(null);
    setSearchQuery('');
    setIsOpen(false);
  };

  /**
   * Handle removing a dependency
   */
  const handleRemoveDependency = (stepId: string) => {
    const updatedDependencies = currentDependencies.filter((id) => id !== stepId);
    onChange?.(updatedDependencies);
    setError(null);
  };

  /**
   * Get step data for display
   */
  const getStepLabel = (stepId: string) => {
    const step = allSteps.find((s) => s.id === stepId);
    return step ? `${step.id} (${step.tags.action})` : stepId;
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Dependencies <span className="text-gray-500">({currentDependencies.length})</span>
      </label>

      {/* Selected chips */}
      <div className="mb-2 flex flex-wrap gap-2">
        {currentDependencies.map((depId) => (
          <div
            key={depId}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200"
          >
            <span className="text-sm font-medium">{depId}</span>
            <button
              onClick={() => handleRemoveDependency(depId)}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 transition-colors"
              aria-label={`Remove ${depId}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && <div className="mb-2 text-sm text-red-600">{error}</div>}

      {/* Dropdown trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer flex items-center justify-between hover:border-gray-400 transition-colors"
      >
        <span className="text-sm text-gray-500">
          {availableSteps.length === 0 ? 'No available steps' : 'Add dependency...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search steps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Available steps list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredSteps.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchQuery ? 'No matching steps' : 'No available steps'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredSteps.map((step) => (
                  <li key={step.id}>
                    <button
                      onClick={() => handleAddDependency(step.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono text-sm text-gray-900">{step.id}</div>
                        <div className="text-xs text-gray-500">{step.tags.action}</div>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {step.tags.target.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Info text */}
      <p className="text-xs text-gray-500 mt-2">
        Select steps that must complete before this step can run
      </p>
    </div>
  );
}
