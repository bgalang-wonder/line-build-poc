"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { formatNormalizedScore, formatRawScore } from "@/lib/complexityFormatters";
import { InfoTooltip } from "@/components/ui/Tooltip";

const MOBILE_BREAKPOINT = 768;

type ValidationStatus = "valid" | "blocked" | "warning";

type PortfolioBuild = {
  buildId: string;
  itemId: string;
  name?: string;
  version: number;
  status: "draft" | "published" | "archived";
  validationStatus: ValidationStatus;
  complexity: number | null; // Raw score
  normalizedComplexity?: number | null; // Normalized score (0-100) - optional for backwards compatibility
  rating: "low" | "medium" | "high" | "very_high" | null;
  stepCount: number;
  hardErrorCount: number;
  warningCount: number;
  transferCount: number;
  updatedAt: string;
};

type SortField = "name" | "status" | "complexity" | "updated";
type SortDirection = "asc" | "desc";
type FilterStatus = "all" | "blocked" | "warning" | "ready" | "transfers";

type BuildListTableProps = {
  builds: PortfolioBuild[];
  loading?: boolean;
};

const STATUS_STYLES: Record<ValidationStatus, { dot: string; text: string; bg: string }> = {
  valid: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  blocked: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
};

const RATING_STYLES: Record<string, { text: string; bg: string }> = {
  low: { text: "text-emerald-700", bg: "bg-emerald-50" },
  medium: { text: "text-yellow-700", bg: "bg-yellow-50" },
  high: { text: "text-orange-700", bg: "bg-orange-50" },
  very_high: { text: "text-rose-700", bg: "bg-rose-50" },
};

