'use client';

import React, { useCallback, useState, useRef } from 'react';
import {
  MessageSquare,
  MessageCircle,
  Mail,
  Globe,
  Webhook,
  Clock,
  Filter,
  RefreshCw,
  GripVertical,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowNode, ActionType, getActionDefinition, Position } from './types';

// Icon mapping for action types
const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  MessageCircle,
  Mail,
  Globe,
  Webhook,
  Clock,
  Filter,
  RefreshCw,
};

interface ActionNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onMove: (nodeId: string, position: Position) => void;
  onDelete: (nodeId: string) => void;
  onStartConnection: (nodeId: string) => void;
  onEndConnection: (nodeId: string) => void;
  onConfigure: (nodeId: string) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function ActionNode({
  node,
  isSelected,
  onSelect,
  onMove,
  onDelete,
  onStartConnection,
  onEndConnection,
  onConfigure,
  canvasRef,
}: ActionNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  const definition = getActionDefinition(node.actionType);
  const IconComponent = definition ? iconMap[definition.icon] || MessageSquare : MessageSquare;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action-button]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onSelect(node.id);

      if (nodeRef.current) {
        const rect = nodeRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
      setIsDragging(true);
    },
    [node.id, onSelect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - canvasRect.left - dragOffset.x;
      const newY = e.clientY - canvasRect.top - dragOffset.y;

      // Constrain to canvas bounds
      const constrainedX = Math.max(0, Math.min(newX, canvasRect.width - 200));
      const constrainedY = Math.max(0, Math.min(newY, canvasRect.height - 80));

      onMove(node.id, { x: constrainedX, y: constrainedY });
    },
    [isDragging, canvasRef, dragOffset, node.id, onMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleConnectionOutput = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartConnection(node.id);
  };

  const handleConnectionInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEndConnection(node.id);
  };

  return (
    <div
      ref={nodeRef}
      className={cn(
        'absolute flex flex-col rounded-lg border-2 bg-white shadow-lg transition-shadow',
        'min-w-[180px] cursor-grab select-none',
        isSelected ? 'border-blue-500 shadow-blue-200' : 'border-gray-200',
        isDragging && 'cursor-grabbing shadow-xl'
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        zIndex: isSelected || isDragging ? 100 : 10,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Input connection point */}
      <div
        className="absolute -left-3 top-1/2 h-5 w-5 -translate-y-1/2 cursor-pointer rounded-full border-2 border-gray-300 bg-white transition-colors hover:border-blue-500 hover:bg-blue-50"
        onClick={handleConnectionInput}
        title="Connect input"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-md px-3 py-2"
        style={{ backgroundColor: definition?.color || '#6B7280' }}
      >
        <GripVertical className="h-4 w-4 text-white/70" />
        <IconComponent className="h-4 w-4 text-white" />
        <span className="flex-1 text-sm font-medium text-white">
          {node.label || definition?.label || 'Action'}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-3">
        <div className="text-xs text-gray-500">
          Type: {node.type}
        </div>
        <div className="text-xs text-gray-400 truncate max-w-[160px]">
          {Object.keys(node.config).length > 0
            ? `Config: ${Object.keys(node.config).join(', ')}`
            : 'No configuration'}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-1 mt-1">
          <button
            data-action-button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure(node.id);
            }}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Configure"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            data-action-button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Output connection point */}
      <div
        className="absolute -right-3 top-1/2 h-5 w-5 -translate-y-1/2 cursor-pointer rounded-full border-2 border-gray-300 bg-white transition-colors hover:border-green-500 hover:bg-green-50"
        onClick={handleConnectionOutput}
        title="Connect output"
      />
    </div>
  );
}

export default ActionNode;
