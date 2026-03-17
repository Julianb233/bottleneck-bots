import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Megaphone,
  Send,
  TrendingUp,
  Zap,
  Clock,
  Play,
  Plus,
  Star,
  Filter,
  Calendar,
  Mail,
  Target,
  UserPlus,
  GitBranch,
  Copy,
  Shield,
  Upload,
  FileText,
  RefreshCw,
  Loader2,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Icon mapping for template icons
const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Calendar, Mail, Target, Search, Send, UserPlus, Star,
  Filter, FileText, RefreshCw, Upload, GitBranch, Copy,
  Shield, Megaphone, TrendingUp, Zap, Play, Plus,
  CheckCircle,
};

// Category config for display
const categoryConfig: Record<string, { icon: React.FC<{ className?: string }>; color: string; bgColor: string }> = {
  marketing: { icon: Megaphone, color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  outreach: { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  sales: { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
  ghl: { icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
};

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

interface TemplateStep {
  title: string;
  description?: string;
  actionType?: string;
}

export default function TaskTemplates() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');

  // Fetch categories
  const categoriesQuery = trpc.taskTemplates.getCategories.useQuery();

  // Fetch templates
  const templatesQuery = trpc.taskTemplates.list.useQuery({
    category: selectedCategory,
    search: searchQuery || undefined,
    limit: 50,
  });

  // Seed mutation (for first-time setup)
  const seedMutation = trpc.taskTemplates.seed.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.templatesSeeded} templates`);
      categoriesQuery.refetch();
      templatesQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Seed failed: ${err.message}`);
    },
  });

  // Create task from template
  const createTaskMutation = trpc.taskTemplates.createTask.useMutation({
    onSuccess: () => {
      toast.success('Task created from template');
      setShowCreateDialog(false);
      setSelectedTemplate(null);
      setTaskTitle('');
      setTaskDescription('');
    },
    onError: (err) => {
      toast.error(`Failed to create task: ${err.message}`);
    },
  });

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const templates = templatesQuery.data?.templates || [];
    const grouped: Record<string, typeof templates> = {};
    for (const t of templates) {
      if (!grouped[t.categorySlug]) grouped[t.categorySlug] = [];
      grouped[t.categorySlug].push(t);
    }
    return grouped;
  }, [templatesQuery.data]);

  const categories = categoriesQuery.data || [];
  const hasTemplates = (templatesQuery.data?.total || 0) > 0;
  const isLoading = templatesQuery.isLoading || categoriesQuery.isLoading;

  const handleUseTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTaskTitle(template.name);
    setTaskDescription(template.description || '');
    setShowCreateDialog(true);
  };

  const handleCreateTask = () => {
    if (!selectedTemplate) return;
    createTaskMutation.mutate({
      templateId: selectedTemplate.id,
      title: taskTitle || undefined,
      description: taskDescription || undefined,
    });
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName) return Zap;
    return iconMap[iconName] || Zap;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Task Templates' },
          ]}
        />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Task Templates</h1>
            <p className="text-muted-foreground mt-1">
              Pre-built workflows for marketing, outreach, sales, and GHL automations
            </p>
          </div>
          <div className="flex gap-2">
            {!hasTemplates && !isLoading && (
              <Button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                variant="outline"
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Load Templates
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === undefined ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(undefined)}
        >
          All Templates
        </Button>
        {(categories.length > 0 ? categories : FALLBACK_CATEGORIES).map((cat: any) => {
          const config = categoryConfig[cat.slug] || categoryConfig.marketing;
          const Icon = config.icon;
          return (
            <Button
              key={cat.slug}
              variant={selectedCategory === cat.slug ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.slug)}
              className="gap-1.5"
            >
              <Icon className="h-4 w-4" />
              {cat.name}
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      )}

      {/* Empty State */}
      {!isLoading && !hasTemplates && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Load the pre-built template library to get started with agency workflow automation.
            </p>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Load Template Library
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Templates Grid */}
      {!isLoading && hasTemplates && (
        <>
          {selectedCategory ? (
            // Single category view
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(templatesByCategory[selectedCategory] || []).map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={handleUseTemplate}
                  onView={setSelectedTemplate}
                  getIcon={getIcon}
                />
              ))}
            </div>
          ) : (
            // All categories view — grouped
            Object.entries(templatesByCategory).map(([slug, templates]) => {
              const config = categoryConfig[slug] || categoryConfig.marketing;
              const Icon = config.icon;
              const category = categories.find((c: any) => c.slug === slug);
              return (
                <div key={slug} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
                      <Icon className={cn('h-5 w-5', config.color)} />
                    </div>
                    <h2 className="text-lg font-semibold">
                      {category?.name || slug}
                    </h2>
                    <Badge variant="secondary" className="ml-1">{templates.length}</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onUse={handleUseTemplate}
                        onView={setSelectedTemplate}
                        getIcon={getIcon}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Template Detail / Preview Dialog */}
      {selectedTemplate && !showCreateDialog && (
        <Dialog open={true} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {React.createElement(getIcon(selectedTemplate.icon), { className: 'h-5 w-5' })}
                {selectedTemplate.name}
              </DialogTitle>
              <DialogDescription>{selectedTemplate.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedTemplate.difficulty && (
                  <Badge className={difficultyColors[selectedTemplate.difficulty] || ''}>
                    {selectedTemplate.difficulty}
                  </Badge>
                )}
                {selectedTemplate.estimatedDuration && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {selectedTemplate.estimatedDuration} min
                  </Badge>
                )}
                {selectedTemplate.requiresHumanReview && (
                  <Badge variant="outline">Requires review</Badge>
                )}
              </div>

              {/* Steps */}
              <div>
                <h4 className="text-sm font-medium mb-2">Workflow Steps</h4>
                <div className="space-y-2">
                  {((selectedTemplate.steps as TemplateStep[]) || []).map((step: TemplateStep, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.title}</p>
                        {step.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                        )}
                      </div>
                      {step.actionType && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {step.actionType.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              {selectedTemplate.defaultTags && (selectedTemplate.defaultTags as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(selectedTemplate.defaultTags as string[]).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>Close</Button>
              <Button onClick={() => handleUseTemplate(selectedTemplate)}>
                <Play className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Task from Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task from Template</DialogTitle>
            <DialogDescription>
              Customize the task details before creating. Fields are pre-filled from the template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe the task..."
                rows={3}
              />
            </div>
            {selectedTemplate && (
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-1">Template Settings</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Priority: {selectedTemplate.priority}</Badge>
                  <Badge variant="outline">Type: {selectedTemplate.taskType?.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">
                    {selectedTemplate.assignedToBot ? 'Bot assigned' : 'Manual'}
                  </Badge>
                  {selectedTemplate.estimatedDuration && (
                    <Badge variant="outline">~{selectedTemplate.estimatedDuration} min</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onUse,
  onView,
  getIcon,
}: {
  template: any;
  onUse: (t: any) => void;
  onView: (t: any) => void;
  getIcon: (name: string | null) => React.FC<{ className?: string }>;
}) {
  const Icon = getIcon(template.icon);
  const config = categoryConfig[template.categorySlug] || categoryConfig.marketing;
  const steps = (template.steps as TemplateStep[]) || [];

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(template)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn('p-2 rounded-lg', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="flex items-center gap-1.5">
            {template.difficulty && (
              <Badge className={cn('text-xs', difficultyColors[template.difficulty] || '')}>
                {template.difficulty}
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-base mt-3">{template.name}</CardTitle>
        <CardDescription className="line-clamp-2 text-xs">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {template.estimatedDuration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {template.estimatedDuration}m
              </span>
            )}
            <span className="flex items-center gap-1">
              {steps.length} steps
            </span>
            {template.usageCount > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {template.usageCount}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onUse(template);
            }}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Use
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Fallback categories when DB has none (before seeding)
const FALLBACK_CATEGORIES = [
  { slug: 'marketing', name: 'Marketing Campaigns' },
  { slug: 'outreach', name: 'Outreach Sequences' },
  { slug: 'sales', name: 'Sales Pipelines' },
  { slug: 'ghl', name: 'GHL Automations' },
];
