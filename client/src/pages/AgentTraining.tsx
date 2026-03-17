import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Plus,
  Trash2,
  RefreshCw,
  GraduationCap,
  Workflow,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  BookOpen,
  Settings2,
  Play,
  ArrowUpDown,
  ChevronRight,
  Copy,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ========================================
// TYPES
// ========================================

interface ActionStep {
  order: number;
  action: 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'screenshot' | 'scroll';
  selector?: string;
  instruction?: string;
  value?: string;
  waitFor?: string;
  timeout?: number;
}

interface WorkflowTemplate {
  taskType: string;
  taskName: string;
  pageUrl: string;
  steps: ActionStep[];
  category: string;
  description: string;
}

// ========================================
// CONSTANTS
// ========================================

const GHL_CATEGORIES = [
  { value: 'contacts', label: 'Contacts & CRM' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'calendars', label: 'Calendars & Appointments' },
  { value: 'opportunities', label: 'Opportunities & Pipelines' },
  { value: 'payments', label: 'Payments & Invoices' },
  { value: 'marketing', label: 'Marketing & Campaigns' },
  { value: 'automation', label: 'Automations & Workflows' },
  { value: 'funnels', label: 'Funnels & Websites' },
  { value: 'reputation', label: 'Reputation & Reviews' },
  { value: 'reporting', label: 'Reporting & Analytics' },
  { value: 'settings', label: 'Settings & Configuration' },
  { value: 'custom', label: 'Custom Workflow' },
];

const ACTION_TYPES: { value: ActionStep['action']; label: string }[] = [
  { value: 'navigate', label: 'Navigate to URL' },
  { value: 'click', label: 'Click Element' },
  { value: 'type', label: 'Type Text' },
  { value: 'extract', label: 'Extract Data' },
  { value: 'wait', label: 'Wait' },
  { value: 'screenshot', label: 'Take Screenshot' },
  { value: 'scroll', label: 'Scroll' },
];

const EMPTY_STEP: ActionStep = {
  order: 0,
  action: 'click',
  selector: '',
  instruction: '',
  value: '',
};

// ========================================
// SUBCOMPONENTS
// ========================================

