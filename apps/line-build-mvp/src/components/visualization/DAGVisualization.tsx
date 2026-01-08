'use client';

import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
  Connection,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { LineBuild, WorkUnit, ActionType } from '@/lib/model/types';

interface DAGVisualizationProps {
  build: LineBuild;
  selectedStepId?: string;
  onSelectStep?: (stepId: string) => void;
}

// Action type to color mapping
const ACTION_COLORS: Record<ActionType, string> = {
  PREP: '#3B82F6', // blue
  HEAT: '#EF4444', // red
  TRANSFER: '#8B5CF6', // purple
  ASSEMBLE: '#10B981', // green
  PORTION: '#F59E0B', // amber
  PLATE: '#EC4899', // pink
  FINISH: '#06B6D4', // cyan
  QUALITY_CHECK: '#6366F1', // indigo
};

// Phase to background mapping
const PHASE_BG: Record<string, string> = {
  PRE_COOK: '#F0F9FF', // light blue
  COOK: '#FEF2F2', // light red
  POST_COOK: '#F0FDF4', // light green
  ASSEMBLY: '#FDF2F8', // light pink
  PASS: '#ECFDF5', // very light green
};

function createDAGNodes(workUnits: WorkUnit[], selectedStepId?: string): Node[] {
  return workUnits.map((unit, index) => {
    const actionColor = ACTION_COLORS[unit.tags.action] || '#6B7280';
    const bgColor = unit.tags.phase ? PHASE_BG[unit.tags.phase] : '#FFFFFF';
    const isSelected = unit.id === selectedStepId;

    return {
      id: unit.id,
      data: {
        label: (
          <div className="w-full max-w-[150px] text-center">
            <div className="font-semibold text-xs truncate">{unit.tags.action}</div>
            <div className="text-xs text-gray-600 truncate">{unit.tags.target.name || unit.tags.target.bomId}</div>
            {unit.tags.equipment && (
              <div className="text-xs text-gray-500">🔧 {unit.tags.equipment}</div>
            )}
            {unit.tags.time && (
              <div className="text-xs text-gray-500">
                ⏱ {unit.tags.time.value}
                {unit.tags.time.unit === 'min' ? 'm' : 's'}
                {unit.tags.time.type === 'passive' && ' (passive)'}
              </div>
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

function createDAGEdges(workUnits: WorkUnit[]): Edge[] {
  const edges: Edge[] = [];

  workUnits.forEach((unit) => {
    unit.dependsOn.forEach((depId) => {
      edges.push({
        id: `edge-${depId}-${unit.id}`,
        source: depId,
        target: unit.id,
        animated: true,
        style: {
          stroke: '#9CA3AF',
          strokeWidth: 2,
        },
      });
    });
  });

  return edges;
}

export function DAGVisualization({ build, selectedStepId, onSelectStep }: DAGVisualizationProps) {
  // Generate nodes and edges from workUnits
  const initialNodes = useMemo(
    () => createDAGNodes(build.workUnits, selectedStepId),
    [build.workUnits, selectedStepId]
  );

  const initialEdges = useMemo(() => createDAGEdges(build.workUnits), [build.workUnits]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Handle node click for selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onSelectStep) {
        onSelectStep(node.id);
      }
    },
    [onSelectStep]
  );

  if (build.workUnits.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <div className="text-center text-gray-500">
          <p className="text-sm font-medium mb-2">No work units yet</p>
          <p className="text-xs">Add steps using the chat or form to see the DAG</p>
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
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
