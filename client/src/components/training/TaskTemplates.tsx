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

interface TemplateStep {
  order: number;
  actionType: string;
  description: string;
}

interface TemplateInput {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
  options?: string[];
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: TemplateStep[];
  tags: string[];
  estimatedMinutes: number;
  creditCost: number;
  platform: string;
  platformRequirements: string[];
  inputs: TemplateInput[];
}

type ViewMode = 'grid' | 'list';

export default function TaskTemplates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Fetch templates from backend
  const { data: rawTemplates = [], isLoading } = trpc.templates.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Transform DB templates to UI format
  const templates: TaskTemplate[] = rawTemplates.map((t: any) => {
    const parsedSteps = typeof t.steps === 'string' ? JSON.parse(t.steps) : (t.steps || []);
    return {
      id: String(t.id),
      name: t.name || '',
      description: t.description || '',
      category: t.category || 'general',
      steps: parsedSteps.map((s: any, i: number) => ({
        order: i + 1,
        actionType: (s.action || 'browser').toLowerCase(),
        description: s.description || '',
      })),
      tags: [t.category || 'general'],
      estimatedMinutes: parsedSteps.length * 2,
      creditCost: Math.max(1, parsedSteps.length),
      platform: t.category === 'ghl' ? 'GoHighLevel' : 'General',
      platformRequirements: [],
      inputs: [],
    };
  });

  const runMutation = trpc.templates.execute.useMutation({
    onSuccess: (data: any) => {
      toast.success(data.message || 'Task started successfully');
      setSelectedTemplateId(null);
      setInputValues({});
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const categories = ['ghl', 'marketing', 'sales', 'operations'];

  const handleOpenTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setInputValues({});
  };

  const handleRunTemplate = () => {
    if (!selectedTemplate) return;
    runMutation.mutate({
      id: parseInt(selectedTemplate.id, 10),
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
            const count = templates.filter((t) => t.category === cat).length;
            return (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Template Grid View */}
      {viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleOpenTemplate(template.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    {ICON_MAP[template.id] ?? <Zap className="w-5 h-5" />}
                  </div>
                  <Badge className={CATEGORY_COLORS[template.category]}>
                    {CATEGORY_LABELS[template.category]}
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
                    <Clock className="w-3.5 h-3.5" />~{template.estimatedMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    {template.creditCost} credits
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    {template.steps.length} steps
                  </span>
                </div>
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{template.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => handleOpenTemplate(template.id)}
            >
              <div className="flex items-center gap-4 p-4">
                <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                  {ICON_MAP[template.id] ?? <Zap className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{template.name}</h3>
                    <Badge className={`${CATEGORY_COLORS[template.category]} text-[10px]`}>
                      {CATEGORY_LABELS[template.category]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{template.description}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />~{template.estimatedMinutes}m
                  </span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />{template.creditCost}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />{template.steps.length}
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
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium text-gray-700">Workflow Steps</p>
              <div className="space-y-1.5">
                {selectedTemplate.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-600 font-mono text-xs mt-0.5 min-w-[20px]">
                      {step.order}.
                    </span>
                    <Badge className={`${ACTION_TYPE_COLORS[step.actionType]} text-[10px] px-1.5 py-0 shrink-0`}>
                      {step.actionType}
                    </Badge>
                    <span className="text-gray-600">{step.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" /> ~{selectedTemplate.estimatedMinutes} min
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CreditCard className="w-3 h-3" /> {selectedTemplate.creditCost} credits
              </Badge>
              <Badge className={CATEGORY_COLORS[selectedTemplate.category]}>
                {selectedTemplate.platform}
              </Badge>
            </div>

            {/* Platform requirements */}
            {selectedTemplate.platformRequirements.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-1">Requires</p>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.platformRequirements.map((req) => (
                    <Badge key={req} variant="secondary" className="text-[10px]">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Input form */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Inputs</p>
              {selectedTemplate.inputs.map((input) => (
                <div key={input.name}>
                  <label className="text-sm text-gray-600 mb-1 block">
                    {input.label} {input.required && <span className="text-red-500">*</span>}
                  </label>
                  {input.type === 'textarea' ? (
                    <Textarea
                      placeholder={input.placeholder}
                      value={inputValues[input.name] || ''}
                      onChange={(e) =>
                        setInputValues((prev) => ({ ...prev, [input.name]: e.target.value }))
                      }
                      rows={3}
                    />
                  ) : input.type === 'select' && input.options ? (
                    <Select
                      value={inputValues[input.name] || ''}
                      onValueChange={(val) =>
                        setInputValues((prev) => ({ ...prev, [input.name]: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={input.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {input.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={input.type}
                      placeholder={input.placeholder}
                      value={inputValues[input.name] || ''}
                      onChange={(e) =>
                        setInputValues((prev) => ({ ...prev, [input.name]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>

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
