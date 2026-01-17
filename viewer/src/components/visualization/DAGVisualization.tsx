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
  MarkerType,
  Position,
  type ReactFlowInstance,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { ModeSelector, ModeOptions, type VisualizationMode, type ViewMode } from '@/components/visualization/GraphLayerToggles';

export type ColorBy = 'action' | 'station';
export type { VisualizationMode } from '@/components/visualization/GraphLayerToggles';
import type { BenchTopLineBuild, Step, StationVisit, ValidationOutput } from '@/types';
import { getHardErrorCountByStepId } from '@/lib/validationModel';
import { computeCriticalPath } from '@/lib/graphMetrics';
import { resolveStepDuration } from '@/lib/timeResolution';
import { buildGroupColorMap, getGroupColor, getLightTint, getUniqueGroupIds } from '@/lib/componentColors';
import { groupStepsIntoVisits } from '@/lib/visitTimeline';

type ActionFamily = 'PREP' | 'HEAT' | 'TRANSFER' | 'COMBINE' | 'ASSEMBLE' | 'PORTION' | 'CHECK' | 'PACKAGING' | 'OTHER';
type ArtifactMeta = {
  id: string;
  name?: string;
  groupId?: string;
  components?: string[];
  lineage?: { evolvesFrom?: string };
};

type LaneLayout = {
  laneId: string;
  top: number;
  height: number;
  label: string;
  index: number;
};

type TrackLayout = {
  trackId: string;
  top: number;
  height: number;
  label: string;
  index: number;
};

const NODE_DIMENSIONS = {
  compact: { width: 160, height: 110 },
  expanded: { width: 300, height: 280 },
} as const;

const VISIT_NODE_DIMENSIONS = {
  compact: { width: 200, height: 90 },
  expanded: { width: 340, height: 220 },
} as const;

const ARTIFACT_NODE_DIMENSIONS = {
  compact: { width: 180, height: 50 },
  expanded: { width: 280, height: 180 },
} as const;

const STATION_ORDER = ['hot_side', 'cold_side', 'prep', 'garnish', 'vending', 'expo', 'pass', 'other'];

type Artifact = { id: string; name?: string; groupId?: string; components?: string[] };

interface DAGVisualizationProps {
  build: BenchTopLineBuild;
  validation?: ValidationOutput | null;
  selectedStepId?: string;
  selectedVisitId?: string;
  selectedArtifactId?: string;
  highlightStepIds?: string[];
  onSelectStep?: (stepId: string) => void;
  onSelectVisit?: (visit: StationVisit) => void;
  onSelectArtifact?: (artifact: Artifact | null, artifactSteps: { producedBy: Step[]; consumedBy: Step[] } | null) => void;
  onModeChange?: (mode: VisualizationMode) => void;
}

const ACTION_COLORS: Record<ActionFamily, string> = {
  PREP: '#3B82F6', // blue
  HEAT: '#EF4444', // red
  TRANSFER: '#8B5CF6', // purple
  COMBINE: '#06B6D4', // cyan
  ASSEMBLE: '#10B981', // green
  PORTION: '#F59E0B', // amber
  CHECK: '#6366F1', // indigo
  PACKAGING: '#EC4899', // pink
  OTHER: '#6B7280', // neutral
};

const PHASE_BG: Record<string, string> = {
  PRE_COOK: '#F0F9FF', // light blue
  COOK: '#FEF2F2', // light red
  POST_COOK: '#F0FDF4', // light green
  ASSEMBLY: '#FDF2F8', // light pink
  PASS: '#ECFDF5', // very light green
};

const STATION_COLORS: Record<string, string> = {
  hot_side: '#EF4444',
  cold_side: '#3B82F6',
  prep: '#F59E0B',
  garnish: '#10B981',
  vending: '#8B5CF6',
  expo: '#EC4899',
  pass: '#06B6D4',
  other: '#6B7280',
};

