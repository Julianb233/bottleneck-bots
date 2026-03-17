import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Clock,
  Play,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
} from 'lucide-react';

interface ExecutionHistoryPanelProps {
  taskId: number;
  taskName: string;
}

type ExecutionStatus = 'success' | 'failed' | 'timeout' | 'running' | 'queued' | 'cancelled';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ExecutionHistoryPanel({ taskId, taskName: _taskName }: ExecutionHistoryPanelProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pageSize = 10;

  const { data, isLoading, refetch } = trpc.scheduledTasks.getExecutionHistory.useQuery({
    taskId,
    page,
    pageSize,
    ...(statusFilter !== 'all' ? { status: statusFilter as any } : {}),
  });

  const executions = data?.executions ?? [];
  const pagination = data?.pagination;

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
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {pagination?.totalCount ?? 0} execution{(pagination?.totalCount ?? 0) !== 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {executions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {statusFilter !== 'all' ? 'No executions match this filter' : 'No executions yet'}
          </p>
          <p className="text-xs mt-1">
            {statusFilter !== 'all'
              ? 'Try changing the status filter'
              : 'Run the task manually or wait for the next scheduled run'}
          </p>
        </div>
      )}

      {/* Execution list */}
      {executions.map((execution: any) => (
        <Card key={execution.id} className="border-slate-200 hover:border-slate-300 transition-colors">
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
                    <p className="text-xs text-destructive mt-1 line-clamp-2 max-w-md">
                      {execution.error}
                    </p>
                  )}
                  {execution.stepsCompleted > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Steps: {execution.stepsCompleted}
                      {execution.stepsTotal ? ` / ${execution.stepsTotal}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground space-y-0.5">
                <p title={formatFullDate(execution.startedAt)}>{formatDate(execution.startedAt)}</p>
                <p className="font-medium text-slate-700">{formatDuration(execution.duration)}</p>
                {execution.completedAt && (
                  <p className="text-[10px]">
                    Ended: {formatDate(execution.completedAt)}
                  </p>
                )}
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

            {/* Output preview */}
            {execution.output && execution.status === 'success' && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-xs text-muted-foreground mb-1">Output:</p>
                <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto max-h-24 text-slate-700">
                  {typeof execution.output === 'string'
                    ? execution.output.substring(0, 500)
                    : JSON.stringify(execution.output, null, 2).substring(0, 500)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
