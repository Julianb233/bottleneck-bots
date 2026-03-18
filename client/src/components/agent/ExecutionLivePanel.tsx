/**
 * ExecutionLivePanel
 *
 * Real-time execution detail panel with:
 * - Live browser preview (iframe or screenshot)
 * - Current step in task plan
 * - Action log (clicked X, typed Y, navigated to Z)
 * - LLM reasoning visible (what agent is thinking)
 * - Elapsed time and estimated remaining
 * - Pause/Resume/Cancel controls
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import type { BrowserActionEntry } from '@/stores/agentStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Pause,
  Play,
  Square,
  ExternalLink,
  Maximize2,
  Minimize2,
  Globe,
  MousePointer,
  Brain,
  Clock,
  Activity,
  ChevronRight,
  Loader2,
  Eye,
  AlertCircle,
  Terminal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutionLivePanelProps {
  className?: string;
  sseConnected?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case 'navigate':
      return <Globe className="h-3.5 w-3.5 text-blue-500" />;
    case 'click':
      return <MousePointer className="h-3.5 w-3.5 text-green-500" />;
    case 'type':
    case 'fill':
      return <Terminal className="h-3.5 w-3.5 text-purple-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-slate-500" />;
  }
}

function BrowserPreview() {
  const { activeBrowserSession, browserState } = useAgentStore();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const debugUrl = activeBrowserSession?.debugUrl;
  const hasScreenshot = !!(browserState.screenshotBase64 || browserState.screenshotUrl);

  const PreviewContent = () => {
    if (debugUrl) {
      return (
        <div className="relative w-full h-full min-h-[300px] bg-slate-900 rounded-md overflow-hidden">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Connecting to live browser...</p>
              </div>
            </div>
          )}
          <iframe
            src={debugUrl}
            className="w-full h-full border-none"
            title="Live Browser Preview"
            allow="clipboard-read; clipboard-write"
            onLoad={() => setIframeLoading(false)}
            onError={() => setIframeLoading(false)}
          />
        </div>
      );
    }

    if (hasScreenshot) {
      const src = browserState.screenshotBase64
        ? `data:image/png;base64,${browserState.screenshotBase64}`
        : browserState.screenshotUrl;
      return (
        <div className="relative w-full min-h-[300px] bg-slate-900 rounded-md overflow-hidden flex items-center justify-center">
          <img
            src={src}
            alt="Browser Screenshot"
            className="max-w-full max-h-[500px] object-contain"
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-[300px] bg-slate-50 dark:bg-slate-900 rounded-md border border-dashed border-slate-300 dark:border-slate-700">
        <div className="text-center">
          <Eye className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No live browser view available</p>
          <p className="text-xs text-slate-400 mt-1">
            Browser preview will appear when the agent opens a browser session
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-2">
        {browserState.currentUrl && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-sm">
            <Globe className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
            <span className="truncate text-slate-700 dark:text-slate-300">
              {browserState.currentUrl}
            </span>
            {browserState.pageTitle && (
              <span className="text-slate-400 text-xs truncate ml-auto">
                {browserState.pageTitle}
              </span>
            )}
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {debugUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => window.open(debugUrl, '_blank')}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              {(debugUrl || hasScreenshot) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsFullScreen(true)}
                  title="Full screen"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        <PreviewContent />
      </div>

      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {browserState.pageTitle || 'Live Browser Preview'}
                </span>
                {browserState.currentUrl && (
                  <span className="text-xs text-slate-500 truncate max-w-[400px]">
                    {browserState.currentUrl}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(false)}>
                <Minimize2 className="h-4 w-4 mr-1" />
                Exit
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <PreviewContent />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionLog() {
  const { browserState } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [browserState.actions.length]);

  if (browserState.actions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-400">
        <Activity className="h-4 w-4 mr-2" />
        Waiting for browser actions...
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-1 max-h-[400px] overflow-y-auto">
      {browserState.actions.map((entry: BrowserActionEntry) => (
        <div
          key={entry.id}
          className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
        >
          <ActionIcon action={entry.action} />
          <div className="flex-1 min-w-0">
            <span className="text-slate-700 dark:text-slate-300">
              {entry.description}
            </span>
            {entry.selector && (
              <span className="text-xs text-slate-400 block truncate">
                {entry.selector}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {formatTime(entry.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReasoningView() {
  const { thinkingSteps, reasoningSteps } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingSteps.length, reasoningSteps.length]);

  const hasContent = thinkingSteps.length > 0 || reasoningSteps.length > 0;

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-400">
        <Brain className="h-4 w-4 mr-2" />
        Agent reasoning will appear here...
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-2 max-h-[400px] overflow-y-auto">
      {reasoningSteps.map((step, i) => (
        <div
          key={`reasoning-${i}`}
          className="px-3 py-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md"
        >
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Decision (Step {step.step})
            </span>
            <Badge variant="outline" className="text-xs h-5">
              {Math.round(step.confidence * 100)}% confident
            </Badge>
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-200">{step.decision}</p>
          {step.thought && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{step.thought}</p>
          )}
        </div>
      ))}

      {thinkingSteps.slice(-20).map((step) => (
        <div
          key={step.id}
          className={cn(
            'px-3 py-2 rounded-md text-sm',
            step.type === 'thinking' && 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800',
            step.type === 'tool_use' && 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800',
            step.type === 'tool_result' && 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
            step.type === 'error' && 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800',
            step.type === 'plan' && 'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800',
          )}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            {step.type === 'thinking' && <Brain className="h-3 w-3 text-blue-500" />}
            {step.type === 'tool_use' && <Terminal className="h-3 w-3 text-green-500" />}
            {step.type === 'tool_result' && <ChevronRight className="h-3 w-3 text-slate-500" />}
            {step.type === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
            <span className="text-xs text-slate-500 capitalize">{step.type.replace('_', ' ')}</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
            {step.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProgressBar() {
  const { progress, currentExecution } = useAgentStore();

  if (!progress && !currentExecution) return null;

  const percentComplete = progress?.percentComplete || 0;
  const currentStep = progress?.currentStep || 0;
  const totalSteps = progress?.totalSteps || 0;
  const elapsedTime = progress?.elapsedTime || 0;
  const estimatedTimeRemaining = progress?.estimatedTimeRemaining || 0;
  const currentAction = progress?.currentAction || currentExecution?.taskDescription || 'Initializing...';

  return (
    <div className="space-y-2">
      <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full transition-all duration-500',
            percentComplete >= 100 ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${Math.min(percentComplete, 100)}%` }}
        />
        {percentComplete < 100 && percentComplete > 0 && (
          <div
            className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
            style={{ left: `${Math.min(percentComplete, 95)}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span>Step {currentStep}/{totalSteps}</span>
          <span className="text-slate-400">{Math.round(percentComplete)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(elapsedTime)}
          </span>
          {estimatedTimeRemaining > 0 && (
            <span className="text-slate-400">
              ~{formatDuration(estimatedTimeRemaining)} remaining
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />
        <span className="text-slate-600 dark:text-slate-400 truncate">{currentAction}</span>
      </div>
    </div>
  );
}

function ExecutionControls() {
  const {
    currentExecution,
    isExecuting,
    cancelExecution,
    pauseExecution,
    resumeExecution,
  } = useAgentStore();

  if (!currentExecution) return null;

  const isPaused = currentExecution.status === 'paused';
  const isRunning = isExecuting || currentExecution.status === 'running' || currentExecution.status === 'executing';
  const canControl = isPaused || isRunning;

  if (!canControl) return null;

  return (
    <div className="flex items-center gap-2">
      {isPaused ? (
        <Button size="sm" variant="outline" onClick={() => resumeExecution()} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Resume
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => pauseExecution()} className="gap-1.5">
          <Pause className="h-3.5 w-3.5" />
          Pause
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => cancelExecution()}
        className="gap-1.5 text-red-600 hover:text-red-700 hover:border-red-300"
      >
        <Square className="h-3.5 w-3.5" />
        Cancel
      </Button>
    </div>
  );
}

function StatusBadge() {
  const { currentExecution, isExecuting } = useAgentStore();

  if (!currentExecution) return null;

  const status = currentExecution.status;

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    started: { label: 'Starting', variant: 'default', className: 'bg-blue-500' },
    running: { label: 'Running', variant: 'default', className: 'bg-blue-500' },
    planning: { label: 'Planning', variant: 'default', className: 'bg-purple-500' },
    executing: { label: 'Executing', variant: 'default', className: 'bg-blue-500' },
    paused: { label: 'Paused', variant: 'secondary', className: 'bg-yellow-500 text-white' },
    success: { label: 'Completed', variant: 'default', className: 'bg-green-500' },
    completed: { label: 'Completed', variant: 'default', className: 'bg-green-500' },
    failed: { label: 'Failed', variant: 'destructive' },
    cancelled: { label: 'Cancelled', variant: 'secondary' },
    timeout: { label: 'Timed Out', variant: 'destructive' },
    needs_input: { label: 'Needs Input', variant: 'outline', className: 'border-amber-500 text-amber-600' },
  };

  const config = statusConfig[status] || { label: status, variant: 'outline' as const };

  return (
    <Badge variant={config.variant} className={config.className}>
      {isExecuting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
      {config.label}
    </Badge>
  );
}

export function ExecutionLivePanel({ className, sseConnected }: ExecutionLivePanelProps) {
  const {
    currentExecution,
    isExecuting,
    progress,
    browserState,
    activeBrowserSession,
  } = useAgentStore();

  const [activeTab, setActiveTab] = useState<string>('browser');

  if (!currentExecution && !isExecuting) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-slate-600 mb-1">No Active Execution</h3>
            <p className="text-xs text-slate-400 max-w-[250px]">
              Start an agent task to see real-time browser activity, reasoning, and progress here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Live Execution</CardTitle>
            <StatusBadge />
            {sseConnected !== undefined && (
              <Badge variant="outline" className="gap-1 text-xs">
                {sseConnected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-slate-400" />
                )}
                {sseConnected ? 'Live' : 'Offline'}
              </Badge>
            )}
          </div>
          <ExecutionControls />
        </div>

        {currentExecution?.taskDescription && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
            {currentExecution.taskDescription}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {(isExecuting || progress) && <ProgressBar />}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="browser" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              Browser
              {activeBrowserSession && (
                <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5 text-xs">
              <MousePointer className="h-3.5 w-3.5" />
              Actions
              {browserState.actions.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {browserState.actions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reasoning" className="gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" />
              Reasoning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browser" className="mt-3">
            <BrowserPreview />
          </TabsContent>

          <TabsContent value="actions" className="mt-3">
            <ActionLog />
          </TabsContent>

          <TabsContent value="reasoning" className="mt-3">
            <ReasoningView />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
