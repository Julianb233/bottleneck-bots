'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  MessageCircle,
  Mail,
  Globe,
  Webhook,
  Clock,
  Filter,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACTION_DEFINITIONS, ActionDefinition, ActionType } from './types';

// Icon mapping
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

interface ActionPaletteProps {
  onDragStart: (actionType: ActionType) => void;
  onDragEnd: () => void;
  className?: string;
}

interface CategoryGroup {
  name: string;
  label: string;
  actions: ActionDefinition[];
}

export function ActionPalette({ onDragStart, onDragEnd, className }: ActionPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['communication', 'integration', 'logic', 'utility'])
  );

  // Group actions by category
  const categories: CategoryGroup[] = [
    {
      name: 'communication',
      label: 'Communication',
      actions: ACTION_DEFINITIONS.filter((a) => a.category === 'communication'),
    },
    {
      name: 'integration',
      label: 'Integrations',
      actions: ACTION_DEFINITIONS.filter((a) => a.category === 'integration'),
    },
    {
      name: 'logic',
      label: 'Logic',
      actions: ACTION_DEFINITIONS.filter((a) => a.category === 'logic'),
    },
    {
      name: 'utility',
      label: 'Utilities',
      actions: ACTION_DEFINITIONS.filter((a) => a.category === 'utility'),
    },
  ];

  // Filter actions based on search
  const filteredCategories = categories
    .map((category) => ({
      ...category,
      actions: category.actions.filter((action) =>
        action.label.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.actions.length > 0);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col bg-gray-50 border-r border-gray-200', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
        <p className="text-xs text-gray-500 mt-1">Drag actions to the canvas</p>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Action Categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map((category) => (
          <div key={category.name} className="mb-2">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {expandedCategories.has(category.name) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {category.label}
              <span className="ml-auto text-xs text-gray-400">
                {category.actions.length}
              </span>
            </button>

            {/* Category Actions */}
            {expandedCategories.has(category.name) && (
              <div className="ml-2 mt-1 space-y-1">
                {category.actions.map((action) => (
                  <ActionPaletteItem
                    key={action.type}
                    action={action}
                    onDragStart={() => onDragStart(action.type)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            No actions found
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionPaletteItemProps {
  action: ActionDefinition;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function ActionPaletteItem({ action, onDragStart, onDragEnd }: ActionPaletteItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const IconComponent = iconMap[action.icon] || MessageSquare;

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('actionType', action.type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'flex cursor-grab items-center gap-3 rounded-md border border-transparent px-3 py-2 transition-all',
        'hover:border-gray-200 hover:bg-white hover:shadow-sm',
        'active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: action.color }}
      >
        <IconComponent className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {action.label}
        </div>
      </div>
    </div>
  );
}

export default ActionPalette;
