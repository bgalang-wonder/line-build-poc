"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DAGVisualization, type BenchTopLineBuild } from "@/components/visualization/DAGVisualization";
import { Button } from "@/components/ui/Button";
import { StepInspector } from "@/components/visualization/StepInspector";

type BuildSummary = {
  buildId: string;
  itemId: string;
  version: number;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  createdAt: string;
  relativePath: string;
};

type ValidationError = {
  severity: "hard" | "strong" | "soft";
  ruleId: string;
  message: string;
  stepId?: string;
  fieldPath?: string;
};

type ValidationOutput = {
  buildId: string;
  itemId: string;
  timestamp: string;
  valid: boolean;
  hardErrors: ValidationError[];
  warnings: ValidationError[];
  metrics?: Record<string, unknown>;
};

const POLL_MS = 1500;

function statusBadgeVariant(
  status: BuildSummary["status"],
): "success" | "warning" | "danger" | "default" {
  if (status === "published") return "success";
  if (status === "draft") return "warning";
  if (status === "archived") return "default";
  return "default";
}

export default function ViewerPage() {
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [selectedBuild, setSelectedBuild] = useState<BenchTopLineBuild | null>(null);
  const [validation, setValidation] = useState<ValidationOutput | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(undefined);
  const lastFetchedUpdatedAtRef = useRef<string | null>(null);

  const selectedSummary = useMemo(
    () => builds.find((b) => b.buildId === selectedBuildId) ?? null,
    [builds, selectedBuildId],
  );

  const selectedStep = useMemo(() => {
    if (!selectedBuild || !selectedStepId) return null;
    return selectedBuild.steps.find((s) => s.id === selectedStepId) ?? null;
  }, [selectedBuild, selectedStepId]);

  const fetchBuilds = useCallback(async (): Promise<BuildSummary[]> => {
    const res = await fetch("/api/builds", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch builds: ${res.status}`);
    const json = (await res.json()) as unknown;
    return Array.isArray(json) ? (json as BuildSummary[]) : [];
  }, []);

  const fetchBuild = useCallback(async (buildId: string): Promise<BenchTopLineBuild> => {
    const res = await fetch(`/api/builds/${encodeURIComponent(buildId)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Failed to fetch build: ${res.status}`);
    return (await res.json()) as BenchTopLineBuild;
  }, []);

  const fetchValidation = useCallback(async (buildId: string): Promise<ValidationOutput | null> => {
    const res = await fetch(`/api/validation/${encodeURIComponent(buildId)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch validation: ${res.status}`);
    return (await res.json()) as ValidationOutput;
  }, []);

  // Poll /api/builds every 1–2 seconds (POLL_MS = 1500ms).
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const next = await fetchBuilds();
        if (cancelled) return;
        setBuilds(next);

        if (next.length === 0) {
          setSelectedBuildId(null);
          setSelectedBuild(null);
          setValidation(null);
          setSelectedStepId(undefined);
          lastFetchedUpdatedAtRef.current = null;
          return;
        }

        setSelectedBuildId((prev) => {
          if (prev && next.some((b) => b.buildId === prev)) return prev;
          return next[0].buildId;
        });
      } catch {
        // Keep last-known state; this is a PoC viewer.
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchBuilds]);

  // Refetch build + validation when selection changes OR when updatedAt changes.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedBuildId) return;
      const nextUpdatedAt = selectedSummary?.updatedAt ?? null;
      if (
        lastFetchedUpdatedAtRef.current === nextUpdatedAt &&
        selectedBuild?.id === selectedBuildId
      ) {
        return;
      }

      try {
        const [b, v] = await Promise.all([
          fetchBuild(selectedBuildId),
          fetchValidation(selectedBuildId),
        ]);
        if (cancelled) return;
        setSelectedBuild(b);
        setValidation(v);
        lastFetchedUpdatedAtRef.current = nextUpdatedAt;
      } catch {
        if (cancelled) return;
        setSelectedBuild(null);
        setValidation(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [fetchBuild, fetchValidation, selectedBuildId, selectedSummary?.updatedAt, selectedBuild?.id]);

  return (
    <div className="h-[calc(100vh-80px)] bg-neutral-50 p-6 overflow-hidden">
      <div className="mx-auto max-w-7xl h-full grid grid-cols-12 gap-6">
        {/* Left Column: Build List */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 h-full flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0 shadow-sm border border-neutral-200">
            <CardHeader className="flex-none">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Builds</div>
                <Badge variant="default">{builds.length}</Badge>
              </div>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto min-h-0 p-3">
              <div className="space-y-2" role="listbox" aria-label="Available builds">
                {builds.length === 0 ? (
                  <div className="text-sm text-neutral-500 px-1">No builds found.</div>
                ) : (
                  builds.map((b) => {
                    const active = b.buildId === selectedBuildId;
                    return (
                      <button
                        key={b.buildId}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          active
                            ? "border-primary-600 bg-primary-50 text-neutral-900 shadow-sm"
                            : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900"
                        }`}
                        onClick={() => {
                          setSelectedBuildId(b.buildId);
                          setSelectedStepId(undefined);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {b.itemId || b.buildId}
                            </div>
                            <div className="text-xs opacity-70 truncate">
                              v{b.version} • {b.buildId}
                            </div>
                          </div>
                          <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                        </div>
                        <div className="mt-2 text-xs opacity-50 truncate">
                          updated {b.updatedAt || "—"}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Graph + Inspector */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 h-full flex flex-col gap-6 min-h-0">
          {/* Graph Card */}
          <Card padding="none" className="flex-1 flex flex-col min-h-0 shadow-sm border border-neutral-200">
            <CardHeader className="flex-none">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">
                    {selectedBuild ? selectedBuild.itemId : "Select a build"}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {selectedBuild ? `${selectedBuild.id} • v${selectedBuild.version}` : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {validation ? (
                    <Badge variant={validation.valid ? "success" : "danger"}>
                      {validation.valid ? "Valid" : "Invalid"}
                    </Badge>
                  ) : (
                    <Badge variant="default">No validation</Badge>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!selectedBuildId) return;
                      lastFetchedUpdatedAtRef.current = null;
                      setSelectedBuild(null);
                      setValidation(null);
                    }}
                    disabled={!selectedBuildId}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="flex-1 flex flex-col min-h-0 p-0 relative">
              {validation && !validation.valid ? (
                <div className="absolute top-4 left-4 z-10 max-w-sm pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-sm border border-rose-200 rounded-lg p-3 shadow-sm">
                    <div className="text-sm font-medium text-rose-700">
                      Validation Issues
                    </div>
                    <div className="text-xs text-rose-600 mt-1">
                      {validation.hardErrors.length} hard error(s)
                    </div>
                    {validation.warnings.length > 0 && (
                      <div className="text-xs text-amber-600 mt-0.5">
                        {validation.warnings.length} warning(s)
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex-1 min-h-0 w-full">
                {selectedBuild ? (
                  <DAGVisualization
                    build={selectedBuild}
                    validation={validation}
                    selectedStepId={selectedStepId}
                    onSelectStep={(id) => setSelectedStepId(id)}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-neutral-50/50">
                    <div className="text-center text-neutral-500">
                      <div className="text-sm font-medium mb-1">No build selected</div>
                      <div className="text-xs">Choose a build from the list to view steps.</div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Inspector Card (Fixed height / Auto) */}
          <div className="flex-none max-h-[35%] overflow-y-auto">
             <StepInspector step={selectedStep} validation={validation} />
          </div>
        </div>
      </div>
    </div>
  );
}