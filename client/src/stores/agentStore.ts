/**
 * Agent Store
 *
 * Zustand store for managing agent state across the application.
 * Integrates with tRPC API for real-time agent execution.
 */

import { create } from 'zustand';
import type { AgentPlan, ThinkingStep, AgentExecutionListItem } from '@/types/agent';
import type { BrowserAction } from '@/components/agent/EnhancedBrowserLiveView';

// ========================================
// TYPES
// ========================================

export interface ToolHistoryEntry {
  timestamp: Date;
  toolName: string;
  parameters: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  duration?: number;
}

// Agent status type used across the application
export type AgentStatus = 'idle' | 'planning' | 'executing' | 'completed' | 'error' | 'paused';

export interface CurrentExecution {
  id: number;
  status: 'started' | 'running' | 'planning' | 'executing' | 'success' | 'completed' | 'failed' | 'timeout' | 'cancelled' | 'needs_input' | 'paused';
  plan: AgentPlan | null;
  thinkingSteps: ThinkingStep[];
  toolHistory: ToolHistoryEntry[];
  output: unknown;
  error?: string;
  iterations: number;
  duration?: number;
  taskDescription?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'system';
  message: string;
  detail?: string;
}

export interface BrowserSession {
  sessionId: string;
  debugUrl?: string;
  liveViewUrl?: string;
}

export interface ProgressData {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  currentAction: string;
}

export interface ReasoningStep {
  step: number;
  thought: string;
  evidence: string[];
  hypothesis: string;
  decision: string;
  alternatives: string[];
  confidence: number;
  timestamp?: string;
}

interface AgentState {
  // Execution state
  currentExecution: CurrentExecution | null;
  isExecuting: boolean;

  // Browser session tracking
  activeBrowserSession: BrowserSession | null;

  // Browser action tracking (for live preview overlay)
  currentBrowserAction: BrowserAction | null;
  browserActions: BrowserAction[];

  // Progress tracking
  progress: ProgressData | null;

  // Reasoning steps
  reasoningSteps: ReasoningStep[];

  // History
  executionHistory: AgentExecutionListItem[];
  isLoadingHistory: boolean;

  // Thinking steps for display
  thinkingSteps: ThinkingStep[];

  // Logs (for debugging/monitoring)
  logs: LogEntry[];

  // Swarm/multi-agent
  connectedAgents: number;

  // Stats
  stats: {
    total: number;
    byStatus: Record<string, number>;
    averageDuration: number;
    successRate: number;
  } | null;

  // Actions
  startExecution: (taskDescription: string, context?: Record<string, unknown>) => Promise<void>;
  loadExecution: (executionId: string) => Promise<void>;
  loadExecutionHistory: () => Promise<void>;
  loadStats: () => Promise<void>;
  cancelExecution: () => Promise<void>;
  respondToAgent: (response: string) => Promise<void>;
  clearCurrentExecution: () => void;
  setStatus: (status: CurrentExecution['status']) => void;

  // Browser session management
  setActiveBrowserSession: (session: BrowserSession | null) => void;
  fetchActiveBrowserSession: () => Promise<void>;

  // Thinking step management
  addThinkingStep: (step: ThinkingStep) => void;

  // Log management
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // Swarm management
  setConnectedAgents: (count: number) => void;

  // Reset
  reset: () => void;

  // SSE event handlers
  handleSSEEvent: (event: { type: string; data: unknown }) => void;
}

const initialState = {
  currentExecution: null,
  isExecuting: false,
  activeBrowserSession: null,
  currentBrowserAction: null,
  browserActions: [],
  progress: null,
  reasoningSteps: [],
  executionHistory: [],
  isLoadingHistory: false,
  thinkingSteps: [],
  logs: [],
  connectedAgents: 0,
  stats: null,
};

/** Infer browser action type from tool name */
function inferBrowserActionType(toolName: string): BrowserAction['type'] {
  if (toolName.includes('click')) return 'click';
  if (toolName.includes('type') || toolName.includes('fill')) return 'type';
  if (toolName.includes('navigate') || toolName.includes('goto')) return 'navigate';
  if (toolName.includes('scroll')) return 'scroll';
  if (toolName.includes('extract')) return 'extract';
  if (toolName.includes('wait')) return 'wait';
  if (toolName.includes('screenshot')) return 'screenshot';
  return 'custom';
}

