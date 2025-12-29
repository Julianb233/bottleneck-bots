// Workflow Builder Types

export type NodeType = 'trigger' | 'action' | 'condition';

export type ActionType =
  | 'slack'
  | 'discord'
  | 'email'
  | 'http'
  | 'webhook'
  | 'delay'
  | 'filter'
  | 'transform';

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  actionType: ActionType;
  label: string;
  config: Record<string, unknown>;
  position: Position;
  connections: string[]; // IDs of connected nodes
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ActionDefinition {
  type: ActionType;
  label: string;
  icon: string;
  category: 'communication' | 'integration' | 'logic' | 'utility';
  color: string;
  defaultConfig: Record<string, unknown>;
}

export interface DragItem {
  type: 'action' | 'node';
  actionType?: ActionType;
  nodeId?: string;
}

export interface CanvasState {
  nodes: WorkflowNode[];
  selectedNodeId: string | null;
  connecting: {
    fromNodeId: string | null;
    toPosition: Position | null;
  };
  zoom: number;
  pan: Position;
}

// Action definitions for the palette
export const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    type: 'slack',
    label: 'Slack Message',
    icon: 'MessageSquare',
    category: 'communication',
    color: '#4A154B',
    defaultConfig: { channel: '', message: '' },
  },
  {
    type: 'discord',
    label: 'Discord Message',
    icon: 'MessageCircle',
    category: 'communication',
    color: '#5865F2',
    defaultConfig: { channelId: '', content: '' },
  },
  {
    type: 'email',
    label: 'Send Email',
    icon: 'Mail',
    category: 'communication',
    color: '#EA4335',
    defaultConfig: { to: '', subject: '', body: '' },
  },
  {
    type: 'http',
    label: 'HTTP Request',
    icon: 'Globe',
    category: 'integration',
    color: '#10B981',
    defaultConfig: { url: '', method: 'GET', headers: {}, body: '' },
  },
  {
    type: 'webhook',
    label: 'Webhook Trigger',
    icon: 'Webhook',
    category: 'integration',
    color: '#F59E0B',
    defaultConfig: { endpoint: '' },
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: 'Clock',
    category: 'utility',
    color: '#6366F1',
    defaultConfig: { duration: 1000, unit: 'ms' },
  },
  {
    type: 'filter',
    label: 'Filter',
    icon: 'Filter',
    category: 'logic',
    color: '#8B5CF6',
    defaultConfig: { condition: '', field: '' },
  },
  {
    type: 'transform',
    label: 'Transform Data',
    icon: 'RefreshCw',
    category: 'logic',
    color: '#EC4899',
    defaultConfig: { mapping: {} },
  },
];

// Helper to generate unique IDs
export const generateId = (): string => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to get action definition by type
export const getActionDefinition = (actionType: ActionType): ActionDefinition | undefined => {
  return ACTION_DEFINITIONS.find(def => def.type === actionType);
};
