 import { Node, Edge, MarkerType, Position } from 'reactflow';
 import type { BenchTopLineBuild, Step, DerivedTransferStep } from '@/types';
 import { getDependencyStepId, isConditionalDependency } from '@/types';
 import { 
   ACTION_COLORS, 
   STATION_COLORS, 
   PHASE_BG, 
   NODE_DIMENSIONS,
   type ActionFamily 
 } from '../constants';
 import { renderCompactLabel, renderExpandedLabel } from '../nodes/StepNode';
 import { renderTransferLabel, getTransferNodeStyle } from '../nodes/TransferNode';
 import React from 'react';
 
 export function createWorkOrderNodes(params: {
   steps: Step[];
   build: BenchTopLineBuild;
   selectedStepId?: string;
   selectedTransferId?: string;
   highlightStepIds?: string[];
   criticalPathNodeIds?: Set<string>;
   externalNodes?: { id: string; label: string }[];
   hardErrorCountByStepId?: Map<string, number>;
   viewMode?: 'compact' | 'expanded';
   assemblyPoints?: Map<string, { inputCount: number; outputCount: number }>;
   showAssemblyPoints?: boolean;
   highlightMergesOnly?: boolean;
   colorBy?: 'action' | 'station';
   showTransfers?: boolean;
   derivedTransfers?: DerivedTransferStep[];
 }): Node[] {
   const orderedSteps = [...params.steps].sort((a, b) => a.orderIndex - b.orderIndex);
   const externalNodes = params.externalNodes ?? [];
   const highlightSet = new Set(params.highlightStepIds ?? []);
   const hasHighlight = highlightSet.size > 0;
   const criticalPathNodes = params.criticalPathNodeIds ?? new Set();
   const highlightMergesOnly = params.highlightMergesOnly ?? false;
 
   const external: Node[] = externalNodes.map((n, index) => ({
     id: n.id,
     data: { label: React.createElement('div', { className: "w-full max-w-[180px] text-center" }, 
       React.createElement('div', { className: "font-semibold text-xs text-neutral-700 truncate" }, "EXTERNAL"),
       React.createElement('div', { className: "text-xs text-neutral-600 truncate" }, n.label)
     ) },
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
 
   // Create transfer nodes if showTransfers is enabled
   const transferNodes: Node[] = [];
   if (params.showTransfers && params.derivedTransfers && params.derivedTransfers.length > 0) {
     const viewMode = params.viewMode ?? 'compact';
     params.derivedTransfers
       // Filter out self-referential transfers (producer === consumer) - these can't be visualized
       .filter((transfer) => transfer.producerStepId !== transfer.consumerStepId)
       .forEach((transfer, idx) => {
         const isSelected = transfer.id === params.selectedTransferId;
         transferNodes.push({
           id: `transfer:${transfer.id}`,
           data: {
             label: renderTransferLabel(transfer, viewMode),
             transfer, // Store for click handling
           },
           position: { x: idx * 150, y: 150 }, // Dagre will reposition
           sourcePosition: Position.Right,
           targetPosition: Position.Left,
           style: getTransferNodeStyle(transfer, viewMode, isSelected),
         });
       });
   }

   return [...external, ...stepNodes, ...transferNodes];
 }
 
export function createWorkOrderEdges(
  steps: Step[],
  criticalPathEdgeIds?: Set<string>,
  showTransfers?: boolean,
  derivedTransfers?: DerivedTransferStep[]
): Edge[] {
  const edges: Edge[] = [];
  const cpEdges = criticalPathEdgeIds ?? new Set();

  // Build a map of producer→consumer pairs that have transfers.
  // Key: "producerStepId→consumerStepId", Value: transfers (plural to avoid orphan nodes).
  const transferMap = new Map<string, DerivedTransferStep[]>();
  const usedTransferIds = new Set<string>();
  if (showTransfers && derivedTransfers) {
    for (const transfer of derivedTransfers) {
      if (transfer.producerStepId === transfer.consumerStepId) continue;
      const key = `${transfer.producerStepId}->${transfer.consumerStepId}`;
      if (!transferMap.has(key)) transferMap.set(key, []);
      transferMap.get(key)!.push(transfer);
    }
  }

   // Create dependency edges, routing through transfer nodes when applicable
   for (const step of steps) {
     // Deduplicate dependencies by stepId to avoid creating duplicate edges
     const seenDeps = new Set<string>();
     for (const depRef of step.dependsOn ?? []) {
       const depId = getDependencyStepId(depRef);

       // Skip if we've already processed this dependency
       if (seenDeps.has(depId)) continue;
       seenDeps.add(depId);

       const isConditional = isConditionalDependency(depRef);
      const isCP = cpEdges.has(`${depId}->${step.id}`);

      const edgeKey = `${depId}->${step.id}`;
      const transfers = transferMap.get(edgeKey);

      if (transfers && transfers.length > 0 && showTransfers) {
        for (const transfer of transfers) {
          // Route through transfer node: producer → transfer → consumer
          const transferNodeId = `transfer:${transfer.id}`;

          // Edge: producer → transfer
          edges.push({
            id: `work:${depId}->transfer:${transfer.id}`,
            source: depId,
            target: transferNodeId,
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              stroke: isConditional ? '#A855F7' : (isCP ? '#F97316' : '#9CA3AF'),
              strokeWidth: isCP ? 4 : 2,
              strokeDasharray: isConditional ? '5,5' : undefined,
            },
            data: { conditional: isConditional },
          });

          // Edge: transfer → consumer
          edges.push({
            id: `work:transfer:${transfer.id}->${step.id}`,
            source: transferNodeId,
            target: step.id,
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              stroke: isConditional ? '#A855F7' : (isCP ? '#F97316' : '#9CA3AF'),
              strokeWidth: isCP ? 4 : 2,
              strokeDasharray: isConditional ? '5,5' : undefined,
            },
            data: { conditional: isConditional },
          });

          usedTransferIds.add(transfer.id);
        }
      } else {
        // Direct edge: producer → consumer
        edges.push({
          id: `work:${depId}->${step.id}`,
           source: depId,
           target: step.id,
           animated: false,
           markerEnd: { type: MarkerType.ArrowClosed },
           style: {
             stroke: isConditional ? '#A855F7' : (isCP ? '#F97316' : '#9CA3AF'),
             strokeWidth: isCP ? 4 : 2,
             strokeDasharray: isConditional ? '5,5' : undefined,
           },
           data: { conditional: isConditional },
         });
       }
     }
   }

  // Create edges for any remaining transfers that don't have explicit dependsOn
  // These are material flow transfers without explicit task dependencies
  if (showTransfers && derivedTransfers) {
    for (const transfer of derivedTransfers) {
      // Skip self-referential transfers (producer === consumer) - these can't be visualized as edges
      if (transfer.producerStepId === transfer.consumerStepId) {
        continue;
      }
      if (usedTransferIds.has(transfer.id)) continue;

      const edgeKey = `${transfer.producerStepId}->${transfer.consumerStepId}`;
      // Only create edges for transfers that weren't handled above
      if (!transferMap.has(edgeKey)) continue;

      const transferNodeId = `transfer:${transfer.id}`;

       // Edge: producer → transfer (dashed to indicate material flow, not task dependency)
       edges.push({
         id: `material:${transfer.producerStepId}->transfer:${transfer.id}`,
         source: transfer.producerStepId,
         target: transferNodeId,
         animated: false,
         markerEnd: { type: MarkerType.ArrowClosed },
         style: {
           stroke: '#60A5FA', // blue-400 for material flow
           strokeWidth: 2,
           strokeDasharray: '4,4',
         },
         data: { materialFlow: true },
       });

       // Edge: transfer → consumer
       edges.push({
         id: `material:transfer:${transfer.id}->${transfer.consumerStepId}`,
         source: transferNodeId,
         target: transfer.consumerStepId,
         animated: false,
         markerEnd: { type: MarkerType.ArrowClosed },
         style: {
           stroke: '#60A5FA',
           strokeWidth: 2,
           strokeDasharray: '4,4',
         },
         data: { materialFlow: true },
       });
     }
   }

   return edges;
 }
