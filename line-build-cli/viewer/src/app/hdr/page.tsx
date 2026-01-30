"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import HdrConfigEditor, { type HdrConfigData } from "@/components/hdr/HdrConfigEditor";
import ConfigSelector from "@/components/hdr/ConfigSelector";
import SaveControls from "@/components/hdr/SaveControls";

interface ConfigInfo {
  hdrId: string;
  name: string;
  podCount: number;
  isActive: boolean;
}

export default function HdrPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<ConfigInfo[]>([]);
  const [activeConfig, setActiveConfig] = useState<HdrConfigData | null>(null);
  const [editedConfig, setEditedConfig] = useState<HdrConfigData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasUnsavedChanges =
    editedConfig && activeConfig && JSON.stringify(editedConfig) !== JSON.stringify(activeConfig);

  // Load configs and active config
  const loadData = useCallback(async () => {
    try {
      const [configsRes, activeConfigRes] = await Promise.all([
        fetch("/api/hdr/list"),
        fetch("/api/hdr/config"),
      ]);

      if (!configsRes.ok || !activeConfigRes.ok) {
        throw new Error("Failed to load HDR data");
      }

      const configsData = await configsRes.json();
      const activeConfigData = await activeConfigRes.json();

      setConfigs(configsData.configs);
      setActiveConfig(activeConfigData);
      setEditedConfig(activeConfigData);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load HDR data:", error);
      setMessage({ type: "error", text: "Failed to load HDR configurations" });
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for updates (every 3 seconds)
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      if (!hasUnsavedChanges) {
        loadData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading, hasUnsavedChanges, loadData]);

  const handleSave = async () => {
    if (!editedConfig) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/hdr/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      const result = await response.json();
      setMessage({ type: "success", text: result.message || "Configuration saved successfully" });
      setActiveConfig(editedConfig);
      await loadData();
    } catch (error) {
      console.error("Save failed:", error);
      setMessage({ type: "error", text: "Failed to save configuration" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAs = async (newName: string) => {
    if (!editedConfig) return;

    setIsSaving(true);
    setMessage(null);

    // Generate new config ID from name
    const newConfigId = newName.toLowerCase().replace(/\s+/g, "-");

    const newConfig = {
      ...editedConfig,
      hdrId: newConfigId,
      name: newName,
    };

    try {
      const response = await fetch("/api/hdr/config?new=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to create new configuration");
      }

      const result = await response.json();
      setMessage({
        type: "success",
        text: result.message || "New configuration created successfully",
      });

      // Reload data and navigate to new config
      await loadData();
      router.refresh();
    } catch (error) {
      console.error("Save As failed:", error);
      setMessage({ type: "error", text: "Failed to create new configuration" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectConfig = async (configId: string) => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        "You have unsaved changes. Are you sure you want to switch configurations?"
      );
      if (!confirm) return;
    }

    setMessage(null);

    try {
      const response = await fetch("/api/hdr/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId }),
      });

      if (!response.ok) {
        throw new Error("Failed to activate configuration");
      }

      await loadData();
      router.refresh();
      setMessage({ type: "success", text: "Configuration switched successfully" });
    } catch (error) {
      console.error("Failed to switch config:", error);
      setMessage({ type: "error", text: "Failed to switch configuration" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading HDR configurations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HDR Configuration Manager</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage kitchen pod layouts and station assignments
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>

          <div className="flex items-center justify-between">
            <ConfigSelector
              configs={configs}
              activeConfigId={activeConfig?.hdrId || ""}
              onSelectConfig={handleSelectConfig}
              disabled={isSaving}
            />

            <SaveControls
              onSave={handleSave}
              onSaveAs={handleSaveAs}
              hasUnsavedChanges={!!hasUnsavedChanges}
              isSaving={isSaving}
            />
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div
            className={`px-4 py-3 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {editedConfig && (
          <HdrConfigEditor config={editedConfig} onChange={setEditedConfig} />
        )}
      </div>
    </div>
  );
}
