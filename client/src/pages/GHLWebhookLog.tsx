/**
 * GHL Webhook Event Log
 *
 * View recent inbound webhook events and their processing status.
 * Includes dead letter queue management for failed events.
 * Uses direct fetch to the webhook REST endpoints since these aren't on tRPC.
 *
 * Linear: AI-5214
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Webhook,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface WebhookHealth {
  status: string;
  configured: boolean;
  supportedEvents: string[];
  deadLetterCount: number;
  workflowQueueAvailable: boolean;
  timestamp: string;
}

interface DLQEntry {
  id: number;
  eventId: string | null;
  eventType: string;
  locationId: string | null;
  payload: any;
  error: string;
  retryCount: number;
  maxRetries: number;
  lastRetriedAt: string | null;
  resolved: boolean;
  createdAt: string;
}

export default function GHLWebhookLog() {
  const [health, setHealth] = useState<WebhookHealth | null>(null);
  const [dlqItems, setDlqItems] = useState<DLQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlqLoading, setDlqLoading] = useState(true);
  const [selectedPayload, setSelectedPayload] = useState<any>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/ghl/webhooks/health');
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch {
      // Health endpoint not available
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDLQ = useCallback(async () => {
    setDlqLoading(true);
    try {
      const res = await fetch('/api/ghl/webhooks/dlq');
      if (res.ok) {
        const data = await res.json();
        setDlqItems(data.items || []);
      }
    } catch {
      // DLQ endpoint not available
    } finally {
      setDlqLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchDLQ();
  }, [fetchHealth, fetchDLQ]);

  const retryDLQEntry = async (id: number) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/ghl/webhooks/dlq/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        toast.success('Event reprocessed successfully');
        fetchDLQ();
        fetchHealth();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Retry failed');
      }
    } catch {
      toast.error('Failed to retry event');
    } finally {
      setRetryingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="h-6 w-6" /> Webhook Event Log
          </h1>
          <p className="text-muted-foreground text-sm">
            Monitor GHL webhook events and failed event queue
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchHealth();
            fetchDLQ();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Health Overview */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : health ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={health.status === 'ok' ? 'default' : 'destructive'}>
                  {health.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Configured</p>
                {health.configured ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Failed Events</p>
                <span className={`text-lg font-bold ${health.deadLetterCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {health.deadLetterCount}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Queue Available</p>
                {health.workflowQueueAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Webhook endpoint not reachable. Ensure the server is running.
          </CardContent>
        </Card>
      )}

      {/* Supported Events */}
      {health?.supportedEvents && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Supported Event Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {health.supportedEvents.map((evt) => (
                <Badge key={evt} variant="outline" className="text-xs">
                  {evt}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dead Letter Queue */}
      <Tabs defaultValue="dlq">
        <TabsList>
          <TabsTrigger value="dlq" className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Dead Letter Queue
            {dlqItems.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs h-5 min-w-5 px-1">
                {dlqItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dlq">
          <Card>
            <CardContent className="p-0">
              {dlqLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : dlqItems.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  No failed events. All webhooks processed successfully.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dlqItems.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.eventType}
                          </Badge>
                          {entry.locationId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Location: {entry.locationId.slice(0, 12)}...
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-destructive max-w-[300px] truncate" title={entry.error}>
                            {entry.error}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {entry.retryCount} / {entry.maxRetries}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="View payload"
                              onClick={() => setSelectedPayload(entry.payload)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={entry.retryCount >= entry.maxRetries || retryingId === entry.id}
                              onClick={() => retryDLQEntry(entry.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              {retryingId === entry.id ? 'Retrying...' : 'Retry'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payload Viewer Dialog */}
      <Dialog open={!!selectedPayload} onOpenChange={(open) => !open && setSelectedPayload(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Event Payload</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-[60vh]">
            {JSON.stringify(selectedPayload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
