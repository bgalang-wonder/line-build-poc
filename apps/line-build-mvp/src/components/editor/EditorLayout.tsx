'use client';

/**
 * Editor Shell Layout (benchtop-x0c.11.2)
 *
 * 3-column responsive layout:
 * - Left: Chat Panel (25%)
 * - Center: DAG Visualization (40%)
 * - Right: Form + Validation (35%)
 *
 * Features:
 * - Draggable column dividers for resizing
 * - Responsive: Stacks vertically on screens < 1200px
 * - 60px header with nav elements
 * - 16px padding, 8px gaps between columns
 */

import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EditorLayoutProps {
  chatPanel?: React.ReactNode;
  dagPanel?: React.ReactNode;
  formPanel?: React.ReactNode;
  validationPanel?: React.ReactNode;
}

// ============================================================================
// Resizable Divider Component
// ============================================================================

interface ResizableDividerProps {
  vertical?: boolean;
  onDrag: (delta: number) => void;
}

function ResizableDivider({ vertical = true, onDrag }: ResizableDividerProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = vertical ? e.movementX : e.movementY;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, vertical, onDrag]);

  return (
    <div
      onMouseDown={() => setIsDragging(true)}
      className={`flex items-center justify-center cursor-col-resize hover:bg-blue-200 transition-colors group ${
        vertical ? 'w-2 bg-gray-200' : 'h-2 bg-gray-200'
      }`}
    >
      <GripVertical className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ============================================================================
// Editor Layout Component
// ============================================================================

export function EditorLayout({
  chatPanel,
  dagPanel,
  formPanel,
  validationPanel,
}: EditorLayoutProps) {
  // Column widths in pixels
  const [leftWidth, setLeftWidth] = useState(400); // ~25% of 1600px
  const [centerWidth, setCenterWidth] = useState(640); // ~40%
  // rightWidth is calculated as remaining space

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1600);

  // Update container width on mount and resize
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const rightWidth = Math.max(300, containerWidth - leftWidth - centerWidth - 16); // 16 = 2 divider widths

  const handleLeftResize = (delta: number) => {
    const newWidth = Math.max(300, Math.min(leftWidth + delta, containerWidth - 600));
    setLeftWidth(newWidth);
  };

  const handleCenterResize = (delta: number) => {
    const newWidth = Math.max(300, Math.min(centerWidth + delta, containerWidth - leftWidth - 300 - 16));
    setCenterWidth(newWidth);
  };

  // Check if we should stack vertically (responsive)
  const isStacked = containerWidth < 1200;

  if (isStacked) {
    // Mobile/tablet: stack vertically
    return (
      <div
        ref={containerRef}
        className="flex flex-col h-[calc(100vh-60px)] bg-white overflow-hidden"
      >
        {/* Chat Panel */}
        <div className="min-h-0 border-b border-gray-200">
          <div className="h-60 overflow-y-auto p-4 bg-gray-50">
            {chatPanel || <div className="text-gray-500 text-sm">Chat Panel</div>}
          </div>
        </div>

        {/* DAG Panel */}
        <div className="min-h-0 border-b border-gray-200">
          <div className="h-80 overflow-auto p-4 bg-gray-50">
            {dagPanel || <div className="text-gray-500 text-sm">DAG Visualization</div>}
          </div>
        </div>

        {/* Form + Validation Panel */}
        <div className="flex-1 min-h-0">
          <div className="h-full flex overflow-hidden">
            {/* Form */}
            <div className="flex-1 border-r border-gray-200 overflow-y-auto p-4">
              {formPanel || <div className="text-gray-500 text-sm">Form</div>}
            </div>

            {/* Validation */}
            <div className="w-1/3 overflow-y-auto p-4 bg-gray-50">
              {validationPanel || <div className="text-gray-500 text-sm">Validation</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: 3-column layout
  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-60px)] bg-white gap-2 p-4 overflow-hidden"
    >
      {/* Left Column: Chat */}
      <div
        style={{ width: `${leftWidth}px` }}
        className="min-w-[300px] flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto p-4">
          {chatPanel || <div className="text-gray-500 text-sm">Chat Panel</div>}
        </div>
      </div>

      {/* Divider 1 */}
      <ResizableDivider onDrag={handleLeftResize} />

      {/* Center Column: DAG */}
      <div
        style={{ width: `${centerWidth}px` }}
        className="min-w-[300px] flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
      >
        <div className="flex-1 overflow-auto p-4">
          {dagPanel || <div className="text-gray-500 text-sm">DAG Visualization</div>}
        </div>
      </div>

      {/* Divider 2 */}
      <ResizableDivider onDrag={handleCenterResize} />

      {/* Right Column: Form + Validation (split vertically) */}
      <div
        style={{ width: `${rightWidth}px` }}
        className="min-w-[300px] flex flex-col gap-2 overflow-hidden"
      >
        {/* Form Panel */}
        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-y-auto p-4">
          {formPanel || <div className="text-gray-500 text-sm">Form</div>}
        </div>

        {/* Validation Panel */}
        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-y-auto p-4">
          {validationPanel || <div className="text-gray-500 text-sm">Validation Panel</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Placeholder Components for Development
// ============================================================================

export function ChatPanelPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">Chat</div>
      <div className="space-y-2">
        <div className="bg-blue-100 text-blue-900 rounded p-2 text-xs">
          User message here
        </div>
        <div className="bg-green-100 text-green-900 rounded p-2 text-xs">
          Assistant response here
        </div>
      </div>
      <div className="pt-2 border-t border-gray-200">
        <input
          type="text"
          placeholder="Type a message..."
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          disabled
        />
      </div>
    </div>
  );
}

export function DAGPanelPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">DAG Visualization</div>
      <div className="bg-white rounded border border-gray-300 p-4 text-center text-xs text-gray-500 h-40 flex items-center justify-center">
        Dependency graph will render here
      </div>
    </div>
  );
}

export function FormPanelPlaceholder() {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">Form Editor</div>
      <div className="space-y-2">
        <div>
          <label className="text-xs font-semibold text-gray-700">
            Action Type
          </label>
          <select className="w-full mt-1 text-xs border border-gray-300 rounded px-2 py-1" disabled>
            <option>Select action...</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Target</label>
          <input
            type="text"
            placeholder="Item name"
            className="w-full mt-1 text-xs border border-gray-300 rounded px-2 py-1"
            disabled
          />
        </div>
      </div>
    </div>
  );
}

export function ValidationPanelPlaceholder() {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-900">Validation</div>
      <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800">
        ✓ All Clear
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div>• Rule 1: Pass</div>
        <div>• Rule 2: Pass</div>
      </div>
    </div>
  );
}
