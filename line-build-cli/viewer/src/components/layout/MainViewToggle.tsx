import React from "react";

export type ViewType = "graph" | "steps" | "rules";

type MainViewToggleProps = {
  value: ViewType;
  onChange: (value: ViewType) => void;
};

export function MainViewToggle({ value, onChange }: MainViewToggleProps) {
  const options: { id: ViewType; label: string }[] = [
    { id: "graph", label: "Graph" },
    { id: "steps", label: "Steps" },
    { id: "rules", label: "Rules" },
  ];

  return (
    <div className="inline-flex rounded-md overflow-hidden border border-neutral-300">
      {options.map((opt, idx) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            idx > 0 ? "border-l border-neutral-300" : ""
          } ${
            value === opt.id
              ? "bg-primary-600 text-white"
              : "bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
