'use client';

import React, { useState } from 'react';

export interface CardOption {
  id: string;
  label: string;
  value: string;
  description?: string;
}

interface InlineCardProps {
  id: string;
  title: string;
  description?: string;
  options: CardOption[];
  mode?: 'single' | 'multi';
  onSubmit?: (selectedIds: string[]) => void;
  isLoading?: boolean;
}

/**
 * InlineCard Component
 *
 * Interactive card component displayed within chat with selectable options.
 * Features:
 * - Title and optional description
 * - Option list with clickable buttons
 * - Single-select or multi-select modes
 * - Visual highlighting for selected options
 * - Responsive design for mobile
 * - Submit action callback on selection
 *
 * Acceptance Criteria:
 * ✓ Render card component in chat with title + option list
 * ✓ Each option is clickable
 * ✓ Selected option is highlighted
 * ✓ Click triggers card submit action
 * ✓ Cards are responsive on mobile
 * ✓ Support multi-select and single-select modes
 */
export default function InlineCard({
  id,
  title,
  description,
  options,
  mode = 'single',
  onSubmit,
  isLoading = false,
}: InlineCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleOptionClick = (optionId: string) => {
    if (isLoading) return;

    if (mode === 'single') {
      // Single-select: toggle or switch selection
      const newSelected = selectedIds.includes(optionId) ? [] : [optionId];
      setSelectedIds(newSelected);
      onSubmit?.(newSelected);
    } else {
      // Multi-select: toggle in/out of array
      const newSelected = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId];
      setSelectedIds(newSelected);
    }
  };

  const handleSubmit = () => {
    if (selectedIds.length > 0 && !isLoading) {
      onSubmit?.(selectedIds);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow my-2 max-w-lg">
      {/* Header */}
      <div className="mb-3">
        <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
      </div>

      {/* Options Grid */}
      <div
        className="space-y-2 mb-4"
        role="group"
        aria-label={`${title} options`}
      >
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id)}
              disabled={isLoading}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                isSelected
                  ? 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-500/20'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-100'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start gap-2">
                {/* Selection indicator */}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium">{option.label}</p>
                  {option.description && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Multi-select submit button */}
      {mode === 'multi' && (
        <button
          onClick={handleSubmit}
          disabled={selectedIds.length === 0 || isLoading}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isLoading ? 'Loading...' : `Submit (${selectedIds.length} selected)`}
        </button>
      )}

      {/* Selection counter for feedback */}
      {selectedIds.length > 0 && (
        <div className="text-xs text-gray-500 text-center mt-2">
          {mode === 'single'
            ? 'Selection submitted'
            : `${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''} selected`}
        </div>
      )}
    </div>
  );
}
