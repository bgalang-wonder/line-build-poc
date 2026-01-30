"use client";

import React, { useState, useRef, useEffect, useCallback, ReactNode } from "react";

export type RightSidebarTab = "detail" | "steps" | "rules" | "score";

type TabCounts = {
  steps?: number;
  rules?: number;
  rulesWithIssues?: number;
};

type RightSidebarProps = {
  activeTab: RightSidebarTab;
  onTabChange: (tab: RightSidebarTab) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  detailContent: ReactNode;
  stepsContent: ReactNode;
  rulesContent: ReactNode;
  scoreContent: ReactNode;
  hasDetailSelection: boolean;
  tabCounts?: TabCounts;
};

const SIDEBAR_WIDTH_KEY = "lineBuildViewer.rightSidebarWidth";
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const MOBILE_BREAKPOINT = 768;

export function RightSidebar({
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
  detailContent,
  stepsContent,
  rulesContent,
  scoreContent,
  hasDetailSelection,
  tabCounts,
}: RightSidebarProps) {
  // Mobile detection for bottom sheet mode (F9)
  const [isMobile, setIsMobile] = useState(false);
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load persisted width from localStorage
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    try {
      const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      return stored ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(stored, 10))) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Persist width changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      // ignore
    }
  }, [width]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarRef.current?.offsetWidth ?? width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Dragging left increases width, dragging right decreases
      const delta = startX.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const tabs: { id: RightSidebarTab; label: string; icon: ReactNode; count?: number; hasIssues?: boolean }[] = [
    {
      id: "detail",
      label: "Detail",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "steps",
      label: "Steps",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      count: tabCounts?.steps,
    },
    {
      id: "rules",
      label: "Rules",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      count: tabCounts?.rules,
      hasIssues: (tabCounts?.rulesWithIssues ?? 0) > 0,
    },
    {
      id: "score",
      label: "Score",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  // Mobile bottom sheet view (F9)
  if (isMobile) {
    return (
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white border-t border-neutral-200 shadow-lg transition-all duration-300 ${
          bottomSheetExpanded ? "h-[70vh]" : "h-auto"
        }`}
      >
        {/* Drag handle and tabs */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100">
          <button
            onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
            className="flex-1 flex justify-center py-1"
          >
            <div className="w-10 h-1 rounded-full bg-neutral-300" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-2 py-1 bg-neutral-50 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setBottomSheetExpanded(true);
              }}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-primary-700 shadow-sm border border-neutral-200"
                  : "text-neutral-600"
              }`}
            >
              {tab.icon}
              <span className="hidden xs:inline">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] text-neutral-400">({tab.count})</span>
              )}
              {tab.hasIssues && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              )}
            </button>
          ))}
        </div>

        {/* Content area - only show when expanded */}
        {bottomSheetExpanded && (
          <div className="flex-1 overflow-auto" style={{ height: "calc(70vh - 80px)" }}>
            {activeTab === "detail" && (hasDetailSelection ? detailContent : (
              <div className="h-full flex items-center justify-center text-neutral-400 p-4 text-sm">
                Select a node to view details
              </div>
            ))}
            {activeTab === "steps" && stepsContent}
            {activeTab === "rules" && rulesContent}
            {activeTab === "score" && scoreContent}
          </div>
        )}
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="w-12 border-l border-neutral-200 bg-white flex flex-col">
        {/* Expand Button */}
        <button
          onClick={() => onCollapsedChange(false)}
          className="p-3 hover:bg-neutral-100 transition-colors text-neutral-500 hover:text-neutral-700 border-b border-neutral-200"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Vertical Tab Icons */}
        <div className="flex-1 flex flex-col items-center py-2 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onCollapsedChange(false);
                onTabChange(tab.id);
              }}
              className={`p-2 rounded transition-colors relative ${
                activeTab === tab.id
                  ? "bg-primary-100 text-primary-700"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              }`}
              title={tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label}
            >
              {tab.icon}
              {tab.hasIssues && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="border-l border-neutral-200 bg-white flex flex-col relative"
      style={{ width }}
    >
      {/* Resize Handle - 8px wide for Fitts's Law compliance */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize group z-10 flex items-center justify-center"
      >
        {/* Visual drag affordance */}
        <div className="w-1 h-12 rounded-full bg-neutral-200 group-hover:bg-primary-400 transition-colors" />
      </div>

      {/* Header with Tabs */}
      <div className="border-b border-neutral-200 flex items-center justify-between px-2 py-1.5 bg-neutral-50">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-primary-700 shadow-sm border border-neutral-200"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-[10px] text-neutral-400 font-normal">
                  ({tab.count})
                </span>
              )}
              {tab.hasIssues && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Has issues" />
              )}
            </button>
          ))}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => onCollapsedChange(true)}
          className="p-1.5 hover:bg-neutral-100 rounded transition-colors text-neutral-500 hover:text-neutral-700"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === "detail" && (
          <div className="flex-1 overflow-auto">
            {hasDetailSelection ? (
              detailContent
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 p-6">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-sm text-center">Select a node in the graph to view details</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "steps" && (
          <div className="flex-1 overflow-hidden">
            {stepsContent}
          </div>
        )}
        {activeTab === "rules" && (
          <div className="flex-1 overflow-hidden">
            {rulesContent}
          </div>
        )}
        {activeTab === "score" && (
          <div className="flex-1 overflow-hidden">
            {scoreContent}
          </div>
        )}
      </div>
    </div>
  );
}
