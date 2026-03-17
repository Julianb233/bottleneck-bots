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
  EmptyContent
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SessionRecordingViewer } from '@/components/browser/SessionRecordingViewer';
import { trpc } from '@/lib/trpc';
import {
  History,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Pause,
  Clock,
  ExternalLink,
  Download,
  Play,
  Eye,
  ChevronLeft,
  ChevronRight,
  Video,
  FileText,
  Brain,
  Monitor,
  RotateCcw,
  Timer,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

// ========================================
// TYPES
// ========================================

type ExecutionStatus = 'started' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | 'needs_input';
type DateRange = 'all' | 'today' | 'week' | 'month';

interface StepResult {
  tool?: string;
  action?: string;
  result?: string;
  error?: string;
  duration?: number;
  timestamp?: string;
  screenshot?: string;
  reasoning?: string;
}

// ========================================
// HELPERS
// ========================================

function getStatusIcon(status: ExecutionStatus) {
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
}

function getStatusBadgeVariant(status: ExecutionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success':
      return 'default';
    case 'running':
    case 'started':
      return 'secondary';
    case 'failed':
    case 'timeout':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusColor(status: ExecutionStatus) {
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
}

function formatDuration(ms?: number | null) {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(date: Date | string) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(date);
}

function filterByDateRange(date: Date | string, range: DateRange): boolean {
  if (range === 'all') return true;
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return d >= today;
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return d >= monthAgo;
    }
    default:
      return true;
  }
}

// ========================================
// EXPORT REPORT
// ========================================

