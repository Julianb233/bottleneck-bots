/**
 * ExecutionDetailView Component
 *
 * Full execution detail view for reviewing past agent task executions.
 * Features:
 * - Step-by-step timeline of all actions taken
 * - LLM reasoning chain display
 * - BrowserBase session recording replay
 * - Error details with classification
 * - Execution output/result viewer
 * - Export to PDF/JSON
 * - Retry failed executions
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Brain,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MousePointer,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Timer,
  Trash2,
  Type,
  Video,
  Wrench,
  XCircle,
  Eye,
  Camera,
  Zap,
  Code,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { StepTimeline, type ExecutionStep } from '@/components/browser/StepTimeline';
import { SessionRecordingViewer } from '@/components/browser/SessionRecordingViewer';

// ========================================
// TYPES
// ========================================

interface ExecutionDetailViewProps {
  executionId: number;
  onBack?: () => void;
  onRetry?: (taskDescription: string) => void;
  className?: string;
}

// ========================================
// MAIN COMPONENT
// ========================================

export function ExecutionDetailView({
  executionId,
  onBack,
  onRetry,
  className = '',
}: ExecutionDetailViewProps) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [jsonExpanded, setJsonExpanded] = useState(false);

  // Fetch execution details
  const { data: execution, isLoading, error } = trpc.agent.getExecution.useQuery({
    executionId,
  });

  // Retry mutation
  const retryMutation = trpc.agent.retryExecution.useMutation({
    onSuccess: (data) => {
      toast.success(`Retry started - Execution #${data.executionId}`);
    },
    onError: (err) => {
      toast.error(`Retry failed: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-3">Loading execution details...</p>
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground mt-3">
            {error?.message || 'Execution not found'}
          </p>
          {onBack && (
            <Button variant="outline" onClick={onBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to History
            </Button>
          )}
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    started: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Started', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    running: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Running', icon: <Activity className="h-3 w-3" /> },
    success: { color: 'text-green-600', bg: 'bg-green-100', label: 'Success', icon: <CheckCircle className="h-3 w-3" /> },
    failed: { color: 'text-red-600', bg: 'bg-red-100', label: 'Failed', icon: <XCircle className="h-3 w-3" /> },
    timeout: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Timeout', icon: <Clock className="h-3 w-3" /> },
    cancelled: { color: 'text-slate-600', bg: 'bg-slate-100', label: 'Cancelled', icon: <Square className="h-3 w-3" /> },
    needs_input: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'Waiting', icon: <Pause className="h-3 w-3" /> },
  };

  const status = statusConfig[execution.status || 'started'] || statusConfig.started;
  const isFailed = execution.status === 'failed' || execution.status === 'timeout';
  const isComplete = execution.status === 'success' || isFailed || execution.status === 'cancelled';

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleRetry = () => {
    retryMutation.mutate({ executionId });
  };

  const handleExportJson = () => {
    const content = JSON.stringify(execution, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Execution data exported as JSON');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(String(executionId));
    toast.success('Execution ID copied');
  };

  // Build step data from execution
  const steps: ExecutionStep[] = (execution.toolHistory || []).map((tool: any, index: number) => ({
    id: `step-${index}`,
    stepNumber: index + 1,
    action: tool.toolName || tool.action || `Step ${index + 1}`,
    actionType: mapActionType(tool.toolName || ''),
    target: tool.params?.url || tool.params?.selector || tool.target,
    status: tool.success === false ? 'failed' as const : 'completed' as const,
    duration: tool.duration,
    timestamp: tool.timestamp,
    error: tool.error,
    result: tool.result,
  }));

  // Build thinking steps
  const thinkingSteps = (execution.thinkingSteps || []).map((step: any, index: number) => ({
    id: `think-${index}`,
    timestamp: step.timestamp || new Date().toISOString(),
    thought: step.thought || step.content || step.message || '',
    phase: step.phase,
    toolUsed: step.toolUsed,
  }));

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b bg-card px-4 py-4 space-y-3">
        {/* Back + Title */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="mt-0.5">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${status.bg} ${status.color} gap-1 border-0`}>
                  {status.icon}
                  {status.label}
                </Badge>
                <button onClick={handleCopyId} className="text-xs text-muted-foreground hover:text-foreground font-mono">
                  #{executionId}
                </button>
              </div>
              <h2 className="text-base font-semibold truncate">
                {execution.task?.title || execution.task?.description || 'Agent Task Execution'}
              </h2>
              {execution.task?.description && execution.task.title !== execution.task.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {execution.task.description}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isFailed && (
              <Button
                variant="default"
                size="sm"
                onClick={handleRetry}
                disabled={retryMutation.isPending}
                className="gap-1.5"
              >
                {retryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Retry
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(execution.startedAt)}
          </div>
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            {formatDuration(execution.duration)}
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            {execution.stepsCompleted ?? 0} / {execution.stepsTotal ?? '?'} steps
          </div>
          {execution.attemptNumber && execution.attemptNumber > 1 && (
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Attempt #{execution.attemptNumber}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 border-b">
            <TabsList className="h-10">
              <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" />
                Timeline
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {steps.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reasoning" className="gap-1.5 text-xs">
                <Brain className="h-3.5 w-3.5" />
                Reasoning
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {thinkingSteps.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="recording" className="gap-1.5 text-xs">
                <Video className="h-3.5 w-3.5" />
                Recording
              </TabsTrigger>
              {isFailed && (
                <TabsTrigger value="errors" className="gap-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Errors
                </TabsTrigger>
              )}
              <TabsTrigger value="output" className="gap-1.5 text-xs">
                <Code className="h-3.5 w-3.5" />
                Output
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="flex-1 overflow-y-auto mt-0 p-4">
            {steps.length > 0 ? (
              <StepTimeline steps={steps} />
            ) : (
              <EmptyTabContent
                icon={<Activity className="h-10 w-10" />}
                title="No steps recorded"
                description="This execution did not record any step data."
              />
            )}
          </TabsContent>

          {/* Reasoning Tab */}
          <TabsContent value="reasoning" className="flex-1 overflow-y-auto mt-0 p-4">
            {thinkingSteps.length > 0 ? (
              <div className="space-y-3">
                {thinkingSteps.map((step: any) => (
                  <ReasoningStepCard key={step.id} step={step} />
                ))}
              </div>
            ) : (
              <EmptyTabContent
                icon={<Brain className="h-10 w-10" />}
                title="No reasoning data"
                description="This execution did not capture LLM reasoning steps."
              />
            )}
          </TabsContent>

          {/* Recording Tab */}
          <TabsContent value="recording" className="flex-1 overflow-y-auto mt-0 p-4">
            <SessionRecordingViewer
              sessionId={String(executionId)}
              recordingUrl={undefined} // Will be available when BrowserBase integration is complete
              recordingStatus="not_available"
            />
          </TabsContent>

          {/* Errors Tab */}
          {isFailed && (
            <TabsContent value="errors" className="flex-1 overflow-y-auto mt-0 p-4">
              <ErrorDetailPanel
                error={execution.error}
                status={execution.status || 'failed'}
                onRetry={handleRetry}
                isRetrying={retryMutation.isPending}
              />
            </TabsContent>
          )}

          {/* Output Tab */}
          <TabsContent value="output" className="flex-1 overflow-y-auto mt-0 p-4">
            <OutputViewer
              output={execution.output}
              plan={execution.plan}
              isExpanded={jsonExpanded}
              onToggleExpand={() => setJsonExpanded(!jsonExpanded)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function mapActionType(toolName: string): ExecutionStep['actionType'] {
  const lower = toolName.toLowerCase();
  if (lower.includes('navigate') || lower.includes('goto')) return 'navigate';
  if (lower.includes('click') || lower.includes('press')) return 'click';
  if (lower.includes('type') || lower.includes('fill') || lower.includes('input')) return 'type';
  if (lower.includes('extract') || lower.includes('scrape') || lower.includes('get')) return 'extract';
  if (lower.includes('observe') || lower.includes('look')) return 'observe';
  if (lower.includes('wait') || lower.includes('sleep')) return 'wait';
  if (lower.includes('screenshot') || lower.includes('capture')) return 'screenshot';
  return 'click'; // default
}

// ========================================
// SUB-COMPONENTS
// ========================================

function EmptyTabContent({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="opacity-30 mb-3">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs mt-1">{description}</p>
    </div>
  );
}

function ReasoningStepCard({ step }: { step: any }) {
  const time = step.timestamp
    ? new Date(step.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div className={`p-3 rounded-lg border ${
      step.toolUsed
        ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
        : 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
    }`}>
      <div className="flex items-start gap-2">
        <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {time && <span className="text-[10px] font-mono text-muted-foreground">{time}</span>}
            {step.phase && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">{step.phase}</Badge>
            )}
            {step.toolUsed && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                <Wrench className="h-2.5 w-2.5" />
                {step.toolUsed}
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed">{step.thought}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorDetailPanel({ error, status, onRetry, isRetrying }: {
  error: string | null | undefined;
  status: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const errorType = classifyError(error || '');

  return (
    <div className="space-y-4">
      {/* Error Classification */}
      <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/10">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            {errorType.category}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Error Message</p>
            <pre className="text-sm bg-background p-3 rounded border font-mono whitespace-pre-wrap break-words">
              {error || 'Unknown error'}
            </pre>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Classification</p>
            <Badge variant={errorType.recoverable ? 'secondary' : 'destructive'} className="text-xs">
              {errorType.recoverable ? 'Recoverable' : 'Non-recoverable'}
            </Badge>
          </div>

          {errorType.suggestion && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Action</p>
              <p className="text-sm">{errorType.suggestion}</p>
            </div>
          )}

          {errorType.recoverable && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              size="sm"
              className="gap-1.5"
            >
              {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Retry Execution
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OutputViewer({ output, plan, isExpanded, onToggleExpand }: {
  output: any;
  plan: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const handleCopy = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success('Copied to clipboard');
  };

  if (!output && !plan) {
    return (
      <EmptyTabContent
        icon={<Code className="h-10 w-10" />}
        title="No output data"
        description="This execution did not produce output data."
      />
    );
  }

  return (
    <div className="space-y-4">
      {output && (
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Execution Output
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => handleCopy(output)} className="h-7 gap-1">
              <Copy className="h-3 w-3" />
              Copy
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded border font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
              {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {plan && (
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Execution Plan
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => handleCopy(plan)} className="h-7 gap-1">
              <Copy className="h-3 w-3" />
              Copy
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded border font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto">
              {typeof plan === 'string' ? plan : JSON.stringify(plan, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========================================
// ERROR CLASSIFICATION
// ========================================

interface ErrorClassification {
  category: string;
  recoverable: boolean;
  suggestion?: string;
}

function classifyError(errorMessage: string): ErrorClassification {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      category: 'Timeout Error',
      recoverable: true,
      suggestion: 'The task took too long. Try breaking it into smaller steps or increasing the timeout.',
    };
  }

  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
    return {
      category: 'Rate Limit Error',
      recoverable: true,
      suggestion: 'API rate limit hit. Wait a moment and retry - the system will automatically back off.',
    };
  }

  if (lower.includes('network') || lower.includes('connection') || lower.includes('econnrefused') || lower.includes('fetch failed')) {
    return {
      category: 'Network Error',
      recoverable: true,
      suggestion: 'Network connectivity issue. Check your connection and retry.',
    };
  }

  if (lower.includes('auth') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('forbidden') || lower.includes('403')) {
    return {
      category: 'Authentication Error',
      recoverable: false,
      suggestion: 'Authentication failed. Check your credentials and API keys in Settings.',
    };
  }

  if (lower.includes('not found') || lower.includes('404') || lower.includes('element not found') || lower.includes('selector')) {
    return {
      category: 'Element Not Found',
      recoverable: true,
      suggestion: 'A page element was not found. The page layout may have changed. Try retrying or adjusting the task description.',
    };
  }

  if (lower.includes('cancelled') || lower.includes('canceled')) {
    return {
      category: 'Cancelled',
      recoverable: true,
      suggestion: 'Execution was cancelled. You can retry if needed.',
    };
  }

  if (lower.includes('500') || lower.includes('internal server') || lower.includes('server error')) {
    return {
      category: 'Server Error',
      recoverable: true,
      suggestion: 'The server encountered an error. This is usually temporary - try again.',
    };
  }

  return {
    category: 'Execution Error',
    recoverable: true,
    suggestion: 'An unexpected error occurred. Try retrying or modifying the task description.',
  };
}
