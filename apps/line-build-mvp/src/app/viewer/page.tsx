"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DAGVisualization, type BenchTopLineBuild } from "@/components/visualization/DAGVisualization";
import { Button } from "@/components/ui/Button";

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
    <div className="min-h-[calc(100vh-80px)] bg-neutral-50 p-6">
      <div className="mx-auto max-w-7xl grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">Builds</div>
                <Badge variant="default">{builds.length}</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {builds.length === 0 ? (
                  <div className="text-sm text-neutral-500">No builds found.</div>
                ) : (
                  builds.map((b) => {
                    const active = b.buildId === selectedBuildId;
                    return (
                      <button
                        key={b.buildId}
                        type="button"
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                          active
                            ? "border-primary-600 bg-primary-50"
                            : "border-neutral-200 bg-white hover:bg-neutral-50"
                        }`}
                        onClick={() => {
                          setSelectedBuildId(b.buildId);
                          setSelectedStepId(undefined);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-neutral-900 truncate">
                              {b.itemId || b.buildId}
                            </div>
                            <div className="text-xs text-neutral-500 truncate">
                              v{b.version} • {b.buildId}
                            </div>
                          </div>
                          <Badge variant={statusBadgeVariant(b.status)}>{b.status}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-neutral-500 truncate">
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

        <div className="col-span-12 md:col-span-8 lg:col-span-9 space-y-6">
          <Card>
            <CardHeader>
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
            <CardBody>
              {validation && !validation.valid ? (
                <div className="mb-4 text-sm text-danger-700">
                  {validation.hardErrors.length} hard error(s), {validation.warnings.length} warning(s)
                </div>
              ) : null}

              <div className="h-[600px]">
                {selectedBuild ? (
                  <DAGVisualization
                    build={selectedBuild}
                    selectedStepId={selectedStepId}
                    onSelectStep={(id) => setSelectedStepId(id)}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-white rounded border border-neutral-200">
                    <div className="text-center text-neutral-500">
                      <div className="text-sm font-medium mb-1">No build selected</div>
                      <div className="text-xs">Choose a build from the list to view steps.</div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

