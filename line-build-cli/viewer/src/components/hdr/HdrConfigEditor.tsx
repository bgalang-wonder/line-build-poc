"use client";

import React from "react";
import PodSection from "./PodSection";
import StationDefaultsSection from "./StationDefaultsSection";
import StationLocationsSection from "./StationLocationsSection";

type PodType = "HOT" | "COLD" | "HYBRID" | "CLAMSHELL" | "PIZZA" | "EXPO" | "VENDING";

interface Pod {
  podId: string;
  podType: PodType;
  equipment: string[];
}

export interface HdrConfigData {
  hdrId: string;
  name: string;
  pods: Pod[];
  stationPodDefaults: Record<string, PodType>;
  stationLocations: Record<string, string>;
}

interface HdrConfigEditorProps {
  config: HdrConfigData;
  onChange: (config: HdrConfigData) => void;
}

export default function HdrConfigEditor({ config, onChange }: HdrConfigEditorProps) {
  const handleUpdatePod = (index: number, updatedPod: Pod) => {
    const newPods = [...config.pods];
    newPods[index] = updatedPod;
    onChange({ ...config, pods: newPods });
  };

  const handleRemovePod = (index: number) => {
    const newPods = config.pods.filter((_, i) => i !== index);
    onChange({ ...config, pods: newPods });
  };

  const handleAddPod = () => {
    const newPod: Pod = {
      podId: `New_Pod_${config.pods.length + 1}`,
      podType: "HYBRID",
      equipment: [],
    };
    onChange({ ...config, pods: [...config.pods, newPod] });
  };

  const handleUpdateStationDefaults = (stationPodDefaults: Record<string, PodType>) => {
    onChange({ ...config, stationPodDefaults });
  };

  const handleUpdateStationLocations = (stationLocations: Record<string, string>) => {
    onChange({ ...config, stationLocations });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Configuration ID (read-only)
          </label>
          <input
            type="text"
            value={config.hdrId}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => onChange({ ...config, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Mock 11-Pod Layout"
          />
        </div>
      </div>

      {/* Pods */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Pods ({config.pods.length})
          </h2>
          <button
            onClick={handleAddPod}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Add Pod
          </button>
        </div>

        {config.pods.map((pod, index) => (
          <PodSection
            key={index}
            pod={pod}
            index={index}
            onUpdate={handleUpdatePod}
            onRemove={handleRemovePod}
          />
        ))}
      </div>

      {/* Station Defaults */}
      <StationDefaultsSection
        stationPodDefaults={config.stationPodDefaults}
        onUpdate={handleUpdateStationDefaults}
      />

      {/* Station Locations */}
      <StationLocationsSection
        stationLocations={config.stationLocations}
        availablePodIds={config.pods.map((p) => p.podId)}
        onUpdate={handleUpdateStationLocations}
      />
    </div>
  );
}
