'use client';

import React from 'react';
import { Position } from './types';

interface ConnectionLineProps {
  fromPosition: Position;
  toPosition: Position;
  isActive?: boolean;
  isTemporary?: boolean;
  onDelete?: () => void;
}

export function ConnectionLine({
  fromPosition,
  toPosition,
  isActive = false,
  isTemporary = false,
  onDelete,
}: ConnectionLineProps) {
  // Calculate control points for a smooth bezier curve
  const dx = toPosition.x - fromPosition.x;
  const dy = toPosition.y - fromPosition.y;

  // The curve should bow outward horizontally
  const curvature = Math.min(Math.abs(dx) * 0.5, 100);

  const controlPoint1 = {
    x: fromPosition.x + curvature,
    y: fromPosition.y,
  };

  const controlPoint2 = {
    x: toPosition.x - curvature,
    y: toPosition.y,
  };

  const pathD = `
    M ${fromPosition.x} ${fromPosition.y}
    C ${controlPoint1.x} ${controlPoint1.y},
      ${controlPoint2.x} ${controlPoint2.y},
      ${toPosition.x} ${toPosition.y}
  `;

  // Calculate midpoint for delete button
  const midX = (fromPosition.x + toPosition.x) / 2;
  const midY = (fromPosition.y + toPosition.y) / 2;

  return (
    <g className="connection-line group">
      {/* Invisible wider path for easier interaction */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={onDelete}
      />

      {/* Visible connection line */}
      <path
        d={pathD}
        fill="none"
        stroke={isTemporary ? '#94A3B8' : isActive ? '#3B82F6' : '#64748B'}
        strokeWidth={isActive ? 3 : 2}
        strokeDasharray={isTemporary ? '5,5' : undefined}
        className={`transition-all ${isTemporary ? 'opacity-60' : 'opacity-100'}`}
        style={{
          filter: isActive ? 'drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))' : undefined,
        }}
      />

      {/* Arrow head at the end */}
      {!isTemporary && (
        <polygon
          points={`
            ${toPosition.x - 8},${toPosition.y - 4}
            ${toPosition.x},${toPosition.y}
            ${toPosition.x - 8},${toPosition.y + 4}
          `}
          fill={isActive ? '#3B82F6' : '#64748B'}
          className="transition-colors"
        />
      )}

      {/* Delete button (appears on hover) */}
      {onDelete && !isTemporary && (
        <g
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle
            cx={midX}
            cy={midY}
            r={10}
            fill="white"
            stroke="#EF4444"
            strokeWidth={2}
          />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#EF4444"
            fontSize={14}
            fontWeight="bold"
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
}

// Helper component for rendering all connections
interface ConnectionsLayerProps {
  nodes: { id: string; position: Position; connections: string[] }[];
  activeConnectionId?: string;
  temporaryConnection?: {
    fromPosition: Position;
    toPosition: Position;
  } | null;
  onDeleteConnection: (fromId: string, toId: string) => void;
}

export function ConnectionsLayer({
  nodes,
  activeConnectionId,
  temporaryConnection,
  onDeleteConnection,
}: ConnectionsLayerProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Calculate connection positions (offset for node size)
  const getConnectionPositions = (fromId: string, toId: string) => {
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);

    if (!fromNode || !toNode) return null;

    // Approximate node dimensions
    const nodeWidth = 180;
    const nodeHeight = 80;

    return {
      from: {
        x: fromNode.position.x + nodeWidth + 12, // Right edge + connection point offset
        y: fromNode.position.y + nodeHeight / 2,
      },
      to: {
        x: toNode.position.x - 12, // Left edge - connection point offset
        y: toNode.position.y + nodeHeight / 2,
      },
    };
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 5 }}
    >
      {/* Render all existing connections */}
      {nodes.flatMap((node) =>
        node.connections.map((targetId) => {
          const positions = getConnectionPositions(node.id, targetId);
          if (!positions) return null;

          const connectionKey = `${node.id}-${targetId}`;
          const isActive = activeConnectionId === connectionKey;

          return (
            <ConnectionLine
              key={connectionKey}
              fromPosition={positions.from}
              toPosition={positions.to}
              isActive={isActive}
              onDelete={() => onDeleteConnection(node.id, targetId)}
            />
          );
        })
      )}

      {/* Render temporary connection line while dragging */}
      {temporaryConnection && (
        <ConnectionLine
          fromPosition={temporaryConnection.fromPosition}
          toPosition={temporaryConnection.toPosition}
          isTemporary
        />
      )}
    </svg>
  );
}

export default ConnectionLine;
