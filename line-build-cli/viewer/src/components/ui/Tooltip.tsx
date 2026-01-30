import React, { useState, useRef, useEffect, ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

/**
 * Lightweight tooltip component with 150ms delay (per Doherty Threshold)
 */
export function Tooltip({ content, children, position = "top", delay = 150 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-800",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-neutral-800",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-neutral-800",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-neutral-800",
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && content && (
        <span
          role="tooltip"
          className={`absolute z-50 px-2 py-1.5 text-xs text-white bg-neutral-800 rounded shadow-lg whitespace-nowrap ${positionClasses[position]}`}
        >
          {content}
          <span className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
        </span>
      )}
    </span>
  );
}

/**
 * Info icon with tooltip - use for explanatory hints
 */
export function InfoTooltip({ content, className = "" }: { content: ReactNode; className?: string }) {
  return (
    <Tooltip content={content} position="top">
      <span className={`inline-flex items-center justify-center w-4 h-4 text-neutral-400 hover:text-neutral-600 cursor-help ${className}`}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
        </svg>
      </span>
    </Tooltip>
  );
}
