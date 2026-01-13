'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dagre from '@dagrejs/dagre';
import { formatStepLabel } from '@/lib/stepLabel';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
  MarkerType,
  Position,
  type ReactFlowInstance,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { GraphLayerToggles } from '@/components/visualization/GraphLayerToggles';
import type { BenchTopLineBuild, Step, ValidationOutput } from '@/types';
import { getHardErrorCountByStepId } from '@/lib/validationModel';

type ActionFamily = 'PREP' | 'HEAT' | 'TRANSFER' | 'COMBINE' | 'ASSEMBLE' | 'PORTION' | 'CHECK' | 'VEND' | 'OTHER';
type ViewMode = 'compact' | 'expanded';

const NODE_DIMENSIONS = {
  compact: { width: 160, height: 110 },
  expanded: { width: 300, height: 280 },
} as const;

type ArtifactSource =
  | { type: 'in_build'; artifactId: string }
  | {
      type: 'external_build';
      itemId: string;
      version?: number | 'latest_published';
      artifactId?: string;
    };

type ArtifactRef = {
  source: ArtifactSource;
  quantity?: { value: number; unit: string; kind?: 'absolute' | 'multiplier' };
  notes?: string;
};

interface DAGVisualizationProps {
  build: BenchTopLineBuild;
  validation?: ValidationOutput | null;
  selectedStepId?: string;
  highlightStepIds?: string[];
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

const EXTERNAL_NODE_PREFIX = 'external_build:';

function isExternalNodeId(id: string): boolean {
  return id.startsWith(EXTERNAL_NODE_PREFIX);
}

function externalSourceNodeId(source: Extract<ArtifactSource, { type: 'external_build' }>): string {
  const versionKey = source.version === undefined ? 'unspecified' : String(source.version);
  const artifactKey = source.artifactId ?? 'primary';
  return `${EXTERNAL_NODE_PREFIX}${source.itemId}:${versionKey}:${artifactKey}`;
}

function renderCompactLabel(step: Step, hardErrorCount: number): React.ReactNode {
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

  return (
    <div className="relative w-full max-w-[150px] text-center">
      <div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
        {formatStepLabel(step.orderIndex)}
      </div>
      {hardErrorCount > 0 ? (
        <div className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow">
          {hardErrorCount}
        </div>
      ) : null}
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
  );
}

function renderExpandedLabel(step: Step, hardErrorCount: number): React.ReactNode {
  const targetLabel =
    step.target?.name ||
    step.target?.bomUsageId ||
    step.target?.bomComponentId ||
    '';

  const hasQuantity = step.action.family === 'PORTION' && (step as any).quantity;
  const quantity = (step as any).quantity;

  return (
    <div className="relative w-full text-left text-[10px] space-y-1">
      {/* S## badge */}
      <div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10">
        {formatStepLabel(step.orderIndex)}
      </div>
      {/* Error badge */}
      {hardErrorCount > 0 ? (
        <div className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow z-10">
          {hardErrorCount}
        </div>
      ) : null}

      {/* Header: Action + Target + Order */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-neutral-200">
        <div className="font-bold text-xs text-neutral-900">{step.action.family}</div>
        <div className="text-neutral-500 text-[9px]">ord {step.orderIndex}</div>
      </div>
      {targetLabel ? (
        <div className="text-neutral-700 font-medium truncate">{targetLabel}</div>
      ) : null}

      {/* Context row: Station | Phase | PrepType */}
      <div className="flex flex-wrap gap-1 text-[9px]">
        {step.stationId ? (
          <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{step.stationId}</span>
        ) : null}
        {step.cookingPhase ? (
          <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{step.cookingPhase}</span>
        ) : null}
        {step.prepType ? (
          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{step.prepType}</span>
        ) : null}
      </div>

      {/* Equipment + Technique */}
      {(step.equipment?.applianceId || step.action.techniqueId) ? (
        <div className="flex items-center gap-2 text-neutral-600">
          {step.equipment?.applianceId ? (
            <span>🔧 {step.equipment.applianceId}</span>
          ) : null}
          {step.action.techniqueId ? (
            <span className="text-blue-600">✂ {step.action.techniqueId}</span>
          ) : null}
        </div>
      ) : null}

      {/* Time */}
      {typeof step.time?.durationSeconds === 'number' && step.time.durationSeconds > 0 ? (
        <div className="text-neutral-600">
          ⏱ {formatDuration(step.time.durationSeconds)}
          <span className="ml-1 text-neutral-400">
            ({step.time.isActive === false ? 'passive' : 'active'})
          </span>
        </div>
      ) : null}

      {/* Container */}
      {step.container ? (
        <div className="text-neutral-600">
          📦 {step.container.type}{step.container.name ? `: ${step.container.name}` : ''}
        </div>
      ) : null}

      {/* Quantity (for PORTION) */}
      {hasQuantity && quantity ? (
        <div className="text-neutral-600">
          ⚖ {quantity.value} {quantity.unit}
        </div>
      ) : null}

      {/* Instruction */}
      {typeof step.instruction === 'string' && step.instruction.trim().length > 0 ? (
        <div className="pt-1 border-t border-neutral-100">
          <div className="text-[9px] text-neutral-400 uppercase mb-0.5">Instruction</div>
          <div className="text-neutral-700 whitespace-pre-wrap">{step.instruction.trim()}</div>
        </div>
      ) : null}

      {/* Notes */}
      {typeof step.notes === 'string' && step.notes.trim().length > 0 ? (
        <div className="pt-1 border-t border-neutral-100">
          <div className="text-[9px] text-neutral-400 uppercase mb-0.5">Notes</div>
          <div className="text-neutral-500 italic whitespace-pre-wrap">{step.notes.trim()}</div>
        </div>
      ) : null}

      {/* Dependencies: consumes/produces */}
      {((step.consumes ?? []).length > 0 || (step.produces ?? []).length > 0) ? (
        <div className="pt-1 border-t border-neutral-100 text-[9px]">
          {(step.consumes ?? []).length > 0 ? (
            <div className="text-cyan-600">
              ← {(step.consumes ?? []).map(c => c.source.type === 'in_build' ? c.source.artifactId : 'external').join(', ')}
            </div>
          ) : null}
          {(step.produces ?? []).length > 0 ? (
            <div className="text-green-600">
              → {(step.produces ?? []).map(p => p.source.type === 'in_build' ? p.source.artifactId : 'external').join(', ')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function createDAGNodes(params: {
  steps: Step[];
  selectedStepId?: string;
  highlightStepIds?: string[];
  externalNodes?: { id: string; label: string }[];
  hardErrorCountByStepId?: Map<string, number>;
  viewMode?: ViewMode;
}): Node[] {
  const orderedSteps = [...params.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const externalNodes = params.externalNodes ?? [];
  const highlightSet = new Set(params.highlightStepIds ?? []);
  const hasHighlight = highlightSet.size > 0;

  const external: Node[] = externalNodes.map((n, index) => {
    return {
      id: n.id,
      data: {
        label: (
          <div className="w-full max-w-[180px] text-center">
            <div className="font-semibold text-xs text-neutral-700 truncate">EXTERNAL</div>
            <div className="text-xs text-neutral-600 truncate">{n.label}</div>
          </div>
        ),
      },
      position: { x: -240, y: index * 140 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: '#FFFFFF',
        border: '2px dashed #06B6D4',
        borderRadius: '8px',
        padding: '12px 8px',
        width: '190px',
        minHeight: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        boxShadow: 'none',
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
    };
  });

  const viewMode = params.viewMode ?? 'compact';
  const dims = NODE_DIMENSIONS[viewMode];

  const stepNodes: Node[] = orderedSteps.map((step, index) => {
    const actionFamily = step.action.family as ActionFamily;
    const actionColor = ACTION_COLORS[actionFamily] || '#6B7280';
    const bgColor = step.cookingPhase ? PHASE_BG[step.cookingPhase] : '#FFFFFF';
    const isSelected = step.id === params.selectedStepId;
    const isHighlighted = highlightSet.has(step.id);
    const hardErrorCount = params.hardErrorCountByStepId?.get(step.id) ?? 0;
    const hasHardError = hardErrorCount > 0;

    const label = viewMode === 'expanded'
      ? renderExpandedLabel(step, hardErrorCount)
      : renderCompactLabel(step, hardErrorCount);

    return {
      id: step.id,
      data: { label },
      position: { x: index * 250, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: bgColor,
        opacity: hasHighlight && !isHighlighted && !isSelected ? 0.4 : 1,
        border: hasHardError
          ? '3px solid #e11d48'
          : isSelected
            ? `3px solid #000`
            : isHighlighted
              ? `3px solid #4f46e5`
              : `2px solid ${actionColor}`,
        borderRadius: '8px',
        padding: viewMode === 'expanded' ? '12px' : '12px 8px',
        width: `${dims.width}px`,
        minHeight: viewMode === 'expanded' ? '120px' : '80px',
        display: 'flex',
        alignItems: viewMode === 'expanded' ? 'flex-start' : 'center',
        justifyContent: viewMode === 'expanded' ? 'flex-start' : 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isSelected || isHighlighted ? '0 0 0 4px rgba(79, 70, 229, 0.2)' : 'none',
      },
    };
  });

  return [...external, ...stepNodes];
}

function applyDagreLayout(params: {
  nodes: Node[];
  workEdges: Edge[];
  flowEdges: Edge[];
  viewMode?: ViewMode;
}): Node[] {
  const viewMode = params.viewMode ?? 'compact';
  const dims = NODE_DIMENSIONS[viewMode];

  const stepNodes = params.nodes.filter((n) => !isExternalNodeId(n.id));
  const externalNodes = params.nodes.filter((n) => isExternalNodeId(n.id));

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: viewMode === 'expanded' ? 120 : 80,
    ranksep: viewMode === 'expanded' ? 200 : 140,
    marginx: 20,
    marginy: 20,
  });

  const STEP_NODE_WIDTH = dims.width;
  const STEP_NODE_HEIGHT = dims.height;

  for (const n of [...stepNodes].sort((a, b) => a.id.localeCompare(b.id))) {
    dagreGraph.setNode(n.id, { width: STEP_NODE_WIDTH, height: STEP_NODE_HEIGHT });
  }

  for (const e of [...params.workEdges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!dagreGraph.hasNode(e.source) || !dagreGraph.hasNode(e.target)) continue;
    dagreGraph.setEdge(e.source, e.target);
  }

  dagre.layout(dagreGraph);

  const positionedStepNodes = stepNodes.map((n) => {
    const p = dagreGraph.node(n.id) as { x: number; y: number } | undefined;
    if (!p) return n;
    return {
      ...n,
      position: { x: p.x - STEP_NODE_WIDTH / 2, y: p.y - STEP_NODE_HEIGHT / 2 },
    };
  });

  const stepPosById = new Map(positionedStepNodes.map((n) => [n.id, n.position] as const));

  const externalTargetsBySource = new Map<string, string[]>();
  for (const e of params.flowEdges) {
    if (!isExternalNodeId(e.source)) continue;
    if (!stepPosById.has(e.target)) continue;
    if (!externalTargetsBySource.has(e.source)) externalTargetsBySource.set(e.source, []);
    externalTargetsBySource.get(e.source)!.push(e.target);
  }

  const EXTERNAL_NODE_WIDTH = 190;
  const EXTERNAL_NODE_HEIGHT = 80;

  const positionedExternalNodes = [...externalNodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n, index) => {
      const targets = externalTargetsBySource.get(n.id) ?? [];
      if (targets.length === 0) {
        return { ...n, position: { x: -240, y: index * 140 } };
      }

      let bestTarget = targets[0]!;
      for (const t of targets) {
        const tp = stepPosById.get(t);
        const bp = stepPosById.get(bestTarget);
        if (!tp || !bp) continue;
        if (tp.y < bp.y) bestTarget = t;
      }

      const tp = stepPosById.get(bestTarget);
      if (!tp) return { ...n, position: { x: -240, y: index * 140 } };

      return {
        ...n,
        position: {
          x: tp.x - (EXTERNAL_NODE_WIDTH + 120),
          y: tp.y + (STEP_NODE_HEIGHT - EXTERNAL_NODE_HEIGHT) / 2,
        },
      };
    });

  return [...positionedExternalNodes, ...positionedStepNodes];
}

function createWorkEdges(steps: Step[]): Edge[] {
  const edges: Edge[] = [];

  for (const step of steps) {
    for (const depId of step.dependsOn ?? []) {
      edges.push({
        id: `work:${depId}->${step.id}`,
        source: depId,
        target: step.id,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke: '#9CA3AF',
          strokeWidth: 2,
        },
      });
    }
  }

  return edges;
}

function createFlowEdges(params: {
  steps: Step[];
  externalNodesById: Map<string, { id: string; label: string }>;
}): Edge[] {
  const producedByArtifactId = new Map<string, string[]>();

  const sortedSteps = [...params.steps].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.id.localeCompare(b.id);
  });

  for (const step of sortedSteps) {
    for (const pr of step.produces ?? []) {
      if (pr.source.type !== 'in_build') continue;
      const artifactId = pr.source.artifactId;
      if (!artifactId) continue;
      if (!producedByArtifactId.has(artifactId)) producedByArtifactId.set(artifactId, []);
      producedByArtifactId.get(artifactId)!.push(step.id);
    }
  }

  const flowEdges: Edge[] = [];

  for (const step of sortedSteps) {
    for (const cr of step.consumes ?? []) {
      if (cr.source.type === 'in_build') {
        const artifactId = cr.source.artifactId;
        if (!artifactId) continue;
        const producers = producedByArtifactId.get(artifactId) ?? [];
        for (const producerStepId of producers) {
          flowEdges.push({
            id: `flow:${producerStepId}->${step.id}:${artifactId}`,
            source: producerStepId,
            target: step.id,
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              stroke: '#06B6D4',
              strokeWidth: 2,
            },
          });
        }
        continue;
      }

      if (cr.source.type === 'external_build') {
        const externalId = externalSourceNodeId(cr.source);
        if (!params.externalNodesById.has(externalId)) {
          const versionLabel = cr.source.version === undefined ? '' : `@${String(cr.source.version)}`;
          const artifactLabel = cr.source.artifactId ? `:${cr.source.artifactId}` : ':primary';
          params.externalNodesById.set(externalId, {
            id: externalId,
            label: `${cr.source.itemId}${versionLabel}${artifactLabel}`,
          });
        }

        flowEdges.push({
          id: `flow:${externalId}->${step.id}`,
          source: externalId,
          target: step.id,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: '#06B6D4',
            strokeWidth: 2,
          },
        });
      }
    }
  }

  return flowEdges;
}

export function DAGVisualization({ build, validation, selectedStepId, highlightStepIds, onSelectStep }: DAGVisualizationProps) {
  const [showWorkEdges, setShowWorkEdges] = useState(true);
  const [showFlowEdges, setShowFlowEdges] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Undo/redo history for node positions
  const [positionHistory, setPositionHistory] = useState<Node[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const hardErrorCountByStepId = useMemo(() => {
    return getHardErrorCountByStepId(validation ?? null);
  }, [validation]);

  const graphModel = useMemo(() => {
    const externalNodesById = new Map<string, { id: string; label: string }>();
    const workEdges = createWorkEdges(build.steps);
    const flowEdges = showFlowEdges
      ? createFlowEdges({ steps: build.steps, externalNodesById })
      : [];
    const externalNodes = showFlowEdges ? Array.from(externalNodesById.values()) : [];

    let nodes = createDAGNodes({
      steps: build.steps,
      selectedStepId,
      highlightStepIds,
      externalNodes,
      hardErrorCountByStepId,
      viewMode,
    });

    if (showWorkEdges) {
      nodes = applyDagreLayout({ nodes, workEdges, flowEdges, viewMode });
    }

    const edges = [
      ...(showWorkEdges ? workEdges : []),
      ...(showFlowEdges ? flowEdges : []),
    ];

    return { nodes, edges };
  }, [build.steps, selectedStepId, highlightStepIds, showFlowEdges, showWorkEdges, hardErrorCountByStepId, viewMode]);

  const initialNodes = useMemo(
    () => graphModel.nodes,
    [graphModel.nodes],
  );
  const initialEdges = useMemo(() => graphModel.edges, [graphModel.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    // Reset history when layout changes
    setPositionHistory([initialNodes]);
    setHistoryIndex(0);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Custom handler to capture drag end events for undo history
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check if this is a drag end event (dragging changed from true to false)
      const dragEnd = changes.some(
        (c) => c.type === 'position' && 'dragging' in c && c.dragging === false
      );

      if (dragEnd) {
        // Save current positions to history before applying change
        setPositionHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(nodes);
          return newHistory;
        });
        setHistoryIndex((prev) => prev + 1);
      }

      onNodesChange(changes);
    },
    [nodes, historyIndex, onNodesChange]
  );

  // Keyboard handler for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setNodes(positionHistory[newIndex]);
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (historyIndex < positionHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setNodes(positionHistory[newIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, positionHistory, setNodes]);

  useEffect(() => {
    const inst = reactFlowInstanceRef.current;
    if (!inst) return;
    const id = window.requestAnimationFrame(() => {
      inst.fitView({ padding: 0.2, duration: 250 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [graphModel.nodes.length, graphModel.edges.length, showWorkEdges, showFlowEdges, build.id, viewMode]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isExternalNodeId(node.id)) return;
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <GraphLayerToggles
          showWorkEdges={showWorkEdges}
          showFlowEdges={showFlowEdges}
          onToggleWorkEdges={() => setShowWorkEdges((v) => !v)}
          onToggleFlowEdges={() => setShowFlowEdges((v) => !v)}
          viewMode={viewMode}
          onSetViewMode={setViewMode}
        />
        <div className="text-xs text-neutral-500">
          {showWorkEdges ? (
            <span className="mr-3">
              <span className="inline-block align-middle mr-1 h-2 w-3 rounded bg-neutral-400" />
              Work
            </span>
          ) : null}
          {showFlowEdges ? (
            <span>
              <span className="inline-block align-middle mr-1 h-2 w-3 rounded bg-cyan-500" />
              Flow
            </span>
          ) : null}
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onInit={(inst) => {
          reactFlowInstanceRef.current = inst;
        }}
        fitView
        nodesConnectable={false}
      >
        <Background />
        <Controls 
          orientation="horizontal" 
          className="flex flex-row !flex-row border border-neutral-200 rounded-md overflow-hidden bg-white shadow-sm [&_button]:border-b-0 [&_button]:border-r [&_button:last-child]:border-r-0" 
          style={{ left: 10, bottom: 40 }} 
        />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
