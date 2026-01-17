"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { DAGVisualization, type VisualizationMode } from "@/components/visualization/DAGVisualization";
import { DetailPanel } from "@/components/visualization/DetailPanel";
import { MainViewToggle, type ViewType } from "@/components/layout/MainViewToggle";
import { StepsTable } from "@/components/steps/StepsTable";
import { RulesPanel } from "@/components/validation/RulesPanel";
import { BuildHealthStrip } from "@/components/validation/BuildHealthStrip";
import { buildGroupColorMap } from "@/lib/componentColors";
import type { BenchTopLineBuild, ValidationOutput, BuildSummary, StationVisit, Step } from "@/types";

type Artifact = { id: string; name?: string; groupId?: string; components?: string[] };
type ArtifactSteps = { producedBy: Step[]; consumedBy: Step[] };

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
  const [selectedVisit, setSelectedVisit] = useState<StationVisit | null>(null);
  const [highlightStepIds, setHighlightStepIds] = useState<string[]>([]);
  const [mainView, setMainView] = useState<ViewType>("graph");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastProcessedSelectionRequestId, setLastProcessedSelectionRequestId] = useState<string | null>(
    null,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dagMode, setDagMode] = useState<VisualizationMode>("work_order");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [artifactSteps, setArtifactSteps] = useState<ArtifactSteps | null>(null);

  const selectedSummary = builds.find((b) => b.buildId === selectedBuildId) ?? null;
  const selectedStep = selectedBuild?.steps.find((s) => s.id === selectedStepId) ?? null;

  // Build group color map for DetailPanel
  const groupColorMap = useMemo(() => {
    if (!selectedBuild?.artifacts) return new Map<string, string>();
    return buildGroupColorMap(selectedBuild.artifacts);
  }, [selectedBuild?.artifacts]);

  // Clear selections when mode changes
  const handleModeChange = useCallback((mode: VisualizationMode) => {
    setDagMode(mode);
    // Clear selections for other modes
    if (mode !== "work_order") {
      setSelectedStepId(undefined);
    }
    if (mode !== "material_flow") {
      setSelectedArtifact(null);
      setArtifactSteps(null);
    }
    if (mode !== "station_handoffs") {
      setSelectedVisit(null);
    }
  }, []);

  // Handle artifact selection from DAG
  const handleSelectArtifact = useCallback((artifact: Artifact | null, steps: ArtifactSteps | null) => {
    setSelectedArtifact(artifact);
    setArtifactSteps(steps);
    // Clear other selections
    setSelectedStepId(undefined);
    setSelectedVisit(null);
  }, []);

  // Clear detail panel selection
  const handleCloseDetailPanel = useCallback(() => {
    setSelectedStepId(undefined);
    setSelectedVisit(null);
    setSelectedArtifact(null);
    setArtifactSteps(null);
  }, []);

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
          setSelectedVisit(null);
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
      setSelectedVisit(null);
    })();
    return () => { cancelled = true; };
  }, [fetchBuild, fetchValidation, selectedBuildId, selectedSummary?.updatedAt, lastUpdatedAt, selectedBuild?.id]);

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div 
        className={`border-r border-neutral-200 bg-white flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? "w-12" : "w-72"
        }`}
      >
        <div className="p-2 border-b border-neutral-200 flex items-center justify-between min-h-[60px]">
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0 px-2">
              <h1 className="font-semibold text-lg truncate">Line Build Viewer</h1>
              <p className="text-sm text-neutral-500">{builds.length} build(s)</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-neutral-100 rounded-md transition-colors text-neutral-500 hover:text-neutral-700 flex-shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        {sidebarCollapsed ? (
          <div className="flex-1 flex flex-col items-center py-2">
            <div className="text-xs font-medium text-neutral-400 rotate-180 [writing-mode:vertical-lr] mt-2">
              {builds.length} builds
            </div>
          </div>
        ) : (
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
        )}
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
                <div className="flex-1 min-h-0">
                  <DAGVisualization
                    build={selectedBuild}
                    validation={validation}
                    selectedStepId={selectedStepId}
                    selectedVisitId={selectedVisit?.id}
                    selectedArtifactId={selectedArtifact?.id}
                    highlightStepIds={highlightStepIds}
                    onSelectStep={(id) => {
                      setSelectedStepId(id);
                      setSelectedVisit(null);
                      setSelectedArtifact(null);
                      setArtifactSteps(null);
                      setHighlightStepIds([]); // Clear rule highlight on manual step selection
                    }}
                    onSelectVisit={(visit) => {
                      setSelectedVisit(visit);
                      setSelectedStepId(undefined);
                      setSelectedArtifact(null);
                      setArtifactSteps(null);
                      setHighlightStepIds([]);
                    }}
                    onSelectArtifact={handleSelectArtifact}
                    onModeChange={handleModeChange}
                  />
                </div>
              )}
              {mainView === "steps" && (
                <div className="flex-1 overflow-hidden bg-white rounded-lg border border-neutral-200">
                  <StepsTable
                    build={selectedBuild}
                    validation={validation}
                    selectedStepId={selectedStepId}
                    onSelectStep={(id) => { setSelectedStepId(id); setSelectedVisit(null); setHighlightStepIds([]); }}
                  />
                </div>
              )}
              {mainView === "rules" && (
                <div className="flex-1 overflow-hidden bg-white rounded-lg border border-neutral-200">
                  <RulesPanel
                    validation={validation}
                    onSelectStep={(id) => { setSelectedStepId(id); setSelectedVisit(null); }}
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

        {/* Detail Panel */}
        {mainView === "graph" && (
          <DetailPanel
            mode={dagMode}
            selectedStep={selectedStep}
            validation={validation}
            buildId={selectedBuildId ?? undefined}
            selectedArtifact={selectedArtifact}
            artifactSteps={artifactSteps}
            artifacts={selectedBuild?.artifacts}
            groupColorMap={groupColorMap}
            selectedVisit={selectedVisit}
            onClose={handleCloseDetailPanel}
            onSelectStep={(id) => { 
              setSelectedStepId(id); 
              setSelectedVisit(null);
              setSelectedArtifact(null);
              setArtifactSteps(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
