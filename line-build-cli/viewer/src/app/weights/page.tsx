"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ImpactPreviewPanel,
  type WeightImpactPreview,
} from "@/components/complexity/ImpactPreviewPanel";

// Type matching the CLI config
interface ComplexityConfig {
  version: string;
  technique: { default: number; overrides: Record<string, number> };
  location: { hot_side: number; cold_side: number; expo: number; vending: number };
  equipment: { default: number; overrides: Record<string, number> };
  signals: Record<string, number>;
  thresholds: {
    shortEquipmentSeconds: number;
    ratings: { low: number; medium: number; high: number };
  };
  categoryMultipliers: {
    location: number;
    technique: number;
    packaging: number;
    stationMovement: number;
    taskCount: number;
  };
  actionFamilyWeights?: Record<string, number>;
}

type SectionId = "location" | "technique" | "signals" | "multipliers" | "equipment";

function WeightSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 5,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-40 text-sm text-neutral-700 truncate" title={label}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 appearance-none bg-neutral-200 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-primary-500
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-primary-600"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-20 text-sm text-right font-mono px-2 py-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left font-medium text-neutral-900 hover:bg-neutral-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {title}
        </span>
        {count !== undefined && (
          <span className="text-sm text-neutral-400 font-normal">({count} items)</span>
        )}
      </button>
      {expanded && <div className="px-4 pb-4 border-t border-neutral-100 pt-4">{children}</div>}
    </div>
  );
}

// Signal names for display
const SIGNAL_NAMES: Record<string, string> = {
  groupingBounces: "Grouping Bounces",
  stationBounces: "Station Bounces",
  mergePointCount: "Merge Points",
  deepMergeCount: "Deep Merges (3+)",
  parallelEntryPoints: "Entry Points",
  shortEquipmentSteps: "Short Equip Steps",
  backToBackEquipment: "Back-to-Back Equip",
  transferCount: "Transfers",
  stationTransitions: "Station Transitions",
};

