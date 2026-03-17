import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Workflow,
  GitBranch,
  ListOrdered,
} from 'lucide-react';

// Types

type Platform = 'general' | 'ghl' | 'hubspot' | 'salesforce';
type StepAction = 'Navigate' | 'Click' | 'Type' | 'Extract' | 'API Call' | 'Wait' | 'Verify';

interface WorkflowStep {
  order: number;
  action: StepAction;
  description: string;
  expectedInput?: string;
  expectedOutput?: string;
}

interface WorkflowFormData {
  name: string;
  description: string;
  platform: Platform;
  steps: WorkflowStep[];
}

interface WorkflowEntry {
  id: number;
  name?: string;
  context?: string;
  content?: string;
  description?: string;
  platform?: string;
  steps?: WorkflowStep[];
  createdAt: string | Date;
}

// Constants

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'ghl', label: 'GoHighLevel' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'salesforce', label: 'Salesforce' },
];

const PLATFORM_BADGE_COLORS: Record<Platform, string> = {
  general: 'bg-gray-100 text-gray-700',
  ghl: 'bg-emerald-100 text-emerald-700',
  hubspot: 'bg-orange-100 text-orange-700',
  salesforce: 'bg-blue-100 text-blue-700',
};

const STEP_ACTIONS: StepAction[] = [
  'Navigate',
  'Click',
  'Type',
  'Extract',
  'API Call',
  'Wait',
  'Verify',
];

const EMPTY_STEP: WorkflowStep = {
  order: 1,
  action: 'Navigate',
  description: '',
  expectedInput: '',
  expectedOutput: '',
};

const EMPTY_FORM: WorkflowFormData = {
  name: '',
  description: '',
  platform: 'general',
  steps: [{ ...EMPTY_STEP }],
};

// Helper: parse stored workflow content into display fields
function parseWorkflowContent(entry: WorkflowEntry): {
  name: string;
  description: string;
  platform: Platform;
  stepCount: number;
  steps: WorkflowStep[];
} {
  // Backend spreads parsed content onto the row, so fields may be top-level
  const name = entry.name ?? entry.context ?? 'Untitled Workflow';
  const description = entry.description ?? '';
  const platform = (entry.platform ?? 'general') as Platform;
  const steps = Array.isArray(entry.steps) ? entry.steps : [];
  return { name, description, platform, stepCount: steps.length, steps };
}

// Sub-components

