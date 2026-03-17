import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Timer,
  Zap,
  TrendingUp,
  FileText,
  Video,
  Ban,
  ArrowUpDown,
} from 'lucide-react';
import { useLocation } from 'wouter';

type ExecutionStatus = 'all' | 'success' | 'failed' | 'cancelled' | 'running' | 'started' | 'timeout' | 'needs_input';
type DateRange = 'all' | 'today' | 'week' | 'month';
type TriggerType = 'all' | 'automatic' | 'manual' | 'retry' | 'scheduled';

function getStatusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary" className="gap-1"><Ban className="h-3 w-3" />Cancelled</Badge>;
    case 'running':
    case 'started':
      return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1"><Play className="h-3 w-3" />Running</Badge>;
    case 'timeout':
      return <Badge variant="outline" className="text-orange-600 border-orange-300 gap-1"><Clock className="h-3 w-3" />Timeout</Badge>;
    case 'needs_input':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300 gap-1"><AlertTriangle className="h-3 w-3" />Needs Input</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatDate(date: string | Date | null): string {
  if (!date) return '--';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateRangeParams(dateRange: DateRange): { dateFrom?: string; dateTo?: string } {
  if (dateRange === 'all') return {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (dateRange) {
    case 'today':
      return { dateFrom: today.toISOString() };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { dateFrom: weekAgo.toISOString() };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { dateFrom: monthAgo.toISOString() };
    }
    default:
      return {};
  }
}

// ========================================
// EXECUTION DETAIL PANEL
// ========================================

