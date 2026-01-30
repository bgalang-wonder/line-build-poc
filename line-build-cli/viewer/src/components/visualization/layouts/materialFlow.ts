 import { Node, Edge, MarkerType, Position } from 'reactflow';
 import type { Step, GroupingId } from '@/types';
 import { getGroupingForStation } from '@/types';
 import { 
   ASSEMBLY_NODE_DIMENSIONS, 
   KITCHEN_GROUPINGS, 
   STATION_COLORS,
   SUBLOCATION_COLORS 
 } from '../constants';
 import { getGroupColor, getLightTint, getUniqueGroupIds } from '@/lib/componentColors';
 import { renderAssemblyLabel } from '../nodes/AssemblyNode';
 import React from 'react';
 import dagre from '@dagrejs/dagre';
 
 type AssemblyMeta = {
   id: string;
   name?: string;
   groupId?: string;
   subAssemblies?: string[];
   lineage?: { evolvesFrom?: string };
 };
 
 type LaneLayout = {
   laneId: string;
   top: number;
   height: number;
   label: string;
   index: number;
 };
 
 function getStepGrouping(step: { groupingId?: GroupingId; equipment?: { applianceId?: string }; stationId?: string }): GroupingId {
   if (step.groupingId) return step.groupingId;
   const applianceId = step.equipment?.applianceId;
   if (applianceId) return getGroupingForStation(applianceId);
   return getGroupingForStation(step.stationId);
 }
 
 export function createMaterialFlowModel(params: {
   steps: Step[];
   assemblies: AssemblyMeta[];
   groupColorMap: Map<string, string>;
   selectedGroupIds: string[];
   viewMode: 'compact' | 'expanded';
   selectedAssemblyId?: string;
   highlightMergesOnly: boolean;
   showAssemblyPoints: boolean;
   showKitchenLayout: boolean;
   traceAssemblyIds?: Set<string>;
 }): { nodes: Node[]; edges: Edge[]; assemblyById: Map<string, AssemblyMeta>; laneLayout: LaneLayout[]; nodeLaneAssignment: Map<string, string> } {
   const { steps, assemblies, groupColorMap, selectedGroupIds, viewMode, selectedAssemblyId, highlightMergesOnly, showAssemblyPoints, showKitchenLayout, traceAssemblyIds } = params;
   const dims = ASSEMBLY_NODE_DIMENSIONS[viewMode];
   const assemblyById = new Map(assemblies.map(a => [a.id, a]));
   const filterActive = selectedGroupIds.length > 0 && selectedGroupIds.length < getUniqueGroupIds(assemblies).length;
   const traceActive = (traceAssemblyIds?.size ?? 0) > 0;
   const producerStep = new Map<string, Step>(); 
   for (const step of steps) for (const out of step.output ?? []) if (out.source.type === 'in_build') producerStep.set((out.source as any).assemblyId, step);
   
   const assemblySources = new Map<string, { stationId?: string; sublocation?: string }>();
   for (const step of steps) {
     for (const inp of step.input ?? []) {
       if (inp.source.type === 'in_build' && inp.from) {
         const assemblyId = (inp.source as any).assemblyId;
         if (!producerStep.has(assemblyId) && !assemblySources.has(assemblyId)) {
           assemblySources.set(assemblyId, { stationId: inp.from.stationId, sublocation: inp.from.sublocation?.type });
         }
       }
     }
   }
   
   for (const step of steps) {
     const hasInputs = (step.input ?? []).length > 0;
     const outputs = (step.output ?? []).filter((o): o is any => o.source.type === 'in_build');
     const stepFrom = (step as any).from;
     if (!hasInputs && outputs.length > 0 && stepFrom?.stationId && stepFrom?.sublocation?.type) {
       for (const out of outputs) {
         const assemblyId = out.source.assemblyId;
         if (!assemblySources.has(assemblyId)) {
           assemblySources.set(assemblyId, { stationId: stepFrom.stationId, sublocation: stepFrom.sublocation.type });
         }
       }
     }
   }

   // NEW: Check output[].from for external ingredient sources (tributaries)
   // This catches PORTION steps that add ingredients from equipment/storage
   // (e.g., "Place Protein from Steam Well" where the protein materializes)
   for (const step of steps) {
     for (const out of step.output ?? []) {
       if (out.source.type !== 'in_build') continue;
       const assemblyId = (out.source as any).assemblyId;
       const outFrom = (out as any).from;
       // If output has explicit from with equipment/storage sublocation, it's a tributary
       if (outFrom?.sublocation?.type &&
           outFrom.sublocation.type !== 'work_surface' &&
           !assemblySources.has(assemblyId)) {
         assemblySources.set(assemblyId, {
           stationId: outFrom.stationId,
           sublocation: outFrom.sublocation.type
         });
       }
     }
   }

   const nodeLaneAssignment = new Map<string, string>();
   for (const assembly of assemblies) {
     const producer = producerStep.get(assembly.id);
     let groupingId = 'cold_side'; 
     if (producer) groupingId = getStepGrouping(producer);
     else {
       const src = assemblySources.get(assembly.id);
       if (src?.stationId) groupingId = getGroupingForStation(src.stationId);
     }
     nodeLaneAssignment.set(`assembly:${assembly.id}`, groupingId);
   }
 
   const stationToSublocations = new Map<string, Set<string>>();
   assemblySources.forEach((info) => {
     const station = info.stationId || 'other';
     const sub = info.sublocation || 'ambient';
     if (!stationToSublocations.has(station)) stationToSublocations.set(station, new Set());
     stationToSublocations.get(station)!.add(sub);
   });
 
   stationToSublocations.forEach((_sublocations, station) => {
     const groupingId = getGroupingForStation(station);
     nodeLaneAssignment.set(`station:${station}`, groupingId);
   });
 
   const nodes: Node[] = [];
   const SUBLOC_WIDTH = 100;
   const SUBLOC_HEIGHT = 36;
   const SUBLOC_GAP = 8;
   const STATION_PADDING = 12;
   const STATION_HEADER = 28;
 
   stationToSublocations.forEach((sublocations, station) => {
     const sublocArray = Array.from(sublocations);
     const stationWidth = SUBLOC_WIDTH + STATION_PADDING * 2;
     const stationHeight = STATION_HEADER + sublocArray.length * (SUBLOC_HEIGHT + SUBLOC_GAP) - SUBLOC_GAP + STATION_PADDING;
     const stationColor = STATION_COLORS[station] || STATION_COLORS.other;
 
     nodes.push({
       id: `station:${station}`,
       type: 'group',
       data: {}, 
       position: { x: 0, y: 0 },
       style: { 
         background: 'rgba(248, 250, 252, 0.95)', 
         border: '2px dashed #94A3B8', 
         borderLeft: `4px solid ${stationColor}`,
         borderRadius: '12px', 
         width: `${stationWidth}px`, 
         height: `${stationHeight}px`,
         padding: 0,
       } as React.CSSProperties,
     });
 
     nodes.push({
       id: `station-label:${station}`,
       parentId: `station:${station}`,
       extent: 'parent' as const,
       data: { 
         label: React.createElement('div', { className: "text-center w-full" },
           React.createElement('div', { className: "text-[8px] font-medium uppercase tracking-wider opacity-60", style: { color: stationColor } }, station.replace(/_/g, ' ')),
           React.createElement('div', { className: "text-sm font-bold leading-tight mt-0.5", style: { color: stationColor } }, station.replace(/_/g, ' ').toUpperCase())
         )
       },
       position: { x: STATION_PADDING, y: 4 },
       draggable: false, selectable: false,
       style: { background: 'transparent', border: 'none', width: `${SUBLOC_WIDTH}px`, height: `${STATION_HEADER - 4}px`, pointerEvents: 'none' } as React.CSSProperties,
     });
 
     sublocArray.forEach((sub, idx) => {
       const locId = `location:${station}:${sub}`;
       const sublocColor = SUBLOCATION_COLORS[sub] || SUBLOCATION_COLORS.other;
       nodes.push({
         id: locId,
         parentId: `station:${station}`,
         extent: 'parent' as const,
         data: { 
           label: React.createElement('div', { className: "flex items-center justify-center gap-1.5 w-full" },
             React.createElement('span', { className: "w-2 h-2 rounded-full flex-shrink-0", style: { backgroundColor: sublocColor } }),
             React.createElement('span', { className: "text-[10px] font-semibold", style: { color: sublocColor } }, sub.replace(/_/g, ' '))
           )
         },
         position: { x: STATION_PADDING, y: STATION_HEADER + idx * (SUBLOC_HEIGHT + SUBLOC_GAP) },
         sourcePosition: Position.Right, targetPosition: Position.Left,
         style: { background: '#FFFFFF', border: `2px solid ${sublocColor}`, borderRadius: '6px', width: `${SUBLOC_WIDTH}px`, height: `${SUBLOC_HEIGHT}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', boxShadow: `0 1px 3px ${sublocColor}30` } as React.CSSProperties,
       });
     });
   });
 
   for (const assembly of assemblies) {
     if (filterActive && assembly.groupId && !selectedGroupIds.includes(assembly.groupId)) continue;
     const groupColor = getGroupColor(assembly.groupId, groupColorMap);
     const isSelected = selectedAssemblyId === assembly.id;
     const isMergePoint = (assembly.subAssemblies?.length ?? 0) >= 2;
     const shouldShowMerge = showAssemblyPoints && isMergePoint;
     const sourceInfo = assemblySources.get(assembly.id);
     const sourceLabel = sourceInfo ? [sourceInfo.stationId, sourceInfo.sublocation].filter(Boolean).join(' / ').replace(/_/g, ' ').toUpperCase() : undefined;
     const isDimmed = (highlightMergesOnly && !isMergePoint) || (traceActive && !traceAssemblyIds?.has(`assembly:${assembly.id}`));
     
     const getBaseComponents = (assemblyId: string, visited = new Set<string>()): Array<{id: string; name: string; color: string}> => {
       if (visited.has(assemblyId)) return [];
       visited.add(assemblyId);
       const asm = assemblyById.get(assemblyId);
       if (!asm) return [{ id: assemblyId, name: assemblyId, color: '#6B7280' }];
       if (!asm.subAssemblies || asm.subAssemblies.length === 0) return [{ id: asm.id, name: asm.name || asm.id, color: getGroupColor(asm.groupId, groupColorMap) }];
       return asm.subAssemblies.flatMap(cid => getBaseComponents(cid, visited));
     };
     
     const baseComponents = assembly.subAssemblies?.length ? Array.from(new Map(assembly.subAssemblies.flatMap(cid => getBaseComponents(cid)).map(c => [c.id, c] as [string, any])).values()) : [];
     const nodeWidth = viewMode === 'expanded' ? 240 : 160;
     let nodeHeight = viewMode === 'compact' ? 50 : 90 + (baseComponents.length / 1.5) * 32 + 10;
     const lightFill = getLightTint(groupColor);
     
     nodes.push({
       id: `assembly:${assembly.id}`,
       data: { label: renderAssemblyLabel(assembly, viewMode, baseComponents, showKitchenLayout, sourceLabel) },
       position: { x: 0, y: 0 },
       sourcePosition: Position.Right, targetPosition: Position.Left,
       style: { background: lightFill, border: isSelected ? '3px solid #111827' : shouldShowMerge ? '5px solid #7C3AED' : '1px solid #D1D5DB', borderRadius: '10px', padding: viewMode === 'expanded' ? '12px' : '8px', width: `${nodeWidth}px`, minHeight: `${nodeHeight}px`, opacity: isDimmed ? 0.25 : 1, cursor: 'pointer', display: 'flex', alignItems: viewMode === 'compact' ? 'center' : 'flex-start', animation: shouldShowMerge ? 'merge-pulse 1.8s ease-out infinite' : undefined } as React.CSSProperties,
       width: nodeWidth, height: nodeHeight,
     } as any);
   }
 
   const edges: Edge[] = [];
   assemblySources.forEach((info, assemblyId) => {
     const locId = `location:${info.stationId || 'other'}:${info.sublocation || 'ambient'}`;
     const sublocColor = SUBLOCATION_COLORS[info.sublocation || 'other'] || SUBLOCATION_COLORS.other;
     edges.push({ id: `source-flow:${locId}->assembly:${assemblyId}`, source: locId, target: `assembly:${assemblyId}`, animated: false, style: { stroke: sublocColor, strokeWidth: 2, strokeDasharray: '6 3' }, markerEnd: { type: MarkerType.ArrowClosed, color: sublocColor } });
   });
   
   for (const step of steps) {
     const outputs = (step.output ?? []).filter((o): o is any => o.source.type === 'in_build' && Boolean(o.source.assemblyId));
     for (const out of outputs) {
       const outputAssembly = assemblyById.get(out.source.assemblyId);
       if (!outputAssembly || (filterActive && outputAssembly.groupId && !selectedGroupIds.includes(outputAssembly.groupId))) continue;
       for (const inp of step.input ?? []) {
         if (inp.source.type !== 'in_build' || inp.source.assemblyId === out.source.assemblyId) continue;
         const inputAssembly = assemblyById.get(inp.source.assemblyId);
         if (!inputAssembly || (filterActive && inputAssembly.groupId && !selectedGroupIds.includes(inputAssembly.groupId))) continue;
         const isDimmed = (highlightMergesOnly && !( (inputAssembly.subAssemblies?.length ?? 0) >= 2 || (outputAssembly.subAssemblies?.length ?? 0) >= 2 )) || (traceActive && (!traceAssemblyIds?.has(`assembly:${inp.source.assemblyId}`) || !traceAssemblyIds?.has(`assembly:${out.source.assemblyId}`)));
         edges.push({ id: `mf:${inp.source.assemblyId}->${out.source.assemblyId}:${step.id}`, source: `assembly:${inp.source.assemblyId}`, target: `assembly:${out.source.assemblyId}`, animated: false, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6B7280', strokeWidth: 2, opacity: isDimmed ? 0.2 : 1 } });
       }
     }
   }
 
   const dagreGraph = new dagre.graphlib.Graph();
   dagreGraph.setDefaultEdgeLabel(() => ({}));
   dagreGraph.setGraph({ rankdir: 'LR', nodesep: viewMode === 'expanded' ? 160 : 90, ranksep: viewMode === 'expanded' ? 220 : 140, marginx: 30, marginy: 30 });
   for (const node of nodes) if (!(node as any).parentId) dagreGraph.setNode(node.id, { width: (node as any).width || 160, height: (node as any).height || 50 });
   for (const edge of edges) {
     let source = edge.source;
     if (source.startsWith('location:')) {
       const [_, station] = source.split(':');
       source = `station:${station}`;
     }
     if (dagreGraph.hasNode(source) && dagreGraph.hasNode(edge.target)) dagreGraph.setEdge(source, edge.target);
   }
   dagre.layout(dagreGraph);
   
   const nodePositions = new Map<string, { x: number; y: number }>();
   for (const node of nodes) {
     if (!(node as any).parentId) {
       const pos = dagreGraph.node(node.id);
       if (pos) nodePositions.set(node.id, { x: pos.x - ((node as any).width || dims.width) / 2, y: pos.y - ((node as any).height || dims.height) / 2 });
     }
   }
   
   let finalNodes = nodes.map(node => ({ ...node, position: nodePositions.get(node.id) || node.position }));
   let laneLayout: LaneLayout[] = [];
   
   if (showKitchenLayout) {
     const nodesPerLane = new Map<string, string[]>();
     for (const node of finalNodes) {
       if ((node as any).parentId) continue;
       const laneId = nodeLaneAssignment.get(node.id);
       if (laneId) {
         if (!nodesPerLane.has(laneId)) nodesPerLane.set(laneId, []);
         nodesPerLane.get(laneId)!.push(node.id);
       }
     }
     const MIN_LANE_HEIGHT = 100;
     const NODE_SPACING = 80;
     let currentTop = 0;
     let laneIndex = 0;
     const laneYPositions = new Map<string, { top: number; nodeY: number }>();
     for (const grouping of KITCHEN_GROUPINGS) {
       const laneNodeIds = nodesPerLane.get(grouping.id) ?? [];
       if (laneNodeIds.length === 0) continue;
       const height = Math.max(MIN_LANE_HEIGHT, laneNodeIds.length * NODE_SPACING + 40);
       laneLayout.push({ laneId: grouping.id, top: currentTop, height, label: grouping.label, index: laneIndex });
       laneYPositions.set(grouping.id, { top: currentTop, nodeY: currentTop + 40 });
       currentTop += height + 20;
       laneIndex++;
     }
     const nodeYOverrides = new Map<string, number>();
     const laneNodeCounters = new Map<string, number>();
     for (const node of finalNodes) {
       if ((node as any).parentId) continue;
       const laneId = nodeLaneAssignment.get(node.id);
       if (!laneId) continue;
       const lanePos = laneYPositions.get(laneId);
       if (!lanePos) continue;
       const idx = laneNodeCounters.get(laneId) ?? 0;
       nodeYOverrides.set(node.id, lanePos.nodeY + idx * NODE_SPACING);
       laneNodeCounters.set(laneId, idx + 1);
     }
     finalNodes = finalNodes.map(node => {
       const newY = nodeYOverrides.get(node.id);
       if (newY !== undefined) return { ...node, position: { ...node.position, y: newY } };
       return node;
     });
   }
   
   return { nodes: finalNodes, edges, assemblyById, laneLayout, nodeLaneAssignment };
 }
