"use client";

import React from "react";

type SummaryCardVariant = "default" | "blocked" | "warning" | "success";

type SummaryCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: SummaryCardVariant;
  icon?: React.ReactNode;
};

const VARIANT_STYLES: Record<SummaryCardVariant, { bg: string; text: string; icon: string }> = {
  default: {
    bg: "bg-white",
    text: "text-neutral-900",
    icon: "text-neutral-400",
  },
  blocked: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    icon: "text-rose-400",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    icon: "text-amber-400",
  },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    icon: "text-emerald-400",
  },
};

export function SummaryCard({ label, value, sublabel, variant = "default", icon }: SummaryCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className={`${styles.bg} rounded-lg border border-neutral-200 p-4 flex items-start gap-3`}>
      {icon && (
        <div className={`${styles.icon} flex-shrink-0`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
          {label}
        </div>
        <div className={`text-2xl font-bold ${styles.text}`}>
          {value}
        </div>
        {sublabel && (
          <div className="text-xs text-neutral-500 mt-0.5">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

// Pre-built icons for common use cases
export function BuildsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

export function BlockedIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function ComplexityIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
