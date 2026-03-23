/**
 * GHL Pipeline Board
 *
 * Kanban-style view of opportunities grouped by pipeline stage.
 * Supports moving opportunities between stages and creating new ones.
 *
 * Linear: AI-5214
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  Plus,
  ArrowRight,
  RefreshCw,
  Kanban,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

export default function GHLPipeline() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'won' | 'lost' | 'abandoned' | 'all'>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    contactId: '',
    stageId: '',
    monetaryValue: '',
  });
  const [moveDialog, setMoveDialog] = useState<{ opp: any; targetStageId: string } | null>(null);

  const { data: pipelines, isLoading: pipelinesLoading } = trpc.ghl.listPipelines.useQuery();

  // Auto-select first pipeline
  const activePipelineId = selectedPipelineId || (pipelines as any)?.pipelines?.[0]?.id || '';
  const activePipeline = (pipelines as any)?.pipelines?.find((p: any) => p.id === activePipelineId);

  const {
    data: oppsData,
    isLoading: oppsLoading,
    refetch,
  } = trpc.ghl.searchOpportunities.useQuery(
    {
      pipelineId: activePipelineId,
      status: statusFilter,
      limit: 100,
    },
    { enabled: !!activePipelineId }
  );

  const updateMutation = trpc.ghl.updateOpportunity.useMutation({
    onSuccess: () => {
      toast.success('Opportunity updated');
      setMoveDialog(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.ghl.createOpportunity.useMutation({
    onSuccess: () => {
      toast.success('Opportunity created');
      setCreateOpen(false);
      setCreateForm({ name: '', contactId: '', stageId: '', monetaryValue: '' });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const opportunities = (oppsData as any)?.opportunities ?? oppsData ?? [];
  const stages = activePipeline?.stages ?? [];

  // Group opportunities by stage
  const oppsByStage = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const stage of stages) {
      grouped[stage.id] = [];
    }
    for (const opp of opportunities as any[]) {
      const stageId = opp.pipelineStageId || opp.stageId;
      if (grouped[stageId]) {
        grouped[stageId].push(opp);
      } else {
        // Unmatched stage — put in first column
        const firstStageId = stages[0]?.id;
        if (firstStageId && grouped[firstStageId]) {
          grouped[firstStageId].push(opp);
        }
      }
    }
    return grouped;
  }, [opportunities, stages]);

  const formatCurrency = (val: number | string | null | undefined) => {
    if (val == null) return null;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return null;
    return `$${num.toLocaleString()}`;
  };

  if (pipelinesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Kanban className="h-6 w-6" /> Pipeline Board
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage opportunities across pipeline stages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button
            size="sm"
            disabled={!activePipelineId}
            onClick={() => {
              setCreateForm((f) => ({ ...f, stageId: stages[0]?.id || '' }));
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> New Opportunity
          </Button>
        </div>
      </div>

      {/* Pipeline & status selector */}
      <div className="flex gap-3 items-center">
        <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select pipeline" />
          </SelectTrigger>
          <SelectContent>
            {((pipelines as any)?.pipelines ?? []).map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban board */}
      {!activePipelineId ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No pipelines found. Connect a GHL location with active pipelines.
          </CardContent>
        </Card>
      ) : oppsLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage: any) => {
            const stageOpps = oppsByStage[stage.id] || [];
            const totalValue = stageOpps.reduce((sum: number, o: any) => {
              const val = parseFloat(o.monetaryValue ?? '0');
              return sum + (isNaN(val) ? 0 : val);
            }, 0);

            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className="mb-3 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{stage.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {stageOpps.length}
                    </Badge>
                  </div>
                  {totalValue > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(totalValue)} total
                    </p>
                  )}
                </div>

                <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2">
                  {stageOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No opportunities
                    </p>
                  ) : (
                    stageOpps.map((opp: any) => (
                      <Card key={opp.id} className="shadow-sm">
                        <CardContent className="p-3 space-y-2">
                          <p className="font-medium text-sm leading-tight">{opp.name}</p>
                          {opp.monetaryValue && (
                            <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(opp.monetaryValue)}
                            </p>
                          )}
                          {opp.contact && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {opp.contact.firstName} {opp.contact.lastName}
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <Badge
                              variant={
                                opp.status === 'won' ? 'default' :
                                opp.status === 'lost' ? 'destructive' :
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {opp.status}
                            </Badge>
                            {/* Move to next stage button */}
                            {stages.indexOf(stage) < stages.length - 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Move to next stage"
                                onClick={() =>
                                  setMoveDialog({
                                    opp,
                                    targetStageId: stages[stages.indexOf(stage) + 1].id,
                                  })
                                }
                              >
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Move Confirmation Dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(open) => !open && setMoveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Opportunity</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move <strong>{moveDialog?.opp?.name}</strong> to{' '}
            <strong>{stages.find((s: any) => s.id === moveDialog?.targetStageId)?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialog(null)}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                moveDialog &&
                updateMutation.mutate({
                  opportunityId: moveDialog.opp.id,
                  stageId: moveDialog.targetStageId,
                })
              }
            >
              {updateMutation.isPending ? 'Moving...' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Opportunity Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Opportunity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Deal name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contact ID</label>
              <Input
                value={createForm.contactId}
                onChange={(e) => setCreateForm((f) => ({ ...f, contactId: e.target.value }))}
                placeholder="GHL Contact ID"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Stage</label>
              <Select
                value={createForm.stageId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, stageId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Value ($)</label>
              <Input
                type="number"
                value={createForm.monetaryValue}
                onChange={(e) => setCreateForm((f) => ({ ...f, monetaryValue: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={createMutation.isPending || !createForm.name || !createForm.contactId || !createForm.stageId}
              onClick={() =>
                createMutation.mutate({
                  pipelineId: activePipelineId,
                  stageId: createForm.stageId,
                  contactId: createForm.contactId,
                  name: createForm.name,
                  monetaryValue: createForm.monetaryValue ? parseFloat(createForm.monetaryValue) : undefined,
                })
              }
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