function StatsCards({
  patternsCount,
  feedbackCount,
  systemStats,
}: {
  patternsCount: number;
  feedbackCount: number;
  systemStats: { totalPatterns: number; totalSelectors: number; avgPatternSuccessRate: number } | null;
}) {
  const avgSuccess = systemStats?.avgPatternSuccessRate ?? 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Workflow className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{patternsCount}</p>
              <p className="text-xs text-gray-500">Trained Patterns</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{systemStats?.totalSelectors ?? 0}</p>
              <p className="text-xs text-gray-500">Learned Selectors</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgSuccess > 0 ? `${Math.round(avgSuccess)}%` : '--'}</p>
              <p className="text-xs text-gray-500">Success Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{feedbackCount}</p>
              <p className="text-xs text-gray-500">Feedback Entries</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepEditor({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: ActionStep;
  index: number;
  onChange: (step: ActionStep) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold flex-shrink-0 mt-1">
        {index + 1}
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Action</label>
          <Select
            value={step.action}
            onValueChange={(v) => onChange({ ...step, action: v as ActionStep['action'] })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            {step.action === 'navigate' ? 'URL' : 'Selector'}
          </label>
          <Input
            className="h-9"
            placeholder={step.action === 'navigate' ? 'https://app.gohighlevel.com/...' : 'button.submit, #element-id'}
            value={step.selector || ''}
            onChange={(e) => onChange({ ...step, selector: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-500 mb-1 block">
            Instruction (natural language for Stagehand)
          </label>
          <Input
            className="h-9"
            placeholder='e.g. "click the Add Contact button" or "type {{firstName}} into the first name field"'
            value={step.instruction || ''}
            onChange={(e) => onChange({ ...step, instruction: e.target.value })}
          />
        </div>
        {(step.action === 'type' || step.action === 'extract') && (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              {step.action === 'type' ? 'Value / Variable' : 'Extract Target'}
            </label>
            <Input
              className="h-9"
              placeholder={step.action === 'type' ? '{{variableName}} or literal text' : 'Field to extract'}
              value={step.value || ''}
              onChange={(e) => onChange({ ...step, value: e.target.value })}
            />
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0 mt-1"
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function WorkflowTemplateDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: WorkflowTemplate) => void;
  initialData?: WorkflowTemplate | null;
}) {
  const [taskType, setTaskType] = useState(initialData?.taskType || '');
  const [taskName, setTaskName] = useState(initialData?.taskName || '');
  const [pageUrl, setPageUrl] = useState(initialData?.pageUrl || '');
  const [category, setCategory] = useState(initialData?.category || 'custom');
  const [description, setDescription] = useState(initialData?.description || '');
  const [steps, setSteps] = useState<ActionStep[]>(
    initialData?.steps || [{ ...EMPTY_STEP, order: 0 }]
  );

  // Reset form when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      setTaskType(initialData?.taskType || '');
      setTaskName(initialData?.taskName || '');
      setPageUrl(initialData?.pageUrl || '');
      setCategory(initialData?.category || 'custom');
      setDescription(initialData?.description || '');
      setSteps(initialData?.steps || [{ ...EMPTY_STEP, order: 0 }]);
    }
  }, [open, initialData]);

  const addStep = () => {
    setSteps([...steps, { ...EMPTY_STEP, order: steps.length }]);
  };

  const updateStep = (index: number, updatedStep: ActionStep) => {
    const newSteps = [...steps];
    newSteps[index] = { ...updatedStep, order: index };
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    setSteps(newSteps);
  };

  const handleSave = () => {
    if (!taskType.trim()) {
      toast.error('Task type is required');
      return;
    }
    if (!taskName.trim()) {
      toast.error('Task name is required');
      return;
    }
    if (steps.length === 0) {
      toast.error('At least one step is required');
      return;
    }

    onSave({
      taskType: taskType.trim(),
      taskName: taskName.trim(),
      pageUrl: pageUrl.trim(),
      category,
      description: description.trim(),
      steps: steps.map((s, i) => ({ ...s, order: i })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            {initialData ? 'Edit Workflow Template' : 'Create Workflow Template'}
          </DialogTitle>
          <DialogDescription>
            Define the steps your agent should follow to complete this task in GoHighLevel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Task Type ID</label>
              <Input
                placeholder="e.g. contact_create"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Unique identifier for this workflow</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GHL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Task Name</label>
            <Input
              placeholder="e.g. Create New Contact"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
            <Textarea
              placeholder="Describe what this workflow does and when it should be used..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Starting URL</label>
            <Input
              placeholder="https://app.gohighlevel.com/v2/location/{locationId}/..."
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
            />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Automation Steps</label>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="w-4 h-4 mr-1" />
                Add Step
              </Button>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <StepEditor
                  key={index}
                  step={step}
                  index={index}
                  onChange={(s) => updateStep(index, s)}
                  onRemove={() => removeStep(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>
            {initialData ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatternLibraryTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTaskType, setDeleteTaskType] = useState<string | null>(null);

  const patternsQuery = trpc.knowledge.listPatterns.useQuery();
  const deletePatternMutation = trpc.knowledge.deletePattern.useMutation({
    onSuccess: () => {
      toast.success('Pattern deleted');
      setDeleteTaskType(null);
      patternsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const patterns = patternsQuery.data?.patterns || [];
  const filtered = searchQuery
    ? patterns.filter(
        (p: any) =>
          p.taskType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.taskName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : patterns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search patterns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => patternsQuery.refetch()}
          disabled={patternsQuery.isRefetching}
        >
          <RefreshCw className={cn('w-4 h-4', patternsQuery.isRefetching && 'animate-spin')} />
        </Button>
      </div>

      {patternsQuery.isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading patterns...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No patterns found</p>
          <p className="text-sm text-gray-400 mt-1">
            Patterns are created when agents learn from executing tasks
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Type</TableHead>
                <TableHead>Task Name</TableHead>
                <TableHead className="text-center">Steps</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    Success <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Executions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((pattern: any) => {
                const total = (pattern.successCount || 0) + (pattern.failureCount || 0);
                const rate = total > 0 ? Math.round(((pattern.successCount || 0) / total) * 100) : 0;
                return (
                  <TableRow key={pattern.taskType}>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{pattern.taskType}</code>
                    </TableCell>
                    <TableCell className="font-medium">{pattern.taskName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{(pattern.steps as any[])?.length || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          rate >= 80
                            ? 'bg-emerald-100 text-emerald-700'
                            : rate >= 50
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700',
                          'hover:opacity-90'
                        )}
                      >
                        {total > 0 ? `${rate}%` : '--'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-gray-600">{total}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTaskType(pattern.taskType)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteTaskType !== null} onOpenChange={() => setDeleteTaskType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pattern</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the pattern <strong>{deleteTaskType}</strong>? This will remove
              all learned steps and execution history for this task type.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                deleteTaskType && deletePatternMutation.mutate({ taskType: deleteTaskType })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkflowTemplatesTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const patternsQuery = trpc.knowledge.listPatterns.useQuery();
  const savePatternMutation = trpc.knowledge.savePattern.useMutation({
    onSuccess: () => {
      toast.success('Workflow template saved');
      setDialogOpen(false);
      setEditingTemplate(null);
      patternsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const patterns = patternsQuery.data?.patterns || [];
  const filtered = searchQuery
    ? patterns.filter(
        (p: any) =>
          p.taskType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.taskName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : patterns;

  const handleSave = (template: WorkflowTemplate) => {
    savePatternMutation.mutate({
      taskType: template.taskType,
      taskName: template.taskName,
      pageUrl: template.pageUrl,
      steps: template.steps,
    });
  };

  const handleEdit = (pattern: any) => {
    setEditingTemplate({
      taskType: pattern.taskType,
      taskName: pattern.taskName,
      pageUrl: pattern.pageUrl || '',
      steps: (pattern.steps as ActionStep[]) || [],
      category: 'custom',
      description: '',
    });
    setDialogOpen(true);
  };

  const handleDuplicate = (pattern: any) => {
    setEditingTemplate({
      taskType: `${pattern.taskType}_copy`,
      taskName: `${pattern.taskName} (Copy)`,
      pageUrl: pattern.pageUrl || '',
      steps: (pattern.steps as ActionStep[]) || [],
      category: 'custom',
      description: '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => {
            setEditingTemplate(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {patternsQuery.isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Workflow className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No workflow templates yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first template to train your agent</p>
          <Button
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              setEditingTemplate(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((pattern: any) => {
            const total = (pattern.successCount || 0) + (pattern.failureCount || 0);
            const rate = total > 0 ? Math.round(((pattern.successCount || 0) / total) * 100) : 0;
            const stepsCount = (pattern.steps as any[])?.length || 0;

            return (
              <Card
                key={pattern.taskType}
                className="hover:border-emerald-300 transition-colors cursor-pointer group"
                onClick={() => handleEdit(pattern)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{pattern.taskName}</CardTitle>
                      <CardDescription>
                        <code className="text-xs">{pattern.taskType}</code>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(pattern);
                        }}
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>{stepsCount} steps</span>
                    </div>
                    {total > 0 && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5" />
                          <span>{total} runs</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {rate >= 80 ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>{rate}% success</span>
                        </div>
                      </>
                    )}
                    {total === 0 && (
                      <Badge variant="outline" className="text-xs">
                        Not tested
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <WorkflowTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        initialData={editingTemplate}
      />
    </div>
  );
}

function FeedbackTab() {
  const feedbackQuery = trpc.knowledge.getFeedback.useQuery({ limit: 50 });
  const feedback = feedbackQuery.data?.feedback || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Review agent execution feedback and provide corrections</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => feedbackQuery.refetch()}
          disabled={feedbackQuery.isRefetching}
        >
          <RefreshCw className={cn('w-4 h-4', feedbackQuery.isRefetching && 'animate-spin')} />
        </Button>
      </div>

      {feedbackQuery.isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading feedback...</div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No feedback entries yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Feedback is collected after agent executions to improve performance
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((entry: any) => (
            <Card key={entry.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-1.5 rounded-full mt-0.5',
                        entry.feedbackType === 'success'
                          ? 'bg-emerald-100'
                          : entry.feedbackType === 'failure'
                          ? 'bg-red-100'
                          : entry.feedbackType === 'partial'
                          ? 'bg-amber-100'
                          : 'bg-blue-100'
                      )}
                    >
                      {entry.feedbackType === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : entry.feedbackType === 'failure' ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Zap className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{entry.taskType}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {entry.feedbackType}
                        </Badge>
                        {entry.rating && (
                          <span className="text-xs text-gray-500">
                            {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
                          </span>
                        )}
                      </div>
                      {entry.comment && (
                        <p className="text-sm text-gray-600">{entry.comment}</p>
                      )}
                      {entry.corrections && (
                        <p className="text-sm text-blue-600 mt-1">
                          Correction: {entry.corrections}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainingMetricsTab() {
  const statsQuery = trpc.knowledge.getSystemStats.useQuery();
  const feedbackStatsQuery = trpc.knowledge.getFeedbackStats.useQuery();
  const topPatternsQuery = trpc.knowledge.getTopPatterns.useQuery({ limit: 5 });
  const errorStatsQuery = trpc.knowledge.getErrorStats.useQuery();

  const systemStats = statsQuery.data?.stats;
  const feedbackStats = feedbackStatsQuery.data?.stats;
  const topPatterns = topPatternsQuery.data?.patterns || [];
  const errorStats = errorStatsQuery.data?.stats;

  return (
    <div className="space-y-6">
      {/* Training Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Training Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{systemStats?.totalPatterns ?? 0}</p>
              <p className="text-xs text-gray-500">Action Patterns</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{systemStats?.totalSelectors ?? 0}</p>
              <p className="text-xs text-gray-500">Selectors Learned</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{systemStats?.totalBrandVoices ?? 0}</p>
              <p className="text-xs text-gray-500">Brand Voices</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">{systemStats?.totalClientContexts ?? 0}</p>
              <p className="text-xs text-gray-500">Client Profiles</p>
            </div>
          </div>

          {systemStats && (systemStats.totalPatterns ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Overall Success Rate</span>
                <span className="text-sm font-medium">
                  {Math.round(systemStats.avgPatternSuccessRate ?? 0)}%
                </span>
              </div>
              <Progress value={systemStats.avgPatternSuccessRate ?? 0} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Top Performing Patterns
          </CardTitle>
          <CardDescription>Most reliable automation patterns based on success rate</CardDescription>
        </CardHeader>
        <CardContent>
          {topPatterns.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No patterns executed yet
            </p>
          ) : (
            <div className="space-y-3">
              {topPatterns.map((pattern: any, index: number) => {
                const total = (pattern.successCount || 0) + (pattern.failureCount || 0);
                const rate = total > 0 ? Math.round(((pattern.successCount || 0) / total) * 100) : 0;
                return (
                  <div key={pattern.taskType} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-300 w-6 text-right">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pattern.taskName}</p>
                      <p className="text-xs text-gray-400">{total} executions</p>
                    </div>
                    <Badge
                      className={cn(
                        rate >= 80
                          ? 'bg-emerald-100 text-emerald-700'
                          : rate >= 50
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700',
                        'hover:opacity-90'
                      )}
                    >
                      {rate}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Feedback Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackStats ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Feedback</span>
                  <span className="font-medium">{feedbackStats.total ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average Rating</span>
                  <span className="font-medium">
                    {feedbackStats.averageRating
                      ? `${Number(feedbackStats.averageRating).toFixed(1)} / 5`
                      : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Positive</span>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    {feedbackStats.byType?.success ?? 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Needs Improvement</span>
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    {feedbackStats.byType?.partial ?? 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Failed</span>
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                    {feedbackStats.byType?.failure ?? 0}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Error Recovery
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorStats ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Error Patterns Learned</span>
                  <span className="font-medium">{errorStats.totalErrors ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Resolved Errors</span>
                  <span className="font-medium">{errorStats.resolvedErrors ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Resolution Rate</span>
                  <span className="font-medium">{Math.round(errorStats.resolutionRate ?? 0)}%</span>
                </div>
                {errorStats.topStrategies?.slice(0, 3).map((strat: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate max-w-[180px]">{strat.strategy}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(strat.successRate)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function AgentTraining() {
  const patternsQuery = trpc.knowledge.listPatterns.useQuery();
  const feedbackQuery = trpc.knowledge.getFeedback.useQuery({ limit: 50 });
  const systemStatsQuery = trpc.knowledge.getSystemStats.useQuery();

  const patternsCount = patternsQuery.data?.total ?? 0;
  const feedbackCount = feedbackQuery.data?.total ?? 0;
  const systemStats = systemStatsQuery.data?.stats ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Training</h1>
          <p className="text-gray-500 mt-1">
            Define workflows, review patterns, and train your AI agent on agency-specific tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              patternsQuery.refetch();
              feedbackQuery.refetch();
              systemStatsQuery.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards
        patternsCount={patternsCount}
        feedbackCount={feedbackCount}
        systemStats={systemStats as any}
      />

      {/* Tabs */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <Workflow className="w-4 h-4" />
            Workflow Templates
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-1.5">
            <Brain className="w-4 h-4" />
            Pattern Library
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4" />
            Feedback
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Workflow className="w-5 h-5" />
                Workflow Templates
              </CardTitle>
              <CardDescription>
                Define step-by-step automation workflows for your agent to execute in GoHighLevel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowTemplatesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Learned Patterns
              </CardTitle>
              <CardDescription>
                Patterns the agent has learned from executing tasks and receiving feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatternLibraryTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Training Feedback
              </CardTitle>
              <CardDescription>
                Review execution feedback and guide agent learning through corrections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeedbackTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <TrainingMetricsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
