import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  History,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface StepResult {
  stepId: string;
  status: string;
  output?: unknown;
  error?: string;
  duration?: number;
}

const PAGE_SIZE = 20;

const statusConfig: Record<ExecutionStatus, { icon: React.ElementType; color: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  completed: { icon: CheckCircle, color: 'text-green-500', variant: 'default' },
  failed: { icon: XCircle, color: 'text-red-500', variant: 'destructive' },
  running: { icon: Loader2, color: 'text-blue-500', variant: 'default' },
  pending: { icon: Clock, color: 'text-slate-400', variant: 'outline' },
  cancelled: { icon: AlertCircle, color: 'text-slate-400', variant: 'secondary' },
};

function formatDuration(ms: number | null | undefined) {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ExecutionHistory() {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [selectedExecution, setSelectedExecution] = useState<number | null>(null);

  const { data: executions, isLoading, refetch } = trpc.pipelines.getAllExecutions.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const replayMutation = trpc.pipelines.replayExecution.useMutation({
    onSuccess: (data) => {
      toast.success(`Replay started (execution #${data.executionId})`);
      refetch();
    },
    onError: (err) => {
      toast.error(`Replay failed: ${err.message}`);
    },
  });

  const handleReplay = (executionId: number) => {
    replayMutation.mutate({ executionId });
  };

  const hasMore = executions && executions.length === PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Execution History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View past agent runs and replay them
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as ExecutionStatus | 'all');
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Execution list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !executions || executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No executions found</p>
            <p className="text-sm mt-1">
              {statusFilter !== 'all'
                ? 'Try changing the status filter'
                : 'Execute a pipeline to see history here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {executions.map((exec) => {
            const status = exec.status as ExecutionStatus;
            const config = statusConfig[status] || statusConfig.pending;
            const Icon = config.icon;
            const isRunning = status === 'running';

            return (
              <Card
                key={exec.id}
                className="hover:border-slate-300 transition-colors cursor-pointer"
                onClick={() => setSelectedExecution(exec.id)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Icon
                        className={`h-5 w-5 ${config.color} ${isRunning ? 'animate-spin' : ''}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {exec.pipelineName}
                          </span>
                          <Badge variant={config.variant} className="text-xs capitalize">
                            {status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            #{exec.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{formatDate(exec.startedAt)}</span>
                          <span>{formatDuration(exec.duration)}</span>
                          <span>
                            {exec.currentStepIndex}/{exec.totalSteps} steps
                          </span>
                        </div>
                        {exec.error && (
                          <p className="text-xs text-destructive mt-1 line-clamp-1">
                            {exec.error}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExecution(exec.id);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Inspect
                      </Button>
                      {status !== 'running' && status !== 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReplay(exec.id);
                          }}
                          disabled={replayMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Replay
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Execution detail dialog */}
      {selectedExecution !== null && (
        <ExecutionDetailDialog
          executionId={selectedExecution}
          onClose={() => setSelectedExecution(null)}
          onReplay={() => handleReplay(selectedExecution)}
          isReplaying={replayMutation.isPending}
        />
      )}
    </div>
  );
}

function ExecutionDetailDialog({
  executionId,
  onClose,
  onReplay,
  isReplaying,
}: {
  executionId: number;
  onClose: () => void;
  onReplay: () => void;
  isReplaying: boolean;
}) {
  const { data: execution, isLoading } = trpc.pipelines.getExecution.useQuery(
    { executionId },
    { enabled: executionId > 0 }
  );

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4 py-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!execution) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execution Not Found</DialogTitle>
            <DialogDescription>Could not load execution #{executionId}.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const status = (execution.status || 'pending') as ExecutionStatus;
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const stepResults = (execution.stepResults || []) as StepResult[];
  const inputData = execution.input as Record<string, unknown> | null;
  const outputData = execution.output as Record<string, unknown> | null;
  const canReplay = status !== 'running' && status !== 'pending';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            Execution #{executionId}
            <Badge variant={config.variant} className="capitalize">
              {status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Pipeline #{execution.pipelineId} | Started {formatDate(execution.startedAt)} |
            Duration {formatDuration(execution.duration)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="steps" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="steps">Steps ({stepResults.length})</TabsTrigger>
            <TabsTrigger value="io">Input / Output</TabsTrigger>
            <TabsTrigger value="error">
              {execution.error ? 'Error' : 'Details'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="steps" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {stepResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No step results recorded
                  </p>
                ) : (
                  stepResults.map((step, index) => {
                    const stepStatus = step.status as ExecutionStatus;
                    const stepConfig = statusConfig[stepStatus] || statusConfig.pending;
                    const StepIcon = stepConfig.icon;
                    return (
                      <Card key={step.stepId || index} className="border-slate-200">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <StepIcon
                                className={`h-4 w-4 ${stepConfig.color}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  Step {index + 1}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {step.stepId}
                                </Badge>
                                <Badge variant={stepConfig.variant} className="text-xs capitalize">
                                  {step.status}
                                </Badge>
                                {step.duration != null && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(step.duration)}
                                  </span>
                                )}
                              </div>
                              {step.error && (
                                <p className="text-xs text-destructive mt-1 line-clamp-2">
                                  {step.error}
                                </p>
                              )}
                              {step.output != null ? (
                                <pre className="text-xs bg-slate-50 rounded p-2 mt-2 overflow-x-auto max-h-24">
                                  {JSON.stringify(step.output, null, 2)}
                                </pre>
                              ) : null}
                            </div>
                            {index < stepResults.length - 1 && (
                              <ArrowRight className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="io" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Input Variables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inputData && Object.keys(inputData).length > 0 ? (
                      <pre className="text-xs bg-slate-50 rounded p-3 overflow-x-auto">
                        {JSON.stringify(inputData, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">No input variables</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Output</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {outputData && Object.keys(outputData).length > 0 ? (
                      <pre className="text-xs bg-slate-50 rounded p-3 overflow-x-auto">
                        {JSON.stringify(outputData, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">No output data</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="error" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {execution.error ? (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-900 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Error
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-sm text-red-800 whitespace-pre-wrap font-mono">
                        {execution.error}
                      </pre>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No errors recorded for this execution</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Execution Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Execution ID</dt>
                      <dd className="font-mono">{executionId}</dd>
                      <dt className="text-muted-foreground">Pipeline ID</dt>
                      <dd className="font-mono">{execution.pipelineId}</dd>
                      <dt className="text-muted-foreground">Total Steps</dt>
                      <dd>{execution.totalSteps}</dd>
                      <dt className="text-muted-foreground">Current Step</dt>
                      <dd>{execution.currentStepIndex}</dd>
                      <dt className="text-muted-foreground">Started</dt>
                      <dd>{execution.startedAt ? new Date(execution.startedAt).toLocaleString() : '-'}</dd>
                      <dt className="text-muted-foreground">Completed</dt>
                      <dd>{execution.completedAt ? new Date(execution.completedAt).toLocaleString() : '-'}</dd>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canReplay && (
            <Button onClick={onReplay} disabled={isReplaying}>
              <Play className="h-4 w-4 mr-1" />
              {isReplaying ? 'Replaying...' : 'Replay'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
