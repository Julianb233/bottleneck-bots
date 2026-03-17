import React, { useState } from 'react';
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
  CreditCard,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';

interface TemplateStep {
  action: string;
  description: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ghl' | 'marketing' | 'research' | 'content';
  platform: string;
  icon: React.ReactNode;
  steps: TemplateStep[];
  estimatedMinutes: number;
  estimatedCredits: number;
  requiredSkills: string[];
  inputs: { label: string; placeholder: string; required: boolean }[];
}

const TEMPLATES: TaskTemplate[] = [
  {
    id: 'ghl-add-contact',
    name: 'Add Contact to Pipeline',
    description: 'Create a new contact in GHL and add them to a specific pipeline stage.',
    category: 'ghl',
    platform: 'GoHighLevel',
    icon: <Users className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Open GoHighLevel contacts page' },
      { action: 'Click', description: 'Click "Add Contact" button' },
      { action: 'Type', description: 'Fill in contact details (name, email, phone)' },
      { action: 'Click', description: 'Save contact' },
      { action: 'Navigate', description: 'Go to pipeline view' },
      { action: 'Click', description: 'Add contact to specified pipeline stage' },
    ],
    estimatedMinutes: 3,
    estimatedCredits: 2,
    requiredSkills: ['browser', 'ghl_api'],
    inputs: [
      { label: 'Contact Name', placeholder: 'John Doe', required: true },
      { label: 'Email', placeholder: 'john@example.com', required: true },
      { label: 'Phone', placeholder: '+1 555-0123', required: false },
      { label: 'Pipeline Name', placeholder: 'Sales Pipeline', required: true },
      { label: 'Stage', placeholder: 'New Lead', required: true },
    ],
  },
  {
    id: 'ghl-launch-campaign',
    name: 'Launch Email Campaign',
    description: 'Select contacts by tag/segment and launch an email campaign in GHL.',
    category: 'ghl',
    platform: 'GoHighLevel',
    icon: <Mail className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Open GHL marketing campaigns' },
      { action: 'Click', description: 'Create new campaign' },
      { action: 'Type', description: 'Set campaign name and email content' },
      { action: 'Click', description: 'Select target contacts by tag' },
      { action: 'Verify', description: 'Review campaign settings' },
      { action: 'Click', description: 'Launch campaign' },
    ],
    estimatedMinutes: 5,
    estimatedCredits: 3,
    requiredSkills: ['browser', 'ghl_api', 'email'],
    inputs: [
      { label: 'Campaign Name', placeholder: 'March Newsletter', required: true },
      { label: 'Target Tag', placeholder: 'active-clients', required: true },
      { label: 'Email Subject', placeholder: 'Your March Update', required: true },
      { label: 'Brief Description', placeholder: 'Monthly newsletter with latest updates...', required: true },
    ],
  },
  {
    id: 'ghl-update-tags',
    name: 'Bulk Update Contact Tags',
    description: 'Search for contacts matching criteria and add/remove tags in bulk.',
    category: 'ghl',
    platform: 'GoHighLevel',
    icon: <Tag className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Open GHL contacts' },
      { action: 'Click', description: 'Apply search filters' },
      { action: 'Click', description: 'Select all matching contacts' },
      { action: 'Click', description: 'Bulk actions > Add/Remove tags' },
      { action: 'Type', description: 'Enter tag name' },
      { action: 'Verify', description: 'Confirm bulk update' },
    ],
    estimatedMinutes: 3,
    estimatedCredits: 2,
    requiredSkills: ['browser', 'ghl_api'],
    inputs: [
      { label: 'Search Criteria', placeholder: 'e.g., contacts from San Diego', required: true },
      { label: 'Tag to Add', placeholder: 'vip-client', required: false },
      { label: 'Tag to Remove', placeholder: 'cold-lead', required: false },
    ],
  },
  {
    id: 'ghl-pipeline-report',
    name: 'Export Pipeline Report',
    description: 'Pull pipeline data from GHL and generate a CSV report.',
    category: 'ghl',
    platform: 'GoHighLevel',
    icon: <FileSpreadsheet className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Open GHL pipeline view' },
      { action: 'Extract', description: 'Gather all opportunities and their stages' },
      { action: 'Extract', description: 'Collect values, dates, and assigned users' },
      { action: 'API Call', description: 'Format data as CSV' },
      { action: 'Verify', description: 'Validate report completeness' },
    ],
    estimatedMinutes: 4,
    estimatedCredits: 3,
    requiredSkills: ['browser', 'ghl_api', 'file_creation'],
    inputs: [
      { label: 'Pipeline Name', placeholder: 'Sales Pipeline', required: true },
      { label: 'Date Range', placeholder: 'Last 30 days', required: false },
    ],
  },
  {
    id: 'ghl-create-workflow',
    name: 'Create GHL Workflow',
    description: 'Build an automation workflow in GoHighLevel with triggers and actions.',
    category: 'ghl',
    platform: 'GoHighLevel',
    icon: <Zap className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Open GHL automations' },
      { action: 'Click', description: 'Create new workflow' },
      { action: 'Type', description: 'Set workflow name and trigger' },
      { action: 'Click', description: 'Add action steps' },
      { action: 'Type', description: 'Configure each action' },
      { action: 'Click', description: 'Save and activate workflow' },
    ],
    estimatedMinutes: 8,
    estimatedCredits: 5,
    requiredSkills: ['browser', 'ghl_api'],
    inputs: [
      { label: 'Workflow Name', placeholder: 'New Lead Follow-up', required: true },
      { label: 'Trigger', placeholder: 'When contact is created', required: true },
      { label: 'Actions Description', placeholder: 'Send welcome email, wait 1 day, send SMS', required: true },
    ],
  },
  {
    id: 'lead-enrichment',
    name: 'Lead Enrichment',
    description: 'Research a company and find key decision makers with contact info.',
    category: 'research',
    platform: 'General',
    icon: <Search className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Search for company website' },
      { action: 'Extract', description: 'Gather company info (size, industry, location)' },
      { action: 'Navigate', description: 'Search LinkedIn for decision makers' },
      { action: 'Extract', description: 'Collect names, titles, and contact info' },
      { action: 'API Call', description: 'Compile enrichment report' },
    ],
    estimatedMinutes: 6,
    estimatedCredits: 4,
    requiredSkills: ['browser', 'web_scraping'],
    inputs: [
      { label: 'Company Name', placeholder: 'Acme Corp', required: true },
      { label: 'Company Website', placeholder: 'https://acme.com', required: false },
      { label: 'Target Roles', placeholder: 'CEO, CMO, VP Marketing', required: false },
    ],
  },
  {
    id: 'competitor-analysis',
    name: 'Competitor Analysis',
    description: 'Browse competitor websites and compile a comparison report.',
    category: 'research',
    platform: 'General',
    icon: <BarChart3 className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Visit competitor website' },
      { action: 'Extract', description: 'Analyze features, pricing, positioning' },
      { action: 'Navigate', description: 'Check competitor reviews and social' },
      { action: 'Extract', description: 'Gather strengths and weaknesses' },
      { action: 'API Call', description: 'Generate comparison report' },
    ],
    estimatedMinutes: 10,
    estimatedCredits: 5,
    requiredSkills: ['browser', 'web_scraping', 'reporting'],
    inputs: [
      { label: 'Your Company/Product', placeholder: 'Our SaaS Product', required: true },
      { label: 'Competitor URLs', placeholder: 'https://competitor1.com, https://competitor2.com', required: true },
      { label: 'Focus Areas', placeholder: 'Pricing, features, UX', required: false },
    ],
  },
  {
    id: 'content-creation',
    name: 'Content Creation',
    description: 'Write a blog post and social media posts from a content brief.',
    category: 'content',
    platform: 'General',
    icon: <PenTool className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Research topic online' },
      { action: 'Extract', description: 'Gather key points and data' },
      { action: 'API Call', description: 'Generate blog post draft' },
      { action: 'API Call', description: 'Create social media variations' },
      { action: 'Verify', description: 'Review content quality' },
    ],
    estimatedMinutes: 8,
    estimatedCredits: 4,
    requiredSkills: ['browser', 'web_scraping', 'file_creation'],
    inputs: [
      { label: 'Topic', placeholder: 'How AI is transforming marketing agencies', required: true },
      { label: 'Target Audience', placeholder: 'Agency owners, 25-45', required: true },
      { label: 'Tone', placeholder: 'Professional but conversational', required: false },
      { label: 'Word Count', placeholder: '1500', required: false },
    ],
  },
  {
    id: 'social-scheduling',
    name: 'Schedule Social Posts',
    description: 'Create and schedule social media posts across platforms.',
    category: 'marketing',
    platform: 'General',
    icon: <Megaphone className="w-5 h-5" />,
    steps: [
      { action: 'API Call', description: 'Generate post content from brief' },
      { action: 'Navigate', description: 'Open social media scheduler' },
      { action: 'Type', description: 'Enter post content' },
      { action: 'Click', description: 'Select platforms and schedule time' },
      { action: 'Verify', description: 'Confirm scheduling' },
    ],
    estimatedMinutes: 5,
    estimatedCredits: 3,
    requiredSkills: ['browser', 'file_creation'],
    inputs: [
      { label: 'Post Topic', placeholder: 'Product launch announcement', required: true },
      { label: 'Platforms', placeholder: 'LinkedIn, Twitter, Facebook', required: true },
      { label: 'Schedule Date', placeholder: 'Next Monday 9am', required: false },
    ],
  },
  {
    id: 'website-audit',
    name: 'Website Audit',
    description: 'Crawl a website and generate a comprehensive SEO/UX audit report.',
    category: 'research',
    platform: 'General',
    icon: <Globe className="w-5 h-5" />,
    steps: [
      { action: 'Navigate', description: 'Load target website' },
      { action: 'Extract', description: 'Check page speed, meta tags, structure' },
      { action: 'Navigate', description: 'Test key user flows' },
      { action: 'Extract', description: 'Identify broken links and issues' },
      { action: 'API Call', description: 'Compile audit report with recommendations' },
    ],
    estimatedMinutes: 12,
    estimatedCredits: 6,
    requiredSkills: ['browser', 'web_scraping', 'reporting'],
    inputs: [
      { label: 'Website URL', placeholder: 'https://example.com', required: true },
      { label: 'Focus', placeholder: 'SEO, performance, accessibility', required: false },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  ghl: 'bg-blue-100 text-blue-700',
  marketing: 'bg-pink-100 text-pink-700',
  research: 'bg-purple-100 text-purple-700',
  content: 'bg-amber-100 text-amber-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  ghl: 'GoHighLevel',
  marketing: 'Marketing',
  research: 'Research',
  content: 'Content',
};

export default function TaskTemplates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const filteredTemplates = TEMPLATES.filter((t) => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ghl', 'marketing', 'research', 'content'];

  const handleOpenTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setInputValues({});
  };

  const handleRunTemplate = () => {
    if (!selectedTemplate) return;
    const missingRequired = selectedTemplate.inputs
      .filter((i) => i.required && !inputValues[i.label]?.trim());

    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.map((i) => i.label).join(', ')}`);
      return;
    }

    toast.success(`Task "${selectedTemplate.name}" queued for execution`);
    setSelectedTemplate(null);
    setInputValues({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Task Templates</h1>
        <p className="text-gray-500 mt-1">
          Pre-built templates for common agency tasks. Select one to run with your agent.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
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
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => handleOpenTemplate(template)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-emerald-100 transition-colors">
                  {template.icon}
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
                  <Clock className="w-3.5 h-3.5" />
                  ~{template.estimatedMinutes} min
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  {template.estimatedCredits} credits
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  {template.steps.length} steps
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No templates match your search</p>
          <p className="text-sm text-gray-400">Try a different search term or category</p>
        </div>
      )}

      {/* Template Detail Dialog */}
      <Dialog open={selectedTemplate !== null} onOpenChange={() => setSelectedTemplate(null)}>
        {selectedTemplate && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  {selectedTemplate.icon}
                </div>
                <div>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <DialogDescription>{selectedTemplate.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Steps preview */}
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium text-gray-700">Steps</p>
              <div className="space-y-1">
                {selectedTemplate.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-600 font-mono text-xs mt-0.5 min-w-[20px]">{i + 1}.</span>
                    <span className="text-gray-600">{step.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info badges */}
            <div className="flex gap-3 mb-4">
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" /> ~{selectedTemplate.estimatedMinutes} min
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CreditCard className="w-3 h-3" /> {selectedTemplate.estimatedCredits} credits
              </Badge>
              <Badge className={CATEGORY_COLORS[selectedTemplate.category]}>
                {selectedTemplate.platform}
              </Badge>
            </div>

            {/* Input form */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Inputs</p>
              {selectedTemplate.inputs.map((input) => (
                <div key={input.label}>
                  <label className="text-sm text-gray-600 mb-1 block">
                    {input.label} {input.required && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    placeholder={input.placeholder}
                    value={inputValues[input.label] || ''}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, [input.label]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={handleRunTemplate}
              >
                <Play className="w-4 h-4" />
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
