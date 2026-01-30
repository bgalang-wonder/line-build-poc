"use client";

import React, { useState } from "react";

type PodType = "HOT" | "COLD" | "HYBRID" | "CLAMSHELL" | "PIZZA" | "EXPO" | "VENDING";

interface StationDefaultsSectionProps {
  stationPodDefaults: Record<string, PodType>;
  onUpdate: (stationPodDefaults: Record<string, PodType>) => void;
}

const POD_TYPES: PodType[] = ["HOT", "COLD", "HYBRID", "CLAMSHELL", "PIZZA", "EXPO", "VENDING"];

const STATIONS = [
  "fryer",
  "waterbath",
  "turbo",
  "microwave",
  "clamshell_grill",
  "press",
  "toaster",
  "garnish",
  "pizza",
  "expo",
  "prep",
  "vending",
  "speed_line",
];

export default function StationDefaultsSection({
  stationPodDefaults,
  onUpdate,
}: StationDefaultsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUpdateStation = (stationId: string, podType: PodType) => {
    onUpdate({
      ...stationPodDefaults,
      [stationId]: podType,
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
          <span className="font-semibold">Station Pod Type Defaults</span>
          <span className="text-xs text-gray-500">
            {Object.keys(stationPodDefaults).length} stations configured
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 bg-white">
          <p className="text-sm text-gray-600 mb-4">
            Default pod type for each station (used when equipment doesn't constrain the choice).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STATIONS.map((station) => (
              <div key={station} className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-32">{station}:</label>
                <select
                  value={stationPodDefaults[station] || "COLD"}
                  onChange={(e) => handleUpdateStation(station, e.target.value as PodType)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {POD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
