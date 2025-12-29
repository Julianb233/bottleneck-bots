'use client';

import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ActionNode } from './ActionNode';
import { ConnectionsLayer } from './ConnectionLine';
import {
  Workflow,
  WorkflowNode,
  ActionType,
  Position,
  generateId,
  getActionDefinition,
} from './types';

interface WorkflowCanvasProps {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  onNodeConfigure?: (nodeId: string) => void;
  className?: string;
}

export function WorkflowCanvas({
  workflow,
  onWorkflowChange,
  onNodeConfigure,
  className,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [temporaryConnection, setTemporaryConnection] = useState<{
    fromPosition: Position;
    toPosition: Position;
  } | null>(null);

  // Handle dropping a new action from the palette
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const actionType = e.dataTransfer.getData('actionType') as ActionType;
      if (!actionType || !canvasRef.current) return;

      const definition = getActionDefinition(actionType);
      if (!definition) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const position: Position = {
        x: e.clientX - canvasRect.left - 90, // Center the node
        y: e.clientY - canvasRect.top - 40,
      };

      // Snap to grid (20px)
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;

      const newNode: WorkflowNode = {
        id: generateId(),
        type: actionType === 'webhook' ? 'trigger' : 'action',
        actionType,
        label: definition.label,
        config: { ...definition.defaultConfig },
        position,
        connections: [],
      };

      onWorkflowChange({
        ...workflow,
        nodes: [...workflow.nodes, newNode],
      });
    },
    [workflow, onWorkflowChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Handle node movement
  const handleNodeMove = useCallback(
    (nodeId: string, position: Position) => {
      // Snap to grid
      const snappedPosition = {
        x: Math.round(position.x / 20) * 20,
        y: Math.round(position.y / 20) * 20,
      };

      const updatedNodes = workflow.nodes.map((node) =>
        node.id === nodeId ? { ...node, position: snappedPosition } : node
      );

      onWorkflowChange({
        ...workflow,
        nodes: updatedNodes,
      });
    },
    [workflow, onWorkflowChange]
  );

  // Handle node deletion
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      // Remove the node and any connections to it
      const updatedNodes = workflow.nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => ({
          ...node,
          connections: node.connections.filter((id) => id !== nodeId),
        }));

      onWorkflowChange({
        ...workflow,
        nodes: updatedNodes,
      });

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [workflow, onWorkflowChange, selectedNodeId]
  );

  // Handle starting a connection
  const handleStartConnection = useCallback(
    (nodeId: string) => {
      setConnectingFrom(nodeId);

      // Find the node and calculate the starting position
      const node = workflow.nodes.find((n) => n.id === nodeId);
      if (node && canvasRef.current) {
        const fromPosition = {
          x: node.position.x + 180 + 12, // Right edge
          y: node.position.y + 40, // Center
        };
        setTemporaryConnection({
          fromPosition,
          toPosition: fromPosition,
        });
      }
    },
    [workflow.nodes]
  );

  // Handle mouse move for connection dragging
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!connectingFrom || !temporaryConnection || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      setTemporaryConnection({
        ...temporaryConnection,
        toPosition: {
          x: e.clientX - canvasRect.left,
          y: e.clientY - canvasRect.top,
        },
      });
    },
    [connectingFrom, temporaryConnection]
  );

  // Handle ending a connection
  const handleEndConnection = useCallback(
    (targetNodeId: string) => {
      if (!connectingFrom || connectingFrom === targetNodeId) {
        setConnectingFrom(null);
        setTemporaryConnection(null);
        return;
      }

      // Check if connection already exists
      const sourceNode = workflow.nodes.find((n) => n.id === connectingFrom);
      if (sourceNode?.connections.includes(targetNodeId)) {
        setConnectingFrom(null);
        setTemporaryConnection(null);
        return;
      }

      // Add the connection
      const updatedNodes = workflow.nodes.map((node) =>
        node.id === connectingFrom
          ? { ...node, connections: [...node.connections, targetNodeId] }
          : node
      );

      onWorkflowChange({
        ...workflow,
        nodes: updatedNodes,
      });

      setConnectingFrom(null);
      setTemporaryConnection(null);
    },
    [connectingFrom, workflow, onWorkflowChange]
  );

  // Cancel connection on canvas click
  const handleCanvasClick = useCallback(() => {
    if (connectingFrom) {
      setConnectingFrom(null);
      setTemporaryConnection(null);
    }
    setSelectedNodeId(null);
  }, [connectingFrom]);

  // Handle connection deletion
  const handleDeleteConnection = useCallback(
    (fromId: string, toId: string) => {
      const updatedNodes = workflow.nodes.map((node) =>
        node.id === fromId
          ? { ...node, connections: node.connections.filter((id) => id !== toId) }
          : node
      );

      onWorkflowChange({
        ...workflow,
        nodes: updatedNodes,
      });
    },
    [workflow, onWorkflowChange]
  );

  // Handle node configuration
  const handleConfigure = useCallback(
    (nodeId: string) => {
      if (onNodeConfigure) {
        onNodeConfigure(nodeId);
      }
    },
    [onNodeConfigure]
  );

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative overflow-hidden bg-gray-100',
        'bg-[radial-gradient(circle,#d1d5db_1px,transparent_1px)] bg-[length:20px_20px]',
        isDragOver && 'bg-blue-50',
        connectingFrom && 'cursor-crosshair',
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
    >
      {/* Connections Layer */}
      <ConnectionsLayer
        nodes={workflow.nodes}
        temporaryConnection={temporaryConnection}
        onDeleteConnection={handleDeleteConnection}
      />

      {/* Nodes */}
      {workflow.nodes.map((node) => (
        <ActionNode
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          onSelect={handleNodeSelect}
          onMove={handleNodeMove}
          onDelete={handleNodeDelete}
          onStartConnection={handleStartConnection}
          onEndConnection={handleEndConnection}
          onConfigure={handleConfigure}
          canvasRef={canvasRef}
        />
      ))}

      {/* Empty state */}
      {workflow.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-400">
              Drag actions here to build your workflow
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Connect nodes by clicking the output (right) and input (left) points
            </p>
          </div>
        </div>
      )}

      {/* Connecting indicator */}
      {connectingFrom && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-lg">
          Click on another node to connect, or click canvas to cancel
        </div>
      )}
    </div>
  );
}

export default WorkflowCanvas;
