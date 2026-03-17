/**
 * AgentExecutionPanel Component
 *
 * Comprehensive agent execution panel with live browser preview.
 * Combines all execution monitoring features into a single view:
 *
 * - Live browser preview via BrowserBase debug URL
 * - SSE-streamed action log (clicked X, typed Y, navigated to Z)
 * - LLM reasoning visible (what the agent is thinking)
 * - Progress tracking with elapsed time and ETA
 * - Pause/Resume/Cancel controls during execution
 * - Screenshot gallery from key moments
 *
 * Wired to agentProgressTracker.service.ts via SSE events.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Activity,
  Brain,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Maximize2,
  Monitor,
  MousePointer,
  Navigation,
  Pause,
  Play,
  Square,
  Type,
  XCircle,
  Wrench,
  Eye,
  Globe,
  Timer,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useExecutionStream, type ActionLogEntry, type ThinkingStep } from '@/hooks/useExecutionStream';
import { trpc } from '@/lib/trpc';

// ========================================
// TYPES
// ========================================

interface AgentExecutionPanelProps {
  executionId: string | number;
  taskName?: string;
  taskDescription?: string;
  className?: string;
  onClose?: () => void;
  onComplete?: (result: any) => void;
}

// ========================================
// MAIN COMPONENT
// ========================================

export function AgentExecutionPanel({
  executionId,
  taskName,
  taskDescription,
  className = '',
  onClose,
  onComplete,
}: AgentExecutionPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const actionLogEndRef = useRef<HTMLDivElement>(null);
  const thinkingEndRef = useRef<HTMLDivElement>(null);

  // SSE stream for real-time execution updates
  const execution = useExecutionStream({
    executionId,
    autoConnect: true,
    onComplete: (result) => {
      toast.success('Task completed successfully');
      onComplete?.(result);
    },
    onError: (error) => {
      toast.error(`Task failed: ${error}`);
    },
  });

  // tRPC mutations for execution control
  const pauseMutation = trpc.agent.pauseExecution.useMutation({
    onSuccess: () => toast.info('Execution paused'),
    onError: (err) => toast.error(`Failed to pause: ${err.message}`),
  });
  const resumeMutation = trpc.agent.resumeExecution.useMutation({
    onSuccess: () => toast.info('Execution resumed'),
    onError: (err) => toast.error(`Failed to resume: ${err.message}`),
  });
  const cancelMutation = trpc.agent.cancelExecution.useMutation({
    onSuccess: () => toast.warning('Execution cancelled'),
    onError: (err) => toast.error(`Failed to cancel: ${err.message}`),
  });

  // Auto-scroll action log
  useEffect(() => {
    if (actionLogEndRef.current) {
      actionLogEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [execution.actionLog.length]);

  // Auto-scroll thinking
  useEffect(() => {
    if (thinkingEndRef.current) {
      thinkingEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [execution.thinkingSteps.length]);

  const handlePause = () => {
    pauseMutation.mutate({ executionId: Number(executionId) });
  };

  const handleResume = () => {
    resumeMutation.mutate({ executionId: Number(executionId) });
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this execution?')) {
      cancelMutation.mutate({ executionId: Number(executionId), reason: 'Cancelled by user' });
    }
  };

  const isRunning = execution.status === 'running';
  const isPaused = execution.status === 'paused';
  const isComplete = execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled';

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <ExecutionPanelHeader
        taskName={taskName}
        status={execution.status}
        progress={execution.progress}
        duration={execution.duration}
        isRunning={isRunning}
        isPaused={isPaused}
        isComplete={isComplete}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
        onClose={onClose}
        isPauseLoading={pauseMutation.isPending}
        isResumeLoading={resumeMutation.isPending}
        isCancelLoading={cancelMutation.isPending}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 border-b">
            <TabsList className="h-10">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <Monitor className="h-3.5 w-3.5" />
                Live View
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                Actions
                {execution.actionLog.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {execution.actionLog.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="thinking" className="gap-1.5 text-xs">
                <Brain className="h-3.5 w-3.5" />
                Reasoning
                {execution.thinkingSteps.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {execution.thinkingSteps.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="screenshots" className="gap-1.5 text-xs">
                <Camera className="h-3.5 w-3.5" />
                Screenshots
                {execution.browser.screenshots.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {execution.browser.screenshots.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab - Live Browser + Action Summary */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              {/* Live Browser Preview - 2/3 width */}
              <div className="lg:col-span-2">
                <LiveBrowserPreview
                  browser={execution.browser}
                  isActive={isRunning}
                  currentAction={execution.progress.currentAction}
                />
              </div>

              {/* Side Panel - Action Feed + Current State */}
              <div className="space-y-4">
                {/* Current Action */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Current Action
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex items-start gap-2">
                      {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500 mt-0.5 flex-shrink-0" />}
                      {isPaused && <Pause className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                      {isComplete && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {execution.progress.currentAction}
                        </p>
                        {execution.browser.currentUrl && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {execution.browser.currentUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Latest Thinking */}
                {execution.thinkingSteps.length > 0 && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Brain className="h-3 w-3" />
                        Agent Thinking
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <p className="text-xs text-foreground leading-relaxed line-clamp-4">
                        {execution.thinkingSteps[execution.thinkingSteps.length - 1].thought}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Actions Feed */}
                <Card className="flex-1">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Recent Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {execution.actionLog.slice(-10).map((entry) => (
                          <ActionLogItem key={entry.id} entry={entry} compact />
                        ))}
                        {execution.actionLog.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Waiting for actions...
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Actions Tab - Full Action Log */}
          <TabsContent value="actions" className="flex-1 overflow-hidden mt-0 p-4">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3 px-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Action Log
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {execution.actionLog.length} actions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden px-4 pb-3">
                <ScrollArea className="h-full">
                  <div className="space-y-1.5">
                    {execution.actionLog.map((entry) => (
                      <ActionLogItem key={entry.id} entry={entry} />
                    ))}
                    {execution.actionLog.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Activity className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">No actions recorded yet</p>
                      </div>
                    )}
                    <div ref={actionLogEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Thinking Tab - LLM Reasoning */}
          <TabsContent value="thinking" className="flex-1 overflow-hidden mt-0 p-4">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3 px-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Agent Reasoning
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {execution.thinkingSteps.length} thoughts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden px-4 pb-3">
                <ScrollArea className="h-full">
                  <div className="space-y-3">
                    {execution.thinkingSteps.map((step) => (
                      <ThinkingStepItem key={step.id} step={step} />
                    ))}
                    {execution.thinkingSteps.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Brain className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">Agent has not started thinking yet</p>
                      </div>
                    )}
                    <div ref={thinkingEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Screenshots Tab */}
          <TabsContent value="screenshots" className="flex-1 overflow-y-auto mt-0 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {execution.browser.screenshots.map((screenshot) => (
                <Card key={screenshot.id} className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                  <div className="aspect-video bg-muted relative">
                    {(screenshot.url || screenshot.base64) ? (
                      <img
                        src={screenshot.url || `data:image/png;base64,${screenshot.base64}`}
                        alt={screenshot.pageTitle || 'Screenshot'}
                        className="w-full h-full object-cover"
                        onClick={() => window.open(screenshot.url, '_blank')}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Camera className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {screenshot.pageTitle || new Date(screenshot.timestamp).toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {execution.browser.screenshots.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Camera className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No screenshots captured yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Error display */}
      {execution.error && (
        <div className="p-4 border-t bg-destructive/5">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Execution Error</p>
              <p className="text-xs text-destructive/80 mt-0.5">{execution.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// SUB-COMPONENTS
// ========================================

/** Header with progress, controls, and status */
function ExecutionPanelHeader({
  taskName,
  status,
  progress,
  duration,
  isRunning,
  isPaused,
  isComplete,
  onPause,
  onResume,
  onCancel,
  onClose,
  isPauseLoading,
  isResumeLoading,
  isCancelLoading,
}: {
  taskName?: string;
  status: string;
  progress: any;
  duration: number;
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onClose?: () => void;
  isPauseLoading: boolean;
  isResumeLoading: boolean;
  isCancelLoading: boolean;
}) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatETA = (ms: number) => {
    if (ms <= 0) return 'Almost done';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `~${minutes}m ${seconds % 60}s remaining`;
    return `~${seconds}s remaining`;
  };

  const statusConfig: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    connecting: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Connecting', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    running: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Running', icon: <Activity className="h-3 w-3" /> },
    paused: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'Paused', icon: <Pause className="h-3 w-3" /> },
    completed: { color: 'text-green-600', bg: 'bg-green-100', label: 'Completed', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { color: 'text-red-600', bg: 'bg-red-100', label: 'Failed', icon: <XCircle className="h-3 w-3" /> },
    cancelled: { color: 'text-slate-600', bg: 'bg-slate-100', label: 'Cancelled', icon: <Square className="h-3 w-3" /> },
    idle: { color: 'text-slate-600', bg: 'bg-slate-100', label: 'Idle', icon: <Clock className="h-3 w-3" /> },
  };

  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div className="border-b bg-card px-4 py-3 space-y-3">
      {/* Top row: task name, status, controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className={`${config.bg} ${config.color} gap-1 border-0`}>
            {config.icon}
            {config.label}
          </Badge>
          <h3 className="text-sm font-semibold truncate">
            {taskName || 'Agent Task Execution'}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Elapsed time */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  {formatDuration(duration)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Elapsed time</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-5" />

          {/* Execution controls */}
          {!isComplete && (
            <>
              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPause}
                  disabled={isPauseLoading}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  {isPauseLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResume}
                  disabled={isResumeLoading}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  {isResumeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  Resume
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isCancelLoading}
                className="h-7 px-2.5 text-xs gap-1 text-destructive hover:text-destructive"
              >
                {isCancelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                Cancel
              </Button>
            </>
          )}

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2 text-xs">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {progress.currentStep} of {progress.totalSteps || '?'}
          </span>
          <span>
            {progress.percentComplete > 0 && `${Math.round(progress.percentComplete)}%`}
            {progress.estimatedTimeRemaining > 0 && isRunning && (
              <> - {formatETA(progress.estimatedTimeRemaining)}</>
            )}
          </span>
        </div>
        <Progress value={progress.percentComplete} className="h-1.5" />
      </div>
    </div>
  );
}

/** Live browser preview with chrome UI */
function LiveBrowserPreview({
  browser,
  isActive,
  currentAction,
}: {
  browser: any;
  isActive: boolean;
  currentAction: string;
}) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Browser chrome */}
      <div className="bg-muted/50 border-b px-3 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </div>

        {/* URL bar */}
        <div className="flex-1 bg-background border rounded px-3 py-1 text-xs text-muted-foreground font-mono truncate flex items-center gap-2">
          <Globe className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{browser.currentUrl || 'about:blank'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isActive && (
            <Badge variant="default" className="h-5 px-1.5 text-[10px] gap-1 bg-blue-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              LIVE
            </Badge>
          )}
          {browser.debugUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => window.open(browser.debugUrl, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Browser content */}
      <div className="flex-1 relative bg-muted/30">
        {browser.debugUrl ? (
          <iframe
            src={browser.debugUrl}
            className="w-full h-full border-none min-h-[400px]"
            title="Live Browser Preview"
            allow="clipboard-read; clipboard-write"
          />
        ) : browser.latestScreenshot ? (
          <img
            src={browser.latestScreenshot}
            alt="Latest screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
            <Monitor className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-sm font-medium">Waiting for browser session</p>
            <p className="text-xs mt-1 opacity-60">
              Live preview will appear when the agent starts a browser task
            </p>
          </div>
        )}

        {/* Action overlay */}
        {isActive && currentAction && currentAction !== 'Waiting to start...' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/95 border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 max-w-[90%]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="text-xs font-medium truncate">{currentAction}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Single action log entry */
function ActionLogItem({ entry, compact = false }: { entry: ActionLogEntry; compact?: boolean }) {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'navigate': return <Navigation className="h-3 w-3 text-blue-500" />;
      case 'click': return <MousePointer className="h-3 w-3 text-purple-500" />;
      case 'type': return <Type className="h-3 w-3 text-green-500" />;
      case 'extract': return <Eye className="h-3 w-3 text-amber-500" />;
      case 'screenshot': return <Camera className="h-3 w-3 text-pink-500" />;
      case 'tool': return <Wrench className="h-3 w-3 text-orange-500" />;
      case 'error': return <XCircle className="h-3 w-3 text-red-500" />;
      default: return <Zap className="h-3 w-3 text-slate-500" />;
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle className="h-2.5 w-2.5 text-green-500" />;
      case 'failed': return <XCircle className="h-2.5 w-2.5 text-red-500" />;
      default: return <Clock className="h-2.5 w-2.5 text-slate-400" />;
    }
  };

  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (compact) {
    return (
      <div className="flex items-start gap-2 py-1">
        {getActionIcon(entry.type)}
        <div className="min-w-0 flex-1">
          <p className="text-xs truncate">{entry.description}</p>
        </div>
        {getStatusIndicator(entry.status)}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
      entry.status === 'running' ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' :
      entry.status === 'failed' ? 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
      'bg-card border-border hover:bg-muted/30'
    }`}>
      <div className="mt-0.5 flex-shrink-0">
        {getActionIcon(entry.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{time}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {entry.type}
          </Badge>
          {getStatusIndicator(entry.status)}
        </div>
        <p className="text-sm mt-0.5">{entry.description}</p>
        {entry.target && (
          <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
            {entry.target}
          </p>
        )}
        {entry.duration && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {entry.duration}ms
          </p>
        )}
      </div>
    </div>
  );
}

/** Single thinking/reasoning step */
function ThinkingStepItem({ step }: { step: ThinkingStep }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = step.evidence || step.hypothesis || step.decision || step.alternatives;

  const time = new Date(step.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        step.toolUsed
          ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
          : step.confidence && step.confidence > 0.8
          ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
          : 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
      }`}
    >
      <div className="flex items-start gap-2">
        <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-muted-foreground">{time}</span>
            {step.phase && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {step.phase}
              </Badge>
            )}
            {step.confidence != null && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {Math.round(step.confidence * 100)}% confident
              </Badge>
            )}
            {step.toolUsed && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                <Wrench className="h-2.5 w-2.5" />
                {step.toolUsed}
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed">{step.thought}</p>

          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[10px] text-primary mt-2 hover:underline"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Show details
            </button>
          )}

          {isExpanded && hasDetails && (
            <div className="mt-2 space-y-2 text-xs">
              {step.hypothesis && (
                <div>
                  <span className="font-semibold text-muted-foreground">Hypothesis:</span>
                  <p className="mt-0.5">{step.hypothesis}</p>
                </div>
              )}
              {step.decision && (
                <div>
                  <span className="font-semibold text-muted-foreground">Decision:</span>
                  <p className="mt-0.5">{step.decision}</p>
                </div>
              )}
              {step.evidence && step.evidence.length > 0 && (
                <div>
                  <span className="font-semibold text-muted-foreground">Evidence:</span>
                  <ul className="mt-0.5 list-disc list-inside">
                    {step.evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {step.alternatives && step.alternatives.length > 0 && (
                <div>
                  <span className="font-semibold text-muted-foreground">Alternatives considered:</span>
                  <ul className="mt-0.5 list-disc list-inside">
                    {step.alternatives.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
