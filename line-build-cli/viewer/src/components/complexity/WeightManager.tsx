"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ScoreReport } from "./ScorePanel";
import { ImpactPreviewPanel, type WeightImpactPreview } from "./ImpactPreviewPanel";
import { BuildImpactCard } from "./BuildImpactCard";

// Type for weight changes summary
type WeightChange = {
  path: string;
  label: string;
  from: number;
  to: number;
  delta: number;
};

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

type WeightManagerProps = {
  buildId: string | null;
  currentScore: ScoreReport | null;
  onConfigChange?: () => void;
};

type SectionId = "location" | "technique" | "signals" | "multipliers";

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
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 text-xs text-neutral-600 truncate" title={label}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 appearance-none bg-neutral-200 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-primary-500
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-14 text-xs text-right font-mono px-1 py-0.5 border border-neutral-200 rounded"
      />
    </div>
  );
}

// Component to display weight changes
function WeightChangesSummary({ changes }: { changes: WeightChange[] }) {
  if (changes.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
      <div className="text-xs font-medium text-blue-800 mb-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        Weight Changes ({changes.length})
      </div>
      <div className="space-y-1">
        {changes.map((change) => (
          <div key={change.path} className="flex items-center justify-between text-xs">
            <span className="text-blue-700 truncate max-w-[140px]" title={change.label}>
              {change.label}
            </span>
            <span className="font-mono text-blue-900 flex items-center gap-1">
              <span className="text-blue-500">{change.from.toFixed(1)}</span>
              <span className="text-blue-400">→</span>
              <span>{change.to.toFixed(1)}</span>
              <span className={`ml-1 ${change.delta > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ({change.delta > 0 ? "+" : ""}{change.delta.toFixed(1)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compute differences between two configs
function computeWeightChanges(
  baseline: ComplexityConfig | null,
  current: ComplexityConfig | null,
  signalNames: Record<string, string>
): WeightChange[] {
  if (!baseline || !current) return [];

  const changes: WeightChange[] = [];

  // Location weights
  for (const [key, value] of Object.entries(current.location)) {
    const baseValue = baseline.location[key as keyof typeof baseline.location];
    if (value !== baseValue) {
      changes.push({
        path: `location.${key}`,
        label: `Location: ${key.replace("_", " ")}`,
        from: baseValue,
        to: value,
        delta: value - baseValue,
      });
    }
  }

  // Category multipliers
  for (const [key, value] of Object.entries(current.categoryMultipliers)) {
    const baseValue = baseline.categoryMultipliers[key as keyof typeof baseline.categoryMultipliers];
    if (value !== baseValue) {
      changes.push({
        path: `categoryMultipliers.${key}`,
        label: `Multiplier: ${key.replace(/([A-Z])/g, " $1").trim()}`,
        from: baseValue,
        to: value,
        delta: value - baseValue,
      });
    }
  }

  // Signals
  for (const [key, value] of Object.entries(current.signals)) {
    const baseValue = baseline.signals[key];
    if (value !== baseValue) {
      changes.push({
        path: `signals.${key}`,
        label: `Signal: ${signalNames[key] || key}`,
        from: baseValue,
        to: value,
        delta: value - baseValue,
      });
    }
  }

  // Technique default
  if (current.technique.default !== baseline.technique.default) {
    changes.push({
      path: "technique.default",
      label: "Technique: Default",
      from: baseline.technique.default,
      to: current.technique.default,
      delta: current.technique.default - baseline.technique.default,
    });
  }

  // Technique overrides
  for (const [key, value] of Object.entries(current.technique.overrides)) {
    const baseValue = baseline.technique.overrides[key];
    if (value !== baseValue) {
      changes.push({
        path: `technique.overrides.${key}`,
        label: `Technique: ${key}`,
        from: baseValue ?? 0,
        to: value,
        delta: value - (baseValue ?? 0),
      });
    }
  }

  return changes;
}

function CollapsibleSection({
  id,
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-100">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 px-1 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs text-neutral-400 font-normal">({count})</span>
        )}
      </button>
      {expanded && <div className="px-1 pb-3">{children}</div>}
    </div>
  );
}

export function WeightManager({ buildId, currentScore, onConfigChange }: WeightManagerProps) {
  const [config, setConfig] = useState<ComplexityConfig | null>(null);
  const [defaults, setDefaults] = useState<ComplexityConfig | null>(null);
  const [baseline, setBaseline] = useState<ComplexityConfig | null>(null); // Config before current session changes
  const [hasOverride, setHasOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<WeightImpactPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expanded sections
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    location: false,
    technique: false,
    signals: false,
    multipliers: false,
  });

  // Portfolio preview expansion (collapsed by default at item level)
  const [portfolioExpanded, setPortfolioExpanded] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/complexity/config");
        if (!res.ok) throw new Error("Failed to load config");
        const data = await res.json();
        setConfig(data.config);
        setDefaults(data.defaults);
        setBaseline(data.config); // Initialize baseline to track changes from
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
      return updated;
    });
  }, []);

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

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
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
      setBaseline(config); // Reset baseline to saved config
      setPreviewData(null);
      setPreviewError(null);
      onConfigChange?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [config, onConfigChange]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    setError(null);
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
      setBaseline(data.config); // Reset baseline to new config after reset
      setHasUnsavedChanges(false);
      setHasOverride(false);
      setPreviewData(null);
      setPreviewError(null);
      onConfigChange?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [onConfigChange]);

  // Signal names for display
  const signalNames: Record<string, string> = {
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

  // Compute weight changes from baseline
  const weightChanges = useMemo(
    () => computeWeightChanges(baseline, config, signalNames),
    [baseline, config]
  );

  if (loading) {
    return (
      <div className="p-4 text-sm text-neutral-500 flex items-center justify-center h-full">
        <div className="animate-pulse">Loading config...</div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-4 text-sm text-rose-600">
        Error: {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 text-sm text-neutral-500">
        Unable to load configuration
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with current score preview */}
      <div className="p-3 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-neutral-500 uppercase">Current Build Score</div>
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Unsaved
            </span>
          )}
        </div>
        {currentScore ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-neutral-900">
              {currentScore.rawScore.toFixed(1)}
            </span>
            <span className={`text-sm font-medium ${
              currentScore.rating === "low" ? "text-emerald-600" :
              currentScore.rating === "medium" ? "text-yellow-600" :
              currentScore.rating === "high" ? "text-orange-600" :
              "text-rose-600"
            }`}>
              {currentScore.rating.toUpperCase().replace("_", " ")}
            </span>
          </div>
        ) : (
          <div className="text-sm text-neutral-400">No build selected</div>
        )}
      </div>

      {/* Config sections */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Location Weights */}
        <CollapsibleSection
          id="location"
          title="Location Weights"
          count={4}
          expanded={expanded.location}
          onToggle={() => toggleSection("location")}
        >
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
          id="multipliers"
          title="Category Multipliers"
          count={5}
          expanded={expanded.multipliers}
          onToggle={() => toggleSection("multipliers")}
        >
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
          id="signals"
          title="Structural Signals"
          count={Object.keys(config.signals).length}
          expanded={expanded.signals}
          onToggle={() => toggleSection("signals")}
        >
          {Object.entries(config.signals).map(([key, value]) => (
            <WeightSlider
              key={key}
              label={signalNames[key] || key}
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

        {/* Technique Default Weight */}
        <CollapsibleSection
          id="technique"
          title="Technique Weights"
          count={Object.keys(config.technique.overrides).length + 1}
          expanded={expanded.technique}
          onToggle={() => toggleSection("technique")}
        >
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

        {/* Impact Preview - This Build First, Portfolio Summary Collapsed */}
        {hasUnsavedChanges && (
          <div className="mt-4 space-y-3">
            {/* Weight Changes Summary - Show what was changed */}
            <WeightChangesSummary changes={weightChanges} />

            {/* This Build Impact Card - Primary Focus */}
            {(() => {
              const currentBuildImpact = previewData?.buildImpacts.find(b => b.buildId === buildId);
              return (
                <BuildImpactCard
                  buildId={buildId || ""}
                  baseline={currentBuildImpact?.baseline ?? null}
                  preview={currentBuildImpact?.preview ?? null}
                  loading={previewLoading}
                />
              );
            })()}

            {/* Portfolio Summary - Collapsed by Default */}
            {previewData && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setPortfolioExpanded(!portfolioExpanded)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-neutral-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <svg
                      className={`w-3 h-3 transition-transform text-neutral-500 ${portfolioExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-neutral-600">Portfolio Impact</span>
                  </span>
                  <span className="text-xs text-neutral-500">
                    {previewData.buildImpacts.length - 1} other build{previewData.buildImpacts.length - 1 !== 1 ? "s" : ""} affected
                    {previewData.ratingChangedCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        {previewData.ratingChangedCount} rating{previewData.ratingChangedCount !== 1 ? "s" : ""} changed
                      </span>
                    )}
                  </span>
                </button>
                {portfolioExpanded && (
                  <div className="border-t border-neutral-200 p-3">
                    <ImpactPreviewPanel
                      preview={previewData}
                      loading={previewLoading}
                      error={previewError}
                      defaultExpandMigrations={true}
                      defaultExpandStats={false}
                      defaultExpandBuilds={false}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {previewError && (
              <div className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
                {previewError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-600">
          {error}
        </div>
      )}

      {/* Footer with actions */}
      <div className="p-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
        <div className="text-xs text-neutral-500">
          {hasOverride ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-500" />
              Custom config active
            </span>
          ) : (
            "Using defaults"
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving || (!hasOverride && !hasUnsavedChanges)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
