'use client';

import React, { useMemo } from 'react';
import { getCustomizationValue, getAllCustomizationValues } from '@/lib/model/data/equipmentProfiles';
import { ScenarioContext } from '@/lib/model/types';

interface CustomizationValuePickerProps {
  context: ScenarioContext | null;
  onContextChange: (newContext: ScenarioContext) => void;
}

/**
 * Component for selecting customization values
 * Multi-select checkboxes grouped by option type
 */
export function CustomizationValuePicker({
  context,
  onContextChange,
}: CustomizationValuePickerProps) {
  const allCustomizations = getAllCustomizationValues();
  const selectedIds = context?.selectedCustomizationValueIds || [];

  // Group customizations by option ID
  const groupedByOption = useMemo(() => {
    const groups: Record<string, typeof allCustomizations> = {};
    allCustomizations.forEach((cust) => {
      if (!groups[cust.optionId]) {
        groups[cust.optionId] = [];
      }
      groups[cust.optionId].push(cust);
    });
    return groups;
  }, [allCustomizations]);

  const handleToggle = (valueId: string) => {
    let newSelectedIds: string[];
    if (selectedIds.includes(valueId)) {
      newSelectedIds = selectedIds.filter((id) => id !== valueId);
    } else {
      newSelectedIds = [...selectedIds, valueId];
    }

    const newContext: ScenarioContext = {
      equipmentProfileId: context?.equipmentProfileId || '',
      capabilities: context?.capabilities || [],
      selectedCustomizationValueIds: newSelectedIds,
      customizationCount: newSelectedIds.length,
    };
    onContextChange(newContext);
  };

  if (Object.keys(groupedByOption).length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No customizations available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Customizations
      </label>

      {Object.entries(groupedByOption).map(([optionId, customizations]) => (
        <div key={optionId} className="space-y-1">
          <p className="text-xs font-semibold text-gray-600 uppercase">
            {optionId}
          </p>
          <div className="pl-2 space-y-1">
            {customizations.map((cust) => (
              <label
                key={cust.valueId}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(cust.valueId)}
                  onChange={() => handleToggle(cust.valueId)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{cust.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {selectedIds.length > 0 && (
        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
          <p className="font-medium text-gray-700">
            Selected: {selectedIds.length} customization(s)
          </p>
        </div>
      )}
    </div>
  );
}
