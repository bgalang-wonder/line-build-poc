"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  SummaryCard,
  BuildsIcon,
  BlockedIcon,
  WarningIcon,
  ComplexityIcon,
} from "@/components/dashboard/SummaryCard";
import { BuildListTable } from "@/components/dashboard/BuildListTable";

type PortfolioSummary = {
  totalBuilds: number;
  blockedCount: number;
  warningCount: number;
  readyCount: number;
  avgComplexity: number | null;
};

type PortfolioBuild = {
  buildId: string;
  itemId: string;
  name?: string;
  version: number;
  status: "draft" | "published" | "archived";
  validationStatus: "valid" | "blocked" | "warning";
  complexity: number | null;
  rating: "low" | "medium" | "high" | "very_high" | null;
  stepCount: number;
  hardErrorCount: number;
  warningCount: number;
  transferCount: number;
  updatedAt: string;
};

type PortfolioResponse = {
  summary: PortfolioSummary;
  builds: PortfolioBuild[];
};

const POLL_MS = 3000;

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      const data = (await res.json()) as PortfolioResponse;
      setPortfolio(data);
      setError(null);
    } catch (err) {
      console.warn("Portfolio fetch error:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const id = setInterval(fetchPortfolio, POLL_MS);
    return () => clearInterval(id);
  }, [fetchPortfolio]);

  const summary = portfolio?.summary ?? {
    totalBuilds: 0,
    blockedCount: 0,
    warningCount: 0,
    readyCount: 0,
    avgComplexity: null,
  };
  const builds = portfolio?.builds ?? [];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <DashboardHeader buildCount={summary.totalBuilds} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 text-sm">
            Error loading portfolio: {error}
          </div>
        )}

        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Builds"
            value={summary.totalBuilds}
            icon={<BuildsIcon />}
          />
          <SummaryCard
            label="Blocked"
            value={summary.blockedCount}
            sublabel={summary.blockedCount > 0 ? "Need attention" : "None blocked"}
            variant={summary.blockedCount > 0 ? "blocked" : "default"}
            icon={<BlockedIcon />}
          />
          <SummaryCard
            label="Warnings"
            value={summary.warningCount}
            sublabel={summary.warningCount > 0 ? "Review suggested" : "All clean"}
            variant={summary.warningCount > 0 ? "warning" : "default"}
            icon={<WarningIcon />}
          />
          <SummaryCard
            label="Avg Complexity"
            value={summary.avgComplexity !== null ? summary.avgComplexity.toFixed(1) : "--"}
            sublabel="Across all builds"
            icon={<ComplexityIcon />}
          />
        </div>

        {/* Build List */}
        <BuildListTable builds={builds} loading={loading} />
      </div>
    </div>
  );
}
