'use client';

import React, { useState, useCallback } from 'react';
import { Save, Download, Upload, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WorkflowCanvas } from './WorkflowCanvas';
import { ActionPalette } from './ActionPalette';
import { useWorkflow } from './useWorkflow';
import { Workflow, ActionType } from './types';

interface WorkflowBuilderProps {
  initialWorkflow?: Workflow;
  onSave?: (workflow: Workflow) => Promise<void>;
  className?: string;
}

export function WorkflowBuilder({
  initialWorkflow,
  onSave,
  className,
}: WorkflowBuilderProps) {
  const {
    workflow,
    setWorkflow,
    clearWorkflow,
    saveWorkflow,
    isSaving,
    exportWorkflowJSON,
    importWorkflowJSON,
  } = useWorkflow({ initialWorkflow, onSave });

  const [isDragging, setIsDragging] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(workflow.name);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleExport = useCallback(() => {
    const json = exportWorkflowJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportWorkflowJSON, workflow.name]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const success = importWorkflowJSON(text);
      if (!success) {
        alert('Failed to import workflow. Please check the file format.');
      }
    };
    input.click();
  }, [importWorkflowJSON]);

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim()) {
      setWorkflow((prev) => ({
        ...prev,
        name: editedName.trim(),
        updatedAt: new Date().toISOString(),
      }));
    }
    setIsEditingName(false);
  }, [editedName, setWorkflow]);

  const handleClear = useCallback(() => {
    if (workflow.nodes.length === 0) return;
    if (confirm('Are you sure you want to clear all nodes?')) {
      clearWorkflow();
    }
  }, [workflow.nodes.length, clearWorkflow]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        {/* Workflow Name */}
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setEditedName(workflow.name);
                  setIsEditingName(false);
                }
              }}
              className="rounded border border-blue-500 px-2 py-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setEditedName(workflow.name);
                setIsEditingName(true);
              }}
              className="flex items-center gap-2 rounded px-2 py-1 text-lg font-semibold hover:bg-gray-100"
            >
              {workflow.name}
              <Edit2 className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <span className="text-sm text-gray-500">
            {workflow.nodes.length} node{workflow.nodes.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={workflow.nodes.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
          {onSave && (
            <Button
              size="sm"
              onClick={saveWorkflow}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Action Palette */}
        <ActionPalette
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className="w-64 flex-shrink-0"
        />

        {/* Canvas */}
        <WorkflowCanvas
          workflow={workflow}
          onWorkflowChange={setWorkflow}
          className="flex-1"
        />
      </div>
    </div>
  );
}

export default WorkflowBuilder;
