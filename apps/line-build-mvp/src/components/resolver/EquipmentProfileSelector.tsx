'use client';

import React from 'react';
import { getAllEquipmentProfiles } from '@/lib/model/data/equipmentProfiles';
import { ScenarioContext } from '@/lib/model/types';

interface EquipmentProfileSelectorProps {
  context: ScenarioContext | null;
  onContextChange: (newContext: ScenarioContext) => void;
}

/**
 * Component for selecting an equipment profile
 * Updates the scenario context with the selected profile's ID and capabilities
 */
export function EquipmentProfileSelector({
  context,
  onContextChange,
}: EquipmentProfileSelectorProps) {
  const profiles = getAllEquipmentProfiles();
  const selectedProfileId = context?.equipmentProfileId || '';

  const handleProfileChange = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const newContext: ScenarioContext = {
      equipmentProfileId: profileId,
      capabilities: profile.capabilities,
      selectedCustomizationValueIds: context?.selectedCustomizationValueIds || [],
      customizationCount: context?.customizationCount || 0,
    };
    onContextChange(newContext);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Kitchen Profile
      </label>
      <select
        value={selectedProfileId}
        onChange={(e) => handleProfileChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select a kitchen profile...</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.label}
          </option>
        ))}
      </select>

      {selectedProfileId && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
          <p className="font-medium text-gray-700">Capabilities:</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {profiles
              .find((p) => p.id === selectedProfileId)
              ?.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-block px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded"
                >
                  {cap}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
