'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dagre from '@dagrejs/dagre';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

import { GraphLayerToggles } from '@/components/visualization/GraphLayerToggles';

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
  consumes?: ArtifactRef[];
  produces?: ArtifactRef[];
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

export type ArtifactSource =
  | { type: 'in_build'; artifactId: string }
  | {
      type: 'external_build';
      itemId: string;
      version?: number | 'latest_published';
      artifactId?: string;
    };

export type ArtifactRef = {
  source: ArtifactSource;
  quantity?: { value: number; unit: string; kind?: 'absolute' | 'multiplier' };
  notes?: string;
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
  requiresBuilds?: { itemId: string; version?: number | 'latest_published'; role?: string; notes?: string }[];
  artifacts?: { id: string; name?: string; type?: string; bomUsageId?: string; bomComponentId?: string; notes?: string }[];
  primaryOutputArtifactId?: string;
};

export type ValidationError = {
  severity: 'hard' | 'strong' | 'soft';
  ruleId: string;
  message: string;
  stepId?: string;
  fieldPath?: string;
};

export type ValidationOutput = {
  buildId: string;
  itemId: string;
  timestamp: string;
  valid: boolean;
  hardErrors: ValidationError[];
  warnings: ValidationError[];
  metrics?: Record<string, unknown>;
};

interface DAGVisualizationProps {
  build: BenchTopLineBuild;
  validation?: ValidationOutput | null;
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

const EXTERNAL_NODE_PREFIX = 'external_build:';

function isExternalNodeId(id: string): boolean {
  return id.startsWith(EXTERNAL_NODE_PREFIX);
}

function externalSourceNodeId(source: Extract<ArtifactSource, { type: 'external_build' }>): string {
  const versionKey = source.version === undefined ? 'unspecified' : String(source.version);
  const artifactKey = source.artifactId ?? 'primary';
  return `${EXTERNAL_NODE_PREFIX}${source.itemId}:${versionKey}:${artifactKey}`;
}

function createDAGNodes(params: {
  steps: Step[];
  selectedStepId?: string;
  externalNodes?: { id: string; label: string }[];
  hardErrorCountByStepId?: Map<string, number>;
}): Node[] {
  // Layout: simple row by orderIndex for steps (T5.5 adds dagre for work edges).
  const orderedSteps = [...params.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const externalNodes = params.externalNodes ?? [];

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

  const stepNodes: Node[] = orderedSteps.map((step, index) => {
    const actionColor = ACTION_COLORS[step.action.family] || '#6B7280';
    const bgColor = step.cookingPhase ? PHASE_BG[step.cookingPhase] : '#FFFFFF';
    const isSelected = step.id === params.selectedStepId;
    const hardErrorCount = params.hardErrorCountByStepId?.get(step.id) ?? 0;
    const hasHardError = hardErrorCount > 0;

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
          <div className="relative w-full max-w-[150px] text-center">
            {hasHardError ? (
              <div className="absolute -top-2 -right-2 bg-danger-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow">
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
        ),
      },
      position: { x: index * 250, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: bgColor,
        border: hasHardError
          ? '3px solid #e11d48'
          : isSelected
            ? `3px solid #000`
            : `2px solid ${actionColor}`,
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

  return [...external, ...stepNodes];
}

function applyDagreLayout(params: {
  nodes: Node[];
  workEdges: Edge[];
  flowEdges: Edge[];
}): Node[] {
  const stepNodes = params.nodes.filter((n) => !isExternalNodeId(n.id));
  const externalNodes = params.nodes.filter((n) => isExternalNodeId(n.id));

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: 80,
    ranksep: 140,
    marginx: 20,
    marginy: 20,
  });

  const STEP_NODE_WIDTH = 160;
  const STEP_NODE_HEIGHT = 110;

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

  // Position external source nodes near their consumer(s) (based on flow edges),
  // without affecting the dagre layout (which is based on work edges only).
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
      if (!producedByArtifactId.has(artifactId)) producedByArtifactId.set(artifactId, []);
      producedByArtifactId.get(artifactId)!.push(step.id);
    }
  }

  const flowEdges: Edge[] = [];

  for (const step of sortedSteps) {
    for (const cr of step.consumes ?? []) {
      if (cr.source.type === 'in_build') {
        const producers = producedByArtifactId.get(cr.source.artifactId) ?? [];
        for (const producerStepId of producers) {
          flowEdges.push({
            id: `flow:${producerStepId}->${step.id}:${cr.source.artifactId}`,
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

  return flowEdges;
}

export function DAGVisualization({ build, validation, selectedStepId, onSelectStep }: DAGVisualizationProps) {
  const [showWorkEdges, setShowWorkEdges] = useState(true);
  const [showFlowEdges, setShowFlowEdges] = useState(true);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const hardErrorCountByStepId = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of validation?.hardErrors ?? []) {
      if (!e.stepId) continue;
      map.set(e.stepId, (map.get(e.stepId) ?? 0) + 1);
    }
    return map;
  }, [validation?.hardErrors]);

  const graphModel = useMemo(() => {
    const externalNodesById = new Map<string, { id: string; label: string }>();
    const workEdges = createWorkEdges(build.steps);
    const flowEdges = showFlowEdges
      ? createFlowEdges({ steps: build.steps, externalNodesById })
      : [];
    const externalNodes = showFlowEdges ? [...externalNodesById.values()] : [];

    let nodes = createDAGNodes({
      steps: build.steps,
      selectedStepId,
      externalNodes,
      hardErrorCountByStepId,
    });

    if (showWorkEdges) {
      nodes = applyDagreLayout({ nodes, workEdges, flowEdges });
    }

    const edges = [
      ...(showWorkEdges ? workEdges : []),
      ...(showFlowEdges ? flowEdges : []),
    ];

    return { nodes, edges };
  }, [build.steps, selectedStepId, showFlowEdges, showWorkEdges, hardErrorCountByStepId]);

  const initialNodes = useMemo(
    () => graphModel.nodes,
    [graphModel.nodes],
  );
  const initialEdges = useMemo(() => graphModel.edges, [graphModel.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Keep internal state in sync when build/selection changes (e.g., polling refresh).
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  useEffect(() => {
    // Keep framing sensible after layout/toggle changes.
    const inst = reactFlowInstanceRef.current;
    if (!inst) return;
    const id = window.requestAnimationFrame(() => {
      inst.fitView({ padding: 0.2, duration: 250 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [graphModel.nodes.length, graphModel.edges.length, showWorkEdges, showFlowEdges, build.id]);

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onInit={(inst) => {
          reactFlowInstanceRef.current = inst;
        }}
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
