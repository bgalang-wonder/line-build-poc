"use client";

import React, { useState } from "react";

interface StationLocationsSectionProps {
  stationLocations: Record<string, string>;
  availablePodIds: string[];
  onUpdate: (stationLocations: Record<string, string>) => void;
}

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

export default function StationLocationsSection({
  stationLocations,
  availablePodIds,
  onUpdate,
}: StationLocationsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUpdateStation = (stationId: string, podId: string) => {
    if (podId === "") {
      // Remove the mapping
      const updated = { ...stationLocations };
      delete updated[stationId];
      onUpdate(updated);
    } else {
      onUpdate({
        ...stationLocations,
        [stationId]: podId,
      });
    }
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
          <span className="font-semibold">Explicit Station Locations</span>
          <span className="text-xs text-gray-500">
            {Object.keys(stationLocations).length} explicit mappings
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 bg-white">
          <p className="text-sm text-gray-600 mb-4">
            Explicit station → pod ID mappings (for non-equipment stations like garnish, prep,
            expo).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STATIONS.map((station) => (
              <div key={station} className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-32">{station}:</label>
                <select
                  value={stationLocations[station] || ""}
                  onChange={(e) => handleUpdateStation(station, e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">(not set)</option>
                  {availablePodIds.map((podId) => (
                    <option key={podId} value={podId}>
                      {podId}
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