export default function WeightsPage() {
  const [config, setConfig] = useState<ComplexityConfig | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Preview state
  const [previewData, setPreviewData] = useState<WeightImpactPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch preview with debounce
  const fetchPreview = useCallback(async (previewConfig: ComplexityConfig) => {
    // Cancel any pending preview request
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }

    const controller = new AbortController();
    previewAbortRef.current = controller;

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch("/api/complexity/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewConfig }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to compute preview");
      }

      const data = await res.json();
      setPreviewData(data.preview);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setPreviewError((err as Error).message);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Debounced preview effect
  useEffect(() => {
    if (!config || !hasUnsavedChanges) {
      setPreviewData(null);
      return;
    }

    // Clear previous timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Debounce preview fetch by 300ms
    previewTimeoutRef.current = setTimeout(() => {
      fetchPreview(config);
    }, 300);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [config, hasUnsavedChanges, fetchPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  // Expanded sections
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    location: true,
    technique: false,
    signals: false,
    multipliers: false,
    equipment: false,
  });

  // Fetch config on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/complexity/config");
        if (!res.ok) throw new Error("Failed to load config");
        const data = await res.json();
        setConfig(data.config);
        setHasOverride(data.hasOverride);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const toggleSection = useCallback((section: SectionId) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const updateConfig = useCallback((updater: (config: ComplexityConfig) => ComplexityConfig) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      setHasUnsavedChanges(true);
      setSuccessMessage(null);
      return updated;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/complexity/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setHasUnsavedChanges(false);
      setHasOverride(true);
      setPreviewData(null);
      setPreviewError(null);
      setSuccessMessage("Configuration saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/complexity/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset");
      }
      const data = await res.json();
      setConfig(data.config);
      setHasUnsavedChanges(false);
      setHasOverride(false);
      setPreviewData(null);
      setPreviewError(null);
      setSuccessMessage("Configuration reset to defaults!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Loading configuration...</div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-rose-600">Error: {error}</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-500">Unable to load configuration</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </Link>
              <div className="w-px h-5 bg-neutral-300" />
              <div>
                <h1 className="text-xl font-bold text-neutral-900">Complexity Weight Manager</h1>
                <p className="text-sm text-neutral-500">
                  Configure how complexity scores are calculated
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="flex items-center gap-1.5 text-sm text-amber-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              )}
              {hasOverride && !hasUnsavedChanges && (
                <span className="flex items-center gap-1.5 text-sm text-primary-600">
                  <span className="w-2 h-2 rounded-full bg-primary-500" />
                  Custom config active
                </span>
              )}
              <button
                onClick={handleReset}
                disabled={saving || (!hasOverride && !hasUnsavedChanges)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset to Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-6 mt-4">
        {error && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
            {successMessage}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* Location Weights */}
        <CollapsibleSection
          title="Location Weights"
          count={4}
          expanded={expanded.location}
          onToggle={() => toggleSection("location")}
        >
          <p className="text-sm text-neutral-500 mb-4">
            Weight assigned to steps based on their kitchen location.
          </p>
          <WeightSlider
            label="Hot Side"
            value={config.location.hot_side}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                location: { ...c.location, hot_side: v },
              }))
            }
          />
          <WeightSlider
            label="Cold Side"
            value={config.location.cold_side}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                location: { ...c.location, cold_side: v },
              }))
            }
          />
          <WeightSlider
            label="Expo"
            value={config.location.expo}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                location: { ...c.location, expo: v },
              }))
            }
          />
          <WeightSlider
            label="Vending"
            value={config.location.vending}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                location: { ...c.location, vending: v },
              }))
            }
          />
        </CollapsibleSection>

        {/* Category Multipliers */}
        <CollapsibleSection
          title="Category Multipliers"
          count={5}
          expanded={expanded.multipliers}
          onToggle={() => toggleSection("multipliers")}
        >
          <p className="text-sm text-neutral-500 mb-4">
            Multipliers applied to each scoring category in the final calculation.
          </p>
          <WeightSlider
            label="Location"
            value={config.categoryMultipliers.location}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                categoryMultipliers: { ...c.categoryMultipliers, location: v },
              }))
            }
          />
          <WeightSlider
            label="Technique"
            value={config.categoryMultipliers.technique}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                categoryMultipliers: { ...c.categoryMultipliers, technique: v },
              }))
            }
          />
          <WeightSlider
            label="Packaging"
            value={config.categoryMultipliers.packaging}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                categoryMultipliers: { ...c.categoryMultipliers, packaging: v },
              }))
            }
          />
          <WeightSlider
            label="Station Movement"
            value={config.categoryMultipliers.stationMovement}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                categoryMultipliers: { ...c.categoryMultipliers, stationMovement: v },
              }))
            }
          />
          <WeightSlider
            label="Task Count"
            value={config.categoryMultipliers.taskCount}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                categoryMultipliers: { ...c.categoryMultipliers, taskCount: v },
              }))
            }
          />
        </CollapsibleSection>

        {/* Structural Signals */}
        <CollapsibleSection
          title="Structural Signals"
          count={Object.keys(config.signals).length}
          expanded={expanded.signals}
          onToggle={() => toggleSection("signals")}
        >
          <p className="text-sm text-neutral-500 mb-4">
            Weights for structural complexity indicators in the build graph.
          </p>
          {Object.entries(config.signals).map(([key, value]) => (
            <WeightSlider
              key={key}
              label={SIGNAL_NAMES[key] || key}
              value={value}
              onChange={(v) =>
                updateConfig((c) => ({
                  ...c,
                  signals: { ...c.signals, [key]: v },
                }))
              }
            />
          ))}
        </CollapsibleSection>

        {/* Technique Weights */}
        <CollapsibleSection
          title="Technique Weights"
          count={Object.keys(config.technique.overrides).length + 1}
          expanded={expanded.technique}
          onToggle={() => toggleSection("technique")}
        >
          <p className="text-sm text-neutral-500 mb-4">
            Base weight and technique-specific overrides.
          </p>
          <WeightSlider
            label="Default"
            value={config.technique.default}
            onChange={(v) =>
              updateConfig((c) => ({
                ...c,
                technique: { ...c.technique, default: v },
              }))
            }
          />
          {Object.entries(config.technique.overrides).map(([key, value]) => (
            <WeightSlider
              key={key}
              label={key}
              value={value}
              onChange={(v) =>
                updateConfig((c) => ({
                  ...c,
                  technique: {
                    ...c.technique,
                    overrides: { ...c.technique.overrides, [key]: v },
                  },
                }))
              }
            />
          ))}
        </CollapsibleSection>

        {/* Impact Preview Panel - Portfolio Level */}
        {hasUnsavedChanges && (
          <div className="bg-white rounded-lg border border-amber-300 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="font-medium text-amber-900">Portfolio Impact Preview</span>
                </div>
                {previewData && (
                  <span className="text-sm text-amber-700">
                    {previewData.buildImpacts.length} builds • {previewData.ratingChangedCount} rating change{previewData.ratingChangedCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4">
              <ImpactPreviewPanel
                preview={previewData}
                loading={previewLoading}
                error={previewError}
                defaultExpandMigrations={true}
                defaultExpandStats={true}
                defaultExpandBuilds={false}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
