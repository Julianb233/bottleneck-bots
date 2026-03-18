/**
 * useExecutionStream Hook
 *
 * Enhanced SSE hook specifically for the Agent Execution Panel with Live Browser Preview.
 * Provides structured execution state including:
 * - Browser session info (debug URL, live view URL, screenshots)
 * - Action log with typed entries
 * - LLM reasoning/thinking steps
 * - Progress tracking with ETA
 * - Execution control state (running, paused, cancelled)
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// ========================================
// TYPES
// ========================================

export type ExecutionStatus =
  | 'connecting'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'idle';

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  type: 'navigate' | 'click' | 'type' | 'extract' | 'screenshot' | 'tool' | 'system' | 'error';
  action: string;
  target?: string;
  value?: string;
  description: string;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ThinkingStep {
  id: string;
  timestamp: string;
  thought: string;
  phase?: string;
  evidence?: string[];
  hypothesis?: string;
  decision?: string;
  alternatives?: string[];
  confidence?: number;
  toolUsed?: string;
}

export interface BrowserState {
  sessionId?: string;
  debugUrl?: string;
  liveViewUrl?: string;
  currentUrl?: string;
  pageTitle?: string;
  latestScreenshot?: string;
  screenshots: Array<{
    id: string;
    url?: string;
    base64?: string;
    timestamp: string;
    pageTitle?: string;
  }>;
}

export interface ProgressState {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  currentAction: string;
  currentPhase?: string;
  confidence?: number;
}

export interface ExecutionStreamState {
  status: ExecutionStatus;
  isConnected: boolean;
  error: string | null;
  browser: BrowserState;
  actionLog: ActionLogEntry[];
  thinkingSteps: ThinkingStep[];
  progress: ProgressState;
  plan: any | null;
  result: any | null;
  startedAt: string | null;
  duration: number;
}

interface UseExecutionStreamOptions {
  executionId: string | number | null;
  autoConnect?: boolean;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

// ========================================
// HOOK
// ========================================

export function useExecutionStream(options: UseExecutionStreamOptions): ExecutionStreamState & {
  connect: () => void;
  disconnect: () => void;
} {
  const { executionId, autoConnect = true, onComplete, onError } = options;

  const [state, setState] = useState<ExecutionStreamState>({
    status: 'idle',
    isConnected: false,
    error: null,
    browser: { screenshots: [] },
    actionLog: [],
    thinkingSteps: [],
    progress: {
      currentStep: 0,
      totalSteps: 0,
      percentComplete: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      currentAction: 'Waiting to start...',
    },
    plan: null,
    result: null,
    startedAt: null,
    duration: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const addActionLog = useCallback((entry: Omit<ActionLogEntry, 'id'>) => {
    setState(prev => ({
      ...prev,
      actionLog: [...prev.actionLog, { ...entry, id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
    }));
  }, []);

  const addThinking = useCallback((step: Omit<ThinkingStep, 'id'>) => {
    setState(prev => ({
      ...prev,
      thinkingSteps: [...prev.thinkingSteps, { ...step, id: `think-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
    }));
  }, []);

  const handleEvent = useCallback((eventType: string, data: any) => {
    const timestamp = data?.timestamp || new Date().toISOString();

    switch (eventType) {
      case 'connected':
        setState(prev => ({
          ...prev,
          status: 'running',
          isConnected: true,
          error: null,
          startedAt: prev.startedAt || timestamp,
        }));
        startTimeRef.current = Date.now();
        break;

      case 'execution:started':
        setState(prev => ({
          ...prev,
          status: 'running',
          startedAt: data?.startedAt || timestamp,
        }));
        addActionLog({
          timestamp,
          type: 'system',
          action: 'execution_started',
          description: `Task started: ${data?.task || 'Agent task'}`,
          status: 'completed',
        });
        break;

      case 'plan:created':
        setState(prev => ({ ...prev, plan: data?.plan }));
        addActionLog({
          timestamp,
          type: 'system',
          action: 'plan_created',
          description: `Plan created: ${data?.plan?.goal || 'Task plan'}`,
          status: 'completed',
        });
        break;

      case 'phase:start':
        addActionLog({
          timestamp,
          type: 'system',
          action: 'phase_start',
          description: `Phase started: ${data?.phaseName || 'Unknown'}`,
          status: 'running',
        });
        break;

      case 'phase:complete':
        addActionLog({
          timestamp,
          type: 'system',
          action: 'phase_complete',
          description: `Phase completed: ${data?.phaseName || 'Unknown'}`,
          status: 'completed',
        });
        break;

      case 'thinking':
        addThinking({
          timestamp,
          thought: data?.thought || data?.content || '',
          phase: data?.phase,
        });
        break;

      case 'reasoning':
        addThinking({
          timestamp,
          thought: data?.thought || '',
          phase: data?.phase,
          evidence: data?.evidence,
          hypothesis: data?.hypothesis,
          decision: data?.decision,
          alternatives: data?.alternatives,
          confidence: data?.confidence,
        });
        break;

      case 'progress':
        setState(prev => ({
          ...prev,
          progress: {
            currentStep: data?.currentStep ?? prev.progress.currentStep,
            totalSteps: data?.totalSteps ?? prev.progress.totalSteps,
            percentComplete: data?.percentComplete ?? prev.progress.percentComplete,
            elapsedTime: data?.elapsedTime ?? prev.progress.elapsedTime,
            estimatedTimeRemaining: data?.estimatedTimeRemaining ?? prev.progress.estimatedTimeRemaining,
            currentAction: data?.currentAction ?? prev.progress.currentAction,
            currentPhase: data?.currentPhase ?? prev.progress.currentPhase,
            confidence: data?.confidence ?? prev.progress.confidence,
          },
        }));
        break;

      case 'browser:session':
        setState(prev => ({
          ...prev,
          browser: {
            ...prev.browser,
            sessionId: data?.sessionId,
            debugUrl: data?.debugUrl,
            liveViewUrl: data?.debugUrl, // debugUrl serves as liveViewUrl for BrowserBase
          },
        }));
        addActionLog({
          timestamp,
          type: 'system',
          action: 'browser_session',
          description: `Browser session created: ${data?.sessionId?.slice(0, 8) || 'unknown'}`,
          status: 'completed',
        });
        break;

      case 'browser:navigate':
        setState(prev => ({
          ...prev,
          browser: {
            ...prev.browser,
            currentUrl: data?.url,
            pageTitle: data?.pageTitle,
          },
        }));
        addActionLog({
          timestamp,
          type: 'navigate',
          action: 'navigate',
          target: data?.url,
          description: `Navigated to: ${data?.pageTitle || data?.url || 'unknown'}`,
          status: 'completed',
        });
        break;

      case 'browser:action':
        addActionLog({
          timestamp,
          type: data?.action === 'click' ? 'click' : data?.action === 'type' ? 'type' : 'extract',
          action: data?.action || 'action',
          target: data?.selector,
          value: data?.value,
          description: data?.description || `${data?.action || 'Action'} on ${data?.selector || 'element'}`,
          status: 'completed',
        });
        break;

      case 'browser:screenshot':
        const screenshotEntry = {
          id: `screenshot-${Date.now()}`,
          url: data?.screenshotUrl,
          base64: data?.screenshotBase64,
          timestamp,
          pageTitle: data?.pageTitle,
        };
        setState(prev => ({
          ...prev,
          browser: {
            ...prev.browser,
            latestScreenshot: data?.screenshotUrl || (data?.screenshotBase64 ? `data:image/png;base64,${data.screenshotBase64}` : undefined),
            currentUrl: data?.currentUrl || prev.browser.currentUrl,
            pageTitle: data?.pageTitle || prev.browser.pageTitle,
            screenshots: [...prev.browser.screenshots, screenshotEntry],
          },
        }));
        break;

      case 'tool:start':
        addActionLog({
          timestamp,
          type: 'tool',
          action: 'tool_start',
          target: data?.toolName,
          description: `Tool started: ${data?.toolName || 'unknown'}`,
          status: 'running',
        });
        break;

      case 'tool:complete':
        addActionLog({
          timestamp,
          type: 'tool',
          action: 'tool_complete',
          target: data?.toolName,
          description: `Tool completed: ${data?.toolName || 'unknown'}`,
          duration: data?.duration,
          status: 'completed',
        });
        break;

      case 'execution:paused':
        setState(prev => ({ ...prev, status: 'paused' }));
        addActionLog({
          timestamp,
          type: 'system',
          action: 'execution_paused',
          description: `Execution paused: ${data?.reason || 'By user'}`,
          status: 'completed',
        });
        break;

      case 'execution:resumed':
        setState(prev => ({ ...prev, status: 'running' }));
        addActionLog({
          timestamp,
          type: 'system',
          action: 'execution_resumed',
          description: 'Execution resumed',
          status: 'completed',
        });
        break;

      case 'execution:complete':
        setState(prev => ({
          ...prev,
          status: 'completed',
          result: data?.result,
        }));
        addActionLog({
          timestamp,
          type: 'system',
          action: 'execution_complete',
          description: 'Execution completed successfully',
          duration: data?.duration,
          status: 'completed',
        });
        onComplete?.(data?.result);
        break;

      case 'execution:error':
        setState(prev => ({
          ...prev,
          status: 'failed',
          error: data?.error || 'Unknown error',
        }));
        addActionLog({
          timestamp,
          type: 'error',
          action: 'execution_error',
          description: `Error: ${data?.error || 'Unknown error'}`,
          status: 'failed',
        });
        onError?.(data?.error || 'Unknown error');
        break;

      default:
        // Unknown event type, ignore
        break;
    }
  }, [addActionLog, addThinking, onComplete, onError]);

  const connect = useCallback(() => {
    if (!executionId) return;

    cleanup();

    setState(prev => ({ ...prev, status: 'connecting', error: null }));

    const url = `/api/agent/execution-stream/${executionId}`;

    try {
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      // Handle named SSE events
      const eventTypes = [
        'connected', 'execution:started', 'plan:created', 'phase:start', 'phase:complete',
        'thinking', 'reasoning', 'progress', 'browser:session', 'browser:navigate',
        'browser:action', 'browser:screenshot', 'tool:start', 'tool:complete',
        'execution:paused', 'execution:resumed', 'execution:complete', 'execution:error',
      ];

      for (const eventType of eventTypes) {
        // SSE event names use underscores (browser_navigate) not colons
        const sseEventName = eventType.replace(/:/g, '_');
        es.addEventListener(sseEventName, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            handleEvent(eventType, data);
          } catch (e) {
            console.error(`[ExecutionStream] Error parsing ${eventType}:`, e);
          }
        });
        // Also listen with original colon-separated name in case server uses it
        if (sseEventName !== eventType) {
          es.addEventListener(eventType, (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              handleEvent(eventType, data);
            } catch (e) {
              // Silently ignore parse errors for duplicate listeners
            }
          });
        }
      }

      // Also handle the 'connected' event specifically
      es.addEventListener('connected', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent('connected', data);
        } catch (e) {
          // Already handled above
        }
      });

      // Handle generic message events (for servers that send unnamed events)
      es.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type) {
            handleEvent(message.type, message.data || message);
          }
        } catch (e) {
          // Ignore non-JSON messages (heartbeats)
        }
      };

      es.onerror = () => {
        setState(prev => ({ ...prev, isConnected: false }));

        if (es.readyState === EventSource.CLOSED) {
          cleanup();
          // Only reconnect if not in terminal state
          setState(prev => {
            if (prev.status !== 'completed' && prev.status !== 'failed' && prev.status !== 'cancelled') {
              reconnectTimeoutRef.current = setTimeout(() => {
                connect();
              }, 3000);
            }
            return prev;
          });
        }
      };

      // Start duration timer
      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setState(prev => {
            if (prev.status === 'running' || prev.status === 'paused') {
              return { ...prev, duration: Date.now() - (startTimeRef.current || Date.now()) };
            }
            return prev;
          });
        }
      }, 1000);

    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to connect',
      }));
    }
  }, [executionId, cleanup, handleEvent]);

  const disconnect = useCallback(() => {
    cleanup();
    setState(prev => ({ ...prev, isConnected: false, status: 'idle' }));
  }, [cleanup]);

  // Auto-connect when executionId changes
  useEffect(() => {
    if (autoConnect && executionId) {
      connect();
    }
    return () => {
      cleanup();
    };
  }, [executionId, autoConnect, connect, cleanup]);

  return {
    ...state,
    connect,
    disconnect,
  };
}