/** Format browser action description from tool name and params */
function formatBrowserActionDescription(toolName: string, params: any): string {
  if (params?.text) return `Type: "${params.text.substring(0, 50)}"`;
  if (params?.url) return `Navigate to ${params.url}`;
  if (params?.selector) return `${toolName} on ${params.selector}`;
  return toolName.replace(/_/g, ' ');
}

// ========================================
// STORE
// ========================================

export const useAgentStore = create<AgentState>((set, get) => ({
  ...initialState,

  /**
   * Start a new agent task execution
   */
  startExecution: async (taskDescription: string, context?: Record<string, unknown>) => {
    set({ isExecuting: true, thinkingSteps: [], logs: [] });

    // Add initial log
    get().addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Starting agent execution...',
      detail: taskDescription.substring(0, 100),
    });

    try {
      // Import trpc client dynamically to avoid circular deps
      const { trpcClient } = await import('@/lib/trpc');

      const result = await trpcClient.agent.executeTask.mutate({
        taskDescription,
        context: context || {},
        maxIterations: 50,
      });

      set({
        currentExecution: {
          id: result.executionId,
          status: result.status as CurrentExecution['status'],
          plan: result.plan as AgentPlan | null,
          thinkingSteps: (result.thinkingSteps || []) as unknown as ThinkingStep[],
          toolHistory: result.toolHistory || [],
          output: result.output,
          error: undefined,
          iterations: result.iterations || 0,
          duration: result.duration,
          taskDescription,
        },
        thinkingSteps: (result.thinkingSteps || []) as unknown as ThinkingStep[],
        isExecuting: ['running', 'started', 'planning', 'executing'].includes(result.status),
      });

      get().addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: ['completed', 'success'].includes(result.status) ? 'success' : 'info',
        message: `Execution ${result.status}`,
        detail: `ID: ${result.executionId}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      set({ isExecuting: false });

      get().addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Execution failed',
        detail: errorMessage,
      });

      throw error;
    }
  },

  /**
   * Load a specific execution by ID
   */
  loadExecution: async (executionId: string) => {
    try {
      const { trpcClient } = await import('@/lib/trpc');

      const result = await trpcClient.agent.getExecution.query({
        executionId: parseInt(executionId, 10),
      });

      set({
        currentExecution: {
          id: result.id,
          status: result.status as CurrentExecution['status'],
          plan: result.plan as AgentPlan | null,
          thinkingSteps: (result.thinkingSteps || []) as ThinkingStep[],
          toolHistory: (result.toolHistory || []) as ToolHistoryEntry[],
          output: result.output,
          error: result.error || undefined,
          iterations: 0, // Not stored in this endpoint
          duration: result.duration || undefined,
        },
        thinkingSteps: (result.thinkingSteps || []) as ThinkingStep[],
        isExecuting: ['running', 'started'].includes(result.status),
      });
    } catch (error) {
      console.error('Failed to load execution:', error);
      throw error;
    }
  },

  /**
   * Load execution history
   */
  loadExecutionHistory: async () => {
    set({ isLoadingHistory: true });

    try {
      const { trpcClient } = await import('@/lib/trpc');

      const executions = await trpcClient.agent.listExecutions.query({
        limit: 50,
        offset: 0,
      });

      set({
        executionHistory: executions as unknown as AgentExecutionListItem[],
        isLoadingHistory: false,
      });
    } catch (error) {
      console.error('Failed to load execution history:', error);
      set({ isLoadingHistory: false });
      throw error;
    }
  },

  /**
   * Load agent stats
   */
  loadStats: async () => {
    try {
      const { trpcClient } = await import('@/lib/trpc');

      const stats = await trpcClient.agent.getStats.query();

      set({ stats });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  /**
   * Cancel the current execution
   */
  cancelExecution: async () => {
    const { currentExecution } = get();

    if (!currentExecution) {
      throw new Error('No active execution to cancel');
    }

    try {
      const { trpcClient } = await import('@/lib/trpc');

      await trpcClient.agent.cancelExecution.mutate({
        executionId: currentExecution.id,
        reason: 'Cancelled by user',
      });

      set({
        isExecuting: false,
        currentExecution: {
          ...currentExecution,
          status: 'cancelled',
        },
      });

      get().addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'warning',
        message: 'Execution cancelled',
        detail: `ID: ${currentExecution.id}`,
      });
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      throw error;
    }
  },

  /**
   * Respond to agent when it asks for input
   */
  respondToAgent: async (response: string) => {
    const { currentExecution } = get();

    if (!currentExecution) {
      throw new Error('No active execution');
    }

    if (currentExecution.status !== 'needs_input') {
      throw new Error('Execution is not waiting for input');
    }

    try {
      const { trpcClient } = await import('@/lib/trpc');

      await trpcClient.agent.respondToAgent.mutate({
        executionId: currentExecution.id,
        response,
      });

      set({ isExecuting: true });
    } catch (error) {
      console.error('Failed to respond to agent:', error);
      throw error;
    }
  },

  /**
   * Clear current execution
   */
  clearCurrentExecution: () => {
    set({
      currentExecution: null,
      thinkingSteps: [],
      isExecuting: false,
      activeBrowserSession: null,
    });
  },

  /**
   * Set the status of the current execution
   */
  setStatus: (status: CurrentExecution['status']) => {
    const { currentExecution } = get();

    if (currentExecution) {
      set({
        currentExecution: {
          ...currentExecution,
          status,
        },
        isExecuting: status === 'executing' || status === 'planning' || status === 'running' || status === 'started',
      });

      get().addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Status changed to: ${status}`,
      });
    }
  },

  /**
   * Set active browser session
   */
  setActiveBrowserSession: (session: BrowserSession | null) => {
    set({ activeBrowserSession: session });

    if (session) {
      get().addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Browser session detected',
        detail: session.sessionId,
      });
    }
  },

  /**
   * Fetch active browser session from API
   */
  fetchActiveBrowserSession: async () => {
    try {
      const { trpcClient } = await import('@/lib/trpc');

      const sessions = await trpcClient.browser.listSessions.query({ limit: 10 });

      // Find the most recent running session
      const activeSession = sessions.find((s: any) => s.status === 'running');

      if (activeSession) {
        set({
          activeBrowserSession: {
            sessionId: activeSession.sessionId,
            debugUrl: activeSession.debugUrl || undefined,
            liveViewUrl: (activeSession as any).liveViewUrl,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch browser session:', error);
    }
  },

  /**
   * Add a thinking step
   */
  addThinkingStep: (step: ThinkingStep) => {
    set((state) => ({
      thinkingSteps: [...state.thinkingSteps, step],
    }));
  },

  /**
   * Add a log entry
   */
  addLog: (log: LogEntry) => {
    set((state) => ({
      logs: [...state.logs, log].slice(-100), // Keep last 100 logs
    }));
  },

  /**
   * Clear all logs
   */
  clearLogs: () => set({ logs: [] }),

  /**
   * Set connected agent count (for swarm)
   */
  setConnectedAgents: (count: number) => set({ connectedAgents: count }),

  /**
   * Reset store to initial state
   */
  reset: () => set(initialState),

  /**
   * Handle SSE events from agent execution
   */
  handleSSEEvent: (event: { type: string; data: unknown }) => {
    const state = get();
    const data = event.data as Record<string, unknown>;

    switch (event.type) {
      case 'execution:started':
        set({
          isExecuting: true,
          currentExecution: {
            ...(state.currentExecution || {} as CurrentExecution),
            status: 'running',
          },
        });
        break;

      case 'plan:created':
        if (state.currentExecution) {
          set({
            currentExecution: {
              ...state.currentExecution,
              plan: data.plan as AgentPlan,
            },
          });
        }
        break;

      case 'phase:start':
        get().addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Phase started: ${data.phaseName}`,
        });
        break;

      case 'thinking':
        const thinkingStep: ThinkingStep = {
          id: `step-${Date.now()}`,
          type: 'thinking',
          content: data.thought as string || data.content as string,
          timestamp: new Date(),
        };
        get().addThinkingStep(thinkingStep);
        break;

      case 'tool:start': {
        const toolStartStep: ThinkingStep = {
          id: `step-${Date.now()}`,
          type: 'tool_use',
          content: `Using tool: ${data.toolName}`,
          timestamp: new Date(),
          toolName: data.toolName as string,
          toolParams: data.params,
        };
        get().addThinkingStep(toolStartStep);

        // Track browser action for live preview overlay
        const toolName = data.toolName as string;
        if (toolName.startsWith('browser_') || toolName.includes('navigate') || toolName.includes('click') || toolName.includes('type') || toolName.includes('extract') || toolName.includes('screenshot') || toolName.includes('scroll')) {
          const action: BrowserAction = {
            id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: inferBrowserActionType(toolName),
            description: formatBrowserActionDescription(toolName, data.params),
            selector: (data.params as any)?.selector,
            value: (data.params as any)?.text || (data.params as any)?.url,
            timestamp: Date.now(),
            status: 'executing',
          };
          set((s) => ({
            currentBrowserAction: action,
            browserActions: [...s.browserActions, action],
          }));
        }
        break;
      }

      case 'tool:complete': {
        const toolCompleteStep: ThinkingStep = {
          id: `step-${Date.now()}`,
          type: 'tool_result',
          content: `Tool completed: ${data.toolName}`,
          timestamp: new Date(),
          toolName: data.toolName as string,
          toolResult: data.result,
        };
        get().addThinkingStep(toolCompleteStep);

        // Update browser action status
        set((s) => {
          if (!s.currentBrowserAction) return {};
          const updatedActions = s.browserActions.map((a) =>
            a.id === s.currentBrowserAction?.id
              ? { ...a, status: ((data.result as any)?.error ? 'failed' : 'completed') as BrowserAction['status'], duration: data.duration as number }
              : a
          );
          return {
            currentBrowserAction: null,
            browserActions: updatedActions,
          };
        });

        // Check if this is a browser session creation
        if (data.toolName === 'browser_create_session' && data.result) {
          const result = data.result as { success?: boolean; sessionId?: string };
          if (result.success && result.sessionId) {
            get().fetchActiveBrowserSession();
          }
        }
        break;
      }

      case 'phase:complete':
        get().addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `Phase completed: ${data.phaseName}`,
        });
        break;

      case 'execution:complete':
        set({
          isExecuting: false,
          activeBrowserSession: null,
          currentBrowserAction: null,
          currentExecution: state.currentExecution ? {
            ...state.currentExecution,
            status: 'completed',
            output: data.result,
            duration: data.duration as number,
          } : null,
        });
        get().addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'success',
          message: 'Execution completed',
        });
        break;

      case 'execution:error':
        set({
          isExecuting: false,
          activeBrowserSession: null,
          currentBrowserAction: null,
          progress: null,
          currentExecution: state.currentExecution ? {
            ...state.currentExecution,
            status: 'failed',
            error: data.error as string,
          } : null,
        });

        // Handle explained errors with all details
        const errorData = data as any;
        const errorMessage = errorData.title || errorData.error || 'Execution failed';
        const errorDetail = errorData.explanation || errorData.error;

        get().addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: errorMessage,
          detail: errorDetail,
        });
        break;

      case 'progress':
        set({
          progress: data as unknown as ProgressData,
        });
        break;

      case 'reasoning':
        set((state) => ({
          reasoningSteps: [...state.reasoningSteps, data as unknown as ReasoningStep],
        }));

        get().addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Decision: ${(data as unknown as ReasoningStep).decision}`,
          detail: `Confidence: ${Math.round((data as unknown as ReasoningStep).confidence * 100)}%`,
        });
        break;

      case 'browser:session':
        const sessionData = data as { sessionId: string; debugUrl?: string };
        set({
          activeBrowserSession: {
            sessionId: sessionData.sessionId,
            debugUrl: sessionData.debugUrl,
          },
        });

        get().addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'success',
          message: 'Browser session created',
          detail: sessionData.debugUrl ? 'Live view available' : sessionData.sessionId,
        });
        break;
    }
  },
}));
