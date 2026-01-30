'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatStepLabel } from '@/lib/stepLabel';
import ReactFlow, { Node, Edge, Controls, Background, useNodesState, useEdgesState, type ReactFlowInstance, type NodeChange, type Viewport } from 'reactflow';
import 'reactflow/dist/style.css';

import { VisualizationMode, ViewMode, ModeSelector, ModeOptions } from '@/components/visualization/GraphLayerToggles';
export type { VisualizationMode, ViewMode };
import type { BenchTopLineBuild, Step, StationVisit, ValidationOutput, GroupingId } from '@/types';
import { getHardErrorCountByStepId } from '@/lib/validationModel';
import { computeCriticalPath } from '@/lib/graphMetrics';
import { buildGroupColorMap, getUniqueGroupIds } from '@/lib/componentColors';

import { createWorkOrderNodes, createWorkOrderEdges } from './layouts/workOrderFlow';
import { createMaterialFlowModel } from './layouts/materialFlow';
import { createVisitTimelineModel } from './layouts/visitTimeline';
import { applyDagreLayout } from './layouts/dagreLayout';
import { STATION_COLORS, KITCHEN_GROUPING_BY_ID } from './constants';

export type ColorBy = 'action' | 'station';

const EXTERNAL_NODE_PREFIX = 'external_build:';
function isExternalNodeId(id: string): boolean { return id.startsWith(EXTERNAL_NODE_PREFIX); }

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

