'use client';

import React from 'react';
import { ResolvedWorkUnit } from '@/lib/model/types';

interface DiffField {
  field: string;
  baseValue: any;
  scenarioValue: any;
  changed: boolean;
}

interface ScenarioDiffViewerProps {
  baseResolved: ResolvedWorkUnit[] | null;
  scenarioResolved: ResolvedWorkUnit[] | null;
  diffs: Record<string, any> | null;
}

/**
 * Component for viewing differences between base and scenario resolutions
 * Shows per-unit field changes
 */
export function ScenarioDiffViewer({
  baseResolved,
  scenarioResolved,
  diffs,
}: ScenarioDiffViewerProps) {
  if (!diffs || Object.keys(diffs).length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded text-center text-gray-500">
        No differences detected between scenarios
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Changes by Step</h3>

      {Object.entries(diffs).map(([unitId, changes]) => {
        const baseUnit = baseResolved?.find((u) => u.id === unitId);
        const scenarioUnit = scenarioResolved?.find((u) => u.id === unitId);

        if (!baseUnit || !scenarioUnit) return null;

        return (
          <div
            key={unitId}
            className="p-3 border border-orange-200 bg-orange-50 rounded"
          >
            <p className="font-medium text-gray-800 mb-2">
              {scenarioUnit.tags.target.name}
            </p>

            <div className="space-y-1 text-sm">
              {changes.added?.length > 0 && (
                <div>
                  <p className="text-green-700 font-medium">Added fields:</p>
                  {changes.added.map((field: string) => (
                    <div key={field} className="pl-2 text-green-600">
                      + {field}: {formatValue(scenarioUnit.tags[field as keyof typeof scenarioUnit.tags])}
                    </div>
                  ))}
                </div>
              )}

              {changes.removed?.length > 0 && (
                <div>
                  <p className="text-red-700 font-medium">Removed fields:</p>
                  {changes.removed.map((field: string) => (
                    <div key={field} className="pl-2 text-red-600">
                      - {field}: {formatValue(baseUnit.tags[field as keyof typeof baseUnit.tags])}
                    </div>
                  ))}
                </div>
              )}

              {changes.changed?.length > 0 && (
                <div>
                  <p className="text-blue-700 font-medium">Changed fields:</p>
                  {changes.changed.map((field: string) => (
                    <div key={field} className="pl-2 text-blue-600">
                      {field}:{' '}
                      <span className="line-through text-gray-500">
                        {formatValue(baseUnit.tags[field as keyof typeof baseUnit.tags])}
                      </span>{' '}
                      →{' '}
                      <span className="font-semibold">
                        {formatValue(scenarioUnit.tags[field as keyof typeof scenarioUnit.tags])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '(none)';
  }
  if (typeof value === 'object') {
    if ('value' in value && 'unit' in value) {
      return `${value.value}${value.unit}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}
