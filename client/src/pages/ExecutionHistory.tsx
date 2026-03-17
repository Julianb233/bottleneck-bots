import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ExternalLink,
  Timer,
  Activity,
  TrendingUp,
  Ban,
  Loader2,
  Download,
  Video,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ========================================
// STATUS HELPERS
// ========================================

type ExecutionStatus = "started" | "running" | "success" | "failed" | "timeout" | "cancelled" | "needs_input";

const STATUS_CONFIG: Record<
  ExecutionStatus,
  { label: string; color: string; icon: React.ElementType; badgeVariant: "default" | "secondary" | "destructive" | "outline" }
> = {
  started: { label: "Started", color: "text-blue-500", icon: Play, badgeVariant: "secondary" },
  running: { label: "Running", color: "text-blue-600", icon: Loader2, badgeVariant: "default" },
  success: { label: "Success", color: "text-emerald-600", icon: CheckCircle2, badgeVariant: "default" },
  failed: { label: "Failed", color: "text-red-600", icon: XCircle, badgeVariant: "destructive" },
  timeout: { label: "Timeout", color: "text-amber-600", icon: AlertTriangle, badgeVariant: "outline" },
  cancelled: { label: "Cancelled", color: "text-gray-500", icon: Ban, badgeVariant: "secondary" },
  needs_input: { label: "Needs Input", color: "text-purple-600", icon: AlertTriangle, badgeVariant: "outline" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as ExecutionStatus] ?? STATUS_CONFIG.started;
  const Icon = config.icon;
  return (
    <Badge variant={config.badgeVariant} className="gap-1">
      <Icon className={`h-3 w-3 ${config.color} ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "--";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// ========================================
// MAIN PAGE
// ========================================

export default function ExecutionHistory() {
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Detail view
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);

  // Queries
  const statsQuery = trpc.executionHistory.stats.useQuery();
  const taskTypesQuery = trpc.executionHistory.taskTypes.useQuery();

  const listQuery = trpc.executionHistory.list.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    taskType: taskTypeFilter === "all" ? undefined : taskTypeFilter,
    search: searchQuery || undefined,
  });

  const detailQuery = trpc.executionHistory.detail.useQuery(
    { executionId: selectedExecutionId! },
    { enabled: !!selectedExecutionId }
  );

  const stats = statsQuery.data;
  const list = listQuery.data;
  const detail = detailQuery.data;

  const totalPages = list ? Math.ceil(list.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Execution History</h1>
        <p className="text-muted-foreground">
          Review past task executions, inspect timelines, and replay browser sessions.
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Activity} label="Total Executions" value={stats.total} />
          <StatCard
            icon={CheckCircle2}
            label="Success Rate"
            value={`${stats.successRate}%`}
            color="text-emerald-600"
          />
          <StatCard
            icon={Timer}
            label="Avg Duration"
            value={formatDuration(stats.avgDuration)}
          />
          <StatCard
            icon={TrendingUp}
            label="Successful"
            value={stats.byStatus?.success ?? 0}
            color="text-emerald-600"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search executions..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
                <SelectItem value="needs_input">Needs Input</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={taskTypeFilter}
              onValueChange={(v) => {
                setTaskTypeFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(taskTypesQuery.data ?? []).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Execution list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Executions
            {list && (
              <span className="text-sm font-normal text-muted-foreground">
                ({list.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !list || list.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No executions found</p>
              <p className="text-sm">Run some agent tasks to see them here.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {list.items.map((item) => (
                  <ExecutionRow
                    key={item.id}
                    item={item}
                    onView={() => setSelectedExecutionId(item.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Execution Detail Dialog */}
      <ExecutionDetailDialog
        open={!!selectedExecutionId}
        onOpenChange={(open) => {
          if (!open) setSelectedExecutionId(null);
        }}
        detail={detail}
        isLoading={detailQuery.isLoading}
      />
    </div>
  );
}

// ========================================
// SUB-COMPONENTS
// ========================================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Icon className={`h-4 w-4 ${color ?? "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionRow({
  item,
  onView,
}: {
  item: any;
  onView: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onView}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusBadge status={item.status} />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {item.task?.title ?? `Execution #${item.id}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.startedAt
              ? formatDistanceToNow(new Date(item.startedAt), { addSuffix: true })
              : "--"}
            {item.task?.category && (
              <span className="ml-2 text-muted-foreground/70">
                {item.task.category}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">
            {item.stepsCompleted}/{item.stepsTotal} steps
          </p>
          <p className="text-xs text-muted-foreground">{formatDuration(item.duration)}</p>
        </div>
        {item.recordingUrl && (
          <Video className="h-4 w-4 text-blue-500" />
        )}
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ========================================
// DETAIL DIALOG
// ========================================

function ExecutionDetailDialog({
  open,
  onOpenChange,
  detail,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: any;
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {detail?.task?.title ?? `Execution #${detail?.id ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <ExecutionDetailContent detail={detail} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExecutionDetailContent({ detail }: { detail: any }) {
  return (
    <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="replay">Replay</TabsTrigger>
        <TabsTrigger value="export">Export</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="flex-1 min-h-0">
        <ScrollArea className="h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Status">
                <StatusBadge status={detail.status} />
              </InfoRow>
              <InfoRow label="Duration">{formatDuration(detail.duration)}</InfoRow>
              <InfoRow label="Steps">
                {detail.stepsCompleted}/{detail.stepsTotal}
              </InfoRow>
              <InfoRow label="Attempt">#{detail.attemptNumber}</InfoRow>
              <InfoRow label="Started">
                {detail.startedAt ? format(new Date(detail.startedAt), "PPp") : "--"}
              </InfoRow>
              <InfoRow label="Completed">
                {detail.completedAt ? format(new Date(detail.completedAt), "PPp") : "--"}
              </InfoRow>
            </div>

            {/* Task info */}
            {detail.task && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Task Details</h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {detail.task.taskType?.replace(/_/g, " ")}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Category:</span>{" "}
                      {detail.task.category}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Priority:</span>{" "}
                      <Badge variant="outline" className="text-xs">
                        {detail.task.priority}
                      </Badge>
                    </p>
                    {detail.task.description && (
                      <p className="text-muted-foreground mt-2">{detail.task.description}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Error details */}
            {detail.error && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">Error Details</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                    <p className="font-mono text-red-700">{detail.error}</p>
                    {detail.errorCode && (
                      <p className="text-xs text-red-500 mt-1">Code: {detail.errorCode}</p>
                    )}
                    {detail.errorStack && (
                      <details className="mt-2">
                        <summary className="text-xs text-red-500 cursor-pointer">
                          Stack Trace
                        </summary>
                        <pre className="text-xs mt-1 overflow-auto max-h-40 whitespace-pre-wrap text-red-600">
                          {detail.errorStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Output */}
            {detail.output && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Output</h4>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                    {typeof detail.output === "string"
                      ? detail.output
                      : JSON.stringify(detail.output, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      {/* Timeline Tab */}
      <TabsContent value="timeline" className="flex-1 min-h-0">
        <ScrollArea className="h-[60vh]">
          <TimelineView
            stepResults={detail.stepResults}
            logs={detail.logs}
            screenshots={detail.screenshots}
            startedAt={detail.startedAt}
          />
        </ScrollArea>
      </TabsContent>

      {/* Replay Tab */}
      <TabsContent value="replay" className="flex-1 min-h-0">
        <ReplayView
          browserSessionId={detail.browserSessionId}
          recordingUrl={detail.recordingUrl}
          debugUrl={detail.debugUrl}
        />
      </TabsContent>

      {/* Export Tab */}
      <TabsContent value="export" className="flex-1 min-h-0">
        <ExportView executionId={detail.id} />
      </TabsContent>
    </Tabs>
  );
}

// ========================================
// TIMELINE VIEW
// ========================================

function TimelineView({
  stepResults,
  logs,
  screenshots,
  startedAt,
}: {
  stepResults: any[];
  logs: any[];
  screenshots: any[];
  startedAt: string | null;
}) {
  // Merge step results and logs into a combined timeline
  const timelineEntries = useMemo(() => {
    const entries: Array<{
      type: "step" | "log" | "screenshot";
      timestamp: string | null;
      data: any;
    }> = [];

    // Add step results
    if (stepResults?.length) {
      stepResults.forEach((step, i) => {
        entries.push({
          type: "step",
          timestamp: step.timestamp || step.executedAt || null,
          data: { ...step, index: i },
        });
      });
    }

    // Add logs
    if (logs?.length) {
      logs.forEach((log) => {
        entries.push({
          type: "log",
          timestamp: log.timestamp || null,
          data: log,
        });
      });
    }

    // Add screenshots
    if (screenshots?.length) {
      screenshots.forEach((ss) => {
        entries.push({
          type: "screenshot",
          timestamp: ss.timestamp || null,
          data: ss,
        });
      });
    }

    // Sort by timestamp (entries without timestamps go last)
    entries.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return entries;
  }, [stepResults, logs, screenshots]);

  if (timelineEntries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No timeline data available</p>
        <p className="text-sm">Step details will appear here after an execution completes.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 pr-4 space-y-4">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

      {timelineEntries.map((entry, i) => (
        <div key={i} className="relative flex gap-3">
          {/* Dot */}
          <div
            className={`absolute -left-6 top-1 h-3 w-3 rounded-full border-2 ${
              entry.type === "step"
                ? entry.data.success === false
                  ? "bg-red-500 border-red-300"
                  : "bg-emerald-500 border-emerald-300"
                : entry.type === "screenshot"
                ? "bg-blue-500 border-blue-300"
                : "bg-gray-400 border-gray-300"
            }`}
          />

          <div className="flex-1 min-w-0">
            {entry.type === "step" && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">
                    Step {entry.data.index + 1}:{" "}
                    {entry.data.toolName || entry.data.action || entry.data.name || "Action"}
                  </p>
                  {entry.data.durationMs && (
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(entry.data.durationMs)}
                    </span>
                  )}
                </div>
                {/* LLM reasoning */}
                {entry.data.reasoning && (
                  <p className="text-xs text-blue-600 italic mb-1">
                    Reasoning: {entry.data.reasoning}
                  </p>
                )}
                {/* Parameters */}
                {entry.data.parameters && (
                  <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">Parameters</summary>
                    <pre className="mt-1 overflow-auto max-h-24 whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(entry.data.parameters, null, 2)}
                    </pre>
                  </details>
                )}
                {/* Result */}
                {entry.data.result && (
                  <details className="text-xs mt-1">
                    <summary className="text-muted-foreground cursor-pointer">Result</summary>
                    <pre className="mt-1 overflow-auto max-h-24 whitespace-pre-wrap text-muted-foreground">
                      {typeof entry.data.result === "string"
                        ? entry.data.result
                        : JSON.stringify(entry.data.result, null, 2)}
                    </pre>
                  </details>
                )}
                {/* Error */}
                {entry.data.error && (
                  <p className="text-xs text-red-600 mt-1">Error: {entry.data.error}</p>
                )}
                {entry.timestamp && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(entry.timestamp), "HH:mm:ss.SSS")}
                  </p>
                )}
              </div>
            )}

            {entry.type === "log" && (
              <div className="text-sm">
                <span
                  className={`text-xs font-mono ${
                    entry.data.level === "error"
                      ? "text-red-600"
                      : entry.data.level === "warn"
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }`}
                >
                  [{entry.data.level?.toUpperCase() ?? "INFO"}]
                </span>{" "}
                <span className="text-muted-foreground">{entry.data.message}</span>
                {entry.timestamp && (
                  <span className="text-xs text-muted-foreground/60 ml-2">
                    {format(new Date(entry.timestamp), "HH:mm:ss")}
                  </span>
                )}
              </div>
            )}

            {entry.type === "screenshot" && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Screenshot</p>
                {entry.data.url ? (
                  <img
                    src={entry.data.url}
                    alt={entry.data.description || "Screenshot"}
                    className="rounded border max-h-48 object-contain"
                  />
                ) : entry.data.base64 ? (
                  <img
                    src={`data:image/png;base64,${entry.data.base64}`}
                    alt={entry.data.description || "Screenshot"}
                    className="rounded border max-h-48 object-contain"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Screenshot data unavailable</p>
                )}
                {entry.data.description && (
                  <p className="text-xs text-muted-foreground mt-1">{entry.data.description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================================
// REPLAY VIEW
// ========================================

function ReplayView({
  browserSessionId,
  recordingUrl,
  debugUrl,
}: {
  browserSessionId: string | null;
  recordingUrl: string | null;
  debugUrl: string | null;
}) {
  if (!browserSessionId && !recordingUrl) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No browser recording</p>
        <p className="text-sm">
          This execution did not include a browser session, so there is no replay available.
        </p>
      </div>
    );
  }

  const bbReplayUrl = browserSessionId
    ? `https://www.browserbase.com/sessions/${browserSessionId}`
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium">BrowserBase Session Replay</h4>
        <p className="text-sm text-muted-foreground">
          View the full browser session recording on BrowserBase. This includes every page
          navigation, click, and input the agent performed.
        </p>

        <div className="flex flex-wrap gap-2">
          {bbReplayUrl && (
            <Button asChild variant="default" size="sm">
              <a href={bbReplayUrl} target="_blank" rel="noopener noreferrer">
                <Play className="h-4 w-4 mr-2" />
                Open BrowserBase Replay
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          )}

          {recordingUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={recordingUrl} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4 mr-2" />
                Direct Recording Link
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          )}

          {debugUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={debugUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                Debug URL
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Embedded iframe for Browserbase replay */}
      {bbReplayUrl && (
        <div className="rounded-lg border overflow-hidden bg-black">
          <iframe
            src={bbReplayUrl}
            className="w-full h-[400px]"
            title="Session Replay"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center">
        <p>
          Session ID: <code className="bg-muted px-1 rounded">{browserSessionId}</code>
        </p>
      </div>
    </div>
  );
}

// ========================================
// EXPORT VIEW
// ========================================

function ExportView({ executionId }: { executionId: number }) {
  const [isExporting, setIsExporting] = useState(false);
  const reportQuery = trpc.executionHistory.exportReport.useQuery(
    { executionId },
    { enabled: false }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await reportQuery.refetch();
      if (result.data) {
        // Generate a printable HTML report and trigger download
        const report = result.data;
        const html = generateReportHTML(report);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `execution-report-${executionId}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">Export Execution Report</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Download a detailed HTML report of this execution including task details,
          step timeline, and results. Open the downloaded file in a browser and use Print
          to save as PDF.
        </p>
        <Button onClick={handleExport} disabled={isExporting} size="sm">
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isExporting ? "Generating..." : "Download Report"}
        </Button>
      </div>
    </div>
  );
}

// ========================================
// HELPERS
// ========================================

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function generateReportHTML(report: any): string {
  const statusColor =
    report.status === "success"
      ? "#10B981"
      : report.status === "failed"
      ? "#EF4444"
      : "#F59E0B";

  const steps = (report.stepResults ?? [])
    .map(
      (step: any, i: number) => `
    <div style="border-left: 3px solid ${step.success === false ? "#EF4444" : "#10B981"}; padding: 8px 12px; margin: 8px 0; background: #f9fafb; border-radius: 4px;">
      <strong>Step ${i + 1}: ${step.toolName || step.action || step.name || "Action"}</strong>
      ${step.reasoning ? `<p style="color: #3B82F6; font-style: italic; margin: 4px 0;">Reasoning: ${step.reasoning}</p>` : ""}
      ${step.durationMs ? `<span style="color: #6B7280; font-size: 12px;">${step.durationMs}ms</span>` : ""}
      ${step.error ? `<p style="color: #EF4444; margin: 4px 0;">Error: ${step.error}</p>` : ""}
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Execution Report - ${report.title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1F2937; }
h1 { border-bottom: 3px solid #4F46E5; padding-bottom: 10px; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
.meta-item { background: #f9fafb; padding: 12px; border-radius: 8px; }
.meta-label { font-size: 12px; color: #6B7280; text-transform: uppercase; }
.meta-value { font-size: 18px; font-weight: 600; }
.status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; color: white; background: ${statusColor}; }
.footer { margin-top: 40px; border-top: 2px solid #E5E7EB; padding-top: 12px; text-align: center; color: #9CA3AF; font-size: 12px; }
</style></head><body>
<h1>${report.title}</h1>
<p style="color: #6B7280;">Execution Report - Generated ${report.generatedAt ? new Date(report.generatedAt).toLocaleString() : ""}</p>
<div class="meta">
  <div class="meta-item"><div class="meta-label">Status</div><div><span class="status">${report.status}</span></div></div>
  <div class="meta-item"><div class="meta-label">Duration</div><div class="meta-value">${formatDuration(report.duration)}</div></div>
  <div class="meta-item"><div class="meta-label">Steps</div><div class="meta-value">${report.stepsCompleted}/${report.stepsTotal}</div></div>
  <div class="meta-item"><div class="meta-label">Started</div><div class="meta-value" style="font-size:14px">${report.startedAt ? new Date(report.startedAt).toLocaleString() : "--"}</div></div>
</div>
${report.taskDescription ? `<h2>Task Description</h2><p>${report.taskDescription}</p>` : ""}
${report.error ? `<h2 style="color:#EF4444">Error</h2><pre style="background:#FEF2F2;padding:12px;border-radius:8px;overflow:auto">${report.error}</pre>` : ""}
${steps ? `<h2>Step Timeline</h2>${steps}` : ""}
<div class="footer"><p>Generated by Bottleneck Bots</p></div>
</body></html>`;
}
