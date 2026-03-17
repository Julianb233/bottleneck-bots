import React from 'react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExecutionHistoryPanelProps {
  taskId: number;
  taskName: string;
}

type ExecutionStatus = 'success' | 'failed' | 'timeout' | 'running' | 'queued' | 'cancelled';

export function ExecutionHistoryPanel({ taskId, taskName: _taskName }: ExecutionHistoryPanelProps) {
  const { data, isLoading } = trpc.scheduledTasks.getExecutionHistory.useQuery({
    taskId,
    page: 1,
    pageSize: 20,
  });

  const executions = data?.executions ?? [];

  const getStatusIcon = (status: ExecutionStatus | string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-slate-400" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
      default:
        return <Play className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusVariant = (
    status: ExecutionStatus | string
  ): 'default' | 'destructive' | 'secondary' | 'outline' => {
    switch (status) {
      case 'success':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'timeout':
        return 'secondary';
      case 'running':
        return 'default';
      case 'queued':
        return 'outline';
      case 'cancelled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No executions yet</p>
        <p className="text-xs mt-1">
          Run the task manually or wait for the next scheduled run
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700">
          Execution History ({data?.pagination.totalCount ?? 0})
        </h3>
      </div>

      {executions.map((execution: any) => (
        <Card key={execution.id} className="border-slate-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(execution.status)}
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={getStatusVariant(execution.status)}
                      className="text-xs capitalize"
                    >
                      {execution.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {execution.triggerType}
                    </span>
                    {execution.attemptNumber > 1 && (
                      <Badge variant="outline" className="text-xs">
                        Attempt #{execution.attemptNumber}
                      </Badge>
                    )}
                  </div>
                  {execution.error && (
                    <p className="text-xs text-destructive mt-1 line-clamp-1">
                      {execution.error}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground space-y-0.5">
                <p>{formatDate(execution.startedAt)}</p>
                <p>{formatDuration(execution.duration)}</p>
              </div>
            </div>

            {/* Debug/Recording URLs */}
            {(execution.debugUrl || execution.recordingUrl) && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                {execution.debugUrl && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" asChild>
                    <a href={execution.debugUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Debug
                    </a>
                  </Button>
                )}
                {execution.recordingUrl && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" asChild>
                    <a href={execution.recordingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Recording
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
