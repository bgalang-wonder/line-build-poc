"use client";

import React, { useState } from "react";

type PodType = "HOT" | "COLD" | "HYBRID" | "CLAMSHELL" | "PIZZA" | "EXPO" | "VENDING";

interface Pod {
  podId: string;
  podType: PodType;
  equipment: string[];
}

interface PodSectionProps {
  pod: Pod;
  index: number;
  onUpdate: (index: number, pod: Pod) => void;
  onRemove: (index: number) => void;
}

const POD_TYPES: PodType[] = ["HOT", "COLD", "HYBRID", "CLAMSHELL", "PIZZA", "EXPO", "VENDING"];

const EQUIPMENT_OPTIONS = [
  "FRYER",
  "WATER_BATH",
  "TURBO_OVEN",
  "TOASTER",
  "CLAMSHELL",
  "PRESS",
  "PIZZA_OVEN",
  "PIZZA_CONVEYOR_OVEN",
  "MICROWAVE",
  "VENDING",
  "HOT_BOX",
  "HOT_WELL",
  "STEAM_WELL",
  "SAUCE_WARMER",
  "RICE_COOKER",
];

export default function PodSection({ pod, index, onUpdate, onRemove }: PodSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newEquipment, setNewEquipment] = useState("");

  const handleAddEquipment = () => {
    if (newEquipment && !pod.equipment.includes(newEquipment)) {
      onUpdate(index, {
        ...pod,
        equipment: [...pod.equipment, newEquipment],
      });
      setNewEquipment("");
    }
  };

  const handleRemoveEquipment = (equipmentToRemove: string) => {
    onUpdate(index, {
      ...pod,
      equipment: pod.equipment.filter((e) => e !== equipmentToRemove),
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
          <span className="font-semibold">{pod.podId}</span>
          <span className="text-sm text-gray-600">({pod.podType})</span>
          <span className="text-xs text-gray-500">{pod.equipment.length} equipment</span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {/* Pod ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pod ID</label>
            <input
              type="text"
              value={pod.podId}
              onChange={(e) => onUpdate(index, { ...pod, podId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pod Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pod Type</label>
            <select
              value={pod.podType}
              onChange={(e) => onUpdate(index, { ...pod, podType: e.target.value as PodType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {POD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Equipment</label>

            {/* Equipment list */}
            <div className="flex flex-wrap gap-2 mb-3">
              {pod.equipment.map((equip) => (
                <span
                  key={equip}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {equip}
                  <button
                    onClick={() => handleRemoveEquipment(equip)}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Add equipment */}
            <div className="flex gap-2">
              <select
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select equipment...</option>
                {EQUIPMENT_OPTIONS.filter((e) => !pod.equipment.includes(e)).map((equip) => (
                  <option key={equip} value={equip}>
                    {equip}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddEquipment}
                disabled={!newEquipment}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {/* Remove pod button */}
          <div className="pt-2 border-t">
            <button
              onClick={() => onRemove(index)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove Pod
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
