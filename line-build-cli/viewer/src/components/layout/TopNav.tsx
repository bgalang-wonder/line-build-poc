"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BenchTopLineBuild, ValidationOutput } from "@/types";
import { getRecentBuilds, addRecentBuild, type RecentBuild } from "@/lib/recentBuilds";

type TopNavProps = {
  build: BenchTopLineBuild | null;
  validation: ValidationOutput | null;
};

export function TopNav({ build, validation }: TopNavProps) {
  const router = useRouter();
  const [showRecent, setShowRecent] = useState(false);
  const [recentBuilds, setRecentBuilds] = useState<RecentBuild[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hardErrorCount = validation?.hardErrors?.length ?? 0;
  const warningCount = validation?.warnings?.length ?? 0;

  const statusText = hardErrorCount > 0 ? "BLOCKED" : warningCount > 0 ? "VALID (WARN)" : "VALID";
  const statusColor = hardErrorCount > 0
    ? "bg-rose-100 text-rose-700"
    : warningCount > 0
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  // Track current build in recent history
  useEffect(() => {
    if (build) {
      addRecentBuild(build.id, build.name || build.itemId);
    }
  }, [build?.id]);

  // Load recent builds when dropdown opens
  useEffect(() => {
    if (showRecent) {
      setRecentBuilds(getRecentBuilds().filter((b) => b.buildId !== build?.id));
    }
  }, [showRecent, build?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRecent(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-12 border-b border-neutral-200 bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Back to Dashboard */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>

        {/* Separator */}
        <div className="w-px h-5 bg-neutral-300" />

        {/* Build name and info with recent dropdown */}
        {build ? (
          <div className="flex items-center gap-3 relative" ref={dropdownRef}>
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="flex items-center gap-1.5 hover:bg-neutral-100 rounded px-2 py-1 -ml-2 transition-colors"
            >
              <span className="font-semibold text-neutral-900">
                {build.name || build.itemId}
              </span>
              <svg className={`w-4 h-4 text-neutral-400 transition-transform ${showRecent ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="text-sm text-neutral-500">
              v{build.version}
            </span>
            <span className="text-sm text-neutral-400">
              {build.steps.length} steps
            </span>

            {/* Recent builds dropdown */}
            {showRecent && recentBuilds.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Recently Viewed
                  </span>
                </div>
                <div className="py-1">
                  {recentBuilds.map((recent) => (
                    <button
                      key={recent.buildId}
                      onClick={() => {
                        setShowRecent(false);
                        router.push(`/build/${encodeURIComponent(recent.buildId)}`);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      {recent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className="text-neutral-400 text-sm">Loading...</span>
        )}
      </div>

      {/* Status badge */}
      {build && (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
          {statusText}
        </span>
      )}
    </div>
  );
}
