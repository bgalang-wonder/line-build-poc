"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { ScorePanel, type ScoreReport } from "./ScorePanel";
import { WeightManager } from "./WeightManager";

type ScoreTabMode = "score" | "weights";

type ScoreTabProps = {
  buildId: string | null;
  report: ScoreReport | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

export function ScoreTab({ buildId, report, loading, error, onRefresh }: ScoreTabProps) {
  const [mode, setMode] = useState<ScoreTabMode>("score");

  const handleConfigChange = useCallback(() => {
    // Trigger a refresh of the score when config changes
    onRefresh?.();
  }, [onRefresh]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b border-neutral-200 bg-white">
        <button
          onClick={() => setMode("score")}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            mode === "score"
              ? "text-primary-700 border-b-2 border-primary-500"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Score Breakdown
        </button>
        <button
          onClick={() => setMode("weights")}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            mode === "weights"
              ? "text-primary-700 border-b-2 border-primary-500"
              : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Quick Weights
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {mode === "score" ? (
          <ScorePanel report={report} loading={loading} error={error} />
        ) : (
          <div className="flex flex-col h-full">
            <WeightManager
              buildId={buildId}
              currentScore={report}
              onConfigChange={handleConfigChange}
            />
            {/* Link to full manager */}
            <div className="p-3 border-t border-neutral-200 bg-neutral-50">
              <Link
                href="/weights"
                className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Full Manager
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
