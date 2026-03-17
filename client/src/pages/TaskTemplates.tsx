import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Clock,
  Zap,
  Play,
  LayoutGrid,
  List,
  Filter,
  Loader2,
  Globe,
  Mail,
  Tag,
  FileText,
  Users,
  BarChart3,
  Sparkles,
  Wrench,
  Store,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type TemplateInput = {
  label: string;
  placeholder: string;
  required: boolean;
};

type TemplateStep = {
  action: string;
  description: string;
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof Globe }> = {
  ghl: { label: 'GoHighLevel', color: 'bg-blue-500/10 text-blue-700 border-blue-200', icon: Globe },
  marketing: { label: 'Marketing', color: 'bg-purple-500/10 text-purple-700 border-purple-200', icon: Mail },
  research: { label: 'Research', color: 'bg-amber-500/10 text-amber-700 border-amber-200', icon: BarChart3 },
  content: { label: 'Content', color: 'bg-green-500/10 text-green-700 border-green-200', icon: FileText },
  ops: { label: 'Operations', color: 'bg-slate-500/10 text-slate-700 border-slate-200', icon: Wrench },
};

const CATEGORY_TABS = [
  { key: 'all', label: 'All Templates' },
  { key: 'ghl', label: 'GoHighLevel' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'research', label: 'Research' },
  { key: 'content', label: 'Content' },
  { key: 'ops', label: 'Operations' },
];

