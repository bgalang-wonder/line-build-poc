import React from "react";

type BadgeProps = {
  variant?: "default" | "success" | "warning" | "danger";
  children: React.ReactNode;
};

export function Badge({ variant = "default", children }: BadgeProps) {
  const variants = {
    default: "bg-neutral-100 text-neutral-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
