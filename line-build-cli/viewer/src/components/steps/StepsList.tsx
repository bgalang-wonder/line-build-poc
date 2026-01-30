import React, { useMemo, useState } from "react";
import type { BenchTopLineBuild, ValidationOutput } from "@/types";
import { getHardErrorCountByStepId } from "@/lib/validationModel";
import { StepCard } from "./StepCard";

type FilterMode = "all" | "errors" | "entry";

type StepsListProps = {
  build: BenchTopLineBuild;
  validation: ValidationOutput | null;
  selectedStepId?: string;
  onSelectStep: (stepId: string) => void;
};

export function StepsList({ build, validation, selectedStepId, onSelectStep }: StepsListProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  const hardErrorCounts = useMemo(() => getHardErrorCountByStepId(validation), [validation]);

  const filteredSteps = useMemo(() => {
    return build.steps
      .filter((s) => {
        // Filter by mode
        if (filterMode === "errors" && (hardErrorCounts.get(s.id) ?? 0) === 0) return false;
        if (filterMode === "entry" && (s.dependsOn ?? []).length > 0) return false;

        // Search filter
        if (search) {
          const q = search.toLowerCase();
          const match =
            s.instruction?.toLowerCase().includes(q) ||
            s.notes?.toLowerCase().includes(q) ||
            s.target?.name?.toLowerCase().includes(q) ||
            s.action.family.toLowerCase().includes(q) ||
            s.action.techniqueId?.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [build.steps, filterMode, search, hardErrorCounts]);

  const errorCount = useMemo(
    () => build.steps.filter((s) => (hardErrorCounts.get(s.id) ?? 0) > 0).length,
    [build.steps, hardErrorCounts]
  );
  const entryCount = useMemo(
    () => build.steps.filter((s) => (s.dependsOn ?? []).length === 0).length,
    [build.steps]
  );

  const handleDependencyClick = (stepId: string) => {
    onSelectStep(stepId);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Filters Strip */}
      <div className="p-3 border-b border-neutral-200 bg-neutral-50 space-y-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search steps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-neutral-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filterMode === "all"
                ? "bg-primary-100 text-primary-700"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            All ({build.steps.length})
          </button>
          <button
            onClick={() => setFilterMode("errors")}
            disabled={errorCount === 0}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filterMode === "errors"
                ? "bg-rose-100 text-rose-700"
                : errorCount > 0
                  ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  : "bg-neutral-50 text-neutral-300 cursor-not-allowed"
            }`}
          >
            Errors ({errorCount})
          </button>
          <button
            onClick={() => setFilterMode("entry")}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filterMode === "entry"
                ? "bg-amber-100 text-amber-700"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Entry Points ({entryCount})
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="px-3 py-2 border-b border-neutral-100 bg-white">
        <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
          {filteredSteps.length} / {build.steps.length} steps
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {filteredSteps.map((step) => {
          const errorCount = hardErrorCounts.get(step.id) ?? 0;
          return (
            <StepCard
              key={step.id}
              step={step}
              isSelected={step.id === selectedStepId}
              hasError={errorCount > 0}
              errorCount={errorCount}
              onSelect={() => onSelectStep(step.id)}
              onDependencyClick={handleDependencyClick}
            />
          );
        })}

        {filteredSteps.length === 0 && (
          <div className="py-12 text-center text-neutral-500 text-sm">
            No steps match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