const RATING_LABELS: Record<string, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  very_high: "V.HIGH",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function BuildListTable({ builds, loading }: BuildListTableProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Mobile detection for card view (F9)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = [...builds];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.itemId.toLowerCase().includes(q) ||
          b.buildId.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((b) => {
        if (filterStatus === "blocked") return b.validationStatus === "blocked";
        if (filterStatus === "warning") return b.validationStatus === "warning";
        if (filterStatus === "ready") return b.validationStatus === "valid";
        if (filterStatus === "transfers") return b.transferCount > 0;
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = (a.name || a.itemId).localeCompare(b.name || b.itemId);
          break;
        case "status":
          const statusOrder = { blocked: 0, warning: 1, valid: 2 };
          cmp = statusOrder[a.validationStatus] - statusOrder[b.validationStatus];
          break;
        case "complexity":
          cmp = (a.complexity ?? 0) - (b.complexity ?? 0);
          break;
        case "updated":
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    return result;
  }, [builds, search, filterStatus, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 text-neutral-400">
        {sortDirection === "asc" ? "\u2191" : "\u2193"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-neutral-400">Loading builds...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search builds..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md text-sm border border-neutral-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="text-sm border border-neutral-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Status</option>
          <option value="blocked">Blocked</option>
          <option value="warning">Warnings</option>
          <option value="ready">Valid</option>
          <option value="transfers">Has Transfers</option>
        </select>

        <select
          value={`${sortField}-${sortDirection}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split("-");
            setSortField(f as SortField);
            setSortDirection(d as SortDirection);
          }}
          className="text-sm border border-neutral-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="updated-desc">Recently Updated</option>
          <option value="updated-asc">Oldest Updated</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="complexity-desc">Highest Complexity</option>
          <option value="complexity-asc">Lowest Complexity</option>
          <option value="status-asc">Status (Blocked First)</option>
          <option value="status-desc">Status (Ready First)</option>
        </select>

        <div className="text-xs text-neutral-500">
          {filteredAndSorted.length} / {builds.length} builds
        </div>
      </div>

      {/* Mobile Card View (F9) */}
      {isMobile ? (
        <div className="p-3 space-y-3">
          {filteredAndSorted.map((build) => {
            const statusStyle = STATUS_STYLES[build.validationStatus];
            const ratingStyle = build.rating ? RATING_STYLES[build.rating] : null;

            return (
              <Link
                key={build.buildId}
                href={`/build/${encodeURIComponent(build.buildId)}`}
                className="block p-4 bg-white border border-neutral-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
              >
                {/* Header: Name + Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate">
                      {build.name || build.itemId}
                    </div>
                    <div className="text-xs text-neutral-400 truncate">{build.buildId}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                    {build.validationStatus === "valid" ? "Valid" : build.validationStatus === "blocked" ? "Blocked" : "Warn"}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>v{build.version}</span>
                  <span>{build.stepCount} steps</span>
                  {build.transferCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      {build.transferCount}
                    </span>
                  )}
                  {build.complexity !== null && ratingStyle && (
                    <InfoTooltip content={formatRawScore(build.complexity)}>
                      <span className={`px-1.5 py-0.5 rounded ${ratingStyle.bg} ${ratingStyle.text}`}>
                        {formatNormalizedScore(build.normalizedComplexity ?? null)} {RATING_LABELS[build.rating!]}
                      </span>
                    </InfoTooltip>
                  )}
                  <span className="ml-auto">{formatDate(build.updatedAt)}</span>
                </div>

                {/* Issues row */}
                {(build.hardErrorCount > 0 || build.warningCount > 0) && (
                  <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-2">
                    {build.hardErrorCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                        {build.hardErrorCount} errors
                      </span>
                    )}
                    {build.warningCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                        {build.warningCount} warnings
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}

          {filteredAndSorted.length === 0 && (
            <div className="py-12 text-center text-neutral-500">
              No builds match the current filters.
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left cursor-pointer hover:text-neutral-700" onClick={() => handleSort("status")}>
                  <span className="flex items-center">
                    Status
                    <SortIndicator field="status" />
                  </span>
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-neutral-700" onClick={() => handleSort("name")}>
                  <span className="flex items-center">
                    Build
                    <SortIndicator field="name" />
                  </span>
                </th>
                <th className="px-4 py-3 text-left">Version</th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-neutral-700" onClick={() => handleSort("complexity")}>
                  <span className="flex items-center gap-1">
                    Complexity
                    <SortIndicator field="complexity" />
                    <InfoTooltip content="Normalized score (0-100). Hover individual scores to see raw values." />
                  </span>
                </th>
                <th className="px-4 py-3 text-left">Steps</th>
                <th className="px-4 py-3 text-left">Errors / Warnings</th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-neutral-700" onClick={() => handleSort("updated")}>
                  <span className="flex items-center">
                    Updated
                    <SortIndicator field="updated" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredAndSorted.map((build) => {
                const statusStyle = STATUS_STYLES[build.validationStatus];
                const ratingStyle = build.rating ? RATING_STYLES[build.rating] : null;

                return (
                  <tr key={build.buildId} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {build.validationStatus === "valid" ? "Valid" : build.validationStatus === "blocked" ? "Blocked" : "Warning"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/build/${encodeURIComponent(build.buildId)}`}
                        className="font-medium text-neutral-900 hover:text-primary-600 hover:underline"
                      >
                        {build.name || build.itemId}
                      </Link>
                      <div className="text-xs text-neutral-500">{build.buildId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">v{build.version}</td>
                    <td className="px-4 py-3">
                      {build.complexity !== null && ratingStyle ? (
                        <InfoTooltip content={formatRawScore(build.complexity)}>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${ratingStyle.bg} ${ratingStyle.text}`}>
                            {formatNormalizedScore(build.normalizedComplexity ?? null)}
                            <span className="text-[10px] opacity-75 ml-1">
                              {RATING_LABELS[build.rating!]}
                            </span>
                          </span>
                        </InfoTooltip>
                      ) : (
                        <span className="text-neutral-400 text-sm">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      <span>{build.stepCount}</span>
                      {build.transferCount > 0 && (
                        <span
                          className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200"
                          title={`${build.transferCount} derived transfer${build.transferCount !== 1 ? 's' : ''}`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          {build.transferCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {build.hardErrorCount > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 mr-1">
                          {build.hardErrorCount} err
                        </span>
                      )}
                      {build.warningCount > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                          {build.warningCount} warn
                        </span>
                      )}
                      {build.hardErrorCount === 0 && build.warningCount === 0 && (
                        <span className="text-neutral-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {formatDate(build.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredAndSorted.length === 0 && (
            <div className="py-12 text-center text-neutral-500">
              No builds match the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