function getUpstreamAssemblyIds(targetId: string, edges: Edge[]): Set<string> {
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
  const TRACK_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EA580C', '#0891B2', '#CA8A04', '#DB2777'];
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

interface DAGVisualizationProps {
  build: BenchTopLineBuild;
  validation?: ValidationOutput | null;
  selectedStepId?: string;
  selectedVisitId?: string;
  selectedAssemblyId?: string;
  highlightStepIds?: string[];
  onSelectStep?: (stepId: string | undefined) => void;
  onSelectVisit?: (visit: StationVisit | null) => void;
  onSelectAssembly?: (assembly: any | null, assemblySteps: { producedBy: Step[]; consumedBy: Step[] } | null) => void;
  onModeChange?: (mode: VisualizationMode) => void;
}

export function DAGVisualization({
  build, validation, selectedStepId, selectedVisitId, selectedAssemblyId,
  highlightStepIds, onSelectStep, onSelectVisit, onSelectAssembly, onModeChange,
}: DAGVisualizationProps) {
  const [mode, setMode] = useState<VisualizationMode>('work_order');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showSwimlanes, setShowSwimlanes] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [colorBy] = useState<ColorBy>('action');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [showAssemblyPoints, setShowAssemblyPoints] = useState(true);
  const [highlightMergesOnly, setHighlightMergesOnly] = useState(false);
  const [showKitchenLayout, setShowKitchenLayout] = useState(false);
  const [traceAssemblyIds, setTraceAssemblyIds] = useState<Set<string>>(new Set());
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [positionHistory, setPositionHistory] = useState<Node[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Search state (F8)
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hardErrorCountByStepId = useMemo(() => getHardErrorCountByStepId(validation ?? null), [validation]);
  const criticalPath = useMemo(() => computeCriticalPath(build.steps, { buildId: build.id, buildName: build.name }), [build.steps, build.id, build.name]);
  const { groupColorMap, availableGroupIds } = useMemo(() => {
    const assemblies = build.assemblies ?? [];
    return { groupColorMap: buildGroupColorMap(assemblies), availableGroupIds: getUniqueGroupIds(assemblies) };
  }, [build.assemblies]);

  // Calculate node counts per group for Material Flow mode
  const groupNodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const assemblies = build.assemblies ?? [];
    assemblies.forEach(assembly => {
      if (assembly.groupId) {
        counts.set(assembly.groupId, (counts.get(assembly.groupId) || 0) + 1);
      }
    });
    return counts;
  }, [build.assemblies]);

  // Handlers for group bulk operations
  const handleSelectAllGroups = useCallback(() => {
    setSelectedGroupIds([...availableGroupIds]);
  }, [availableGroupIds]);

  const handleSelectNoGroups = useCallback(() => {
    setSelectedGroupIds([]);
  }, []);

  const assemblyPoints = useMemo(() => {
    const points = new Map<string, { inputCount: number; outputCount: number }>();
    for (const step of build.steps) {
      const inputCount = (step.input ?? []).filter(i => i.source?.type === 'in_build').length;
      const outputCount = (step.output ?? []).filter(o => o.source?.type === 'in_build').length;
      if (inputCount >= 2) points.set(step.id, { inputCount, outputCount });
    }
    return points;
  }, [build.steps]);

  // Search matching (F8)
  const searchMatchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matches = new Set<string>();
    for (const step of build.steps) {
      const searchFields = [
        step.id,
        step.instruction,
        step.notes,
        step.target?.name,
        step.action.family,
        step.action.techniqueId,
        step.stationId,
        step.equipment?.applianceId,
      ].filter(Boolean);
      if (searchFields.some(f => f?.toLowerCase().includes(q))) {
        matches.add(step.id);
      }
    }
    // Also search assemblies in material flow mode
    if (mode === 'material_flow') {
      for (const assembly of build.assemblies ?? []) {
        const searchFields = [assembly.id, assembly.name, assembly.groupId].filter(Boolean);
        if (searchFields.some(f => f?.toLowerCase().includes(q))) {
          matches.add(`assembly:${assembly.id}`);
        }
      }
    }
    return matches;
  }, [searchQuery, build.steps, build.assemblies, mode]);

  useEffect(() => { if (selectedGroupIds.length === 0 && availableGroupIds.length > 0) setSelectedGroupIds(availableGroupIds); }, [availableGroupIds, selectedGroupIds.length]);
  useEffect(() => { setTraceAssemblyIds(new Set()); onModeChange?.(mode); if (mode !== 'work_order') setShowTransfers(false); }, [mode, onModeChange]);
  useEffect(() => { setTraceAssemblyIds(new Set()); }, [build.id]);

  const normalizedTransfers = useMemo(() => {
    const stepIds = new Set(build.steps.map(step => step.id));

    // Transfers already have correct producerStepId and consumerStepId from derivation.
    // We just need to validate they reference existing steps and filter out self-referential transfers.
    return (build.derivedTransfers ?? [])
      .filter((transfer) => {
        // Filter out transfers where producer or consumer doesn't exist
        if (!stepIds.has(transfer.producerStepId) || !stepIds.has(transfer.consumerStepId)) {
          return false;
        }
        // Filter out self-referential transfers (can't be visualized)
        if (transfer.producerStepId === transfer.consumerStepId) {
          return false;
        }
        return true;
      })
      .map((transfer) => ({
        ...transfer,
        // Transfer IDs are already correct, just pass through
        producerStepId: transfer.producerStepId,
        consumerStepId: transfer.consumerStepId,
      }));
  }, [build.steps, build.derivedTransfers]);

  // Count only non-self-referential transfers (those that can actually be visualized)
  const transferCount = normalizedTransfers.filter(t => t.producerStepId !== t.consumerStepId).length;

  const activeLanes = useMemo(() => {
    const lanes = new Set<string>();
    for (const step of build.steps) {
      const stationId = step.stationId || 'other';
      const applianceId = step.equipment?.applianceId;
      lanes.add(applianceId ? `${stationId}:${applianceId}` : stationId);
    }
    const STATION_ORDER = ['hot_side', 'cold_side', 'prep', 'garnish', 'vending', 'expo', 'pass', 'other'];
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
      return { nodes: visitModel.nodes, edges: visitModel.edges, laneLayout: [] as any[], trackLayouts: visitModel.trackLayouts, visitById: visitModel.visitById, assemblyById: new Map(), nodeLaneAssignment: new Map<string, string>() };
    }
    if (mode === 'material_flow') {
      const mfModel = createMaterialFlowModel({ steps: build.steps, assemblies: build.assemblies ?? [], groupColorMap, selectedGroupIds, viewMode, selectedAssemblyId: undefined, highlightMergesOnly, showAssemblyPoints, showKitchenLayout, traceAssemblyIds: traceAssemblyIds.size > 0 ? traceAssemblyIds : undefined });
      return { nodes: mfModel.nodes, edges: mfModel.edges, laneLayout: mfModel.laneLayout, trackLayouts: [] as any[], visitById: new Map(), assemblyById: mfModel.assemblyById, nodeLaneAssignment: mfModel.nodeLaneAssignment };
    }
    const cpNodeIds = showCriticalPath ? new Set(criticalPath.nodeIds) : undefined;
    const cpEdgeIds = showCriticalPath ? new Set(criticalPath.edgeIds) : undefined;
    const edges = createWorkOrderEdges(build.steps, cpEdgeIds, showTransfers, normalizedTransfers);
    let nodes = createWorkOrderNodes({ steps: build.steps, build, selectedStepId, highlightStepIds, criticalPathNodeIds: cpNodeIds, hardErrorCountByStepId, viewMode, assemblyPoints, showAssemblyPoints, highlightMergesOnly, colorBy, showTransfers, derivedTransfers: normalizedTransfers });
    nodes = applyDagreLayout({ nodes, edges, viewMode });
    let laneLayout: any[] = [];
    if (showSwimlanes) {
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
    return { nodes, edges, laneLayout, trackLayouts: [] as any[], visitById: new Map(), assemblyById: new Map(), nodeLaneAssignment: new Map<string, string>() };
  }, [build, selectedStepId, selectedVisitId, highlightStepIds, mode, showCriticalPath, showSwimlanes, showKitchenLayout, selectedGroupIds, showAssemblyPoints, highlightMergesOnly, hardErrorCountByStepId, viewMode, criticalPath, activeLanes, groupColorMap, traceAssemblyIds, colorBy, assemblyPoints, showTransfers]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graphModel.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphModel.edges);
  useEffect(() => { setNodes(graphModel.nodes); setPositionHistory([graphModel.nodes]); setHistoryIndex(0); }, [graphModel.nodes, setNodes]);
  useEffect(() => { setEdges(graphModel.edges); }, [graphModel.edges, setEdges]);

  // Apply search highlighting to nodes
  useEffect(() => {
    if (searchQuery.trim() && searchMatchingNodeIds.size > 0) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            opacity: searchMatchingNodeIds.has(n.id) ? 1 : 0.3,
            boxShadow: searchMatchingNodeIds.has(n.id) ? '0 0 0 3px #3B82F6' : undefined,
          },
        }))
      );
    } else if (!searchQuery.trim()) {
      // Reset opacity when search is cleared
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            opacity: 1,
            boxShadow: undefined,
          },
        }))
      );
    }
  }, [searchQuery, searchMatchingNodeIds, setNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'position' && 'dragging' in c && c.dragging === false)) {
      setPositionHistory(prev => [...prev.slice(0, historyIndex + 1), nodes]);
      setHistoryIndex(prev => prev + 1);
    }
    onNodesChange(changes);
  }, [nodes, historyIndex, onNodesChange]);

  const laneBoundsMap = useMemo(() => {
    const map = new Map<string, { top: number; bottom: number }>();
    for (const lane of graphModel.laneLayout) map.set(lane.laneId, { top: lane.top, bottom: lane.top + lane.height });
    return map;
  }, [graphModel.laneLayout]);

  const handleNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    if (!showKitchenLayout || mode !== 'material_flow') return;
    const laneId = graphModel.nodeLaneAssignment.get(node.id);
    if (!laneId) return;
    const laneBounds = laneBoundsMap.get(laneId);
    if (!laneBounds) return;
    const nodeHeight = (node as any).height || 50;
    const minY = laneBounds.top + 10;
    const maxY = laneBounds.bottom - nodeHeight - 10;
    if (node.position.y < minY || node.position.y > maxY) {
      const clampedY = Math.max(minY, Math.min(maxY, node.position.y));
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, position: { ...n.position, y: clampedY } } : n));
    }
  }, [showKitchenLayout, mode, graphModel.nodeLaneAssignment, laneBoundsMap, setNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+F to open search (F8)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey && historyIndex < positionHistory.length - 1) { setHistoryIndex(h => h + 1); setNodes(positionHistory[historyIndex + 1]); }
        else if (!e.shiftKey && historyIndex > 0) { setHistoryIndex(h => h - 1); setNodes(positionHistory[historyIndex - 1]); }
        return;
      }
      if (e.key === 'Escape') {
        // Close search first, then deselect
        if (showSearch) { setShowSearch(false); setSearchQuery(''); return; }
        if (selectedStepId) onSelectStep?.(undefined);
        else if (selectedVisitId) onSelectVisit?.(null);
        else if (selectedAssemblyId) { setTraceAssemblyIds(new Set()); onSelectAssembly?.(null, null); }
        return;
      }
      if (mode === 'work_order' && selectedStepId && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const sortedSteps = [...build.steps].sort((a, b) => a.orderIndex - b.orderIndex);
        const currentIndex = sortedSteps.findIndex(s => s.id === selectedStepId);
        if (currentIndex === -1) return;
        if (e.key === 'ArrowDown' && currentIndex < sortedSteps.length - 1) onSelectStep?.(sortedSteps[currentIndex + 1].id);
        else if (e.key === 'ArrowUp' && currentIndex > 0) onSelectStep?.(sortedSteps[currentIndex - 1].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, positionHistory, setNodes, selectedStepId, selectedVisitId, selectedAssemblyId, mode, build.steps, onSelectStep, onSelectVisit, onSelectAssembly, showSearch]);

  useEffect(() => { if (reactFlowInstanceRef.current) reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 250 }); }, [graphModel.nodes, graphModel.edges, mode, showSwimlanes, build.id, viewMode]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (isExternalNodeId(node.id)) return;
    if (node.id.startsWith('visit:')) {
      const v = graphModel.visitById.get(node.id);
      if (selectedVisitId === node.id) onSelectVisit?.(null);
      else if (v) onSelectVisit?.(v);
      return;
    }
    if (mode === 'material_flow' && node.id.startsWith('assembly:')) {
      const aId = node.id.replace('assembly:', '');
      if (selectedAssemblyId === aId) { setTraceAssemblyIds(new Set()); onSelectAssembly?.(null, null); }
      else {
        const upstream = getUpstreamAssemblyIds(node.id, graphModel.edges);
        setTraceAssemblyIds(upstream);
        const a = graphModel.assemblyById.get(aId);
        if (a && onSelectAssembly) onSelectAssembly(a, { producedBy: build.steps.filter(s => s.output?.some(o => o.source?.type === 'in_build' && (o.source as any).assemblyId === aId)), consumedBy: build.steps.filter(s => s.input?.some(i => i.source?.type === 'in_build' && (i.source as any).assemblyId === aId)) });
      }
      return;
    }
    if (selectedStepId === node.id) onSelectStep?.(undefined);
    else onSelectStep?.(node.id);
  }, [build.steps, graphModel.edges, graphModel.visitById, graphModel.assemblyById, mode, selectedStepId, selectedVisitId, selectedAssemblyId, onSelectStep, onSelectVisit, onSelectAssembly]);

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
        <ModeOptions mode={mode} viewMode={viewMode} onSetViewMode={setViewMode} showCriticalPath={showCriticalPath} onToggleCriticalPath={() => setShowCriticalPath(v => !v)} showSwimlanes={showSwimlanes} onToggleSwimlanes={() => setShowSwimlanes(v => !v)} showTransfers={showTransfers} onToggleTransfers={() => setShowTransfers(v => !v)} transferCount={transferCount} selectedGroupIds={selectedGroupIds} availableGroupIds={availableGroupIds} groupColorMap={groupColorMap} groupNodeCounts={groupNodeCounts} onToggleGroupId={(id) => setSelectedGroupIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} onSelectAllGroups={handleSelectAllGroups} onSelectNoGroups={handleSelectNoGroups} showAssemblyPoints={showAssemblyPoints} onToggleAssemblyPoints={() => setShowAssemblyPoints(v => !v)} highlightMergesOnly={highlightMergesOnly} onToggleHighlightMergesOnly={() => setHighlightMergesOnly(v => !v)} mergeCount={assemblyPoints.size} showKitchenLayout={showKitchenLayout} onToggleKitchenLayout={() => setShowKitchenLayout(v => !v)} />
        {/* Search button */}
        <button
          onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className="ml-auto p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
          title="Search (Cmd+F)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
      {/* Search overlay (F8) */}
      {showSearch && (
        <div className="absolute top-16 right-4 z-50 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search steps..."
            className="text-sm border-none outline-none w-48 focus:ring-0"
          />
          {searchQuery && (
            <span className="text-xs text-neutral-500">
              {searchMatchingNodeIds.size} match{searchMatchingNodeIds.size !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="p-1 text-neutral-400 hover:text-neutral-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 relative min-h-0">
        {mode === 'station_handoffs' && <div className="absolute left-2 top-2 z-10 bg-white/90 border border-neutral-200 rounded-md p-2 shadow-sm"><div className="text-[9px] font-medium text-neutral-400 uppercase mb-1">Tracks</div>{graphModel.trackLayouts.map((track: any) => <div key={track.trackId} className="flex items-center gap-1.5 text-[11px] py-0.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getTrackColor(track.index) }} /><span className="font-medium text-neutral-700">{track.trackId}</span></div>)}</div>}
        {showSwimlanes && mode === 'work_order' && (
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0', width: '10000px', height: '10000px' }}>
              {graphModel.laneLayout.map((lane: any) => (<div key={lane.laneId} className={`absolute flex items-center px-4 text-[10px] font-bold uppercase tracking-widest border-b border-neutral-200/60 ${lane.index % 2 === 0 ? 'bg-neutral-50 text-neutral-300' : 'bg-white text-neutral-300'}`} style={{ top: lane.top, height: lane.height, width: '10000px' }}>{lane.label}</div>))}
            </div>
          </div>
        )}
        {showKitchenLayout && mode === 'material_flow' && graphModel.laneLayout.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0', width: '10000px', height: '10000px' }}>
              {graphModel.laneLayout.map((lane: any) => {
                const kitchenGrouping = KITCHEN_GROUPING_BY_ID.get(lane.laneId);
                const bgColor = kitchenGrouping?.color ?? '#F3F4F6';
                return (<div key={lane.laneId} className="absolute flex items-start px-4 pt-2 border-b border-neutral-200/60" style={{ top: lane.top, height: lane.height, width: '10000px', backgroundColor: bgColor }}><span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600/70 bg-white/60 px-2 py-1 rounded">{lane.label}</span></div>);
              })}
            </div>
          </div>
        )}
        <ReactFlow key={`${mode}-${showKitchenLayout}-${showSwimlanes}`} nodes={nodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onNodeDrag={handleNodeDrag} onNodeClick={handleNodeClick}
          onNodeMouseEnter={(_e, node) => {
            if (node.id === selectedStepId || node.id === selectedVisitId || node.id === `assembly:${selectedAssemblyId}`) return;
            if (isExternalNodeId(node.id)) return;
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredNodeId(node.id);
              const rfInstance = reactFlowInstanceRef.current;
              if (rfInstance) { const nodePos = rfInstance.flowToScreenPosition({ x: node.position.x + 80, y: node.position.y - 10 }); setTooltipPosition({ x: nodePos.x, y: nodePos.y }); }
            }, 300);
          }}
          onNodeMouseLeave={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setHoveredNodeId(null); setTooltipPosition(null); }}
          onPaneClick={() => { if (mode === 'material_flow') { setTraceAssemblyIds(new Set()); onSelectAssembly?.(null, null); } else if (mode === 'station_handoffs') onSelectVisit?.(null); else onSelectStep?.(undefined); }}
          onInit={(inst) => { reactFlowInstanceRef.current = inst; }} onMove={(_event, vp) => setViewport(vp)} fitView nodesConnectable={false}
        >
          <Background />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            className="flex flex-row !flex-row border border-neutral-200 rounded-md overflow-hidden bg-white shadow-sm"
            style={{ left: 10, bottom: 10 }}
          />
        </ReactFlow>
        {hoveredNodeId && tooltipPosition && (
          <div className="fixed z-50 bg-neutral-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none" style={{ left: tooltipPosition.x, top: tooltipPosition.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}>
            {(() => {
              const step = build.steps.find(s => s.id === hoveredNodeId);
              if (step) return (<div className="max-w-[200px]"><div className="font-semibold">{formatStepLabel(step.orderIndex)}: {step.action.family}</div>{(step.instruction || step.notes) && <div className="text-neutral-300 text-xs mt-1 line-clamp-2">{step.instruction || step.notes}</div>}{step.time?.durationSeconds && <div className="text-neutral-400 text-xs mt-1">⏱ {formatDuration(step.time.durationSeconds)}</div>}</div>);
              if (hoveredNodeId.startsWith('visit:')) { const visit = graphModel.visitById.get(hoveredNodeId); if (visit) return (<div><div className="font-semibold">{visit.stationId.replace('_', ' ').toUpperCase()} {visit.visitNumber}</div><div className="text-neutral-300 text-xs">{visit.steps.length} steps</div></div>); }
              if (hoveredNodeId.startsWith('assembly:')) { const aId = hoveredNodeId.replace('assembly:', ''); const assembly = graphModel.assemblyById.get(aId); if (assembly) return (<div><div className="font-semibold">{assembly.name || assembly.id}</div>{assembly.groupId && <div className="text-neutral-300 text-xs">{assembly.groupId}</div>}</div>); }
              return null;
            })()}
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-4">
          {mode === 'work_order' && (<><span className="flex items-center gap-1.5" title="Task dependency"><span className="inline-block w-4 border-t-2 border-neutral-400" /><span className="inline-block w-0 h-0 border-l-4 border-l-neutral-400 border-y-[3px] border-y-transparent" /><span className="text-[10px]">depends on</span></span>{showCriticalPath && <span className="flex items-center gap-1.5" title="Longest path through the build"><span className="inline-block w-4 h-1 rounded bg-orange-500" /><span className="text-[10px]">critical path ({formatDuration(criticalPath.totalSeconds)})</span></span>}{showTransfers && <span className="flex items-center gap-1.5" title="Derived material transfer between steps"><span className="inline-block w-4 h-3 rounded" style={{ background: '#3B82F6', clipPath: 'polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%)' }} /><span className="text-[10px]">transfer</span></span>}</>)}
          {mode === 'material_flow' && (<><span className="flex items-center gap-1.5" title="Artifact evolving through steps"><span className="inline-block w-5 border-t-[3px] border-neutral-600" /><span className="inline-block w-0 h-0 border-l-4 border-l-neutral-600 border-y-[3px] border-y-transparent" /><span className="text-[10px]">flow</span></span><span className="flex items-center gap-1.5" title="Where multiple components combine into a sub-assembly"><span className="inline-block w-3 h-3 rounded-full border-2 border-violet-500 bg-violet-100" /><span className="text-[10px]">merge point</span></span><span className="flex items-center gap-1.5" title="Physical location cluster"><span className="inline-block w-4 h-3 border-2 border-dashed border-neutral-400 rounded" /><span className="text-[10px]">source cluster</span></span></>)}
          {mode === 'station_handoffs' && (<><span className="flex items-center gap-1.5" title="Sequential steps within a track"><span className="inline-block w-4 border-t-2 border-neutral-500" /><span className="inline-block w-0 h-0 border-l-4 border-l-neutral-500 border-y-[3px] border-y-transparent" /><span className="text-[10px]">within track</span></span><span className="flex items-center gap-1.5" title="Cross-track dependency"><span className="inline-block w-4 border-t-2 border-dashed border-violet-500" /><span className="inline-block w-0 h-0 border-l-4 border-l-violet-500 border-y-[3px] border-y-transparent" /><span className="text-[10px]">cross-track</span></span><span className="flex items-center gap-1.5" title="Revisiting a station previously left (inefficient)"><span className="inline-block w-3 h-3 rounded border-2 border-rose-500 bg-rose-50" /><span className="text-[10px] text-rose-600 font-medium">bouncing</span></span></>)}
        </div>
      </div>
    </div>
  );
}
