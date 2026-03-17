import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  CreditCard,
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

// ── Icon map keyed by template ID ──────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  'ghl-add-contact-pipeline': <Users className="w-5 h-5" />,
  'ghl-launch-email-campaign': <Mail className="w-5 h-5" />,
  'ghl-create-workflow': <Zap className="w-5 h-5" />,
  'ghl-update-contact-tags': <Tag className="w-5 h-5" />,
  'ghl-export-pipeline-report': <FileSpreadsheet className="w-5 h-5" />,
  'marketing-content-creation': <PenTool className="w-5 h-5" />,
  'marketing-competitor-analysis': <BarChart3 className="w-5 h-5" />,
  'marketing-seo-audit': <Globe className="w-5 h-5" />,
  'sales-lead-enrichment': <Search className="w-5 h-5" />,
  'sales-cold-email-sequence': <Mail className="w-5 h-5" />,
  'sales-meeting-scheduler': <CalendarCheck className="w-5 h-5" />,
  'ops-report-generation': <TrendingUp className="w-5 h-5" />,
  'ops-data-cleanup': <Trash2 className="w-5 h-5" />,
  'ops-process-automation': <Settings className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  ghl: 'bg-blue-100 text-blue-700',
  marketing: 'bg-pink-100 text-pink-700',
  sales: 'bg-emerald-100 text-emerald-700',
  operations: 'bg-amber-100 text-amber-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  ghl: 'GHL',
  marketing: 'Marketing',
  sales: 'Sales',
  operations: 'Operations',
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  browser: 'bg-sky-100 text-sky-700',
  api: 'bg-violet-100 text-violet-700',
  email: 'bg-rose-100 text-rose-700',
  ai: 'bg-emerald-100 text-emerald-700',
  file: 'bg-amber-100 text-amber-700',
  wait: 'bg-gray-100 text-gray-700',
};

type ViewMode = 'grid' | 'list';

export default function TaskTemplates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Fetch templates from backend
  const { data: listData, isLoading } = trpc.taskTemplates.list.useQuery(
    { category: selectedCategory ?? undefined, search: searchQuery || undefined, limit: 100 },
    { refetchOnWindowFocus: false },
  );
  const templates = listData?.templates ?? [];

  const runMutation = trpc.taskTemplates.createTask.useMutation({
    onSuccess: () => {
      toast.success('Task created from template');
      setSelectedTemplateId(null);
      setInputValues({});
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  const selectedTemplate = useMemo(
    () => templates.find((t: any) => String(t.id) === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  // Filtering is handled server-side via the list query params
  const filteredTemplates = templates;

  const categories = ['ghl', 'marketing', 'sales', 'operations'];

  const handleOpenTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setInputValues({});
  };

  const handleRunTemplate = () => {
    if (!selectedTemplate) return;
    runMutation.mutate({
      templateId: selectedTemplate.id,
    });
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
            {templates.length} pre-built templates across GHL, Marketing, Sales, and Operations.
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
            placeholder="Search templates by name, description, or tag..."
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
            All ({templates.length})
          </Button>
          {categories.map((cat) => {
            return (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                {CATEGORY_LABELS[cat]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Template Grid View */}
      {viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template: any) => (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleOpenTemplate(String(template.id))}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    {ICON_MAP[template.id] ?? <Zap className="w-5 h-5" />}
                  </div>
                  <Badge className={CATEGORY_COLORS[template.categorySlug] ?? 'bg-gray-100 text-gray-700'}>
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
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    {template.taskType}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    {template.priority}
                  </span>
                </div>
                {/* Tags */}
                {Array.isArray(template.defaultTags) && template.defaultTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {template.defaultTags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {template.defaultTags.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{template.defaultTags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredTemplates.map((template: any) => (
            <Card
              key={template.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => handleOpenTemplate(String(template.id))}
            >
              <div className="flex items-center gap-4 p-4">
                <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                  {ICON_MAP[template.id] ?? <Zap className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{template.name}</h3>
                    <Badge className={`${CATEGORY_COLORS[template.categorySlug] ?? 'bg-gray-100 text-gray-700'} text-[10px]`}>
                      {CATEGORY_LABELS[template.categorySlug] ?? template.categorySlug}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{template.description}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />{template.taskType}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No templates match your search</p>
          <p className="text-sm text-gray-400">Try a different search term or category</p>
        </div>
      )}

      {/* Template Detail & Run Dialog */}
      <Dialog open={selectedTemplate !== null} onOpenChange={() => setSelectedTemplateId(null)}>
        {selectedTemplate && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  {ICON_MAP[selectedTemplate.id] ?? <Zap className="w-5 h-5" />}
                </div>
                <div>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <DialogDescription>{selectedTemplate.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Steps preview */}
            {Array.isArray(selectedTemplate.steps) && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-gray-700">Workflow Steps</p>
                <div className="space-y-1.5">
                  {(selectedTemplate.steps as any[]).map((step: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-600 font-mono text-xs mt-0.5 min-w-[20px]">
                        {i + 1}.
                      </span>
                      <span className="text-gray-600">{step.title ?? step.description ?? String(step)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="gap-1">
                <Zap className="w-3 h-3" /> {selectedTemplate.taskType}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Target className="w-3 h-3" /> {selectedTemplate.priority}
              </Badge>
              <Badge className={CATEGORY_COLORS[selectedTemplate.categorySlug] ?? 'bg-gray-100 text-gray-700'}>
                {CATEGORY_LABELS[selectedTemplate.categorySlug] ?? selectedTemplate.categorySlug}
              </Badge>
            </div>

            {/* Description */}
            {selectedTemplate.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setSelectedTemplateId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={handleRunTemplate}
                disabled={runMutation.isPending}
              >
                {runMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run Task
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
