 import dagre from '@dagrejs/dagre';
 import { Node, Edge, MarkerType, Position } from 'reactflow';
 import type { Step, StationVisit } from '@/types';
 import { getDependencyStepId, isConditionalDependency } from '@/types';
 import { groupStepsIntoVisits } from '@/lib/visitTimeline';
 import { VISIT_NODE_DIMENSIONS, STATION_COLORS } from '../constants';
 import { renderVisitLabel } from '../nodes/VisitNode';
 import React from 'react';
 
 type TrackLayout = {
   trackId: string;
   top: number;
   height: number;
   label: string;
   index: number;
 };
 
 export function createVisitTimelineModel(params: {
   steps: Step[];
   viewMode: 'compact' | 'expanded';
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
     for (const depRef of step.dependsOn ?? []) {
       const depId = getDependencyStepId(depRef);
       const fromVisitId = stepToVisitId.get(depId);
       const toVisitId = stepToVisitId.get(step.id);
       if (fromVisitId && toVisitId && fromVisitId !== toVisitId) {
         if (visitById.get(fromVisitId)?.trackId !== visitById.get(toVisitId)?.trackId) {
           dagreGraph.setEdge(fromVisitId, toVisitId);
           crossTrackEdges.push({ fromVisitId, toVisitId, depStep: stepById.get(depId), step, isConditional: isConditionalDependency(depRef) });
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
