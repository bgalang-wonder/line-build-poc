import React, { useMemo, useState } from "react";
import type { BenchTopLineBuild, ValidationOutput, Step, DerivedTransferStep } from "@/types";
import { formatStepLabel } from "@/lib/stepLabel";
import { getHardErrorCountByStepId } from "@/lib/validationModel";
import { TransferBadge, TRANSFER_LABELS } from "@/components/visualization/nodes/TransferNode";

type StepsTableProps = {
  build: BenchTopLineBuild;
  validation: ValidationOutput | null;
  selectedStepId?: string;
  onSelectStep: (stepId: string) => void;
};

export function StepsTable({ build, validation, selectedStepId, onSelectStep }: StepsTableProps) {
  const [hardErrorsOnly, setHardErrorsOnly] = useState(false);
  const [entryPointsOnly, setEntryPointOnly] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);
  const [search, setSearch] = useState("");

  const derivedTransfers = build.derivedTransfers ?? [];
  // Count only non-self-referential transfers (those that can actually be visualized)
  const transferCount = derivedTransfers.filter(t => t.producerStepId !== t.consumerStepId).length;

  const hardErrorCounts = useMemo(() => getHardErrorCountByStepId(validation), [validation]);

  const filteredSteps = useMemo(() => {
    return build.steps
      .filter((s) => {
        if (hardErrorsOnly && (hardErrorCounts.get(s.id) ?? 0) === 0) return false;
        if (entryPointsOnly && (s.dependsOn ?? []).length > 0) return false;
        if (search) {
          const q = search.toLowerCase();
          const match = 
            (s.instruction?.toLowerCase().includes(q)) ||
            (s.notes?.toLowerCase().includes(q)) ||
            (s.target?.name?.toLowerCase().includes(q)) ||
            (s.action.family.toLowerCase().includes(q)) ||
            (s.id.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [build.steps, hardErrorsOnly, entryPointsOnly, search, hardErrorCounts]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Filters Strip */}
      <div className="p-3 border-b border-neutral-200 flex flex-wrap items-center gap-4 bg-neutral-50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search steps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-neutral-300 rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={hardErrorsOnly}
            onChange={(e) => setHardErrorsOnly(e.target.checked)}
            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Hard Errors Only
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={entryPointsOnly}
            onChange={(e) => setEntryPointOnly(e.target.checked)}
            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Entry Points Only
        </label>
        <label
          className={`flex items-center gap-2 text-xs font-medium cursor-pointer ${
            transferCount === 0 ? 'text-neutral-400 cursor-not-allowed' : 'text-neutral-700'
          }`}
          title={transferCount === 0 ? 'No transfers in this build' : `Show ${transferCount} derived transfers`}
        >
          <input
            type="checkbox"
            checked={showTransfers}
            onChange={(e) => setShowTransfers(e.target.checked)}
            disabled={transferCount === 0}
            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          />
          Show Transfers {transferCount > 0 ? `(${transferCount})` : ''}
        </label>
        <div className="ml-auto text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
          {filteredSteps.length} / {build.steps.length} steps{showTransfers && transferCount > 0 ? ` + ${transferCount} transfers` : ''}
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-neutral-100 z-10 border-b border-neutral-200 shadow-sm">
            <tr className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
              <th className="px-4 py-2 w-16">#</th>
              <th className="px-4 py-2 w-24">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Station</th>
              <th className="px-4 py-2">Phase</th>
              <th className="px-4 py-2">Equipment</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2 w-16 text-center">Deps</th>
              <th className="px-4 py-2 w-16 text-center">Err</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredSteps.map((s) => {
              const isSelected = s.id === selectedStepId;
              const errorCount = hardErrorCounts.get(s.id) ?? 0;
              
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelectStep(s.id)}
                  className={`group cursor-pointer text-sm transition-colors ${
                    isSelected ? "bg-primary-50" : "hover:bg-neutral-50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-bold text-neutral-800 text-xs bg-neutral-100 px-1.5 py-0.5 rounded group-hover:bg-neutral-200 transition-colors">
                      {formatStepLabel(s.orderIndex)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{s.action.family}</td>
                  <td className="px-4 py-3">
                    <div className="truncate max-w-[200px]" title={s.target?.name}>
                      {s.target?.name || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{s.stationId || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    <span className="text-[10px] uppercase">{s.cookingPhase || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{s.equipment?.applianceId || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">
                    {s.time ? `${s.time.durationSeconds}s${s.time.isActive === false ? ' (p)' : ''}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs ${(s.dependsOn?.length ?? 0) === 0 ? 'text-amber-500 font-bold' : 'text-neutral-400'}`}>
                      {s.dependsOn?.length ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {errorCount > 0 ? (
                      <span className="bg-rose-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow-sm">
                        {errorCount}
                      </span>
                    ) : (
                      <span className="text-emerald-500">✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Transfer rows (exclude self-referential) */}
            {showTransfers && derivedTransfers
              .filter((t) => t.producerStepId !== t.consumerStepId)
              .map((t) => (
              <tr
                key={`transfer:${t.id}`}
                className="bg-blue-50/50 text-sm italic"
              >
                <td className="px-4 py-3">
                  <span className="text-[10px] text-blue-600 font-medium">→</span>
                </td>
                <td className="px-4 py-3">
                  <TransferBadge transferType={t.transferType} />
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  <div className="truncate max-w-[200px]" title={t.assemblyId}>
                    {t.assemblyId}
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-500 text-xs">
                  {t.from.stationId || "—"} → {t.to.stationId || "—"}
                </td>
                <td className="px-4 py-3 text-neutral-400 text-[10px]">
                  DERIVED
                </td>
                <td className="px-4 py-3 text-neutral-400">—</td>
                <td className="px-4 py-3 text-neutral-400 text-xs">
                  {t.estimatedTimeSeconds ? `~${t.estimatedTimeSeconds}s` : "—"}
                </td>
                <td className="px-4 py-3 text-center text-neutral-400 text-[10px]">
                  {t.producerStepId.replace('step-', '')} → {t.consumerStepId.replace('step-', '')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-blue-400 text-[10px]">⬦</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSteps.length === 0 && !showTransfers && (
          <div className="p-12 text-center text-neutral-500">
            No steps match the current filters.
          </div>
        )}
        {filteredSteps.length === 0 && showTransfers && derivedTransfers.length === 0 && (
          <div className="p-12 text-center text-neutral-500">
            No steps or transfers match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
