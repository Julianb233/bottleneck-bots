'use client';

import { useState, useCallback } from 'react';
import { Workflow, WorkflowNode, generateId } from './types';

interface UseWorkflowOptions {
  initialWorkflow?: Workflow;
  onSave?: (workflow: Workflow) => Promise<void>;
}

interface UseWorkflowReturn {
  workflow: Workflow;
  setWorkflow: React.Dispatch<React.SetStateAction<Workflow>>;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  removeNode: (nodeId: string) => void;
  addConnection: (fromId: string, toId: string) => void;
  removeConnection: (fromId: string, toId: string) => void;
  clearWorkflow: () => void;
  saveWorkflow: () => Promise<void>;
  isSaving: boolean;
  exportWorkflowJSON: () => string;
  importWorkflowJSON: (json: string) => boolean;
}

const createEmptyWorkflow = (): Workflow => ({
  id: generateId(),
  name: 'Untitled Workflow',
  nodes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowReturn {
  const { initialWorkflow, onSave } = options;
  const [workflow, setWorkflow] = useState<Workflow>(
    initialWorkflow || createEmptyWorkflow()
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: prev.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    }));
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: prev.nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => ({
          ...node,
          connections: node.connections.filter((id) => id !== nodeId),
        })),
    }));
  }, []);

  const addConnection = useCallback((fromId: string, toId: string) => {
    setWorkflow((prev) => {
      const fromNode = prev.nodes.find((n) => n.id === fromId);
      if (!fromNode || fromNode.connections.includes(toId)) {
        return prev;
      }

      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        nodes: prev.nodes.map((node) =>
          node.id === fromId
            ? { ...node, connections: [...node.connections, toId] }
            : node
        ),
      };
    });
  }, []);

  const removeConnection = useCallback((fromId: string, toId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      nodes: prev.nodes.map((node) =>
        node.id === fromId
          ? { ...node, connections: node.connections.filter((id) => id !== toId) }
          : node
      ),
    }));
  }, []);

  const clearWorkflow = useCallback(() => {
    setWorkflow(createEmptyWorkflow());
  }, []);

  const saveWorkflow = useCallback(async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(workflow);
    } finally {
      setIsSaving(false);
    }
  }, [workflow, onSave]);

  const exportWorkflowJSON = useCallback(() => {
    return JSON.stringify(workflow, null, 2);
  }, [workflow]);

  const importWorkflowJSON = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Workflow;

      // Basic validation
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.nodes)) {
        console.error('Invalid workflow format');
        return false;
      }

      // Validate each node
      for (const node of parsed.nodes) {
        if (!node.id || !node.type || !node.actionType || !node.position) {
          console.error('Invalid node format:', node);
          return false;
        }
      }

      setWorkflow({
        ...parsed,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Failed to parse workflow JSON:', error);
      return false;
    }
  }, []);

  return {
    workflow,
    setWorkflow,
    updateNode,
    removeNode,
    addConnection,
    removeConnection,
    clearWorkflow,
    saveWorkflow,
    isSaving,
    exportWorkflowJSON,
    importWorkflowJSON,
  };
}

export default useWorkflow;
