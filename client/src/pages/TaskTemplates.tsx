/**
 * TaskTemplates - Template Browser & Runner
 * Browse pre-built task templates, fill in inputs, and create tasks from them
 */

import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Play,
  Clock,
  Zap,
  Star,
  Grid3X3,
  List,
  ChevronRight,
  Loader2,
  CheckCircle,
  UserPlus,
  Mail,
  Workflow,
  Tags,
  FileSpreadsheet,
  BarChart3,
  PenTool,
  Sparkles,
  ArrowRight,
  Shield,
  LayoutTemplate,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

// Map icon names to lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  UserPlus,
  Mail,
  Workflow,
  Tags,
  FileSpreadsheet,
  Search,
  BarChart3,
  PenTool,
  Zap,
};

// Category icon map
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  Search,
  PenTool,
};

// Difficulty colors
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

type ViewMode = "grid" | "list";

export default function TaskTemplates() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const templatesQuery = trpc.templates.getAll.useQuery({
    category: selectedCategory === "all" ? undefined : selectedCategory,
    search: searchQuery || undefined,
  });
  const categoriesQuery = trpc.templates.getCategories.useQuery();

  // Mutations
  const executeMutation = trpc.templates.execute.useMutation({
    onSuccess: (result) => {
      toast.success("Task Created", {
        description: result.message,
      });
      setIsDetailOpen(false);
      setSelectedTemplate(null);
      setFormInputs({});
      // Navigate to task board to see the new task
      setLocation("/scheduled-tasks");
    },
    onError: (error) => {
      toast.error("Failed to create task", {
        description: error.message,
      });
    },
  });

  const templates = templatesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const openTemplate = (template: any) => {
    setSelectedTemplate(template);
    // Initialize form with default values
    const defaults: Record<string, any> = {};
    for (const input of template.inputs) {
      if (input.defaultValue !== undefined) {
        defaults[input.key] = input.defaultValue;
      }
    }
    setFormInputs(defaults);
    setIsDetailOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    executeMutation.mutate(
      { templateId: selectedTemplate.id, inputs: formInputs },
      { onSettled: () => setIsSubmitting(false) }
    );
  };

  const updateInput = (key: string, value: any) => {
    setFormInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Task Templates" }]} />
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Task Templates</h1>
            <p className="text-muted-foreground mt-1">
              Pre-built templates for common agency tasks. Select a template, fill in the details, and let your AI agent handle the rest.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="h-9"
            >
              All
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {SEEDED_TEMPLATE_COUNT}
              </Badge>
            </Button>
            {categories.map(cat => {
              const CatIcon = CATEGORY_ICON_MAP[cat.icon] || Zap;
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="h-9"
                >
                  <CatIcon className="h-3.5 w-3.5 mr-1" />
                  {cat.name}
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {cat.count}
                  </Badge>
                </Button>
              );
            })}
          </div>
          {/* View toggle */}
          <div className="flex border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-9 px-2.5 rounded-r-none", viewMode === "grid" && "bg-muted")}
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-9 px-2.5 rounded-l-none", viewMode === "list" && "bg-muted")}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {templatesQuery.isLoading && (
        <div className={cn(
          viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"
        )}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
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
      {!templatesQuery.isLoading && templates.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16">
          <LayoutTemplate className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No templates found</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {searchQuery ? "Try a different search term" : "No templates available in this category"}
          </p>
          {searchQuery && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          )}
        </Card>
      )}

      {/* Grid View */}
      {viewMode === "grid" && templates.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => openTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && templates.length > 0 && (
        <div className="space-y-2">
          {templates.map(template => (
            <TemplateListItem
              key={template.id}
              template={template}
              onClick={() => openTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Marketplace Coming Soon */}
      <Card className="border-dashed border-2 bg-muted/30">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium">Template Marketplace</h3>
              <p className="text-sm text-muted-foreground">Community templates and premium automation packs coming soon</p>
            </div>
          </div>
          <Badge variant="outline" className="text-purple-600 border-purple-200">Coming Soon</Badge>
        </CardContent>
      </Card>

      {/* Template Detail Modal */}
      <TemplateDetailDialog
        template={selectedTemplate}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedTemplate(null); }}
        formInputs={formInputs}
        onUpdateInput={updateInput}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// Use a constant for the total count
const SEEDED_TEMPLATE_COUNT = 8;

// ========================================
// TEMPLATE CARD (Grid View)
// ========================================

function TemplateCard({ template, onClick }: { template: any; onClick: () => void }) {
  const IconComponent = ICON_MAP[template.icon] || Zap;

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <IconComponent className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex items-center gap-1.5">
            {template.isNew && (
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">New</Badge>
            )}
            <Badge variant="outline" className={DIFFICULTY_COLORS[template.difficulty]}>
              {template.difficulty}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-base mt-3">{template.name}</CardTitle>
        <CardDescription className="line-clamp-2 text-sm">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {template.estimatedDuration}m
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              {template.creditCost} {template.creditCost === 1 ? "credit" : "credits"}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
        </div>
        {template.platformRequirements.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <Shield className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Requires: {template.platformRequirements.join(", ")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========================================
// TEMPLATE LIST ITEM (List View)
// ========================================

function TemplateListItem({ template, onClick }: { template: any; onClick: () => void }) {
  const IconComponent = ICON_MAP[template.icon] || Zap;

  return (
    <Card
      className="cursor-pointer hover:shadow-sm hover:border-emerald-200 transition-all"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 py-4">
        <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <IconComponent className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{template.name}</h3>
            {template.isNew && (
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">New</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{template.description}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
          <Badge variant="outline" className={DIFFICULTY_COLORS[template.difficulty]}>
            {template.difficulty}
          </Badge>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {template.estimatedDuration}m
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            {template.creditCost}
          </span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// TEMPLATE DETAIL DIALOG
// ========================================

function TemplateDetailDialog({
  template,
  isOpen,
  onClose,
  formInputs,
  onUpdateInput,
  onSubmit,
  isSubmitting,
}: {
  template: any;
  isOpen: boolean;
  onClose: () => void;
  formInputs: Record<string, any>;
  onUpdateInput: (key: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  if (!template) return null;

  const IconComponent = ICON_MAP[template.icon] || Zap;
  const allRequiredFilled = template.inputs
    .filter((f: any) => f.required)
    .every((f: any) => formInputs[f.key] && String(formInputs[f.key]).trim() !== "");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-2">
            {/* Template Info */}
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className={DIFFICULTY_COLORS[template.difficulty]}>
                {template.difficulty}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ~{template.estimatedDuration} min
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {template.creditCost} {template.creditCost === 1 ? "credit" : "credits"}
              </Badge>
              {template.platformRequirements.map((req: string) => (
                <Badge key={req} variant="outline" className="flex items-center gap-1 text-amber-700 border-amber-200">
                  <Shield className="h-3 w-3" />
                  {req}
                </Badge>
              ))}
            </div>

            {/* Steps Preview */}
            <div>
              <h4 className="text-sm font-medium mb-2">What the agent will do:</h4>
              <div className="space-y-1.5">
                {template.steps.map((step: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-medium mt-0.5">
                      {step.order}
                    </div>
                    <div>
                      <span className="font-medium">{step.name}</span>
                      <span className="text-muted-foreground"> — {step.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <div>
              <h4 className="text-sm font-medium mb-3">Configure task inputs:</h4>
              <div className="space-y-4">
                {template.inputs.map((field: any) => (
                  <TemplateInputField
                    key={field.key}
                    field={field}
                    value={formInputs[field.key]}
                    onChange={(val) => onUpdateInput(field.key, val)}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={!allRequiredFilled || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Task...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run from Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// TEMPLATE INPUT FIELD
// ========================================

function TemplateInputField({
  field,
  value,
  onChange,
}: {
  field: any;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Textarea
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
          {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
        </div>
      );

    case "multi-select":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <div className="flex flex-wrap gap-2">
            {field.options?.map((opt: any) => {
              const selected = Array.isArray(value) && value.includes(opt.value);
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8", selected && "bg-emerald-600 hover:bg-emerald-700")}
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    if (selected) {
                      onChange(current.filter((v: string) => v !== opt.value));
                    } else {
                      onChange([...current, opt.value]);
                    }
                  }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
          {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!value}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label className="cursor-pointer" onClick={() => onChange(!value)}>
            {field.label}
          </Label>
          {field.helpText && <p className="text-xs text-muted-foreground ml-1">({field.helpText})</p>}
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Input
            type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "number" ? "number" : "text"}
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
        </div>
      );
  }
}