const STATION_SHORT_LABELS: Record<string, string> = {
  hot_side: 'HOT',
  cold_side: 'COLD',
  prep: 'PREP',
  garnish: 'GARN',
  vending: 'VEND',
  expo: 'EXPO',
  pass: 'PASS',
  other: '?',
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

function externalSourceNodeId(source: any): string {
  const versionKey = source.version === undefined ? 'unspecified' : String(source.version);
  const artifactKey = source.artifactId ?? 'primary';
  return `${EXTERNAL_NODE_PREFIX}${source.itemId}:${versionKey}:${artifactKey}`;
}

function renderCompactLabel(step: Step, hardErrorCount: number, build: BenchTopLineBuild, assemblyInfo?: { inputCount: number; outputCount: number }, colorBy?: ColorBy): React.ReactNode {
  const targetLabel = step.target?.name || step.target?.bomUsageId || step.target?.bomComponentId || '';
  const instructionLabel = typeof step.instruction === 'string' && step.instruction.trim().length > 0
    ? step.instruction.trim()
    : typeof step.notes === 'string' && step.notes.trim().length > 0
      ? step.notes.trim()
      : '';

  const resolved = resolveStepDuration(step, { buildId: build.id, buildName: build.name });
  const hasResolvedTime = resolved.seconds > 0;
  const isExplicit = resolved.source === 'explicit';
  
  const stationId = step.stationId || 'other';
  const stationColor = STATION_COLORS[stationId] || STATION_COLORS.other;
  const stationShortLabel = STATION_SHORT_LABELS[stationId] || '?';
  const showStationBadge = colorBy === 'station';

  return (
    <div className="relative w-full max-w-[150px] text-center">
      <div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10">
        {formatStepLabel(step.orderIndex)}
      </div>
      {showStationBadge ? (
        <div className="absolute -top-2 right-0 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm z-10" style={{ backgroundColor: stationColor }}>
          {stationShortLabel}
        </div>
      ) : null}
      {hardErrorCount > 0 ? (
        <div className={`absolute -top-2 ${showStationBadge ? 'right-10' : '-right-2'} bg-rose-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow`}>
          {hardErrorCount}
        </div>
      ) : null}
      {assemblyInfo && assemblyInfo.inputCount > 1 ? (
        <div className="absolute -bottom-2 right-0 bg-purple-600 text-white text-[9px] font-semibold rounded px-1.5 py-0.5 shadow">
          {assemblyInfo.inputCount}→1
        </div>
      ) : null}
      <div className="font-semibold text-xs truncate">{step.action.family}</div>
      {targetLabel ? <div className="text-xs text-neutral-600 truncate">{targetLabel}</div> : null}
      {step.equipment?.applianceId ? <div className="text-xs text-neutral-500">🔧 {step.equipment.applianceId}</div> : null}
      <div className={`text-xs ${isExplicit ? 'text-neutral-500' : 'text-neutral-400 italic'}`}>
        ⏱ {hasResolvedTime ? formatDuration(resolved.seconds) : '—'}
      </div>
      {instructionLabel ? <div className="mt-1 text-[11px] text-neutral-500 line-clamp-2">{instructionLabel}</div> : <div className="mt-1 text-[11px] text-neutral-400">—</div>}
    </div>
  );
}

function renderExpandedLabel(step: Step, hardErrorCount: number, build: BenchTopLineBuild, assemblyInfo?: { inputCount: number; outputCount: number }, colorBy?: ColorBy): React.ReactNode {
  const targetLabel = step.target?.name || step.target?.bomUsageId || step.target?.bomComponentId || '';
  const quantity = (step as any).quantity;
  const resolved = resolveStepDuration(step, { buildId: build.id, buildName: build.name });
  const hasResolvedTime = resolved.seconds > 0;
  const stationId = step.stationId || 'other';
  const stationColor = STATION_COLORS[stationId] || STATION_COLORS.other;
  const stationShortLabel = STATION_SHORT_LABELS[stationId] || '?';
  const showStationBadge = colorBy === 'station';

  return (
    <div className="relative w-full text-left text-[10px] space-y-1">
      <div className="absolute -top-3 -left-3 bg-neutral-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10">
        {formatStepLabel(step.orderIndex)}
      </div>
      {showStationBadge ? (
        <div className="absolute -top-2 right-0 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow z-10" style={{ backgroundColor: stationColor }}>
          {stationShortLabel}
        </div>
      ) : null}
      {hardErrorCount > 0 ? (
        <div className={`absolute -top-2 ${showStationBadge ? 'right-12' : '-right-2'} bg-rose-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 shadow z-10`}>
          {hardErrorCount}
        </div>
      ) : null}
      {assemblyInfo && assemblyInfo.inputCount > 1 ? (
        <div className="absolute -bottom-2 right-0 bg-purple-600 text-white text-[9px] font-semibold rounded px-1.5 py-0.5 shadow z-10">
          {assemblyInfo.inputCount}→{assemblyInfo.outputCount}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-neutral-200">
        <div className="font-bold text-xs text-neutral-900">{step.action.family}</div>
        <div className="text-neutral-500 text-[9px]">ord {step.orderIndex}</div>
      </div>
      {targetLabel ? <div className="text-neutral-700 font-medium truncate">{targetLabel}</div> : null}
      <div className="flex flex-wrap gap-1 text-[9px]">
        {step.stationId && <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{step.stationId}</span>}
        {step.cookingPhase && <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{step.cookingPhase}</span>}
        {step.prepType && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{step.prepType}</span>}
      </div>
      {(step.equipment?.applianceId || step.action.techniqueId) && (
        <div className="flex items-center gap-2 text-neutral-600">
          {step.equipment?.applianceId && <span>🔧 {step.equipment.applianceId}</span>}
          {step.action.techniqueId && <span className="text-blue-600">✂ {step.action.techniqueId}</span>}
        </div>
      )}
      <div className={`flex flex-col ${resolved.source === 'explicit' ? 'text-neutral-600' : 'text-neutral-400 italic'}`}>
        <div>⏱ {hasResolvedTime ? formatDuration(resolved.seconds) : '—'}{step.time?.isActive === false ? ' (passive)' : ''}</div>
      </div>
      {step.container && <div className="text-neutral-600">📦 {step.container.type}{step.container.name ? `: ${step.container.name}` : ''}</div>}
      {step.action.family === 'PORTION' && quantity && <div className="text-neutral-600">⚖ {quantity.value} {quantity.unit}</div>}
      {typeof step.instruction === 'string' && step.instruction.trim().length > 0 && (
        <div className="pt-1 border-t border-neutral-100">
          <div className="text-[9px] text-neutral-400 uppercase mb-0.5">Instruction</div>
          <div className="text-neutral-700 whitespace-pre-wrap">{step.instruction.trim()}</div>
        </div>
      )}
      {typeof step.notes === 'string' && step.notes.trim().length > 0 && (
        <div className="pt-1 border-t border-neutral-100">
          <div className="text-[9px] text-neutral-400 uppercase mb-0.5">Notes</div>
          <div className="text-neutral-500 italic whitespace-pre-wrap">{step.notes.trim()}</div>
        </div>
      )}
      {((step.input ?? []).length > 0 || (step.output ?? []).length > 0) && (
        <div className="pt-1 border-t border-neutral-100 text-[9px]">
          {(step.input ?? []).length > 0 && <div className="text-cyan-600">← {(step.input ?? []).map(c => c.source.type === 'in_build' ? c.source.artifactId : 'external').join(', ')}</div>}
          {(step.output ?? []).length > 0 && <div className="text-green-600">→ {(step.output ?? []).map(p => p.source.type === 'in_build' ? p.source.artifactId : 'external').join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

function identifyAssemblyPoints(steps: Step[], artifacts: Array<{ id: string; groupId?: string }>): Map<string, { inputCount: number; outputCount: number; inputGroupIds: Set<string> }> {
  const artifactToGroup = new Map(artifacts.map(a => [a.id, a.groupId]));
  const assemblyPoints = new Map<string, { inputCount: number; outputCount: number; inputGroupIds: Set<string> }>();
  for (const step of steps) {
    const inputGroupIds = new Set<string>();
    for (const inp of step.input ?? []) {
      if (inp.source.type === 'in_build' && inp.source.artifactId) {
        const groupId = artifactToGroup.get(inp.source.artifactId);
        if (groupId) inputGroupIds.add(groupId);
      }
    }
    const outputGroupIds = new Set<string>();
    for (const out of step.output ?? []) {
      if (out.source.type === 'in_build' && out.source.artifactId) {
        const groupId = artifactToGroup.get(out.source.artifactId);
        if (groupId) outputGroupIds.add(groupId);
      }
    }
    if (inputGroupIds.size > 1) {
      assemblyPoints.set(step.id, { inputCount: inputGroupIds.size, outputCount: outputGroupIds.size || 1, inputGroupIds });
    }
  }
  return assemblyPoints;
}

function createDAGNodes(params: {
  steps: Step[];
  build: BenchTopLineBuild;
  selectedStepId?: string;
  highlightStepIds?: string[];
  criticalPathNodeIds?: Set<string>;
  externalNodes?: { id: string; label: string }[];
  hardErrorCountByStepId?: Map<string, number>;
  viewMode?: ViewMode;
  assemblyPoints?: Map<string, { inputCount: number; outputCount: number }>;
  showAssemblyPoints?: boolean;
  highlightMergesOnly?: boolean;
  colorBy?: ColorBy;
}): Node[] {
  const orderedSteps = [...params.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const externalNodes = params.externalNodes ?? [];
  const highlightSet = new Set(params.highlightStepIds ?? []);
  const hasHighlight = highlightSet.size > 0;
  const criticalPathNodes = params.criticalPathNodeIds ?? new Set();
  const highlightMergesOnly = params.highlightMergesOnly ?? false;

  const external: Node[] = externalNodes.map((n, index) => ({
    id: n.id,
    data: { label: <div className="w-full max-w-[180px] text-center"><div className="font-semibold text-xs text-neutral-700 truncate">EXTERNAL</div><div className="text-xs text-neutral-600 truncate">{n.label}</div></div> },
    position: { x: -240, y: index * 140 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: { background: '#FFFFFF', border: '2px dashed #06B6D4', borderRadius: '8px', padding: '12px 8px', width: '190px', minHeight: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
    draggable: false, selectable: false, connectable: false, focusable: false,
  }));

  const viewMode = params.viewMode ?? 'compact';
  const dims = NODE_DIMENSIONS[viewMode];
  const colorBy = params.colorBy ?? 'action';
  
  const stepNodes: Node[] = orderedSteps.map((step, index) => {
    const actionFamily = step.action.family as ActionFamily;
    const actionColor = ACTION_COLORS[actionFamily] || '#6B7280';
    const stationId = step.stationId || 'other';
    const stationColor = STATION_COLORS[stationId] || STATION_COLORS.other;
    const borderColor = colorBy === 'station' ? stationColor : actionColor;
    const bgColor = step.cookingPhase ? PHASE_BG[step.cookingPhase] : '#FFFFFF';
    const isSelected = step.id === params.selectedStepId;
    const isHighlighted = highlightSet.has(step.id);
    const hardErrorCount = params.hardErrorCountByStepId?.get(step.id) ?? 0;
    const isOnCriticalPath = criticalPathNodes.has(step.id);
    const assemblyInfo = params.showAssemblyPoints ? params.assemblyPoints?.get(step.id) : undefined;
    const isMergePoint = params.assemblyPoints?.has(step.id) ?? false;
    const isDimmedByMergeFilter = highlightMergesOnly && !isMergePoint && !isSelected;

    const label = viewMode === 'expanded'
      ? renderExpandedLabel(step, hardErrorCount, params.build, assemblyInfo, colorBy)
      : renderCompactLabel(step, hardErrorCount, params.build, assemblyInfo, colorBy);

    const isMissingDetails = (
      (step.action.family === 'HEAT' && !step.time && !step.notes) ||
      (step.action.family === 'PORTION' && !step.quantity && !step.notes) ||
      (step.action.family === 'PREP' && !step.action.techniqueId && !step.notes)
    );

    let nodeOpacity = 1;
    if (isDimmedByMergeFilter) nodeOpacity = 0.35;
    else if (hasHighlight && !isHighlighted && !isSelected) nodeOpacity = 0.4;

    return {
      id: step.id,
      data: { label },
      position: { x: index * 250, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      className: hardErrorCount > 0 ? 'node-has-error' : '',
      style: {
        background: bgColor,
        opacity: nodeOpacity,
        border: hardErrorCount > 0 ? '3px solid #e11d48' : isSelected ? `3px solid #000` : isHighlighted ? `3px solid #4f46e5` : isMergePoint && highlightMergesOnly ? `6px solid #7C3AED` : isMissingDetails ? `3px dashed #9CA3AF` : `4px solid ${borderColor}`,
        borderLeft: isOnCriticalPath ? '8px solid #F97316' : undefined,
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
        animation: isMergePoint && params.showAssemblyPoints ? 'merge-pulse 1.8s ease-out infinite' : undefined,
      } as React.CSSProperties,
    };
  });

  return [...external, ...stepNodes];
}

function applyDagreLayout(params: {
  nodes: Node[];
  edges: Edge[];
  viewMode?: ViewMode;
}): Node[] {
  const viewMode = params.viewMode ?? 'compact';
  const dims = NODE_DIMENSIONS[viewMode];
  const stepNodes = params.nodes.filter((n) => !isExternalNodeId(n.id));
  const externalNodes = params.nodes.filter((n) => isExternalNodeId(n.id));
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: viewMode === 'expanded' ? 140 : 100, ranksep: viewMode === 'expanded' ? 220 : 160, marginx: 30, marginy: 30 });
  for (const n of [...stepNodes].sort((a, b) => a.id.localeCompare(b.id))) dagreGraph.setNode(n.id, { width: dims.width, height: dims.height });
  for (const e of [...params.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!dagreGraph.hasNode(e.source) || !dagreGraph.hasNode(e.target)) continue;
    dagreGraph.setEdge(e.source, e.target);
  }
  dagre.layout(dagreGraph);
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const n of stepNodes) {
    const p = dagreGraph.node(n.id);
    if (p) nodePositions.set(n.id, { x: p.x - dims.width / 2, y: p.y - dims.height / 2 });
  }
  const positionedStepNodes = stepNodes.map((n) => ({ ...n, position: nodePositions.get(n.id) || n.position }));
  const stepPosById = new Map(positionedStepNodes.map((n) => [n.id, n.position] as const));
  const externalTargetsBySource = new Map<string, string[]>();
  for (const e of params.edges) {
    if (!isExternalNodeId(e.source)) continue;
    if (!stepPosById.has(e.target)) continue;
    if (!externalTargetsBySource.has(e.source)) externalTargetsBySource.set(e.source, []);
    externalTargetsBySource.get(e.source)!.push(e.target);
  }
  const positionedExternalNodes = [...externalNodes].sort((a, b) => a.id.localeCompare(b.id)).map((n, index) => {
    const targets = externalTargetsBySource.get(n.id) ?? [];
    if (targets.length === 0) return { ...n, position: { x: -240, y: index * 140 } };
    let bestTarget = targets[0]!;
    for (const t of targets) if ((stepPosById.get(t)?.y ?? 0) < (stepPosById.get(bestTarget)?.y ?? 0)) bestTarget = t;
    const tp = stepPosById.get(bestTarget);
    if (!tp) return { ...n, position: { x: -240, y: index * 140 } };
    return { ...n, position: { x: tp.x - 310, y: tp.y + (dims.height - 80) / 2 } };
  });
  return [...positionedExternalNodes, ...positionedStepNodes];
}

function createWorkOrderEdges(steps: Step[], criticalPathEdgeIds?: Set<string>): Edge[] {
  const edges: Edge[] = [];
  const cpEdges = criticalPathEdgeIds ?? new Set();
  for (const step of steps) {
    for (const depId of step.dependsOn ?? []) {
      const isCP = cpEdges.has(`${depId}->${step.id}`);
      edges.push({
        id: `work:${depId}->${step.id}`,
        source: depId,
        target: step.id,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: isCP ? '#F97316' : '#9CA3AF', strokeWidth: isCP ? 4 : 2 },
      });
    }
  }
  return edges;
}

function createMaterialFlowModel(params: {
  steps: Step[];
  artifacts: ArtifactMeta[];
  groupColorMap: Map<string, string>;
  selectedGroupIds: string[];
  viewMode: ViewMode;
  selectedArtifactId?: string;
  highlightMergesOnly: boolean;
  showAssemblyPoints: boolean;
  showKitchenLayout: boolean;
  traceArtifactIds?: Set<string>;
}): { nodes: Node[]; edges: Edge[]; artifactById: Map<string, ArtifactMeta> } {
  const { steps, artifacts, groupColorMap, selectedGroupIds, viewMode, selectedArtifactId, highlightMergesOnly, showAssemblyPoints, showKitchenLayout, traceArtifactIds } = params;
  const dims = ARTIFACT_NODE_DIMENSIONS[viewMode];
  const artifactById = new Map(artifacts.map(a => [a.id, a]));
  const filterActive = selectedGroupIds.length > 0 && selectedGroupIds.length < getUniqueGroupIds(artifacts).length;
  const traceActive = (traceArtifactIds?.size ?? 0) > 0;
  const producerStep = new Map<string, Step>(); 
  for (const step of steps) for (const out of step.output ?? []) if (out.source.type === 'in_build') producerStep.set(out.source.artifactId, step);
  const consumedArtifactIds = new Set<string>();
  for (const step of steps) for (const inp of step.input ?? []) if (inp.source.type === 'in_build') consumedArtifactIds.add(inp.source.artifactId);
  const mergeArtifactIds = new Set<string>();
  for (const artifact of artifacts) {
    if ((artifact.components?.length ?? 0) >= 2) {
      const componentGroupIds = new Set(artifact.components!.map(cid => artifactById.get(cid)?.groupId).filter((g): g is string => Boolean(g)));
      if (componentGroupIds.size >= 2) mergeArtifactIds.add(artifact.id);
    }
  }
  const artifactSources = new Map<string, { stationId?: string; sublocation?: string }>();
  for (const step of steps) {
    for (const inp of step.input ?? []) {
      if (inp.source.type === 'in_build' && inp.from) {
        const artifactId = inp.source.artifactId;
        if (!producerStep.has(artifactId) && !artifactSources.has(artifactId)) artifactSources.set(artifactId, { stationId: inp.from.stationId, sublocation: inp.from.sublocation?.type });
      }
    }
  }
  const nodes: Node[] = [];
  const uniqueLocations = new Set<string>();
  artifactSources.forEach((info) => uniqueLocations.add(`location:${info.stationId || 'other'}:${info.sublocation || 'ambient'}`));
  
  uniqueLocations.forEach((locId) => {
    const [_, station, sub] = locId.split(':');
    nodes.push({
      id: locId,
      data: { label: <div className="text-center w-full"><div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">SOURCE</div><div className="text-xs font-bold text-neutral-700 leading-tight">{station.replace(/_/g, ' ').toUpperCase()}</div><div className="text-[10px] text-neutral-500 font-medium">{sub.replace(/_/g, ' ').toUpperCase()}</div></div> },
      position: { x: 0, y: 0 },
      sourcePosition: Position.Right, targetPosition: Position.Left,
      style: { background: '#F8FAFC', border: '2px dashed #94A3B8', borderRadius: '8px', padding: '8px', width: '140px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' } as React.CSSProperties,
    });
  });

  for (const artifact of artifacts) {
    if (filterActive && artifact.groupId && !selectedGroupIds.includes(artifact.groupId)) continue;
    const groupColor = getGroupColor(artifact.groupId, groupColorMap);
    const isSelected = selectedArtifactId === artifact.id;
    const isMergePoint = mergeArtifactIds.has(artifact.id);
    const shouldShowMerge = showAssemblyPoints && isMergePoint;
    const sourceInfo = artifactSources.get(artifact.id);
    const sourceLabel = sourceInfo ? [sourceInfo.stationId, sourceInfo.sublocation].filter(Boolean).join(' / ').replace(/_/g, ' ').toUpperCase() : undefined;
    const isDimmed = (highlightMergesOnly && !isMergePoint) || (traceActive && !traceArtifactIds?.has(`artifact:${artifact.id}`));
    const getBaseComponents = (artifactId: string, visited = new Set<string>()): Array<{id: string; name: string; color: string}> => {
      if (visited.has(artifactId)) return [];
      visited.add(artifactId);
      const art = artifactById.get(artifactId);
      if (!art) return [{ id: artifactId, name: artifactId, color: '#6B7280' }];
      if (!art.components || art.components.length === 0) return [{ id: art.id, name: art.name || art.id, color: getGroupColor(art.groupId, groupColorMap) }];
      return art.components.flatMap(cid => getBaseComponents(cid, visited));
    };
    const baseComponents = artifact.components?.length ? Array.from(new Map(artifact.components.flatMap(cid => getBaseComponents(cid)).map(c => [c.id, c] as [string, any])).values()) : [];
    const nodeWidth = viewMode === 'expanded' ? 240 : 160;
    let nodeHeight = viewMode === 'compact' ? 50 : 90 + (baseComponents.length / 1.5) * 32 + 10;
    const lightFill = getLightTint(groupColor);
    nodes.push({
      id: `artifact:${artifact.id}`,
      data: { label: <div className={`text-center w-full ${viewMode === 'expanded' ? 'text-left space-y-1' : ''}`}>{baseComponents.length > 1 && <div className="absolute -top-2 -right-2 bg-violet-600 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow z-10">{baseComponents.length}</div>}<div className={`font-bold leading-tight ${viewMode === 'compact' ? 'text-[11px]' : 'text-sm'}`} style={{ color: '#111827' }}>{artifact.name || artifact.id}</div>{!showKitchenLayout && sourceLabel && <div className="text-[10px] text-neutral-500 font-medium mt-0.5">📍 {sourceLabel}</div>}{viewMode === 'expanded' && <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">{artifact.groupId || 'no group'}</div>}</div> },
      position: { x: 0, y: 0 },
      sourcePosition: Position.Right, targetPosition: Position.Left,
      style: { background: lightFill, border: isSelected ? '3px solid #111827' : shouldShowMerge ? '5px solid #7C3AED' : '1px solid #D1D5DB', borderRadius: '10px', padding: viewMode === 'expanded' ? '12px' : '8px', width: `${nodeWidth}px`, minHeight: `${nodeHeight}px`, opacity: isDimmed ? 0.25 : 1, cursor: 'pointer', display: 'flex', alignItems: viewMode === 'compact' ? 'center' : 'flex-start', animation: shouldShowMerge ? 'merge-pulse 1.8s ease-out infinite' : undefined } as React.CSSProperties,
      width: nodeWidth, height: nodeHeight,
    } as any);
  }
  const edges: Edge[] = [];
  artifactSources.forEach((info, artifactId) => {
    const locId = `location:${info.stationId || 'other'}:${info.sublocation || 'ambient'}`;
    edges.push({ id: `source-flow:${locId}->artifact:${artifactId}`, source: locId, target: `artifact:${artifactId}`, animated: false, style: { stroke: '#94A3B8', strokeWidth: 1.5, strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' } });
  });
  for (const step of steps) {
    const outputs = (step.output ?? []).filter((o): o is any => o.source.type === 'in_build' && Boolean(o.source.artifactId));
    for (const out of outputs) {
      const outputArtifact = artifactById.get(out.source.artifactId);
      if (!outputArtifact || (filterActive && outputArtifact.groupId && !selectedGroupIds.includes(outputArtifact.groupId))) continue;
      for (const inp of step.input ?? []) {
        if (inp.source.type !== 'in_build' || inp.source.artifactId === out.source.artifactId) continue;
        const inputArtifact = artifactById.get(inp.source.artifactId);
        if (!inputArtifact || (filterActive && inputArtifact.groupId && !selectedGroupIds.includes(inputArtifact.groupId))) continue;
        const isDimmed = (highlightMergesOnly && !mergeArtifactIds.has(out.source.artifactId)) || (traceActive && (!traceArtifactIds?.has(`artifact:${inp.source.artifactId}`) || !traceArtifactIds?.has(`artifact:${out.source.artifactId}`)));
        edges.push({ id: `mf:${inp.source.artifactId}->${out.source.artifactId}:${step.id}`, source: `artifact:${inp.source.artifactId}`, target: `artifact:${out.source.artifactId}`, animated: false, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6B7280', strokeWidth: 2, opacity: isDimmed ? 0.2 : 1 } });
      }
    }
  }
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: viewMode === 'expanded' ? 160 : 90, ranksep: viewMode === 'expanded' ? 220 : 140, marginx: 30, marginy: 30 });
  for (const node of nodes) dagreGraph.setNode(node.id, { width: (node as any).width || 160, height: (node as any).height || 50 });
  for (const edge of edges) if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) dagreGraph.setEdge(edge.source, edge.target);
  dagre.layout(dagreGraph);
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = dagreGraph.node(node.id);
    if (pos) nodePositions.set(node.id, { x: pos.x - ((node as any).width || dims.width) / 2, y: pos.y - ((node as any).height || dims.height) / 2 });
  }
  let finalNodes = nodes.map(node => ({ ...node, position: nodePositions.get(node.id) || node.position }));
  if (showKitchenLayout) {
    const hotAppliances = ['fryer', 'turbo', 'waterbath', 'microwave'];
    const coldAppliances = ['clamshell_grill', 'press', 'toaster', 'garnish', 'cold_side', 'cold_rail'];
    const storageLocations = ['cold_storage', 'dry_rail', 'freezer', 'ambient'];
    const allLanes = [...storageLocations, ...hotAppliances, ...coldAppliances, 'other'];
    const laneIdToY = new Map<string, number>();
    let currentTop = 0;
    allLanes.forEach(lane => { laneIdToY.set(lane, currentTop); currentTop += 120; });
    finalNodes = finalNodes.map(n => {
      let laneId = 'other';
      if (n.id.startsWith('location:')) {
        const [_, station, sub] = n.id.split(':');
        if (allLanes.includes(sub)) laneId = sub;
        else if (allLanes.includes(station)) laneId = station;
      } else {
        const artifactId = n.id.replace('artifact:', '');
        const producer = producerStep.get(artifactId);
        if (producer) {
          const app = producer.equipment?.applianceId;
          if (app && allLanes.includes(app)) laneId = app;
          else if (producer.stationId && allLanes.includes(producer.stationId)) laneId = producer.stationId;
        } else {
          const src = artifactSources.get(artifactId);
          if (src?.sublocation && allLanes.includes(src.sublocation)) laneId = src.sublocation;
          else if (src?.stationId && allLanes.includes(src.stationId)) laneId = src.stationId;
        }
      }
      return { ...n, position: { ...n.position, y: (laneIdToY.get(laneId) ?? 0) + 40 } };
    });
  }
  return { nodes: finalNodes, edges, artifactById };
}

function createVisitTimelineModel(params: {
  steps: Step[];
  viewMode: ViewMode;
  selectedVisitId?: string;
}): { nodes: Node[]; edges: Edge[]; trackLayouts: TrackLayout[]; visitById: Map<string, StationVisit> } {
  const { steps, viewMode, selectedVisitId } = params;
  const timelines = groupStepsIntoVisits(steps);
  const visitById = new Map<string, StationVisit>();
  const stepToVisitId = new Map<string, string>();
  for (const timeline of timelines) {
    for (const visit of timeline.visits) {
      visitById.set(visit.id, visit);
      for (const step of visit.steps) stepToVisitId.set(step.id, visit.id);
    }
  }
  const dims = VISIT_NODE_DIMENSIONS[viewMode];
  const trackLayouts: TrackLayout[] = timelines.map((t, i) => ({ trackId: t.trackId, top: i * (dims.height + 150), height: dims.height + 50, label: t.trackId, index: i }));
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 160, marginx: 30, marginy: 30 });
  for (const visit of Array.from(visitById.values())) dagreGraph.setNode(visit.id, { width: dims.width, height: dims.height });
  for (const t of timelines) for (let i = 0; i < t.visits.length - 1; i++) dagreGraph.setEdge(t.visits[i].id, t.visits[i+1].id);
  const stepById = new Map(steps.map(s => [s.id, s]));
  const crossTrackEdges: any[] = [];
  for (const step of steps) {
    for (const depId of step.dependsOn ?? []) {
      const fromVisitId = stepToVisitId.get(depId);
      const toVisitId = stepToVisitId.get(step.id);
      if (fromVisitId && toVisitId && fromVisitId !== toVisitId) {
        if (visitById.get(fromVisitId)?.trackId !== visitById.get(toVisitId)?.trackId) {
          dagreGraph.setEdge(fromVisitId, toVisitId);
          crossTrackEdges.push({ fromVisitId, toVisitId, depStep: stepById.get(depId), step });
        }
      }
    }
  }
  dagre.layout(dagreGraph);
  const nodes: Node[] = Array.from(visitById.values()).map(visit => {
    const dagreNode = dagreGraph.node(visit.id);
    const track = trackLayouts.find(tl => tl.trackId === visit.trackId);
    const isBouncing = visit.visitNumber > 1;
    return {
      id: visit.id,
      data: { label: renderVisitLabel(visit, viewMode, false, track?.index) },
      position: { x: dagreNode.x - dims.width / 2, y: (track?.top ?? 0) + 25 },
      sourcePosition: Position.Right, targetPosition: Position.Left,
      style: { 
        background: isBouncing ? '#FFF1F2' : '#FFFFFF', 
        border: isBouncing ? '3px solid #E11D48' : `3px solid ${STATION_COLORS[visit.stationId] || '#6B7280'}`, 
        borderRadius: '10px', padding: '12px', width: `${dims.width}px`, minHeight: `${dims.height}px`, 
        boxShadow: selectedVisitId === visit.id ? '0 0 0 4px rgba(17, 24, 39, 0.15)' : 'none' 
      },
    };
  });
  const edges: Edge[] = [];
  for (const t of timelines) {
    for (let i = 0; i < t.visits.length - 1; i++) {
      edges.push({ id: `visit-edge:${t.trackId}:${t.visits[i].id}->${t.visits[i+1].id}`, source: t.visits[i].id, target: t.visits[i+1].id, animated: false, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6B7280', strokeWidth: 2 } });
    }
  }
  for (const e of crossTrackEdges) {
    edges.push({ id: `visit-cross:${e.depStep.id}->${e.step.id}`, source: e.fromVisitId, target: e.toVisitId, animated: false, markerEnd: { type: MarkerType.ArrowClosed, color: '#8B5CF6' }, style: { stroke: '#8B5CF6', strokeWidth: 2, strokeDasharray: '6 4' } });
  }
  return { nodes, edges, trackLayouts, visitById };
}

function getUpstreamArtifactIds(targetId: string, edges: Edge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge.source);
  }
  const visited = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const src of incoming.get(current) ?? []) stack.push(src);
  }
  return visited;
}

function getTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

const TRACK_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#CA8A04', '#DB2777'];

function renderVisitLabel(visit: StationVisit, viewMode: ViewMode, isMergeTarget: boolean, trackIndex?: number): React.ReactNode {
  const stationLabel = visit.stationId.replace('_', ' ').toUpperCase();
  const trackColor = trackIndex !== undefined ? TRACK_COLORS[trackIndex % TRACK_COLORS.length] : '#6B7280';
  const isBouncing = visit.visitNumber > 1;

  if (viewMode === 'compact') {
    return (
      <div className="text-center w-full">
        <div className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white" style={{ backgroundColor: trackColor }}>
          {visit.trackId.toUpperCase()}
        </div>
        <div className={`text-xs font-semibold ${isBouncing ? 'text-rose-700' : 'text-neutral-800'}`}>
          {stationLabel} {visit.visitNumber}
          {isBouncing && <span className="ml-1 text-[10px]" title="Station Bouncing detected">⚠️</span>}
        </div>
        <div className="text-[10px] text-neutral-500">{visit.steps.length} steps</div>
      </div>
    );
  }
  return (
    <div className="text-left w-full text-[10px] space-y-1">
      <div className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white" style={{ backgroundColor: trackColor }}>{visit.trackId.toUpperCase()}</div>
      <div className={`font-semibold ${isBouncing ? 'text-rose-700' : 'text-neutral-900'}`}>
        {stationLabel} {visit.visitNumber}
        {isBouncing && <span className="ml-1 text-[10px]" title="Station Bouncing: Inefficient revisit">⚠️</span>}
      </div>
      <div className="text-neutral-500">{visit.steps.length} steps</div>
      <div className="border-t border-neutral-200 pt-1 space-y-0.5">
        {visit.steps.slice(0, 5).map(step => <div key={step.id} className="text-[9px] text-neutral-500 truncate">{formatStepLabel(step.orderIndex)} {step.action.family}</div>)}
      </div>
    </div>
  );
}

export function DAGVisualization({ 
  build, 
  validation, 
  selectedStepId, 
  selectedVisitId, 
  selectedArtifactId,
  highlightStepIds, 
  onSelectStep, 
  onSelectVisit,
  onSelectArtifact,
  onModeChange,
}: DAGVisualizationProps) {
  const [mode, setMode] = useState<VisualizationMode>('work_order');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showSwimlanes, setShowSwimlanes] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [colorBy, setColorBy] = useState<ColorBy>('action');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [showAssemblyPoints, setShowAssemblyPoints] = useState(true);
  const [highlightMergesOnly, setHighlightMergesOnly] = useState(false);
  const [showKitchenLayout, setShowKitchenLayout] = useState(false);
  const [traceArtifactIds, setTraceArtifactIds] = useState<Set<string>>(new Set());
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [positionHistory, setPositionHistory] = useState<Node[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const hardErrorCountByStepId = useMemo(() => getHardErrorCountByStepId(validation ?? null), [validation]);
  const criticalPath = useMemo(() => computeCriticalPath(build.steps, { buildId: build.id, buildName: build.name }), [build.steps, build.id, build.name]);
  const { groupColorMap, availableGroupIds } = useMemo(() => {
    const artifacts = build.artifacts ?? [];
    return { groupColorMap: buildGroupColorMap(artifacts), availableGroupIds: getUniqueGroupIds(artifacts) };
  }, [build.artifacts]);

  useEffect(() => { if (selectedGroupIds.length === 0 && availableGroupIds.length > 0) setSelectedGroupIds(availableGroupIds); }, [availableGroupIds, selectedGroupIds.length]);
  useEffect(() => { setTraceArtifactIds(new Set()); onModeChange?.(mode); }, [mode, onModeChange]);
  useEffect(() => { setTraceArtifactIds(new Set()); }, [build.id]);

  const assemblyPoints = useMemo(() => identifyAssemblyPoints(build.steps, build.artifacts ?? []), [build.steps, build.artifacts]);
  const activeLanes = useMemo(() => {
    const lanes = new Set<string>();
    for (const step of build.steps) {
      const stationId = step.stationId || 'other';
      const applianceId = step.equipment?.applianceId;
      lanes.add(applianceId ? `${stationId}:${applianceId}` : stationId);
    }
    return Array.from(lanes).sort((a, b) => {
      const [aS, aA] = a.split(':');
      const [bS, bA] = b.split(':');
      const aI = STATION_ORDER.indexOf(aS || 'other');
      const bI = STATION_ORDER.indexOf(bS || 'other');
      if (aI !== bI) return aI - bI;
      return (aA || '').localeCompare(bA || '');
    });
  }, [build.steps]);

  const graphModel = useMemo(() => {
    if (mode === 'station_handoffs') {
      const visitModel = createVisitTimelineModel({ steps: build.steps, viewMode, selectedVisitId });
      return { nodes: visitModel.nodes, edges: visitModel.edges, laneLayout: [] as any[], trackLayouts: visitModel.trackLayouts, visitById: visitModel.visitById, artifactById: new Map() };
    }
    if (mode === 'material_flow') {
      const mfModel = createMaterialFlowModel({ steps: build.steps, artifacts: build.artifacts ?? [], groupColorMap, selectedGroupIds, viewMode, selectedArtifactId: undefined, highlightMergesOnly, showAssemblyPoints, showKitchenLayout, traceArtifactIds: traceArtifactIds.size > 0 ? traceArtifactIds : undefined });
      return { nodes: mfModel.nodes, edges: mfModel.edges, laneLayout: [] as any[], trackLayouts: [] as any[], visitById: new Map(), artifactById: mfModel.artifactById };
    }
    const cpNodeIds = showCriticalPath ? new Set(criticalPath.nodeIds) : undefined;
    const cpEdgeIds = showCriticalPath ? new Set(criticalPath.edgeIds) : undefined;
    const edges = createWorkOrderEdges(build.steps, cpEdgeIds);
    let nodes = createDAGNodes({ steps: build.steps, build, selectedStepId, highlightStepIds, criticalPathNodeIds: cpNodeIds, hardErrorCountByStepId, viewMode, assemblyPoints: undefined, showAssemblyPoints: false, highlightMergesOnly: false, colorBy });
    nodes = applyDagreLayout({ nodes, edges, viewMode });
    let laneLayout: any[] = [];
    if (showSwimlanes) {
      const laneToIndex = new Map(activeLanes.map((l, i) => [l, i]));
      const nodesByLane = new Map<string, Node[]>();
      for (const n of nodes) {
        if (isExternalNodeId(n.id)) continue;
        const step = build.steps.find(s => s.id === n.id);
        const lId = step?.equipment?.applianceId ? `${step.stationId}:${step.equipment.applianceId}` : (step?.stationId || 'other');
        if (!nodesByLane.has(lId)) nodesByLane.set(lId, []);
        nodesByLane.get(lId)!.push(n);
      }
      let currentTop = 0;
      activeLanes.forEach((lId, idx) => {
        const laneNodes = nodesByLane.get(lId) ?? [];
        const h = Math.max(1, laneNodes.length) * 150;
        laneLayout.push({ laneId: lId, top: currentTop, height: h, label: lId.replace('_', ' '), index: idx });
        nodes = nodes.map(n => {
          if (isExternalNodeId(n.id)) return n;
          const step = build.steps.find(s => s.id === n.id);
          const currentLId = step?.equipment?.applianceId ? `${step.stationId}:${step.equipment.applianceId}` : (step?.stationId || 'other');
          if (currentLId !== lId) return n;
          const localIdx = laneNodes.findIndex(node => node.id === n.id);
          return { ...n, position: { ...n.position, y: currentTop + 50 + localIdx * 120 } };
        });
        currentTop += h + 40;
      });
    }
    return { nodes, edges, laneLayout, trackLayouts: [] as any[], visitById: new Map(), artifactById: new Map() };
  }, [build, selectedStepId, selectedVisitId, highlightStepIds, mode, showCriticalPath, showSwimlanes, showKitchenLayout, selectedGroupIds, showAssemblyPoints, highlightMergesOnly, hardErrorCountByStepId, viewMode, criticalPath, activeLanes, groupColorMap, assemblyPoints, traceArtifactIds, colorBy]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graphModel.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphModel.edges);
  useEffect(() => { setNodes(graphModel.nodes); setPositionHistory([graphModel.nodes]); setHistoryIndex(0); }, [graphModel.nodes, setNodes]);
  useEffect(() => { setEdges(graphModel.edges); }, [graphModel.edges, setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'position' && 'dragging' in c && c.dragging === false)) {
      setPositionHistory(prev => [...prev.slice(0, historyIndex + 1), nodes]);
      setHistoryIndex(prev => prev + 1);
    }
    onNodesChange(changes);
  }, [nodes, historyIndex, onNodesChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey && historyIndex < positionHistory.length - 1) { setHistoryIndex(h => h + 1); setNodes(positionHistory[historyIndex + 1]); }
        else if (!e.shiftKey && historyIndex > 0) { setHistoryIndex(h => h - 1); setNodes(positionHistory[historyIndex - 1]); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, positionHistory, setNodes]);

  useEffect(() => { if (reactFlowInstanceRef.current) reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 250 }); }, [graphModel.nodes, graphModel.edges, mode, showSwimlanes, build.id, viewMode]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (isExternalNodeId(node.id)) return;
    if (node.id.startsWith('visit:')) { const v = graphModel.visitById.get(node.id); if (v) onSelectVisit?.(v); return; }
    if (mode === 'material_flow' && node.id.startsWith('artifact:')) {
      const upstream = getUpstreamArtifactIds(node.id, graphModel.edges);
      setTraceArtifactIds(upstream);
      const aId = node.id.replace('artifact:', '');
      const a = graphModel.artifactById.get(aId);
      if (a && onSelectArtifact) onSelectArtifact(a, { producedBy: build.steps.filter(s => s.output?.some(o => o.source?.type === 'in_build' && o.source.artifactId === aId)), consumedBy: build.steps.filter(s => s.input?.some(i => i.source?.type === 'in_build' && i.source.artifactId === aId)) });
      return;
    }
    onSelectStep?.(node.id);
  }, [build.steps, graphModel.edges, graphModel.visitById, graphModel.artifactById, mode, onSelectStep, onSelectVisit, onSelectArtifact]);

  if (build.steps.length === 0) return <div className="h-full w-full flex items-center justify-center bg-neutral-50 rounded border border-neutral-200 text-neutral-500 text-sm">No steps yet</div>;

  return (
    <div className="h-full w-full flex flex-col">
      <style jsx global>{`
        @keyframes error-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(225, 29, 72, 0); } }
        @keyframes merge-pulse { 0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.55); } 60% { box-shadow: 0 0 0 14px rgba(139, 92, 246, 0.15); } 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); } }
        .node-has-error { animation: error-pulse 2s ease-in-out infinite; }
      `}</style>
      <div className="mb-2 flex items-center gap-3">
        <ModeSelector mode={mode} onSetMode={setMode} />
        <ModeOptions mode={mode} viewMode={viewMode} onSetViewMode={setViewMode} showCriticalPath={showCriticalPath} onToggleCriticalPath={() => setShowCriticalPath(v => !v)} showSwimlanes={showSwimlanes} onToggleSwimlanes={() => setShowSwimlanes(v => !v)} selectedGroupIds={selectedGroupIds} availableGroupIds={availableGroupIds} groupColorMap={groupColorMap} onToggleGroupId={(id) => setSelectedGroupIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} showAssemblyPoints={showAssemblyPoints} onToggleAssemblyPoints={() => setShowAssemblyPoints(v => !v)} highlightMergesOnly={highlightMergesOnly} onToggleHighlightMergesOnly={() => setHighlightMergesOnly(v => !v)} mergeCount={assemblyPoints.size} showKitchenLayout={showKitchenLayout} onToggleKitchenLayout={() => setShowKitchenLayout(v => !v)} />
      </div>
      <div className="flex-1 relative min-h-0">
        {mode === 'station_handoffs' && <div className="absolute left-2 top-2 z-10 bg-white/90 border border-neutral-200 rounded-md p-2 shadow-sm"><div className="text-[9px] font-medium text-neutral-400 uppercase mb-1">Tracks</div>{graphModel.trackLayouts.map((track) => <div key={track.trackId} className="flex items-center gap-1.5 text-[11px] py-0.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getTrackColor(track.index) }} /><span className="font-medium text-neutral-700">{track.trackId}</span></div>)}</div>}
        {showSwimlanes && mode === 'work_order' && <div className="absolute inset-0 pointer-events-none z-0">{graphModel.laneLayout.map((lane) => <div key={lane.laneId} className={`absolute left-0 right-0 flex items-center px-4 text-[10px] font-bold uppercase tracking-widest border-b border-neutral-200 ${lane.index % 2 === 0 ? 'bg-neutral-50 text-neutral-300' : 'bg-white text-neutral-300'}`} style={{ top: lane.top, height: lane.height }}>{lane.label}</div>)}</div>}
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} onPaneClick={() => { if (mode === 'material_flow' && traceArtifactIds.size > 0) { setTraceArtifactIds(new Set()); onSelectArtifact?.(null, null); } }} onInit={(inst) => { reactFlowInstanceRef.current = inst; }} fitView nodesConnectable={false}><Background /><Controls className="flex flex-row !flex-row border border-neutral-200 rounded-md overflow-hidden bg-white shadow-sm" style={{ left: 10, bottom: 10 }} /></ReactFlow>
      </div>

      {/* Legend Bar at Bottom */}
      <div className="mt-2 pt-2 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-4">
          {mode === 'work_order' && (
            <>
              <span className="flex items-center gap-1.5" title="Task dependency">
                <span className="inline-block w-4 border-t-2 border-neutral-400" />
                <span className="inline-block w-0 h-0 border-l-4 border-l-neutral-400 border-y-[3px] border-y-transparent" />
                <span className="text-[10px]">depends on</span>
              </span>
              {showCriticalPath && (
                <span className="flex items-center gap-1.5" title="Longest path through the build">
                  <span className="inline-block w-4 h-1 rounded bg-orange-500" />
                  <span className="text-[10px]">critical path ({formatDuration(criticalPath.totalSeconds)})</span>
                </span>
              )}
            </>
          )}
          
          {mode === 'material_flow' && (
            <>
              <span className="flex items-center gap-1.5" title="Artifact evolving through steps">
                <span className="inline-block w-5 border-t-[3px] border-neutral-600" />
                <span className="inline-block w-0 h-0 border-l-4 border-l-neutral-600 border-y-[3px] border-y-transparent" />
                <span className="text-[10px]">flow</span>
              </span>
              <span className="flex items-center gap-1.5" title="Where multiple components combine into a sub-assembly">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-violet-500 bg-violet-100" />
                <span className="text-[10px]">merge point</span>
              </span>
              <span className="flex items-center gap-1.5" title="Physical location cluster">
                <span className="inline-block w-4 h-3 border-2 border-dashed border-neutral-400 rounded" />
                <span className="text-[10px]">source cluster</span>
              </span>
            </>
          )}
          
          {mode === 'station_handoffs' && (
            <>
              <span className="flex items-center gap-1.5" title="Sequential steps within a track">
                <span className="inline-block w-4 border-t-2 border-neutral-500" />
                <span className="inline-block w-0 h-0 border-l-4 border-l-neutral-500 border-y-[3px] border-y-transparent" />
                <span className="text-[10px]">within track</span>
              </span>
              <span className="flex items-center gap-1.5" title="Cross-track dependency">
                <span className="inline-block w-4 border-t-2 border-dashed border-violet-500" />
                <span className="inline-block w-0 h-0 border-l-4 border-l-violet-500 border-y-[3px] border-y-transparent" />
                <span className="text-[10px]">cross-track</span>
              </span>
              <span className="flex items-center gap-1.5" title="Revisiting a station previously left (inefficient)">
                <span className="inline-block w-3 h-3 rounded border-2 border-rose-500 bg-rose-50" />
                <span className="text-[10px] text-rose-600 font-medium">bouncing</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
