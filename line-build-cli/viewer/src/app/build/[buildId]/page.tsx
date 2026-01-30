"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DAGVisualization, type VisualizationMode } from "@/components/visualization/DAGVisualization";
import { DetailContent } from "@/components/visualization/DetailContent";
import { RightSidebar, type RightSidebarTab } from "@/components/layout/RightSidebar";
import { StepsList } from "@/components/steps/StepsList";
import { RulesPanel } from "@/components/validation/RulesPanel";
import { BuildHealthStrip } from "@/components/validation/BuildHealthStrip";
import { ScoreTab } from "@/components/complexity/ScoreTab";
import { TopNav } from "@/components/layout/TopNav";
import type { ScoreReport } from "@/components/complexity/ScorePanel";
import { buildGroupColorMap } from "@/lib/componentColors";
import { applyDerivedOrderIndex } from "@/lib/deriveOrder";
import type { BenchTopLineBuild, ValidationOutput, StationVisit, Step } from "@/types";

type Assembly = { id: string; name?: string; groupId?: string; subAssemblies?: string[] };
type AssemblySteps = { producedBy: Step[]; consumedBy: Step[] };

const POLL_MS = 1500;
const RIGHT_PANEL_COLLAPSED_KEY = "lineBuildViewer.rightPanelCollapsed";