function ExecutionDetailPanel({ executionId, onClose }: { executionId: number; onClose: () => void }) {
  const { data: execution, isLoading } = trpc.executionHistory.getDetail.useQuery(
    { executionId },
    { enabled: !!executionId }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center p-12 text-slate-500">Execution not found</div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executionData = execution as Record<string, any>;
  const stepResults: any[] = Array.isArray(executionData.stepResults) ? executionData.stepResults : [];
  const logs: any[] = Array.isArray(executionData.logs) ? executionData.logs : [];
  const screenshots: any[] = Array.isArray(executionData.screenshots) ? executionData.screenshots : [];

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto">
      {/* Execution Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{execution.taskTitle}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
            <span>Attempt #{execution.attemptNumber}</span>
            <span>-</span>
            <span>{execution.taskType}</span>
            <span>-</span>
            <span>{execution.triggeredBy}</span>
          </div>
        </div>
        {getStatusBadge(execution.status)}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Timer className="h-4 w-4 mx-auto mb-1 text-slate-400" />
            <div className="text-sm font-medium">{formatDuration(execution.duration)}</div>
            <div className="text-xs text-slate-500">Duration</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="h-4 w-4 mx-auto mb-1 text-slate-400" />
            <div className="text-sm font-medium">{execution.stepsCompleted}/{execution.stepsTotal}</div>
            <div className="text-xs text-slate-500">Steps</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-slate-400" />
            <div className="text-sm font-medium">{formatDate(execution.startedAt)}</div>
            <div className="text-xs text-slate-500">Started</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-slate-400" />
            <div className="text-sm font-medium">{execution.completedAt ? formatDate(execution.completedAt) : '--'}</div>
            <div className="text-xs text-slate-500">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* BrowserBase Replay */}
      {(execution.recordingUrl || execution.browserSessionId) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="h-4 w-4" />
              Session Replay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {execution.recordingUrl && (
              <div className="rounded-lg border bg-slate-50 overflow-hidden">
                <iframe
                  src={execution.recordingUrl}
                  className="w-full h-64 border-0"
                  title="Session Recording"
                  allow="autoplay"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            )}
            <div className="flex gap-2">
              {execution.recordingUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(execution.recordingUrl!, '_blank')}
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Full Replay
                </Button>
              )}
              {execution.browserSessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://www.browserbase.com/sessions/${execution.browserSessionId}`, '_blank')}
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  BrowserBase Session
                </Button>
              )}
              {execution.debugUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(execution.debugUrl!, '_blank')}
                  className="gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Debug View
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step-by-step Timeline */}
      {(stepResults as any[]).length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Execution Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-4">
                {stepResults.map((step: any, index: number) => (
                  <div key={index} className="relative flex items-start gap-4 pl-2">
                    <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      step.status === 'success' ? 'border-green-500 bg-green-50' :
                      step.status === 'failed' ? 'border-red-500 bg-red-50' :
                      step.status === 'running' ? 'border-blue-500 bg-blue-50' :
                      'border-slate-300 bg-white'
                    }`}>
                      {step.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : step.status === 'failed' ? (
                        <XCircle className="h-3 w-3 text-red-600" />
                      ) : step.status === 'running' ? (
                        <Play className="h-3 w-3 text-blue-600" />
                      ) : (
                        <Clock className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{step.name || step.action || `Step ${index + 1}`}</p>
                        {step.duration && (
                          <span className="text-xs text-slate-500">{formatDuration(step.duration)}</span>
                        )}
                      </div>
                      {step.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                      )}
                      {step.reasoning && (
                        <div className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-600 border">
                          <span className="font-medium">AI Reasoning:</span> {step.reasoning}
                        </div>
                      )}
                      {step.error && (
                        <div className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                          {step.error}
                        </div>
                      )}
                      {step.screenshot && (
                        <div className="mt-1">
                          <img
                            src={step.screenshot}
                            alt={`Step ${index + 1} screenshot`}
                            className="rounded border max-h-32 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Screenshots Gallery */}
      {screenshots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Screenshots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {screenshots.map((screenshot: any, index: number) => (
                <div key={index} className="rounded border overflow-hidden">
                  <img
                    src={typeof screenshot === 'string' ? screenshot : screenshot.url}
                    alt={typeof screenshot === 'string' ? `Screenshot ${index + 1}` : screenshot.label || `Screenshot ${index + 1}`}
                    className="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(typeof screenshot === 'string' ? screenshot : screenshot.url, '_blank')}
                  />
                  {typeof screenshot !== 'string' && screenshot.label && (
                    <div className="text-xs text-slate-500 p-1 text-center">{screenshot.label}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
              {logs.map((log: any, index: number) => (
                <div key={index} className={`py-0.5 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  <span className="text-slate-500">[{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : index}]</span>{' '}
                  {log.message || (typeof log === 'string' ? log : JSON.stringify(log))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Details */}
      {execution.error && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded bg-red-50 p-3 border border-red-200">
              <p className="text-sm text-red-800 font-medium">{execution.error}</p>
              {execution.errorCode && (
                <p className="text-xs text-red-600 mt-1">Code: {execution.errorCode}</p>
              )}
            </div>
            {execution.errorStack && (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Stack Trace</summary>
                <pre className="mt-1 bg-slate-900 text-slate-300 p-2 rounded overflow-x-auto text-[10px]">
                  {execution.errorStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Output */}
      {executionData.output ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-50 rounded p-3 text-xs overflow-x-auto border max-h-48">
              {JSON.stringify(executionData.output, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ========================================
// MAIN EXECUTION HISTORY PAGE
// ========================================

export default function ExecutionHistory() {
  const [, setLocation] = useLocation();

  // Filters
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerType>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Detail view
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);

  // Build query params
  const dateParams = getDateRangeParams(dateRange);
  const queryParams = {
    ...(statusFilter !== 'all' ? {
      statuses: statusFilter === 'running'
        ? ['started' as const, 'running' as const]
        : [statusFilter as any]
    } : {}),
    ...(triggerFilter !== 'all' ? { triggeredBy: triggerFilter as any } : {}),
    ...(taskTypeFilter !== 'all' ? { taskType: taskTypeFilter } : {}),
    ...dateParams,
    limit: itemsPerPage,
    offset: (currentPage - 1) * itemsPerPage,
  };

  const { data, isLoading, refetch } = trpc.executionHistory.list.useQuery(queryParams, {
    retry: false,
    refetchInterval: 10000,
  });

  const { data: taskTypes } = trpc.executionHistory.getTaskTypes.useQuery();

  const executions = data?.executions ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', onClick: () => setLocation('/dashboard') },
              { label: 'Execution History' },
            ]}
          />
          <h1 className="text-3xl font-bold flex items-center gap-2 mt-4">
            <History className="h-8 w-8" />
            Execution History
          </h1>
          <p className="text-muted-foreground mt-1">
            View past task executions, replay browser sessions, and debug failures
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.success ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failed ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.running ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(stats?.avgDuration ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by task name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ExecutionStatus); setCurrentPage(1); }}>
              <SelectTrigger className="w-full md:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
              </SelectContent>
            </Select>

            {/* Task Type Filter */}
            <Select value={taskTypeFilter} onValueChange={(v) => { setTaskTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full md:w-48">
                <Zap className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(taskTypes ?? []).map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Trigger Filter */}
            <Select value={triggerFilter} onValueChange={(v) => { setTriggerFilter(v as TriggerType); setCurrentPage(1); }}>
              <SelectTrigger className="w-full md:w-40">
                <Play className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Triggers</SelectItem>
                <SelectItem value="automatic">Automatic</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="retry">Retry</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setCurrentPage(1); }}>
              <SelectTrigger className="w-full md:w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Executions List */}
      <div className="space-y-2">
        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-slate-600">Loading executions...</p>
            </CardContent>
          </Card>
        ) : executions.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No executions found</EmptyTitle>
              <EmptyDescription>
                {statusFilter !== 'all' || dateRange !== 'all' || triggerFilter !== 'all' || taskTypeFilter !== 'all'
                  ? 'No executions match your filters. Try adjusting your search or filter criteria.'
                  : 'Task executions will appear here once your agents start running tasks.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Task</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Trigger</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Steps</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Duration</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Started</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">Replay</th>
                      <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((execution) => (
                      <tr
                        key={execution.id}
                        className="border-b hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedExecutionId(execution.id)}
                      >
                        <td className="p-3">
                          <div className="max-w-[200px]">
                            <p className="text-sm font-medium truncate">{execution.taskTitle}</p>
                            <p className="text-xs text-slate-500">Attempt #{execution.attemptNumber}</p>
                          </div>
                        </td>
                        <td className="p-3">{getStatusBadge(execution.status)}</td>
                        <td className="p-3">
                          <span className="text-xs text-slate-600">{execution.taskType?.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{execution.triggeredBy}</Badge>
                        </td>
                        <td className="p-3">
                          <span className="text-sm">{execution.stepsCompleted}/{execution.stepsTotal}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-mono">{formatDuration(execution.duration)}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-slate-600">{formatDate(execution.startedAt)}</span>
                        </td>
                        <td className="p-3">
                          {(execution.recordingUrl || execution.browserSessionId) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-blue-600 hover:text-blue-700 h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = execution.recordingUrl ||
                                  `https://www.browserbase.com/sessions/${execution.browserSessionId}`;
                                window.open(url, '_blank');
                              }}
                            >
                              <Video className="h-3 w-3" />
                              Replay
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">--</span>
                          )}
                        </td>
                        <td className="p-3">
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPage * itemsPerPage, total)} of {total} executions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={i}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Detail Dialog */}
      <Dialog open={!!selectedExecutionId} onOpenChange={(open) => { if (!open) setSelectedExecutionId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
          </DialogHeader>
          {selectedExecutionId && (
            <ExecutionDetailPanel
              executionId={selectedExecutionId}
              onClose={() => setSelectedExecutionId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
