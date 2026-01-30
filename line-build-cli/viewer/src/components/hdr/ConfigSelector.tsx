"use client";

import React from "react";

interface ConfigInfo {
  hdrId: string;
  name: string;
  podCount: number;
  isActive: boolean;
}

interface ConfigSelectorProps {
  configs: ConfigInfo[];
  activeConfigId: string;
  onSelectConfig: (configId: string) => void;
  disabled?: boolean;
}

export default function ConfigSelector({
  configs,
  activeConfigId,
  onSelectConfig,
  disabled = false,
}: ConfigSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="config-selector" className="text-sm font-medium text-gray-700">
        HDR Configuration:
      </label>
      <select
        id="config-selector"
        value={activeConfigId}
        onChange={(e) => onSelectConfig(e.target.value)}
        disabled={disabled}
        className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {configs.map((config) => (
          <option key={config.hdrId} value={config.hdrId}>
            {config.isActive ? "● " : ""}
            {config.name} ({config.podCount} pods)
          </option>
        ))}
      </select>
    </div>
  );
}
