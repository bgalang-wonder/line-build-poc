import React, { useMemo, useState } from "react";
import type { ValidationOutput } from "@/types";
import { buildRuleSummaries } from "@/lib/validationModel";
import { ALL_RULES } from "@/lib/allRules";
import { Badge } from "@/components/ui/Badge";

type RulesPanelProps = {
  validation: ValidationOutput | null;
  onSelectStep: (stepId: string) => void;
  onHighlightSteps?: (stepIds: string[]) => void;
};

export function RulesPanel({ validation, onSelectStep, onHighlightSteps }: RulesPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const summaries = useMemo(() => buildRuleSummaries(validation), [validation]);

  const rulesWithStatus = useMemo(() => {
    const summaryMap = new Map(summaries.map(s => [s.ruleId, s]));
    
    return ALL_RULES.map(rule => {
      const summary = summaryMap.get(rule.id);
      return {
        ...rule,
        status: summary ? (summary.severity === 'hard' ? 'fail' : 'warn') : 'pass',
        summary
      };
    });
  }, [summaries]);

  const displayedRules = showAll ? rulesWithStatus : rulesWithStatus.filter(r => r.status !== 'pass');

  if (!validation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg">
        <div className="text-neutral-400 text-4xl mb-4">?</div>
        <h3 className="text-lg font-semibold text-neutral-900">No validation data</h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-neutral-900">Validation Rules Status</h3>
          <p className="text-xs text-neutral-500">
            {showAll ? "Showing all discrete rules" : "Showing only failing rules"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Show All Rules
        </label>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="sticky top-0 bg-neutral-100 z-10 border-b border-neutral-200 shadow-sm">
            <tr className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
              <th className="px-4 py-3 w-16 text-center">Status</th>
              <th className="px-4 py-3 w-24">Rule ID</th>
              <th className="px-4 py-3 w-24 text-center">Scope</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-center w-16">Count</th>
              <th className="px-4 py-3">Affected Steps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayedRules.map((r) => (
              <tr
                key={r.id}
                onClick={() => {
                  if (r.summary && r.summary.stepIds.length > 0) {
                    onSelectStep(r.summary.stepIds[0]);
                    onHighlightSteps?.(r.summary.stepIds);
                  }
                }}
                className={`group text-sm transition-colors ${
                  r.status !== 'pass' ? "cursor-pointer hover:bg-neutral-50" : "bg-neutral-50/30"
                }`}
              >
                <td className="px-4 py-4 text-center">
                  {r.status === 'pass' ? (
                    <span className="text-emerald-500 font-bold">✓</span>
                  ) : r.status === 'fail' ? (
                    <span className="text-rose-600 font-bold">✕</span>
                  ) : (
                    <span className="text-amber-500 font-bold">⚠</span>
                  )}
                </td>
                <td className="px-4 py-4 font-mono text-xs font-bold text-neutral-900">{r.id}</td>
                <td className="px-4 py-4 text-center">
                  <span className="text-[10px] uppercase text-neutral-500 font-medium px-1.5 py-0.5 border border-neutral-200 rounded">
                    {r.scope}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-neutral-800">{r.description}</div>
                  {r.appliesTo && (
                    <div className="text-[10px] text-neutral-400 mt-0.5 italic">Applies to: {r.appliesTo}</div>
                  )}
                </td>
                <td className="px-4 py-4 text-center font-semibold">
                  {r.summary ? r.summary.count : 0}
                </td>
                <td className="px-4 py-4">
                  {r.summary && r.summary.stepIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1 items-center">
                      {r.summary.stepIds.map(stepId => (
                        <button
                          key={stepId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStep(stepId);
                            onHighlightSteps?.(r.summary!.stepIds);
                          }}
                          className="text-[10px] bg-neutral-100 hover:bg-primary-100 hover:text-primary-700 px-1.5 py-0.5 rounded transition-colors"
                        >
                          {stepId}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {displayedRules.length === 0 && !showAll && (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                   <div className="text-emerald-500 text-3xl mb-2">✓</div>
                   <div className="font-medium text-neutral-900">All rules passing</div>
                   <button 
                     onClick={() => setShowAll(true)}
                     className="text-primary-600 hover:underline text-xs mt-2"
                   >
                     Show all rules
                   </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
