import dagre from '@dagrejs/dagre';
import { Node, Edge } from 'reactflow';
import { NODE_DIMENSIONS, TRANSFER_NODE_DIMENSIONS } from '../constants';
 
export function applyDagreLayout(params: {
  nodes: Node[];
  edges: Edge[];
  viewMode?: 'compact' | 'expanded';
}): Node[] {
  const viewMode = params.viewMode ?? 'compact';
  const dims = NODE_DIMENSIONS[viewMode];

  const getNodeDims = (id: string) => {
    if (id.startsWith('transfer:')) return TRANSFER_NODE_DIMENSIONS[viewMode];
    return dims;
  };
   
  // Filter nodes to exclude external ones for the main layout, if needed.
  // In the original code, external nodes are handled specially after dagre layout.
  const stepNodes = params.nodes.filter((n) => !n.id.startsWith('external_build:'));
  const externalNodes = params.nodes.filter((n) => n.id.startsWith('external_build:'));
 
   const dagreGraph = new dagre.graphlib.Graph();
   dagreGraph.setDefaultEdgeLabel(() => ({}));
   dagreGraph.setGraph({ 
     rankdir: 'LR', 
     nodesep: viewMode === 'expanded' ? 140 : 100, 
     ranksep: viewMode === 'expanded' ? 220 : 160, 
     marginx: 30, 
     marginy: 30 
   });
 
  for (const n of [...stepNodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const nodeDims = getNodeDims(n.id);
    dagreGraph.setNode(n.id, { width: nodeDims.width, height: nodeDims.height });
  }
 
   for (const e of [...params.edges].sort((a, b) => a.id.localeCompare(b.id))) {
     if (!dagreGraph.hasNode(e.source) || !dagreGraph.hasNode(e.target)) continue;
     dagreGraph.setEdge(e.source, e.target);
   }
 
   dagre.layout(dagreGraph);
 
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const n of stepNodes) {
    const p = dagreGraph.node(n.id);
    if (!p) continue;
    const nodeDims = getNodeDims(n.id);
    nodePositions.set(n.id, { x: p.x - nodeDims.width / 2, y: p.y - nodeDims.height / 2 });
  }
 
   const positionedStepNodes = stepNodes.map((n) => ({ 
     ...n, 
     position: nodePositions.get(n.id) || n.position 
   }));
 
   const stepPosById = new Map(positionedStepNodes.map((n) => [n.id, n.position] as const));
   const externalTargetsBySource = new Map<string, string[]>();
   for (const e of params.edges) {
     if (!e.source.startsWith('external_build:')) continue;
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
