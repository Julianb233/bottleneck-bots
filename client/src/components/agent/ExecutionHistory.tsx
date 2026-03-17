import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Pause,
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

type ExecutionStatus = 'started' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | 'needs_input';

interface ExecutionHistoryProps {
  onSelectExecution?: (executionId: string) => void;
  selectedExecutionId?: string;
}

export function ExecutionHistory({
  onSelectExecution,
  selectedExecutionId,
}: ExecutionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showStats, setShowStats] = useState(true);

  const { data: executions, isLoading } = trpc.agent.listExecutions.useQuery({
    limit: 50,
    ...(statusFilter !== 'all' ? { status: statusFilter as ExecutionStatus } : {}),
  });

  // Filter by search query
  const filteredExecutions = useMemo(() => {
    if (!executions) return [];
    if (!searchQuery.trim()) return executions;

    const query = searchQuery.toLowerCase();
    return executions.filter((exec) => {
      const title = exec.task?.title?.toLowerCase() || '';
      const description = exec.task?.description?.toLowerCase() || '';
      const id = String(exec.id);
      return title.includes(query) || description.includes(query) || id.includes(query);
    });
  }, [executions, searchQuery]);

  // Compute status summary
  const statusSummary = useMemo(() => {
    if (!executions) return null;
    const summary = { total: executions.length, success: 0, failed: 0, running: 0 };
    for (const exec of executions) {
      if (exec.status === 'success') summary.success++;
      else if (exec.status === 'failed' || exec.status === 'timeout') summary.failed++;
      else if (exec.status === 'running' || exec.status === 'started') summary.running++;
    }
    return summary;
  }, [executions]);

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case 'started':
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'failed':
      case 'timeout':
        return <XCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      case 'needs_input':
        return <Pause className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case 'started':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'running':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
      case 'timeout':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'cancelled':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'needs_input':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="h-full flex flex-col border-r border-gray-200 bg-white">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm text-gray-900">Execution History</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>

        {/* Status summary bar */}
        {showStats && statusSummary && statusSummary.total > 0 && (
          <div className="flex gap-1.5 mb-2">
            <div className="flex-1 bg-gray-50 rounded px-2 py-1 text-center">
              <div className="text-xs font-bold text-gray-700">{statusSummary.total}</div>
              <div className="text-[9px] text-gray-400">Total</div>
            </div>
            <div className="flex-1 bg-green-50 rounded px-2 py-1 text-center">
              <div className="text-xs font-bold text-green-600">{statusSummary.success}</div>
              <div className="text-[9px] text-gray-400">Pass</div>
            </div>
            <div className="flex-1 bg-red-50 rounded px-2 py-1 text-center">
              <div className="text-xs font-bold text-red-600">{statusSummary.failed}</div>
              <div className="text-[9px] text-gray-400">Fail</div>
            </div>
            {statusSummary.running > 0 && (
              <div className="flex-1 bg-blue-50 rounded px-2 py-1 text-center">
                <div className="text-xs font-bold text-blue-600">{statusSummary.running}</div>
                <div className="text-[9px] text-gray-400">Live</div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Search executions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              <SelectValue placeholder="Filter by status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="needs_input">Needs Input</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            <p className="text-xs text-gray-500 mt-2">Loading executions...</p>
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-sm text-gray-500 mt-2">
              {searchQuery || statusFilter !== 'all' ? 'No matching executions' : 'No executions yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Submit a task to get started'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredExecutions.map((execution) => (
              <button
                key={execution.id}
                onClick={() => onSelectExecution?.(String(execution.id))}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  'hover:shadow-sm hover:border-emerald-300',
                  selectedExecutionId === String(execution.id)
                    ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                    : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className={cn('mt-0.5', getStatusColor(execution.status as ExecutionStatus))}>
                    {getStatusIcon(execution.status as ExecutionStatus)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {execution.task?.title || `Task #${execution.taskId}`}
                    </p>
                    {execution.task?.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {execution.task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatRelativeTime(execution.startedAt)}</span>
                  <div className="flex items-center gap-2">
                    {execution.stepsCompleted != null && execution.stepsTotal != null && execution.stepsTotal > 0 && (
                      <span className="text-[10px] text-gray-400">
                        {execution.stepsCompleted}/{execution.stepsTotal} steps
                      </span>
                    )}
                    {execution.duration != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(execution.duration)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                      getStatusColor(execution.status as ExecutionStatus)
                    )}
                  >
                    {execution.status}
                  </span>
                  {execution.attemptNumber != null && execution.attemptNumber > 1 && (
                    <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                      <RotateCcw className="w-2.5 h-2.5" />
                      Attempt {execution.attemptNumber}
                    </span>
                  )}
                </div>

                {/* Error preview for failed executions */}
                {execution.error && (execution.status === 'failed' || execution.status === 'timeout') && (
                  <div className="mt-2 p-1.5 bg-red-50 border border-red-100 rounded text-[10px] text-red-600 line-clamp-2">
                    {execution.error}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
