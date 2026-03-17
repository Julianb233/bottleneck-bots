import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  Mail,
  BarChart3,
  FileSpreadsheet,
  Globe,
  Megaphone,
  Search,
  PenTool,
  Zap,
  Play,
  Clock,
  ArrowRight,
  Tag,
  UserPlus,
  CalendarCheck,
  Trash2,
  Settings,
  LayoutGrid,
  List,
  Loader2,
  Brain,
  Target,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

// ── Icon map keyed by category slug ──────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ghl: <Zap className="w-5 h-5" />,
  marketing: <Megaphone className="w-5 h-5" />,
  sales: <TrendingUp className="w-5 h-5" />,
  outreach: <Mail className="w-5 h-5" />,
  operations: <Settings className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  ghl: 'bg-blue-100 text-blue-700',
  marketing: 'bg-pink-100 text-pink-700',
  sales: 'bg-emerald-100 text-emerald-700',
  outreach: 'bg-violet-100 text-violet-700',
  operations: 'bg-amber-100 text-amber-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  ghl: 'GHL',
  marketing: 'Marketing',
  sales: 'Sales',
  outreach: 'Outreach',
  operations: 'Operations',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

interface TemplateStep {
  title: string;
  description?: string;
  actionType?: string;
}

type ViewMode = 'grid' | 'list';

export default function TaskTemplates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Fetch templates from taskTemplates router
  const { data, isLoading } = trpc.taskTemplates.list.useQuery(
    { category: selectedCategory ?? undefined, search: searchQuery || undefined, limit: 50 },
    { refetchOnWindowFocus: false },
  );

  const templates = data?.templates ?? [];

  const createTaskMutation = trpc.taskTemplates.createTask.useMutation({
    onSuccess: () => {
      toast.success('Task created from template');
      setSelectedTemplateId(null);
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const categories = ['ghl', 'marketing', 'sales', 'outreach'];

  const handleRunTemplate = () => {
    if (!selectedTemplate) return;
    createTaskMutation.mutate({ templateId: selectedTemplate.id });
  };

  const getSteps = (t: typeof templates[number]): TemplateStep[] => {
    const steps = t.steps;
    if (Array.isArray(steps)) return steps as TemplateStep[];
    return [];
  };

  const getTags = (t: typeof templates[number]): string[] => {
    const tags = t.defaultTags;
    if (Array.isArray(tags)) return tags as string[];
    return [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-gray-500">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Templates</h1>
          <p className="text-gray-500 mt-1">
            {templates.length} pre-built templates across GHL, Marketing, Sales, and Outreach.
            Select one to run with your agent.
          </p>
        </div>
        <div className="flex gap-1 border rounded-lg p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search templates by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Template Grid View */}
      {viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const steps = getSteps(template);
            const tags = getTags(template);
            return (
              <Card
                key={template.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      {CATEGORY_ICONS[template.categorySlug] ?? <Zap className="w-5 h-5" />}
                    </div>
                    <Badge className={CATEGORY_COLORS[template.categorySlug] ?? ''}>
                      {CATEGORY_LABELS[template.categorySlug] ?? template.categorySlug}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                  <CardDescription className="text-sm line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {template.estimatedDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />~{template.estimatedDuration} min
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      {steps.length} steps
                    </span>
                    {template.difficulty && (
                      <Badge className={`${DIFFICULTY_COLORS[template.difficulty] ?? ''} text-[10px] px-1.5 py-0`}>
                        {template.difficulty}
                      </Badge>
                    )}
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {tags.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {templates.map((template) => {
            const steps = getSteps(template);
            return (
              <Card
                key={template.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                    {CATEGORY_ICONS[template.categorySlug] ?? <Zap className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{template.name}</h3>
                      <Badge className={`${CATEGORY_COLORS[template.categorySlug] ?? ''} text-[10px]`}>
                        {CATEGORY_LABELS[template.categorySlug] ?? template.categorySlug}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{template.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    {template.estimatedDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />~{template.estimatedDuration}m
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />{steps.length}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {templates.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No templates match your search</p>
          <p className="text-sm text-gray-400">Try a different search term or category</p>
        </div>
      )}

      {/* Template Detail & Run Dialog */}
      <Dialog open={selectedTemplate !== null} onOpenChange={() => setSelectedTemplateId(null)}>
        {selectedTemplate && (() => {
          const steps = getSteps(selectedTemplate);
          const tags = getTags(selectedTemplate);
          return (
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    {CATEGORY_ICONS[selectedTemplate.categorySlug] ?? <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <DialogTitle>{selectedTemplate.name}</DialogTitle>
                    <DialogDescription>{selectedTemplate.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Steps preview */}
              {steps.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700">Workflow Steps</p>
                  <div className="space-y-1.5">
                    {steps.map((step: TemplateStep, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-emerald-600 font-mono text-xs mt-0.5 min-w-[20px]">
                          {i + 1}.
                        </span>
                        {step.actionType && (
                          <Badge className="text-[10px] px-1.5 py-0 shrink-0">
                            {step.actionType}
                          </Badge>
                        )}
                        <span className="text-gray-600">{step.description ?? step.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTemplate.estimatedDuration && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" /> ~{selectedTemplate.estimatedDuration} min
                  </Badge>
                )}
                {selectedTemplate.difficulty && (
                  <Badge className={DIFFICULTY_COLORS[selectedTemplate.difficulty] ?? ''}>
                    {selectedTemplate.difficulty}
                  </Badge>
                )}
                <Badge className={CATEGORY_COLORS[selectedTemplate.categorySlug] ?? ''}>
                  {CATEGORY_LABELS[selectedTemplate.categorySlug] ?? selectedTemplate.categorySlug}
                </Badge>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setSelectedTemplateId(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                  onClick={handleRunTemplate}
                  disabled={createTaskMutation.isPending}
                >
                  {createTaskMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Create Task
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
