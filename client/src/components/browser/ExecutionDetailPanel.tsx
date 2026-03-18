/**
 * ExecutionDetailPanel
 *
 * Shows real-time execution details during agent browser automation:
 * - Current step in the task plan
 * - Action log (clicked X, typed Y, navigated to Z)
 * - LLM reasoning visible (what the agent is thinking)
 * - Elapsed time and estimated remaining
 * - Live screenshot preview
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  Brain,
  Activity,
  Clock,
  Timer,
  MousePointer2,
  Type,
  Navigation,
  Eye,
  FileSearch,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useAgentStore, type BrowserActionEntry, type ReasoningStep, type ProgressData } from '@/stores/agentStore';

// ========================================
// HELPERS
// ========================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function getActionIcon(action: string) {
  switch (action) {
    case 'click':
      return <MousePointer2 className="h-3.5 w-3.5 text-blue-500" />;
    case 'type':
      return <Type className="h-3.5 w-3.5 text-green-500" />;
    case 'navigate':
      return <Navigation className="h-3.5 w-3.5 text-purple-500" />;
    case 'observe':
      return <Eye className="h-3.5 w-3.5 text-amber-500" />;
    case 'extract':
      return <FileSearch className="h-3.5 w-3.5 text-cyan-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-slate-400" />;
  }
}

// ========================================
// SUB-COMPONENTS
// ========================================

function ProgressSection({ progress }: { progress: ProgressData | null }) {
  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Waiting for progress data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Step counter */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 font-medium">
          Step {progress.currentStep} of {progress.totalSteps}
        </span>
        <span className="font-semibold text-slate-800">
          {progress.percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <Progress value={progress.percentComplete} className="h-2" />

      {/* Time info */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Elapsed: {formatDuration(progress.elapsedTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3" />
          <span>
            {progress.estimatedTimeRemaining > 0
              ? `~${formatDuration(progress.estimatedTimeRemaining)} remaining`
              : 'Calculating...'}
          </span>
        </div>
      </div>

      {/* Current action */}
      {progress.currentAction && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2">
          <ChevronRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-sm text-slate-700 truncate">
            {progress.currentAction}
          </span>
        </div>
      )}
    </div>
  );
}

function ActionLog({ actions }: { actions: BrowserActionEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions.length]);

  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-400">
        No actions recorded yet
      </div>
    );
  }

  return (
    <div className="h-[300px] overflow-y-auto" ref={scrollRef}>
      <div className="space-y-1 pr-3">
        {actions.map((entry, idx) => (
          <div
            key={entry.id || idx}
            className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-slate-50 transition-colors"
          >
            <div className="mt-0.5 flex-shrink-0">
              {getActionIcon(entry.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-tight">
                {entry.description}
              </p>
              {entry.selector && (
                <code className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                  {entry.selector}
                </code>
              )}
              {entry.value && (
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Value: &quot;{entry.value}&quot;
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReasoningView({ steps }: { steps: ReasoningStep[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps.length]);

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-400">
        No reasoning steps yet
      </div>
    );
  }

  return (
    <div className="h-[300px] overflow-y-auto" ref={scrollRef}>
      <div className="space-y-3 pr-3">
        {steps.map((step, idx) => (
          <div
            key={`${step.step}-${idx}`}
            className="border border-slate-200 rounded-lg p-3 space-y-2"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-700">
                  Step {step.step}
                </span>
              </div>
              <Badge
                variant={step.confidence > 0.7 ? 'default' : 'secondary'}
                className="text-[10px] h-5"
              >
                {Math.round(step.confidence * 100)}% confident
              </Badge>
            </div>

            {/* Thought */}
            <p className="text-sm text-slate-600 leading-relaxed">
              {step.thought}
            </p>

            {/* Decision */}
            <div className="bg-blue-50 rounded px-2.5 py-1.5">
              <span className="text-xs font-medium text-blue-700">Decision: </span>
              <span className="text-xs text-blue-600">{step.decision}</span>
            </div>

            {/* Evidence */}
            {step.evidence.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Evidence
                </span>
                <ul className="space-y-0.5">
                  {step.evidence.map((e, i) => (
                    <li key={i} className="text-xs text-slate-500 flex items-start gap-1">
                      <span className="text-slate-400 mt-px">-</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Alternatives */}
            {step.alternatives.length > 0 && (
              <div className="text-[10px] text-slate-400">
                Alternatives considered: {step.alternatives.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BrowserPreview({
  screenshotBase64,
  screenshotUrl,
  currentUrl,
  pageTitle,
}: {
  screenshotBase64?: string;
  screenshotUrl?: string;
  currentUrl?: string;
  pageTitle?: string;
}) {
  const imgSrc = screenshotBase64
    ? `data:image/png;base64,${screenshotBase64}`
    : screenshotUrl;

  return (
    <div className="space-y-2">
      {/* URL bar */}
      {currentUrl && (
        <div className="flex items-center gap-2 bg-slate-100 rounded-md px-3 py-1.5">
          <Globe className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-600 truncate">{currentUrl}</span>
        </div>
      )}

      {/* Page title */}
      {pageTitle && (
        <p className="text-xs text-slate-500 truncate px-1">
          {pageTitle}
        </p>
      )}

      {/* Screenshot */}
      {imgSrc ? (
        <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
          <img
            src={imgSrc}
            alt="Browser screenshot"
            className="w-full h-auto object-contain max-h-[400px]"
          />
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="text-[10px] bg-black/50 text-white border-0">
              Live Preview
            </Badge>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <div className="text-center">
            <Globe className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No screenshot available</p>
            <p className="text-xs text-slate-300 mt-1">Screenshots appear during execution</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

interface ExecutionDetailPanelProps {
  className?: string;
}

export function ExecutionDetailPanel({ className = '' }: ExecutionDetailPanelProps) {
  const progress = useAgentStore((s) => s.progress);
  const browserState = useAgentStore((s) => s.browserState);
  const reasoningSteps = useAgentStore((s) => s.reasoningSteps);
  const currentExecution = useAgentStore((s) => s.currentExecution);
  const isExecuting = useAgentStore((s) => s.isExecuting);

  const statusLabel = useMemo(() => {
    if (!currentExecution) return 'No execution';
    switch (currentExecution.status) {
      case 'running':
      case 'executing':
        return 'Running';
      case 'planning':
        return 'Planning';
      case 'paused':
        return 'Paused';
      case 'completed':
      case 'success':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return currentExecution.status;
    }
  }, [currentExecution?.status]);

  const statusColor = useMemo(() => {
    if (!currentExecution) return 'bg-slate-100 text-slate-600';
    switch (currentExecution.status) {
      case 'running':
      case 'executing':
        return 'bg-blue-100 text-blue-700';
      case 'planning':
        return 'bg-indigo-100 text-indigo-700';
      case 'paused':
        return 'bg-amber-100 text-amber-700';
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }, [currentExecution?.status]);

  if (!currentExecution && !isExecuting) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No active execution</p>
          <p className="text-xs text-slate-400 mt-1">
            Start an agent task to see live execution details
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Execution Details
          </CardTitle>
          <div className="flex items-center gap-2">
            {isExecuting && (
              <div className="flex gap-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:300ms]" />
              </div>
            )}
            <Badge className={`text-[10px] h-5 ${statusColor}`}>
              {statusLabel}
            </Badge>
          </div>
        </div>

        {/* Task description */}
        {currentExecution?.taskDescription && (
          <p className="text-xs text-slate-500 mt-1 truncate">
            {currentExecution.taskDescription}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Progress section always visible */}
        <div className="mb-4">
          <ProgressSection progress={progress} />
        </div>

        {/* Tabbed detail views */}
        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="actions" className="text-xs">
              <MousePointer2 className="h-3 w-3 mr-1" />
              Actions
              {browserState.actions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                  {browserState.actions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reasoning" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              Reasoning
              {reasoningSteps.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                  {reasoningSteps.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="mt-3">
            <ActionLog actions={browserState.actions} />
          </TabsContent>

          <TabsContent value="reasoning" className="mt-3">
            <ReasoningView steps={reasoningSteps} />
          </TabsContent>

          <TabsContent value="preview" className="mt-3">
            <BrowserPreview
              screenshotBase64={browserState.screenshotBase64}
              screenshotUrl={browserState.screenshotUrl}
              currentUrl={browserState.currentUrl}
              pageTitle={browserState.pageTitle}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
