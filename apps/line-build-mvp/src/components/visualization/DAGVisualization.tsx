'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';

/**
 * Canonical PoC schema subset for visualization.
 * Source of truth: docs/handoff/POC_TASKS.json -> shared_conventions.schema_contract
 */
export type ActionFamily =
  | 'PREP'
  | 'HEAT'
  | 'TRANSFER'
  | 'COMBINE'
  | 'ASSEMBLE'
  | 'PORTION'
  | 'CHECK'
  | 'VEND'
  | 'OTHER';

export type Step = {
  id: string;
  orderIndex: number;
  action: {
    family: ActionFamily;
    techniqueId?: string;
    detailId?: string;
    displayTextOverride?: string;
  };
  target?: {
    type?: string;
    bomUsageId?: string;
    bomComponentId?: string;
    name?: string;
  };
  equipment?: {
    applianceId: string;
    presetId?: string;
  };
  time?: {
    durationSeconds: number;
    isActive: boolean;
  };
  cookingPhase?: string;
  instruction?: string;
  notes?: string;
  dependsOn?: string[];
};

export type BenchTopLineBuild = {
  id: string;
  itemId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  steps: Step[];
  createdAt: string;
  updatedAt: string;
  menuItemId?: string;
};

interface DAGVisualizationProps {
  build: BenchTopLineBuild;
  selectedStepId?: string;
  onSelectStep?: (stepId: string) => void;
}

const ACTION_COLORS: Record<ActionFamily, string> = {
  PREP: '#3B82F6', // blue
  HEAT: '#EF4444', // red
  TRANSFER: '#8B5CF6', // purple
  COMBINE: '#06B6D4', // cyan
  ASSEMBLE: '#10B981', // green
  PORTION: '#F59E0B', // amber
  CHECK: '#6366F1', // indigo
  VEND: '#EC4899', // pink
  OTHER: '#6B7280', // neutral
};

const PHASE_BG: Record<string, string> = {
  PRE_COOK: '#F0F9FF', // light blue
  COOK: '#FEF2F2', // light red
  POST_COOK: '#F0FDF4', // light green
  ASSEMBLY: '#FDF2F8', // light pink
  PASS: '#ECFDF5', // very light green
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

function createDAGNodes(steps: Step[], selectedStepId?: string): Node[] {
  // Layout: simple row by orderIndex (T5.5 will add deterministic dagre layout).
  const ordered = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return ordered.map((step, index) => {
    const actionColor = ACTION_COLORS[step.action.family] || '#6B7280';
    const bgColor = step.cookingPhase ? PHASE_BG[step.cookingPhase] : '#FFFFFF';
    const isSelected = step.id === selectedStepId;

    const targetLabel =
      step.target?.name ||
      step.target?.bomUsageId ||
      step.target?.bomComponentId ||
      '';

    const instructionLabel =
      typeof step.instruction === 'string' && step.instruction.trim().length > 0
        ? step.instruction.trim()
        : typeof step.notes === 'string' && step.notes.trim().length > 0
          ? step.notes.trim()
          : '';

    return {
      id: step.id,
      data: {
        label: (
          <div className="w-full max-w-[150px] text-center">
            <div className="font-semibold text-xs truncate">{step.action.family}</div>
            {targetLabel ? (
              <div className="text-xs text-neutral-600 truncate">{targetLabel}</div>
            ) : null}
            {step.equipment?.applianceId ? (
              <div className="text-xs text-neutral-500">🔧 {step.equipment.applianceId}</div>
            ) : null}
            {typeof step.time?.durationSeconds === 'number' && step.time.durationSeconds > 0 ? (
              <div className="text-xs text-neutral-500">
                ⏱ {formatDuration(step.time.durationSeconds)}
                {step.time.isActive === false ? ' (passive)' : ''}
              </div>
            ) : null}
            {instructionLabel ? (
              <div className="mt-1 text-[11px] text-neutral-500 line-clamp-2">
                {instructionLabel}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-neutral-400">—</div>
            )}
          </div>
        ),
      },
      position: { x: index * 250, y: 0 },
      style: {
        background: bgColor,
        border: isSelected ? `3px solid #000` : `2px solid ${actionColor}`,
        borderRadius: '8px',
        padding: '12px 8px',
        width: '160px',
        minHeight: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.1)' : 'none',
      },
    };
  });
}

function createDAGEdges(steps: Step[]): Edge[] {
  const edges: Edge[] = [];

  for (const step of steps) {
    for (const depId of step.dependsOn ?? []) {
      edges.push({
        id: `edge-${depId}-${step.id}`,
        source: depId,
        target: step.id,
        animated: false,
        style: {
          stroke: '#9CA3AF',
          strokeWidth: 2,
        },
      });
    }
  }

  return edges;
}

export function DAGVisualization({ build, selectedStepId, onSelectStep }: DAGVisualizationProps) {
  const initialNodes = useMemo(
    () => createDAGNodes(build.steps, selectedStepId),
    [build.steps, selectedStepId],
  );
  const initialEdges = useMemo(() => createDAGEdges(build.steps), [build.steps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Keep internal state in sync when build/selection changes (e.g., polling refresh).
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectStep?.(node.id);
    },
    [onSelectStep],
  );

  if (build.steps.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-neutral-50 rounded border border-neutral-200">
        <div className="text-center text-neutral-500">
          <p className="text-sm font-medium mb-2">No steps yet</p>
          <p className="text-xs">This build has no steps to visualize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        nodesConnectable={false}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