export default function BuildViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const buildId = params.buildId as string;
  const initialStepId = searchParams.get("stepId");

  const [selectedBuild, setSelectedBuild] = useState<BenchTopLineBuild | null>(null);
  const [validation, setValidation] = useState<ValidationOutput | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(initialStepId ?? undefined);
  const [selectedVisit, setSelectedVisit] = useState<StationVisit | null>(null);
  const [highlightStepIds, setHighlightStepIds] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [dagMode, setDagMode] = useState<VisualizationMode>("work_order");
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly | null>(null);
  const [assemblySteps, setAssemblySteps] = useState<AssemblySteps | null>(null);

  // Complexity scoring state
  const [complexityScore, setComplexityScore] = useState<ScoreReport | null>(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [complexityError, setComplexityError] = useState<string | null>(null);

  // Right panel state
  const [rightPanelTab, setRightPanelTab] = useState<RightSidebarTab>("detail");
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(RIGHT_PANEL_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Persist right panel collapsed state
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(RIGHT_PANEL_COLLAPSED_KEY, String(rightPanelCollapsed));
    } catch {
      // ignore
    }
  }, [rightPanelCollapsed]);

  const selectedStep = selectedBuild?.steps.find((s) => s.id === selectedStepId) ?? null;

  // Check if we have any detail selection
  const hasDetailSelection = Boolean(selectedStep || selectedAssembly || selectedVisit);

  // Build group color map for DetailContent
  const groupColorMap = useMemo(() => {
    if (!selectedBuild?.assemblies) return new Map<string, string>();
    return buildGroupColorMap(selectedBuild.assemblies);
  }, [selectedBuild?.assemblies]);

  // Clear selections when mode changes
  const handleModeChange = useCallback((mode: VisualizationMode) => {
    setDagMode(mode);
    if (mode !== "work_order") {
      setSelectedStepId(undefined);
    }
    if (mode !== "material_flow") {
      setSelectedAssembly(null);
      setAssemblySteps(null);
    }
    if (mode !== "station_handoffs") {
      setSelectedVisit(null);
    }
  }, []);

  // Handle step selection with auto-switch to detail tab
  const handleSelectStepWithTabSwitch = useCallback((id: string | undefined) => {
    setSelectedStepId(id);
    if (id) {
      setSelectedVisit(null);
      setSelectedAssembly(null);
      setAssemblySteps(null);
      setRightPanelTab("detail");
    }
    setHighlightStepIds([]);
  }, []);

  // Clear detail panel selection
  const handleCloseDetailPanel = useCallback(() => {
    setSelectedStepId(undefined);
    setSelectedVisit(null);
    setSelectedAssembly(null);
    setAssemblySteps(null);
  }, []);

  const fetchBuild = useCallback(async (): Promise<BenchTopLineBuild | null> => {
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(buildId)}`, { cache: "no-store" });
      if (!res.ok) return null;
      const build = (await res.json()) as BenchTopLineBuild;
      return applyDerivedOrderIndex(build);
    } catch (err) {
      console.warn("Failed to fetch build", buildId, err);
      return null;
    }
  }, [buildId]);

  const fetchValidation = useCallback(async (): Promise<ValidationOutput | null> => {
    try {
      const res = await fetch(`/api/validation/${encodeURIComponent(buildId)}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as ValidationOutput;
    } catch (err) {
      console.warn("Failed to fetch validation", buildId, err);
      return null;
    }
  }, [buildId]);

  const fetchComplexity = useCallback(async (): Promise<ScoreReport | null> => {
    try {
      const res = await fetch(`/api/complexity/${encodeURIComponent(buildId)}`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as ScoreReport;
    } catch (err) {
      console.warn("Failed to fetch complexity", buildId, err);
      return null;
    }
  }, [buildId]);

  // Refresh complexity score (called when weights change)
  const refreshComplexity = useCallback(async () => {
    setComplexityLoading(true);
    try {
      const score = await fetchComplexity();
      setComplexityScore(score);
    } finally {
      setComplexityLoading(false);
    }
  }, [fetchComplexity]);

  // Initial load and polling
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setComplexityLoading(true);
      setComplexityError(null);
      const [b, v, c] = await Promise.all([fetchBuild(), fetchValidation(), fetchComplexity()]);
      if (cancelled) return;
      setSelectedBuild(b);
      setValidation(v);
      setComplexityScore(c);
      setComplexityLoading(false);
      setLastUpdatedAt(b?.updatedAt ?? null);
    };

    loadData();

    const id = setInterval(async () => {
      const b = await fetchBuild();
      if (cancelled) return;

      // Only update if changed
      if (b && b.updatedAt !== lastUpdatedAt) {
        const [v, c] = await Promise.all([fetchValidation(), fetchComplexity()]);
        if (cancelled) return;
        setSelectedBuild(b);
        setValidation(v);
        setComplexityScore(c);
        setLastUpdatedAt(b.updatedAt);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [buildId, fetchBuild, fetchValidation, fetchComplexity, lastUpdatedAt]);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Navigation */}
      <TopNav build={selectedBuild} validation={validation} />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Main Content - DAG */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Health Strip */}
          <BuildHealthStrip build={selectedBuild} validation={validation} complexityScore={complexityScore} />

          {/* DAG Canvas */}
          <div className="flex-1 min-h-0 p-4 overflow-hidden">
            {selectedBuild ? (
              <div className="h-full">
                <DAGVisualization
                  build={selectedBuild}
                  validation={validation}
                  selectedStepId={selectedStepId}
                  selectedVisitId={selectedVisit?.id}
                  selectedAssemblyId={selectedAssembly?.id}
                  highlightStepIds={highlightStepIds}
                  onSelectStep={(id) => {
                    handleSelectStepWithTabSwitch(id);
                  }}
                  onSelectVisit={(visit) => {
                    setSelectedVisit(visit);
                    if (visit) {
                      setSelectedStepId(undefined);
                      setSelectedAssembly(null);
                      setAssemblySteps(null);
                      setRightPanelTab("detail");
                    }
                    setHighlightStepIds([]);
                  }}
                  onSelectAssembly={(assembly, steps) => {
                    setSelectedAssembly(assembly);
                    setAssemblySteps(steps);
                    if (assembly) {
                      setSelectedStepId(undefined);
                      setSelectedVisit(null);
                      setRightPanelTab("detail");
                    }
                  }}
                  onModeChange={handleModeChange}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                Loading build...
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Tabs */}
        {selectedBuild && (
          <RightSidebar
            activeTab={rightPanelTab}
            onTabChange={setRightPanelTab}
            collapsed={rightPanelCollapsed}
            onCollapsedChange={setRightPanelCollapsed}
            hasDetailSelection={hasDetailSelection}
            detailContent={
              <DetailContent
                mode={dagMode}
                selectedStep={selectedStep}
                validation={validation}
                buildId={buildId}
                selectedAssembly={selectedAssembly}
                assemblySteps={assemblySteps}
                assemblies={selectedBuild?.assemblies}
                groupColorMap={groupColorMap}
                selectedVisit={selectedVisit}
                onClose={handleCloseDetailPanel}
                onSelectStep={handleSelectStepWithTabSwitch}
              />
            }
            stepsContent={
              <StepsList
                build={selectedBuild}
                validation={validation}
                selectedStepId={selectedStepId}
                onSelectStep={handleSelectStepWithTabSwitch}
              />
            }
            rulesContent={
              <RulesPanel
                validation={validation}
                onSelectStep={handleSelectStepWithTabSwitch}
                onHighlightSteps={setHighlightStepIds}
              />
            }
            scoreContent={
              <ScoreTab
                buildId={buildId}
                report={complexityScore}
                loading={complexityLoading}
                error={complexityError}
                onRefresh={refreshComplexity}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