function StepRow({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  onChange: (updated: WorkflowStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Step header row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center">
          {step.order}
        </span>

        <div className="flex-1 min-w-0">
          <Select
            value={step.action}
            onValueChange={(val) => onChange({ ...step, action: val as StepAction })}
          >
            <SelectTrigger className="h-7 text-xs w-36 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_ACTIONS.map((a) => (
                <SelectItem key={a} value={a} className="text-xs">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          className="h-7 text-xs flex-1"
          placeholder="Describe this step..."
          value={step.description}
          onChange={(e) => onChange({ ...step, description: e.target.value })}
        />

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-emerald-600"
            onClick={() => setExpanded((p) => !p)}
            title="Show optional fields"
          >
            <ChevronDown
              className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-400 hover:text-red-600"
            onClick={onRemove}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Optional fields */}
      {expanded && (
        <div className="grid grid-cols-2 gap-3 p-3 border-t border-gray-100 bg-white">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Expected Input (optional)</Label>
            <Input
              className="h-7 text-xs"
              placeholder="e.g. contact email address"
              value={step.expectedInput ?? ''}
              onChange={(e) => onChange({ ...step, expectedInput: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Expected Output (optional)</Label>
            <Input
              className="h-7 text-xs"
              placeholder="e.g. confirmation message"
              value={step.expectedOutput ?? ''}
              onChange={(e) => onChange({ ...step, expectedOutput: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: WorkflowEntry;
  onEdit: (entry: WorkflowEntry) => void;
  onDelete: (id: number) => void;
}) {
  const { name, description, platform, stepCount } = parseWorkflowContent(entry);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-emerald-50 rounded-lg flex-shrink-0 mt-0.5">
              <Workflow className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{name}</p>
              {description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    PLATFORM_BADGE_COLORS[platform]
                  )}
                >
                  {PLATFORMS.find((p) => p.value === platform)?.label ?? platform}
                </span>
                <span className="text-xs text-gray-400">
                  <ListOrdered className="w-3 h-3 inline mr-1" />
                  {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-emerald-600"
              onClick={() => onEdit(entry)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-600"
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main component

export default function WorkflowsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<WorkflowFormData>(EMPTY_FORM);

  const workflowsQuery = trpc.agentTraining.listWorkflows.useQuery();

  const createMutation = trpc.agentTraining.createWorkflow.useMutation({
    onSuccess: () => {
      toast.success('Workflow created');
      resetForm();
      void workflowsQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed to create workflow: ${err.message}`),
  });

  const updateMutation = trpc.agentTraining.updateWorkflow.useMutation({
    onSuccess: () => {
      toast.success('Workflow updated');
      resetForm();
      void workflowsQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed to update workflow: ${err.message}`),
  });

  const deleteMutation = trpc.agentTraining.deleteWorkflow.useMutation({
    onSuccess: () => {
      toast.success('Workflow deleted');
      void workflowsQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed to delete workflow: ${err.message}`),
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(entry: WorkflowEntry) {
    const parsed = parseWorkflowContent(entry);
    setForm({
      name: parsed.name,
      description: parsed.description,
      platform: parsed.platform,
      steps: parsed.steps.length > 0 ? parsed.steps : [{ ...EMPTY_STEP }],
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { ...EMPTY_STEP, order: prev.steps.length + 1 },
      ],
    }));
  }

  function updateStep(index: number, updated: WorkflowStep) {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = updated;
      return { ...prev, steps };
    });
  }

  function removeStep(index: number) {
    setForm((prev) => {
      const steps = prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, steps: steps.length > 0 ? steps : [{ ...EMPTY_STEP }] };
    });
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    setForm((prev) => {
      const steps = [...prev.steps];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= steps.length) return prev;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps: steps.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    if (form.steps.some((s) => !s.description.trim())) {
      toast.error('All steps must have a description');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      platform: form.platform,
      steps: form.steps,
    };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  // Backend returns { success, workflows } — each workflow has content spread onto it
  const entries: WorkflowEntry[] = (workflowsQuery.data?.workflows ?? []) as WorkflowEntry[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Workflow Training</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define step-by-step procedures your agent will follow
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={openCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Workflow
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <Card className="border-emerald-200 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-600" />
              {editingId !== null ? 'Edit Workflow' : 'New Workflow'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wf-name">Name *</Label>
                  <Input
                    id="wf-name"
                    placeholder="e.g. Contact Import Flow"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wf-platform">Platform</Label>
                  <Select
                    value={form.platform}
                    onValueChange={(val) => setForm((p) => ({ ...p, platform: val as Platform }))}
                  >
                    <SelectTrigger id="wf-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((plat) => (
                        <SelectItem key={plat.value} value={plat.value}>
                          {plat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wf-desc">Description</Label>
                <Textarea
                  id="wf-desc"
                  placeholder="What does this workflow accomplish?"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Steps *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addStep}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Step
                  </Button>
                </div>

                <div className="space-y-2">
                  {form.steps.map((step, i) => (
                    <StepRow
                      key={i}
                      step={step}
                      index={i}
                      total={form.steps.length}
                      onChange={(updated) => updateStep(i, updated)}
                      onRemove={() => removeStep(i)}
                      onMoveUp={() => moveStep(i, 'up')}
                      onMoveDown={() => moveStep(i, 'down')}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {isSaving ? 'Saving...' : editingId !== null ? 'Save Changes' : 'Create Workflow'}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workflows list */}
      {workflowsQuery.isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Workflow className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No workflows yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Click "Add Workflow" to create your first automation workflow
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {entries.map((entry) => (
            <WorkflowCard
              key={entry.id}
              entry={entry}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