function generateExecutionReport(execution: any): string {
  const lines: string[] = [];
  lines.push('# Execution Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(`- **Execution ID:** ${execution.id}`);
  lines.push(`- **Status:** ${execution.status}`);
  lines.push(`- **Task:** ${execution.task?.title || `Task #${execution.taskId}`}`);
  if (execution.task?.description) {
    lines.push(`- **Description:** ${execution.task.description}`);
  }
  lines.push(`- **Started:** ${execution.startedAt ? formatDate(execution.startedAt) : 'N/A'}`);
  lines.push(`- **Completed:** ${execution.completedAt ? formatDate(execution.completedAt) : 'N/A'}`);
  lines.push(`- **Duration:** ${formatDuration(execution.duration)}`);
  lines.push(`- **Steps:** ${execution.stepsCompleted || 0}/${execution.stepsTotal || 0}`);
  if (execution.attemptNumber && execution.attemptNumber > 1) {
    lines.push(`- **Attempt:** ${execution.attemptNumber}`);
  }
  lines.push('');

  if (execution.error) {
    lines.push('## Error');
    lines.push(`\`\`\`\n${execution.error}\n\`\`\``);
    lines.push('');
  }

  const steps = execution.toolHistory || execution.stepResults || [];
  if (Array.isArray(steps) && steps.length > 0) {
    lines.push('## Execution Steps');
    steps.forEach((step: StepResult, i: number) => {
      lines.push(`### Step ${i + 1}: ${step.tool || step.action || 'Unknown'}`);
      if (step.reasoning) lines.push(`**Reasoning:** ${step.reasoning}`);
      if (step.result) lines.push(`**Result:** ${step.result}`);
      if (step.error) lines.push(`**Error:** ${step.error}`);
      if (step.duration) lines.push(`**Duration:** ${formatDuration(step.duration)}`);
      lines.push('');
    });
  }

  if (execution.output) {
    lines.push('## Output');
    lines.push(`\`\`\`json\n${JSON.stringify(execution.output, null, 2)}\n\`\`\``);
  }

  return lines.join('\n');
}

function downloadReport(execution: any) {
  const report = generateExecutionReport(execution);
  const blob = new Blob([report], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `execution-${execution.id}-report.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Report downloaded');
}

// ========================================
// EXECUTION DETAIL MODAL
// ========================================

function ExecutionDetailModal({
  executionId,
  open,
  onClose,
}: {
  executionId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: execution, isLoading } = trpc.agent.getExecution.useQuery(
    { executionId },
    { enabled: open && executionId > 0 }
  );

  const steps: StepResult[] = useMemo(() => {
    if (!execution) return [];
    const raw = execution.toolHistory || execution.thinkingSteps || [];
    return Array.isArray(raw) ? raw : [];
  }, [execution]);

  const [activeTab, setActiveTab] = useState<'timeline' | 'output' | 'replay'>('timeline');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Execution Details
            {execution && (
              <Badge
                variant={getStatusBadgeVariant(execution.status as ExecutionStatus)}
                className="ml-2"
              >
                {execution.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !execution ? (
          <div className="text-center py-16 text-gray-500">
            Execution not found
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Summary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Task</div>
                <div className="text-sm font-medium truncate mt-1">
                  {execution.task?.title || `Task #${execution.taskId}`}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Duration</div>
                <div className="text-sm font-medium mt-1 flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {formatDuration(execution.duration)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Steps</div>
                <div className="text-sm font-medium mt-1">
                  {execution.stepsCompleted || 0}/{execution.stepsTotal || 0}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Started</div>
                <div className="text-sm font-medium mt-1">
                  {execution.startedAt ? formatRelativeTime(execution.startedAt) : '-'}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Attempt</div>
                <div className="text-sm font-medium mt-1">
                  #{execution.attemptNumber || 1}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b">
              <button
                onClick={() => setActiveTab('timeline')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'timeline'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  Timeline
                </div>
              </button>
              <button
                onClick={() => setActiveTab('output')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'output'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Output
                </div>
              </button>
              <button
                onClick={() => setActiveTab('replay')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'replay'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Video className="h-4 w-4" />
                  Replay
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <ScrollArea className="flex-1 max-h-[50vh]">
              {activeTab === 'timeline' && (
                <div className="space-y-1 pr-4">
                  {steps.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No step data available for this execution</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-3 bottom-3 w-px bg-gray-200" />

                      {steps.map((step, index) => {
                        const isError = !!step.error;
                        const isLast = index === steps.length - 1;
                        return (
                          <div key={index} className="relative pl-10 pb-4">
                            {/* Timeline dot */}
                            <div
                              className={cn(
                                'absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2',
                                isError
                                  ? 'bg-red-100 border-red-400'
                                  : isLast && execution.status === 'success'
                                  ? 'bg-green-100 border-green-400'
                                  : 'bg-white border-gray-300'
                              )}
                            />

                            <div
                              className={cn(
                                'rounded-lg border p-3',
                                isError ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-gray-400">
                                    #{index + 1}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {step.tool || step.action || 'Step'}
                                  </span>
                                </div>
                                {step.duration != null && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(step.duration)}
                                  </span>
                                )}
                              </div>

                              {step.reasoning && (
                                <div className="mt-2 flex items-start gap-1.5">
                                  <Brain className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                                  <p className="text-xs text-purple-700 leading-relaxed">
                                    {step.reasoning}
                                  </p>
                                </div>
                              )}

                              {step.result && !step.error && (
                                <p className="text-xs text-gray-600 mt-1.5 line-clamp-3">
                                  {typeof step.result === 'string'
                                    ? step.result
                                    : JSON.stringify(step.result)}
                                </p>
                              )}

                              {step.error && (
                                <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 font-mono">
                                  {step.error}
                                </div>
                              )}

                              {step.screenshot && (
                                <button
                                  onClick={() => setSelectedScreenshot(step.screenshot!)}
                                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <Monitor className="h-3 w-3" />
                                  View Screenshot
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Error display for failed executions */}
                  {execution.error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Execution Error</span>
                      </div>
                      <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap break-words">
                        {execution.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'output' && (
                <div className="pr-4">
                  {execution.output ? (
                    <pre className="bg-gray-50 border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap break-words overflow-auto">
                      {typeof execution.output === 'string'
                        ? execution.output
                        : JSON.stringify(execution.output, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No output data available</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'replay' && (
                <div className="pr-4">
                  {(execution as any).browserSessionId ? (
                    <div className="space-y-4">
                      {(execution as any).recordingUrl ? (
                        <SessionRecordingViewer
                          sessionId={(execution as any).browserSessionId}
                          recordingUrl={(execution as any).recordingUrl}
                          recordingStatus="COMPLETE"
                        />
                      ) : (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <Video className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-500 mb-3">
                              Recording not available. Open in BrowserBase to view session.
                            </p>
                            {(execution as any).debugUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open((execution as any).debugUrl, '_blank')
                                }
                                className="gap-1.5"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open Debug View
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* BrowserBase session link */}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <Monitor className="h-3 w-3" />
                          Session: {(execution as any).browserSessionId?.slice(0, 12)}...
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const url = `https://www.browserbase.com/sessions/${(execution as any).browserSessionId}`;
                            window.open(url, '_blank');
                          }}
                          className="h-7 gap-1 text-xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                          BrowserBase
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Video className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No browser session was used for this execution</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                {(execution as any).browserSessionId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `https://www.browserbase.com/sessions/${(execution as any).browserSessionId}`;
                      window.open(url, '_blank');
                    }}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    View Replay
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadReport(execution)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export Report
              </Button>
            </div>
          </div>
        )}

        {/* Screenshot overlay */}
        {selectedScreenshot && (
          <Dialog open={!!selectedScreenshot} onOpenChange={() => setSelectedScreenshot(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Screenshot</DialogTitle>
              </DialogHeader>
              <img
                src={selectedScreenshot}
                alt="Step screenshot"
                className="w-full rounded-lg border"
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// MAIN PAGE
// ========================================

export default function ExecutionHistory() {
  const [, setLocation] = useLocation();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Detail modal
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);

  // Data
  const { data: executions, isLoading, refetch } = trpc.agent.listExecutions.useQuery({
    limit: 100,
    ...(statusFilter !== 'all' ? { status: statusFilter as ExecutionStatus } : {}),
  });

  const { data: stats } = trpc.agent.getStats.useQuery();

  // Filter executions
  const filteredExecutions = useMemo(() => {
    if (!executions) return [];

    return executions.filter((exec) => {
      // Date range filter
      if (!filterByDateRange(exec.startedAt, dateRange)) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = exec.task?.title?.toLowerCase() || '';
        const description = exec.task?.description?.toLowerCase() || '';
        const id = String(exec.id);
        const category = exec.task?.category?.toLowerCase() || '';
        if (
          !title.includes(query) &&
          !description.includes(query) &&
          !id.includes(query) &&
          !category.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [executions, dateRange, searchQuery]);

  // Paginate
  const paginatedExecutions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExecutions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExecutions, currentPage]);

  const totalPages = Math.ceil(filteredExecutions.length / itemsPerPage);

  // Reset page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', onClick: () => setLocation('/') },
              { label: 'Execution History' },
            ]}
          />
          <h1 className="text-3xl font-bold flex items-center gap-2 mt-4">
            <History className="h-8 w-8" />
            Execution History
          </h1>
          <p className="text-muted-foreground mt-1">
            Review past task executions, view step-by-step timelines, and replay sessions
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <CardTitle className="text-sm font-medium text-slate-600">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <TrendingUp className="h-5 w-5" />
              {stats?.successRate != null ? `${Math.round(stats.successRate)}%` : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Succeeded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.byStatus?.success ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(stats?.byStatus?.failed ?? 0) + (stats?.byStatus?.timeout ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <Timer className="h-5 w-5 text-slate-400" />
              {formatDuration(stats?.averageDuration)}
            </div>
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
                  placeholder="Search by task name, description, or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleFilterChange();
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="needs_input">Needs Input</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Select
              value={dateRange}
              onValueChange={(v: DateRange) => {
                setDateRange(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full md:w-48">
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

      {/* Executions Table */}
      <Card>
        {isLoading ? (
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-400" />
            <p className="text-slate-600">Loading executions...</p>
          </CardContent>
        ) : paginatedExecutions.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No executions found</EmptyTitle>
              <EmptyDescription>
                {searchQuery || statusFilter !== 'all' || dateRange !== 'all'
                  ? 'No executions match your filters. Try adjusting your search criteria.'
                  : 'Run your first agent task to see execution history here.'}
              </EmptyDescription>
            </EmptyHeader>
            {(searchQuery || statusFilter !== 'all' || dateRange !== 'all') && (
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDateRange('all');
                    setCurrentPage(1);
                  }}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear Filters
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExecutions.map((execution) => (
                  <TableRow
                    key={execution.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedExecutionId(execution.id)}
                  >
                    <TableCell className="font-mono text-xs text-gray-500">
                      #{execution.id}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {execution.task?.title || `Task #${execution.taskId}`}
                        </p>
                        {execution.task?.category && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {execution.task.category}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                          getStatusColor(execution.status as ExecutionStatus)
                        )}
                      >
                        {getStatusIcon(execution.status as ExecutionStatus)}
                        {execution.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {execution.stepsCompleted != null && execution.stepsTotal != null
                        ? `${execution.stepsCompleted}/${execution.stepsTotal}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        {formatDuration(execution.duration)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatRelativeTime(execution.startedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExecutionId(execution.id);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {execution.attemptNumber != null && execution.attemptNumber > 1 && (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <RotateCcw className="h-2.5 w-2.5" />
                            {execution.attemptNumber}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
                    {Math.min(currentPage * itemsPerPage, filteredExecutions.length)} of{' '}
                    {filteredExecutions.length} executions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
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
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Execution Detail Modal */}
      {selectedExecutionId && (
        <ExecutionDetailModal
          executionId={selectedExecutionId}
          open={!!selectedExecutionId}
          onClose={() => setSelectedExecutionId(null)}
        />
      )}
    </div>
  );
}
