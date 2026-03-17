import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  LayoutGrid,
  List,
  Clock,
  Coins,
  Play,
  ChevronRight,
  Globe,
  Mail,
  Bot,
  FileText,
  Zap,
  TrendingUp,
  BarChart3,
  Settings2,
  Filter,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Category metadata
// ============================================================

const CATEGORIES = [
  { key: 'all', label: 'All Templates', icon: LayoutGrid },
  { key: 'ghl', label: 'GoHighLevel', icon: Zap },
  { key: 'marketing', label: 'Marketing', icon: TrendingUp },
  { key: 'sales', label: 'Sales', icon: BarChart3 },
  { key: 'operations', label: 'Operations', icon: Settings2 },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  ghl: 'bg-blue-50 text-blue-700 border-blue-200',
  marketing: 'bg-purple-50 text-purple-700 border-purple-200',
  sales: 'bg-amber-50 text-amber-700 border-amber-200',
  operations: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  browser: <Globe className="h-3.5 w-3.5" />,
  api: <Zap className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  ai: <Bot className="h-3.5 w-3.5" />,
  file: <FileText className="h-3.5 w-3.5" />,
  wait: <Clock className="h-3.5 w-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  browser: 'bg-sky-100 text-sky-700',
  api: 'bg-violet-100 text-violet-700',
  email: 'bg-rose-100 text-rose-700',
  ai: 'bg-emerald-100 text-emerald-700',
  file: 'bg-amber-100 text-amber-700',
  wait: 'bg-gray-100 text-gray-600',
};

// ============================================================
// Component
// ============================================================

