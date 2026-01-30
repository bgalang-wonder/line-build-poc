'use client';

import React, { useState } from 'react';
import { useScenarioResolver } from '@/lib/hooks/useScenarioResolver';
import { ScenarioContext } from '@/lib/model/types';
import { EquipmentProfileSelector } from './EquipmentProfileSelector';
import { CustomizationValuePicker } from './CustomizationValuePicker';
import { ScenarioDiffViewer } from './ScenarioDiffViewer';

interface ScenarioPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Main scenario panel component
 * Combines equipment selector, customization picker, and diff viewer
 * Provides "what-if" scenario exploration
 */
export function ScenarioPanel({ isOpen = true, onClose }: ScenarioPanelProps) {
  const resolver = useScenarioResolver();
  const [pendingContext, setPendingContext] = useState<ScenarioContext | null>(
    resolver.context
  );

  const handleContextChange = (newContext: ScenarioContext) => {
    setPendingContext(newContext);
  };

  const handleResolve = () => {
    if (pendingContext) {
      resolver.resolve(pendingContext);
    }
  };

  const handleClear = () => {
    setPendingContext(null);
    resolver.clear();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="bg-white border-l border-gray-200 p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            What-If Scenario
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Equipment Profile Selector */}
        <div className="border-t pt-4">
          <EquipmentProfileSelector
            context={pendingContext}
            onContextChange={handleContextChange}
          />
        </div>

        {/* Customization Picker */}
        <div className="border-t pt-4">
          <CustomizationValuePicker
            context={pendingContext}
            onContextChange={handleContextChange}
          />
        </div>

        {/* Action Buttons */}
        <div className="border-t pt-4 flex gap-2">
          <button
            onClick={handleResolve}
            disabled={!pendingContext?.equipmentProfileId}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            Preview Scenario
          </button>
          <button
            onClick={handleClear}
            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
          >
            Clear
          </button>
        </div>

        {/* Diff Viewer */}
        {resolver.isActive && (
          <div className="border-t pt-4">
            <ScenarioDiffViewer
              baseResolved={resolver.baseResolved}
              scenarioResolved={resolver.scenarioResolved}
              diffs={resolver.diffs}
            />
          </div>
        )}

        {/* Status */}
        {resolver.isActive && (
          <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
            <p className="font-medium text-green-800">
              ✓ Scenario resolved
            </p>
            {resolver.hasDiffs && (
              <p className="text-green-700 text-xs mt-1">
                {Object.keys(resolver.diffs).length} step(s) affected
              </p>
            )}
            {!resolver.hasDiffs && (
              <p className="text-green-700 text-xs mt-1">
                No differences from base scenario
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