export default function TaskTemplates() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  const { data: templates, isLoading } = trpc.templates.getAll.useQuery(
    activeCategory !== 'all' ? { category: activeCategory } : undefined,
    { refetchOnWindowFocus: false }
  );

  const executeMutation = trpc.templates.execute.useMutation();
  const seedMutation = trpc.templates.seed.useMutation();

  const filteredTemplates = (templates ?? []).filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      (t.platform as string | null)?.toLowerCase().includes(q)
    );
  });

  const handleOpenDetail = (template: any) => {
    setSelectedTemplate(template);
    // Initialize input values with empty strings
    const inputs = (template.inputs as TemplateInput[]) ?? [];
    const initial: Record<string, string> = {};
    inputs.forEach(inp => {
      initial[inp.label] = '';
    });
    setInputValues(initial);
  };

  const handleCloseDetail = () => {
    setSelectedTemplate(null);
    setInputValues({});
  };

  const handleExecute = async () => {
    if (!selectedTemplate) return;

    // Validate required fields
    const inputs = (selectedTemplate.inputs as TemplateInput[]) ?? [];
    const missing = inputs.filter(inp => inp.required && !inputValues[inp.label]?.trim());
    if (missing.length > 0) {
      toast.error(`Please fill in required fields: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setIsExecuting(true);
    try {
      const result = await executeMutation.mutateAsync({
        id: selectedTemplate.id,
        inputValues,
      });
      toast.success(result.message);
      handleCloseDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to execute template');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSeed = async () => {
    try {
      const result = await seedMutation.mutateAsync();
      toast.success(`Seeded templates: ${result.inserted} added, ${result.skipped} already existed`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed templates');
    }
  };

  const getCategoryBadge = (category: string | null) => {
    const cat = category ?? 'General';
    const config = CATEGORY_CONFIG[cat];
    if (!config) {
      return <Badge variant="outline">{cat}</Badge>;
    }
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
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
              Pre-built automation templates ready to run. Choose a template, fill in the details, and let the AI agent handle the rest.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Seed Templates
            </Button>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-1">
        {CATEGORY_TABS.map(tab => (
          <Button
            key={tab.key}
            variant={activeCategory === tab.key ? 'default' : 'ghost'}
            size="sm"
            className={activeCategory === tab.key ? '' : 'text-muted-foreground'}
            onClick={() => setActiveCategory(tab.key)}
          >
            {tab.label}
            {tab.key !== 'all' && templates && (
              <span className="ml-1 text-xs opacity-70">
                ({(templates ?? []).filter(t => tab.key === 'all' || t.category === tab.key).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Marketplace teaser */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="flex items-center gap-4 py-4">
          <Store className="h-8 w-8 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-emerald-800">Template Marketplace Coming Soon</p>
            <p className="text-sm text-emerald-600">
              Share your custom templates with the community and discover templates built by other agencies.
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-300 text-emerald-700 shrink-0">
            Coming Soon
          </Badge>
        </CardContent>
      </Card>

      {/* Template grid/list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20">
          <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No templates found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery
              ? 'Try adjusting your search or category filter.'
              : 'Click "Seed Templates" to load the default templates.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              getCategoryBadge={getCategoryBadge}
              onSelect={() => handleOpenDetail(template)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map(template => (
            <TemplateListItem
              key={template.id}
              template={template}
              getCategoryBadge={getCategoryBadge}
              onSelect={() => handleOpenDetail(template)}
            />
          ))}
        </div>
      )}

      {/* Template detail modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={open => !open && handleCloseDetail()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryBadge(selectedTemplate.category)}
                  {selectedTemplate.platform && selectedTemplate.platform !== 'General' && (
                    <Badge variant="outline">{selectedTemplate.platform as string}</Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{selectedTemplate.name}</DialogTitle>
                <DialogDescription>{selectedTemplate.description}</DialogDescription>
              </DialogHeader>

              {/* Meta info */}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  ~{selectedTemplate.estimatedMinutes ?? 5} min
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {selectedTemplate.estimatedCredits ?? 1} credits
                </div>
                {(selectedTemplate.usageCount ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Play className="h-4 w-4" />
                    {selectedTemplate.usageCount} runs
                  </div>
                )}
              </div>

              {/* Steps preview */}
              <div>
                <h4 className="text-sm font-medium mb-2">Steps</h4>
                <div className="space-y-1">
                  {((selectedTemplate.steps as TemplateStep[]) ?? []).map((step: TemplateStep, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="bg-muted text-muted-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                          {step.action}
                        </span>
                        <span className="mx-1 text-muted-foreground">-</span>
                        <span>{step.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required skills */}
              {((selectedTemplate.requiredSkills as string[]) ?? []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Required Capabilities</h4>
                  <div className="flex flex-wrap gap-1">
                    {((selectedTemplate.requiredSkills as string[]) ?? []).map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic input form */}
              {((selectedTemplate.inputs as TemplateInput[]) ?? []).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Inputs</h4>
                  {((selectedTemplate.inputs as TemplateInput[]) ?? []).map((inp: TemplateInput) => (
                    <div key={inp.label}>
                      <Label className="text-sm">
                        {inp.label}
                        {inp.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      <Input
                        className="mt-1"
                        placeholder={inp.placeholder}
                        value={inputValues[inp.label] ?? ''}
                        onChange={e =>
                          setInputValues(prev => ({ ...prev, [inp.label]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDetail}>
                  Cancel
                </Button>
                <Button onClick={handleExecute} disabled={isExecuting}>
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Use Template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub-components ---

function TemplateCard({
  template,
  getCategoryBadge,
  onSelect,
}: {
  template: any;
  getCategoryBadge: (cat: string | null) => React.ReactNode;
  onSelect: () => void;
}) {
  const steps = (template.steps as TemplateStep[]) ?? [];
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          {getCategoryBadge(template.category)}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {template.estimatedMinutes ?? 5}m
            </span>
            <span className="flex items-center gap-0.5">
              <Zap className="h-3 w-3" />
              {template.estimatedCredits ?? 1}cr
            </span>
          </div>
        </div>
        <CardTitle className="text-base mt-2 group-hover:text-emerald-700 transition-colors">
          {template.name}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-xs">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {steps.length} steps
          </span>
          {template.platform && template.platform !== 'General' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {template.platform as string}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateListItem({
  template,
  getCategoryBadge,
  onSelect,
}: {
  template: any;
  getCategoryBadge: (cat: string | null) => React.ReactNode;
  onSelect: () => void;
}) {
  const steps = (template.steps as TemplateStep[]) ?? [];
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onSelect}
    >
      <CardContent className="flex items-center gap-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getCategoryBadge(template.category)}
            {template.platform && template.platform !== 'General' && (
              <Badge variant="outline" className="text-[10px]">{template.platform as string}</Badge>
            )}
          </div>
          <h3 className="font-medium text-sm truncate">{template.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {template.estimatedMinutes ?? 5}m
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {template.estimatedCredits ?? 1}cr
          </span>
          <span>{steps.length} steps</span>
        </div>
        <Button variant="outline" size="sm" className="shrink-0">
          <Play className="h-3 w-3 mr-1" />
          Use
        </Button>
      </CardContent>
    </Card>
  );
}