export default function TaskTemplates() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});

  // Fetch templates
  const templatesQuery = trpc.taskTemplates.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Run mutation
  const runMutation = trpc.taskTemplates.runFromTemplate.useMutation({
    onSuccess: (data) => {
      toast.success(data.message, {
        description: `Task ID: ${data.taskId} | Est. ${data.estimatedMinutes} min | ${data.creditCost} credits`,
      });
      setShowRunDialog(false);
      setSelectedTemplate(null);
      setFormInputs({});
    },
    onError: (err) => {
      toast.error('Failed to create task', { description: err.message });
    },
  });

  // Filter templates
  const filtered = useMemo(() => {
    if (!templatesQuery.data) return [];
    return templatesQuery.data.filter((t) => {
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [templatesQuery.data, activeCategory, search]);

  // Handlers
  const openDetail = (template: any) => {
    setSelectedTemplate(template);
  };

  const openRunDialog = (template: any) => {
    setSelectedTemplate(template);
    setFormInputs({});
    setShowRunDialog(true);
  };

  const handleRun = () => {
    if (!selectedTemplate) return;
    runMutation.mutate({
      templateId: selectedTemplate.id,
      inputs: formInputs,
    });
  };

  const updateInput = (name: string, value: string) => {
    setFormInputs((prev) => ({ ...prev, [name]: value }));
  };

  // Stats
  const totalTemplates = templatesQuery.data?.length ?? 0;
  const categoryStats = useMemo(() => {
    if (!templatesQuery.data) return {};
    const counts: Record<string, number> = {};
    templatesQuery.data.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [templatesQuery.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Task Templates' }]} />
        <h1 className="text-3xl font-bold tracking-tight mt-4">Task Templates</h1>
        <p className="text-muted-foreground mt-2">
          Pre-built templates for common agency tasks. Select a template, fill in the inputs, and run it with your AI agent.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold">{totalTemplates}</div>
            <p className="text-xs text-muted-foreground">Total Templates</p>
          </CardContent>
        </Card>
        {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => (
          <Card
            key={cat.key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              activeCategory === cat.key ? 'ring-2 ring-emerald-500' : ''
            }`}
            onClick={() => setActiveCategory(activeCategory === cat.key ? 'all' : cat.key)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{categoryStats[cat.key] ?? 0}</div>
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                </div>
                <cat.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, description, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat.key)}
              className="hidden lg:flex"
            >
              <cat.icon className="h-4 w-4 mr-1" />
              {cat.label}
            </Button>
          ))}
          <div className="border-l mx-1" />
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            className="h-9 w-9"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            className="h-9 w-9"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Template Grid / List */}
      {templatesQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No templates found</p>
            <p className="text-muted-foreground text-sm mt-1">
              Try adjusting your search or category filter.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setActiveCategory('all');
              }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="group cursor-pointer hover:shadow-lg transition-all hover:border-emerald-300"
              onClick={() => openDetail(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[template.category] || ''}
                  >
                    {template.category.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {template.platform}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2 group-hover:text-emerald-700 transition-colors">
                  {template.name}
                </CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {template.estimatedMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" />
                      {template.creditCost} credits
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    {template.steps.length} steps
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {template.tags.slice(0, 4).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 4 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      +{template.tags.length - 4}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-emerald-300"
              onClick={() => openDetail(template)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{template.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${CATEGORY_COLORS[template.category] || ''}`}
                    >
                      {template.category.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.platform}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {template.description}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {template.estimatedMinutes}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" />
                    {template.creditCost}
                  </span>
                  <span>{template.steps.length} steps</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRunDialog(template);
                    }}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Detail Modal */}
      <Dialog
        open={!!selectedTemplate && !showRunDialog}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplate(null);
        }}
      >
        {selectedTemplate && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={CATEGORY_COLORS[selectedTemplate.category] || ''}
                >
                  {selectedTemplate.category.toUpperCase()}
                </Badge>
                <Badge variant="secondary">{selectedTemplate.platform}</Badge>
              </div>
              <DialogTitle className="text-xl">{selectedTemplate.name}</DialogTitle>
              <DialogDescription>{selectedTemplate.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-semibold">{selectedTemplate.estimatedMinutes} min</div>
                  <div className="text-xs text-muted-foreground">Estimated time</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Coins className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-semibold">{selectedTemplate.creditCost}</div>
                  <div className="text-xs text-muted-foreground">Credit cost</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-semibold">{selectedTemplate.steps.length}</div>
                  <div className="text-xs text-muted-foreground">Steps</div>
                </div>
              </div>

              {/* Platform requirements */}
              {selectedTemplate.platformRequirements.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Platform Requirements</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.platformRequirements.map((req: string) => (
                      <Badge key={req} variant="outline" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Required inputs preview */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Required Inputs ({selectedTemplate.inputs.filter((i: any) => i.required).length})
                </h4>
                <div className="grid gap-2">
                  {selectedTemplate.inputs.map((inp: any) => (
                    <div
                      key={inp.name}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{inp.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {inp.type}
                        </Badge>
                        {inp.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Execution steps */}
              <div>
                <h4 className="text-sm font-medium mb-2">Execution Steps</h4>
                <div className="space-y-2">
                  {selectedTemplate.steps.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${
                          ACTION_COLORS[step.actionType] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ACTION_ICONS[step.actionType]}
                        {step.actionType}
                      </div>
                      <span className="text-sm">{step.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h4 className="text-sm font-medium mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Close
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  setShowRunDialog(true);
                  setFormInputs({});
                }}
              >
                <Play className="h-4 w-4 mr-2" />
                Run from Template
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Run from Template Dialog */}
      <Dialog
        open={showRunDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowRunDialog(false);
            setSelectedTemplate(null);
            setFormInputs({});
          }
        }}
      >
        {selectedTemplate && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Run: {selectedTemplate.name}</DialogTitle>
              <DialogDescription>
                Fill in the required inputs below to create a task from this template.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Cost summary */}
              <div className="flex items-center gap-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-800">
                    ~{selectedTemplate.estimatedMinutes} min
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-800">
                    {selectedTemplate.creditCost} credits
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-800">
                    {selectedTemplate.steps.length} steps
                  </span>
                </div>
              </div>

              {/* Form fields */}
              {selectedTemplate.inputs.map((inp: any) => (
                <div key={inp.name} className="space-y-1.5">
                  <Label htmlFor={inp.name} className="text-sm font-medium">
                    {inp.label}
                    {inp.required && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {inp.type === 'textarea' ? (
                    <Textarea
                      id={inp.name}
                      placeholder={inp.placeholder}
                      value={formInputs[inp.name] || ''}
                      onChange={(e) => updateInput(inp.name, e.target.value)}
                      rows={3}
                    />
                  ) : inp.type === 'select' && inp.options ? (
                    <Select
                      value={formInputs[inp.name] || ''}
                      onValueChange={(val) => updateInput(inp.name, val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={inp.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {inp.options.map((opt: string) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={inp.name}
                      type={inp.type === 'email' ? 'email' : inp.type === 'url' ? 'url' : 'text'}
                      placeholder={inp.placeholder}
                      value={formInputs[inp.name] || ''}
                      onChange={(e) => updateInput(inp.name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRunDialog(false);
                  setSelectedTemplate(null);
                  setFormInputs({});
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleRun}
                disabled={runMutation.isPending}
              >
                {runMutation.isPending ? (
                  <>Creating task...</>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
