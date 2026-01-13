"use client";

import { useEffect, useState, useCallback } from "react";
import { DAGVisualization } from "@/components/visualization/DAGVisualization";
import { StepInspector } from "@/components/visualization/StepInspector";
import { MainViewToggle, type ViewType } from "@/components/layout/MainViewToggle";
import { StepsTable } from "@/components/steps/StepsTable";
import { RulesPanel } from "@/components/validation/RulesPanel";
import { BuildHealthStrip } from "@/components/validation/BuildHealthStrip";
import type { BenchTopLineBuild, ValidationOutput, BuildSummary } from "@/types";

const POLL_MS = 1500;
const SELECTION_STORAGE_KEY = "lineBuildViewer.lastSelectionRequestId";

function getBuildIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("buildId");
}

function getStepIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("stepId");
}

type ViewerSelectionRequest =
  | { buildId: null }
  | { buildId: string; requestId: string; timestamp: string; stepId?: string };

export default function ViewerPage() {
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(getBuildIdFromUrl());
  const [selectedBuild, setSelectedBuild] = useState<BenchTopLineBuild | null>(null);
  const [validation, setValidation] = useState<ValidationOutput | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(getStepIdFromUrl() ?? undefined);
  const [highlightStepIds, setHighlightStepIds] = useState<string[]>([]);
  const [mainView, setMainView] = useState<ViewType>("graph");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastProcessedSelectionRequestId, setLastProcessedSelectionRequestId] = useState<string | null>(
    null,
  );

  const selectedSummary = builds.find((b) => b.buildId === selectedBuildId) ?? null;
  const selectedStep = selectedBuild?.steps.find((s) => s.id === selectedStepId) ?? null;

  const fetchBuilds = useCallback(async (): Promise<BuildSummary[]> => {
    try {
      const res = await fetch("/api/builds", { cache: "no-store" });
      if (!res.ok) return [];
      return (await res.json()) as BuildSummary[];
    } catch (err) {
      console.warn("Failed to fetch builds", err);
      return [];
    }
  }, []);

  const fetchBuild = useCallback(async (buildId: string): Promise<BenchTopLineBuild | null> => {
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(buildId)}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as BenchTopLineBuild;
    } catch (err) {
      console.warn("Failed to fetch build", buildId, err);
      return null;
    }
  }, []);

  const fetchValidation = useCallback(async (buildId: string): Promise<ValidationOutput | null> => {
    try {
      const res = await fetch(`/api/validation/${encodeURIComponent(buildId)}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as ValidationOutput;
    } catch (err) {
      console.warn("Failed to fetch validation", buildId, err);
      return null;
    }
  }, []);

  const fetchSelectionRequest = useCallback(async (): Promise<ViewerSelectionRequest> => {
    try {
      const res = await fetch("/api/control/selection", { cache: "no-store" });
      if (!res.ok) return { buildId: null };
      return (await res.json()) as ViewerSelectionRequest;
    } catch {
      return { buildId: null };
    }
  }, []);

  // Sync selection to URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    let changed = false;

    if (selectedBuildId) {
      if (url.searchParams.get("buildId") !== selectedBuildId) {
        url.searchParams.set("buildId", selectedBuildId);
        changed = true;
      }
    } else {
      if (url.searchParams.has("buildId")) {
        url.searchParams.delete("buildId");
        changed = true;
      }
    }

    if (selectedStepId) {
      if (url.searchParams.get("stepId") !== selectedStepId) {
        url.searchParams.set("stepId", selectedStepId);
        changed = true;
      }
    } else {
      if (url.searchParams.has("stepId")) {
        url.searchParams.delete("stepId");
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState({}, "", url.toString());
    }
  }, [selectedBuildId, selectedStepId]);

  // Load last-processed selection request ID (prevents re-applying on reload)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SELECTION_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        setLastProcessedSelectionRequestId(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  // Listen for URL changes (including from API redirects)
  useEffect(() => {
    const urlBuildId = getBuildIdFromUrl();
    if (urlBuildId && urlBuildId !== selectedBuildId) {
      setSelectedBuildId(urlBuildId);
    }
  }, [selectedBuildId]);

  // Poll builds list
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [next, selection] = await Promise.all([fetchBuilds(), fetchSelectionRequest()]);
        if (cancelled) return;
        setBuilds(next);

        // One-shot viewer control: apply selection requests once (then user is free to click around).
        if (
          selection.buildId &&
          "requestId" in selection &&
          selection.requestId !== lastProcessedSelectionRequestId &&
          next.some((b) => b.buildId === selection.buildId)
        ) {
          setSelectedBuildId(selection.buildId);
          setSelectedStepId(selection.stepId);
          setLastProcessedSelectionRequestId(selection.requestId);
          try {
            window.localStorage.setItem(SELECTION_STORAGE_KEY, selection.requestId);
          } catch {
            // ignore
          }
          return;
        }

        // Select build: URL param > current selection > first build
        if (next.length > 0) {
          const urlBuildId = getBuildIdFromUrl();
          if (urlBuildId && next.some((b) => b.buildId === urlBuildId)) {
            setSelectedBuildId(urlBuildId);
          } else if (!selectedBuildId) {
            setSelectedBuildId(next[0].buildId);
          }
        }
      } catch (err) {
        console.warn("Polling failed", err);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [fetchBuilds, fetchSelectionRequest, lastProcessedSelectionRequestId, selectedBuildId]);

  // Fetch build + validation when selection or updatedAt changes
  useEffect(() => {
    if (!selectedBuildId) return;
    const updatedAt = selectedSummary?.updatedAt ?? null;
    if (updatedAt === lastUpdatedAt && selectedBuild?.id === selectedBuildId) return;

    let cancelled = false;
    (async () => {
      const [b, v] = await Promise.all([
        fetchBuild(selectedBuildId),
        fetchValidation(selectedBuildId),
      ]);
      if (cancelled) return;
      setSelectedBuild(b);
      setValidation(v);
      setLastUpdatedAt(updatedAt);
      setHighlightStepIds([]); // Clear highlights on build change
    })();
    return () => { cancelled = true; };
  }, [fetchBuild, fetchValidation, selectedBuildId, selectedSummary?.updatedAt, lastUpdatedAt, selectedBuild?.id]);

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-72 border-r border-neutral-200 bg-white flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <h1 className="font-semibold text-lg">Line Build Viewer</h1>
          <p className="text-sm text-neutral-500">{builds.length} build(s)</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {builds.length === 0 ? (
            <p className="text-sm text-neutral-400 p-2">No builds found</p>
          ) : (
            builds.map((b) => (
              <button
                key={b.buildId}
                onClick={() => { setSelectedBuildId(b.buildId); setSelectedStepId(undefined); setHighlightStepIds([]); }}
                className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                  b.buildId === selectedBuildId
                    ? "bg-primary-50 border border-primary-200"
                    : "hover:bg-neutral-50 border border-transparent"
                }`}
              >
                <div className="font-medium text-sm truncate">{b.name || b.itemId}</div>
                <div className="text-xs text-neutral-500">
                  v{b.version} • {b.status} • {b.buildId}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 bg-white flex items-center justify-between">
          <div>
            <div className="font-medium">
              {selectedBuild?.name || selectedBuild?.itemId || "Select a build"}
            </div>
            <div className="text-sm text-neutral-500">
              {selectedBuild ? `${selectedBuild.id} • v${selectedBuild.version}` : "—"}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <MainViewToggle value={mainView} onChange={setMainView} />
            {validation && (
              <span className={`px-2 py-1 rounded text-sm font-medium ${
                validation.valid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}>
                {validation.valid ? "Valid" : `${validation.hardErrors.length} error(s)`}
              </span>
            )}
          </div>
        </div>

        {/* Health Strip */}
        <BuildHealthStrip build={selectedBuild} validation={validation} />

        {/* Content Area */}
        <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
          {selectedBuild ? (
            <>
              {mainView === "graph" && (
                <div className="h-full w-full">
                  <DAGVisualization
                    build={selectedBuild}
                    validation={validation}
                    selectedStepId={selectedStepId}
                    highlightStepIds={highlightStepIds}
                    onSelectStep={(id) => {
                      setSelectedStepId(id);
                      setHighlightStepIds([]); // Clear rule highlight on manual step selection
                    }}
                  />
                </div>
              )}
              {mainView === "steps" && (
                <div className="flex-1 overflow-hidden bg-white rounded-lg border border-neutral-200">
                  <StepsTable
                    build={selectedBuild}
                    validation={validation}
                    selectedStepId={selectedStepId}
                    onSelectStep={(id) => { setSelectedStepId(id); setHighlightStepIds([]); }}
                  />
                </div>
              )}
              {mainView === "rules" && (
                <div className="flex-1 overflow-hidden bg-white rounded-lg border border-neutral-200">
                  <RulesPanel
                    validation={validation}
                    onSelectStep={setSelectedStepId}
                    onHighlightSteps={setHighlightStepIds}
                    onSetView={setMainView}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-400">
              Select a build to view
            </div>
          )}
        </div>

        {/* Inspector */}
        {selectedStep && (
          <div className="border-t border-neutral-200 bg-white max-h-[40%] overflow-y-auto">
            <StepInspector
              step={selectedStep}
              validation={validation}
              buildId={selectedBuildId ?? undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
