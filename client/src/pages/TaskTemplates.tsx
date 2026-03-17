import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  UserPlus,
  Mail,
  Workflow,
  Tags,
  FileBarChart,
  Sparkles,
  Search,
  PenLine,
  Play,
  Clock,
  LayoutGrid,
  List,
  Filter,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Map icon names to lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  UserPlus,
  Mail,
  Workflow,
  Tags,
  FileBarChart,
  Sparkles,
  Search,
  PenLine,
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; badgeBg: string }> = {
  crm: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badgeBg: 'bg-blue-100' },
  marketing: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badgeBg: 'bg-purple-100' },
  automation: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badgeBg: 'bg-amber-100' },
  reporting: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badgeBg: 'bg-emerald-100' },
  ai: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', badgeBg: 'bg-pink-100' },
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
};

type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  estimatedTime: string;
  difficulty: string;
  inputs: {
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    defaultValue?: string;
  }[];
  steps: string[];
  tags: string[];
};

export default function TaskTemplates() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const templatesQuery = trpc.taskTemplates.list.useQuery(
    selectedCategory !== 'all' ? { category: selectedCategory as any } : undefined
  );

  const createFromTemplate = trpc.taskTemplates.createFromTemplate.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedTemplate(null);
        setFormInputs({});
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowSuccess(false);
    // Pre-fill default values
    const defaults: Record<string, string> = {};
    template.inputs.forEach((input) => {
      if (input.defaultValue) {
        defaults[input.key] = input.defaultValue;
      }
    });
    setFormInputs(defaults);
  };

  const handleSubmit = () => {
    if (!selectedTemplate) return;
    createFromTemplate.mutate({
      templateId: selectedTemplate.id,
      inputs: formInputs,
    });
  };

  const updateInput = (key: string, value: string) => {
    setFormInputs((prev) => ({ ...prev, [key]: value }));
  };

  const templates = templatesQuery.data?.templates ?? [];
  const categories = templatesQuery.data?.categories ?? {};

  // Group templates by category for grid view
  const groupedTemplates: Record<string, Template[]> = {};
  templates.forEach((t) => {
    if (!groupedTemplates[t.category]) groupedTemplates[t.category] = [];
    groupedTemplates[t.category].push(t);
  });

  const IconComponent = ({ name }: { name: string }) => {
    const Icon = ICON_MAP[name] || Sparkles;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Templates</h1>
          <p className="text-gray-500 mt-1">
            Pre-built templates for common agency tasks. Pick a template and let your AI agent handle it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          <Filter className="w-4 h-4 mr-1" />
          All Templates
        </Button>
        {Object.entries(categories).map(([key, cat]) => {
          const style = CATEGORY_STYLES[key] || CATEGORY_STYLES.ai;
          return (
            <Button
              key={key}
              variant={selectedCategory === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(key)}
              className={selectedCategory !== key ? cn(style.text, 'border', style.border, 'hover:' + style.bg) : ''}
            >
              {(cat as any).label}
            </Button>
          );
        })}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <LayoutGrid className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.length}</p>
                <p className="text-xs text-gray-500">Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Object.keys(categories).length}</p>
                <p className="text-xs text-gray-500">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.filter((t) => t.category === 'ai').length}</p>
                <p className="text-xs text-gray-500">AI-Powered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Ready</p>
                <p className="text-xs text-gray-500">To Run</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {templatesQuery.isLoading && (
        <div className="text-center py-12 text-gray-500">Loading templates...</div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && !templatesQuery.isLoading && (
        <div className="space-y-8">
          {Object.entries(groupedTemplates).map(([category, catTemplates]) => {
            const catMeta = (categories as any)[category];
            const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.ai;
            return (
              <div key={category}>
                <h2 className={cn('text-lg font-semibold mb-4', style.text)}>
                  {catMeta?.label || category}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {catTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md border',
                        style.border,
                        'hover:' + style.bg
                      )}
                      onClick={() => openTemplate(template)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className={cn('p-2 rounded-lg', style.bg)}>
                            <div className={style.text}>
                              <IconComponent name={template.icon} />
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <Badge className={cn('text-xs', DIFFICULTY_STYLES[template.difficulty])}>
                              {template.difficulty}
                            </Badge>
                          </div>
                        </div>
                        <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                        <CardDescription className="text-sm line-clamp-2">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {template.estimatedTime}
                          </div>
                          <div className="flex gap-1">
                            {template.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && !templatesQuery.isLoading && (
        <div className="space-y-2">
          {templates.map((template) => {
            const style = CATEGORY_STYLES[template.category] || CATEGORY_STYLES.ai;
            const catMeta = (categories as any)[template.category];
            return (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => openTemplate(template)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-2 rounded-lg flex-shrink-0', style.bg)}>
                      <div className={style.text}>
                        <IconComponent name={template.icon} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{template.name}</h3>
                        <Badge className={cn('text-xs flex-shrink-0', style.badgeBg, style.text)}>
                          {catMeta?.label || template.category}
                        </Badge>
                        <Badge className={cn('text-xs flex-shrink-0', DIFFICULTY_STYLES[template.difficulty])}>
                          {template.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-0.5">{template.description}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 hidden sm:inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.estimatedTime}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Detail / Run Modal */}
      <Dialog open={selectedTemplate !== null} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        {selectedTemplate && (
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            {showSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Task Created!</h3>
                <p className="text-gray-500">
                  Your AI agent is now working on "{selectedTemplate.name}".
                </p>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn('p-2 rounded-lg', CATEGORY_STYLES[selectedTemplate.category]?.bg)}>
                      <div className={CATEGORY_STYLES[selectedTemplate.category]?.text}>
                        <IconComponent name={selectedTemplate.icon} />
                      </div>
                    </div>
                    <div>
                      <DialogTitle>{selectedTemplate.name}</DialogTitle>
                      <div className="flex gap-1.5 mt-1">
                        <Badge className={cn('text-xs', CATEGORY_STYLES[selectedTemplate.category]?.badgeBg, CATEGORY_STYLES[selectedTemplate.category]?.text)}>
                          {(categories as any)[selectedTemplate.category]?.label}
                        </Badge>
                        <Badge className={cn('text-xs', DIFFICULTY_STYLES[selectedTemplate.difficulty])}>
                          {selectedTemplate.difficulty}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {selectedTemplate.estimatedTime}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <DialogDescription>{selectedTemplate.description}</DialogDescription>
                </DialogHeader>

                {/* Steps Preview */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Steps the agent will perform:</h4>
                  <div className="space-y-1.5">
                    {selectedTemplate.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium">
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Input Form */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700">Configure task inputs:</h4>
                  {selectedTemplate.inputs.map((input) => (
                    <div key={input.key} className="space-y-1.5">
                      <Label htmlFor={input.key}>
                        {input.label}
                        {input.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      {input.type === 'text' && (
                        <Input
                          id={input.key}
                          placeholder={input.placeholder}
                          value={formInputs[input.key] || ''}
                          onChange={(e) => updateInput(input.key, e.target.value)}
                        />
                      )}
                      {input.type === 'textarea' && (
                        <Textarea
                          id={input.key}
                          placeholder={input.placeholder}
                          value={formInputs[input.key] || ''}
                          onChange={(e) => updateInput(input.key, e.target.value)}
                          rows={3}
                        />
                      )}
                      {input.type === 'select' && input.options && (
                        <Select
                          value={formInputs[input.key] || ''}
                          onValueChange={(val) => updateInput(input.key, val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${input.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {input.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleSubmit}
                    disabled={createFromTemplate.isPending}
                  >
                    {createFromTemplate.isPending ? (
                      'Creating...'
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        Run from Template
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
