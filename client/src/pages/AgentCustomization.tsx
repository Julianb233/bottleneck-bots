import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Bot,
  MessageSquare,
  SlidersHorizontal,
  AlertTriangle,
  FileText,
  Plus,
  X,
  Save,
  RefreshCw,
  Wrench,
  Globe,
  Zap,
  Mail,
  Phone,
  Search,
  Calendar,
  Database,
  BarChart3,
  Eye,
  Sparkles,
} from 'lucide-react';

// ========================================
// TYPES
// ========================================

type ResponseStyle = 'professional' | 'casual' | 'technical';
type Verbosity = 'concise' | 'balanced' | 'detailed';
type Permission = 'read' | 'read-write';

interface EscalationRule {
  condition: string;
  action: string;
}

interface BehaviorConfig {
  personality: string;
  responseStyle: ResponseStyle;
  verbosity: Verbosity;
  escalationRules: EscalationRule[];
  customInstructions: string;
}

interface Skill {
  id: string;
  name: string;
  enabled: boolean;
  permission: Permission;
  rateLimit?: number;
}

// ========================================
// DEFAULTS
// ========================================

const DEFAULT_BEHAVIOR: BehaviorConfig = {
  personality: 'You are a helpful, professional AI assistant for agency operations.',
  responseStyle: 'professional',
  verbosity: 'balanced',
  escalationRules: [],
  customInstructions: '',
};

const DEFAULT_SKILLS: Skill[] = [
  { id: 'browser', name: 'Browser Automation', enabled: true, permission: 'read-write' },
  { id: 'ghl_api', name: 'GoHighLevel API', enabled: true, permission: 'read-write' },
  { id: 'email', name: 'Email Sending', enabled: true, permission: 'read-write' },
  { id: 'sms', name: 'SMS Messaging', enabled: false, permission: 'read' },
  { id: 'voice', name: 'Voice Calling', enabled: false, permission: 'read' },
  { id: 'file_creation', name: 'File Creation', enabled: true, permission: 'read-write' },
  { id: 'web_scraping', name: 'Web Scraping', enabled: true, permission: 'read' },
  { id: 'calendar', name: 'Calendar Management', enabled: true, permission: 'read-write' },
  { id: 'crm', name: 'CRM Operations', enabled: true, permission: 'read-write' },
  { id: 'reporting', name: 'Report Generation', enabled: true, permission: 'read' },
];

// ========================================
// SKILL METADATA
// ========================================

interface SkillMeta {
  icon: React.ElementType;
  description: string;
  color: string;
}

const SKILL_META: Record<string, SkillMeta> = {
  browser: { icon: Globe, description: 'Navigate websites, fill forms, click buttons', color: 'text-blue-600 bg-blue-50' },
  ghl_api: { icon: Zap, description: 'Manage contacts, pipelines, campaigns in GHL', color: 'text-emerald-600 bg-emerald-50' },
  email: { icon: Mail, description: 'Send emails on behalf of your agency', color: 'text-purple-600 bg-purple-50' },
  sms: { icon: MessageSquare, description: 'Send text messages to contacts', color: 'text-sky-600 bg-sky-50' },
  voice: { icon: Phone, description: 'Make outbound phone calls', color: 'text-amber-600 bg-amber-50' },
  file_creation: { icon: FileText, description: 'Generate documents, spreadsheets, reports', color: 'text-indigo-600 bg-indigo-50' },
  web_scraping: { icon: Search, description: 'Extract data from websites', color: 'text-rose-600 bg-rose-50' },
  calendar: { icon: Calendar, description: 'Schedule and manage appointments', color: 'text-teal-600 bg-teal-50' },
  crm: { icon: Database, description: 'CRUD operations on your CRM data', color: 'text-orange-600 bg-orange-50' },
  reporting: { icon: BarChart3, description: 'Create analytics and performance reports', color: 'text-cyan-600 bg-cyan-50' },
};

function getSkillMeta(skillId: string): SkillMeta {
  return SKILL_META[skillId] ?? { icon: Zap, description: 'AI capability module', color: 'text-gray-600 bg-gray-50' };
}

// ========================================
// SUB-COMPONENTS
// ========================================

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-600" />
          {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EscalationRuleRow({
  rule,
  index,
  onChange,
  onRemove,
}: {
  rule: EscalationRule;
  index: number;
  onChange: (updated: EscalationRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0 text-xs text-gray-400 w-4 text-right">{index + 1}.</span>
      <Input
        className="flex-1 h-8 text-xs"
        placeholder="Condition (e.g. user asks about billing)"
        value={rule.condition}
        onChange={(e) => onChange({ ...rule, condition: e.target.value })}
      />
      <span className="flex-shrink-0 text-xs text-gray-400">&rarr;</span>
      <Input
        className="flex-1 h-8 text-xs"
        placeholder="Action (e.g. escalate to human agent)"
        value={rule.action}
        onChange={(e) => onChange({ ...rule, action: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-gray-400 hover:text-red-500"
        onClick={onRemove}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

function ToolCard({
  skill,
  onChange,
}: {
  skill: Skill;
  onChange: (updated: Skill) => void;
}) {
  const meta = getSkillMeta(skill.id);
  const Icon = meta.icon;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        skill.enabled
          ? 'border-l-4 border-l-emerald-500 shadow-sm'
          : 'border-l-4 border-l-transparent'
      )}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg flex-shrink-0', meta.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-gray-900 text-sm truncate">{skill.name}</p>
              <Switch
                checked={skill.enabled}
                onCheckedChange={(checked) => onChange({ ...skill, enabled: checked })}
                className={cn(skill.enabled && 'data-[state=checked]:bg-emerald-500')}
              />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{meta.description}</p>
            {skill.enabled && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                <Label className="text-xs text-gray-500 flex-shrink-0">Permission</Label>
                <Select
                  value={skill.permission}
                  onValueChange={(val) => onChange({ ...skill, permission: val as Permission })}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read" className="text-xs">Read Only</SelectItem>
                    <SelectItem value="read-write" className="text-xs">Read-Write</SelectItem>
                  </SelectContent>
                </Select>
                <Badge
                  className={cn(
                    'text-xs flex-shrink-0',
                    skill.permission === 'read-write'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  )}
                >
                  {skill.permission === 'read-write' ? 'R/W' : 'R'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function AgentCustomization() {
  // Behavior state
  const [behavior, setBehavior] = useState<BehaviorConfig>(DEFAULT_BEHAVIOR);
  const [behaviorDirty, setBehaviorDirty] = useState(false);

  // Skills state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsDirty, setSkillsDirty] = useState(false);

  // Queries
  const behaviorQuery = trpc.agentTraining.getBehaviorConfig.useQuery();
  const skillsQuery = trpc.agentTraining.getSkillConfig.useQuery();
  const previewQuery = trpc.agentTraining.previewTrainingContext.useQuery(undefined, { enabled: false });

  // Mutations
  const updateBehavior = trpc.agentTraining.updateBehaviorConfig.useMutation({
    onSuccess: () => {
      toast.success('Personality & instructions saved');
      setBehaviorDirty(false);
      void behaviorQuery.refetch();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const updateSkills = trpc.agentTraining.updateSkillConfig.useMutation({
    onSuccess: () => {
      toast.success('Tool configuration saved');
      setSkillsDirty(false);
      void skillsQuery.refetch();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  // Sync behavior from server
  useEffect(() => {
    if (behaviorQuery.data?.behavior) {
      const b = behaviorQuery.data.behavior;
      setBehavior({
        personality: b.personality ?? DEFAULT_BEHAVIOR.personality,
        responseStyle: (b.responseStyle ?? 'professional') as ResponseStyle,
        verbosity: (b.verbosity ?? 'balanced') as Verbosity,
        escalationRules: Array.isArray(b.escalationRules) ? b.escalationRules : [],
        customInstructions: b.customInstructions ?? '',
      });
      setBehaviorDirty(false);
    }
  }, [behaviorQuery.data]);

  // Sync skills from server
  useEffect(() => {
    if (skillsQuery.data) {
      const fetched = skillsQuery.data.skills;
      setSkills(Array.isArray(fetched) && fetched.length > 0 ? fetched as Skill[] : DEFAULT_SKILLS);
      setSkillsDirty(false);
    }
  }, [skillsQuery.data]);

  // Behavior helpers
  function updateBehaviorField<K extends keyof BehaviorConfig>(key: K, value: BehaviorConfig[K]) {
    setBehavior((prev) => ({ ...prev, [key]: value }));
    setBehaviorDirty(true);
  }

  function addRule() {
    setBehavior((prev) => ({
      ...prev,
      escalationRules: [...prev.escalationRules, { condition: '', action: '' }],
    }));
    setBehaviorDirty(true);
  }

  function updateRule(index: number, updated: EscalationRule) {
    setBehavior((prev) => {
      const rules = [...prev.escalationRules];
      rules[index] = updated;
      return { ...prev, escalationRules: rules };
    });
    setBehaviorDirty(true);
  }

  function removeRule(index: number) {
    setBehavior((prev) => ({
      ...prev,
      escalationRules: prev.escalationRules.filter((_, i) => i !== index),
    }));
    setBehaviorDirty(true);
  }

  function handleSaveBehavior() {
    updateBehavior.mutate({
      personality: behavior.personality,
      responseStyle: behavior.responseStyle,
      verbosity: behavior.verbosity,
      escalationRules: behavior.escalationRules,
      customInstructions: behavior.customInstructions,
    });
  }

  // Skills helpers
  function handleSkillChange(updated: Skill) {
    setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSkillsDirty(true);
  }

  function handleSaveSkills() {
    updateSkills.mutate({ skills });
  }

  // Preview
  const [showPreview, setShowPreview] = useState(false);

  function handlePreview() {
    setShowPreview(!showPreview);
    if (!showPreview) {
      previewQuery.refetch();
    }
  }

  const enabledCount = skills.filter((s) => s.enabled).length;
  const isLoading = behaviorQuery.isLoading || skillsQuery.isLoading;
  const hasUnsaved = behaviorDirty || skillsDirty;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto overflow-y-auto h-full pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Customization</h1>
          <p className="text-gray-500 mt-1">
            Configure your agent's personality, instructions, and available tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            className="gap-1.5"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide Preview' : 'Preview Prompt'}
          </Button>
        </div>
      </div>

      {/* Prompt Preview */}
      {showPreview && (
        <Card className="border-dashed border-purple-300 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
              <Sparkles className="w-4 h-4" />
              System Prompt Preview
            </CardTitle>
            <CardDescription className="text-xs">
              This is what gets injected into every agent session
              {previewQuery.data?.promptFragmentLength && (
                <span className="ml-2 text-purple-600 font-medium">
                  ({previewQuery.data.promptFragmentLength.toLocaleString()} chars)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : previewQuery.data?.promptFragment ? (
              <pre className="text-xs text-gray-700 bg-white rounded-lg p-4 border max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                {previewQuery.data.promptFragment}
              </pre>
            ) : (
              <p className="text-sm text-gray-500">No training context configured yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="personality" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personality" className="gap-1.5">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Personality</span>
          </TabsTrigger>
          <TabsTrigger value="instructions" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Instructions</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Tools</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {enabledCount}/{skills.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ============ PERSONALITY TAB ============ */}
        <TabsContent value="personality" className="space-y-6">
          {/* Personality Prompt */}
          <SectionCard
            icon={Bot}
            title="Agent Personality"
            description="Define the character and tone your agent should embody"
          >
            <div className="space-y-1.5">
              <Label htmlFor="personality">Personality Prompt</Label>
              <Textarea
                id="personality"
                placeholder="Describe how your agent should behave. Example: You are a professional, efficient assistant that represents our agency. Always be polite, concise, and solution-focused."
                rows={5}
                value={behavior.personality}
                onChange={(e) => updateBehaviorField('personality', e.target.value)}
                className="resize-none"
              />
              <p className="text-xs text-gray-400">
                This text is prepended to every agent session as a system prompt.
              </p>
            </div>
          </SectionCard>

          {/* Communication Style */}
          <SectionCard
            icon={MessageSquare}
            title="Communication Style"
            description="Control the tone and length of agent responses"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="response-style">Response Style</Label>
                <Select
                  value={behavior.responseStyle}
                  onValueChange={(val) => updateBehaviorField('responseStyle', val as ResponseStyle)}
                >
                  <SelectTrigger id="response-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">
                      <div>
                        <span className="font-medium">Professional</span>
                        <span className="text-xs text-gray-500 ml-2">Formal, business-appropriate</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="casual">
                      <div>
                        <span className="font-medium">Casual</span>
                        <span className="text-xs text-gray-500 ml-2">Friendly, conversational</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="technical">
                      <div>
                        <span className="font-medium">Technical</span>
                        <span className="text-xs text-gray-500 ml-2">Precise, detail-oriented</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="verbosity">Verbosity</Label>
                <Select
                  value={behavior.verbosity}
                  onValueChange={(val) => updateBehaviorField('verbosity', val as Verbosity)}
                >
                  <SelectTrigger id="verbosity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">
                      <div>
                        <span className="font-medium">Concise</span>
                        <span className="text-xs text-gray-500 ml-2">Short, to-the-point</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="balanced">
                      <div>
                        <span className="font-medium">Balanced</span>
                        <span className="text-xs text-gray-500 ml-2">Moderate detail level</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="detailed">
                      <div>
                        <span className="font-medium">Detailed</span>
                        <span className="text-xs text-gray-500 ml-2">Thorough explanations</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* Escalation Rules */}
          <SectionCard
            icon={AlertTriangle}
            title="Escalation Rules"
            description="Define when your agent should escalate to a human or take a specific action"
          >
            <div className="space-y-3">
              {behavior.escalationRules.length > 0 && (
                <div className="flex items-center gap-2 px-6">
                  <span className="flex-1 text-xs font-medium text-gray-500">Condition</span>
                  <span className="w-4" />
                  <span className="flex-1 text-xs font-medium text-gray-500">Action</span>
                  <span className="w-7" />
                </div>
              )}
              <div className="space-y-2">
                {behavior.escalationRules.map((rule, i) => (
                  <EscalationRuleRow
                    key={i}
                    rule={rule}
                    index={i}
                    onChange={(updated) => updateRule(i, updated)}
                    onRemove={() => removeRule(i)}
                  />
                ))}
              </div>
              {behavior.escalationRules.length === 0 && (
                <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
                  <AlertTriangle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No escalation rules defined</p>
                  <p className="text-xs text-gray-300 mt-0.5">Add rules to handle edge cases automatically</p>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRule}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Rule
              </Button>
            </div>
          </SectionCard>

          {/* Save Personality */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {behaviorDirty && (
              <p className="text-xs text-amber-600">You have unsaved changes</p>
            )}
            <div className="ml-auto">
              <Button
                onClick={handleSaveBehavior}
                disabled={!behaviorDirty || updateBehavior.isPending}
                className={cn(
                  'transition-all',
                  behaviorDirty
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {updateBehavior.isPending ? 'Saving...' : 'Save Personality'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ============ INSTRUCTIONS TAB ============ */}
        <TabsContent value="instructions" className="space-y-6">
          <SectionCard
            icon={FileText}
            title="System Instructions"
            description="Custom instructions appended to every agent session. Use for rules, constraints, and domain-specific knowledge."
          >
            <div className="space-y-1.5">
              <Label htmlFor="custom-instructions">Custom Instructions</Label>
              <Textarea
                id="custom-instructions"
                placeholder="Any extra rules, constraints, or context your agent should always follow. Example:&#10;&#10;- Always confirm before deleting any records&#10;- Default timezone is America/New_York&#10;- When unsure about pricing, direct users to the pricing page&#10;- Never share API keys or credentials in responses"
                rows={10}
                value={behavior.customInstructions}
                onChange={(e) => updateBehaviorField('customInstructions', e.target.value)}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-400">
                These instructions supplement the personality prompt. Use for rules, constraints, and
                domain-specific knowledge.
              </p>
            </div>
          </SectionCard>

          {/* Instruction Templates */}
          <SectionCard
            icon={Sparkles}
            title="Quick Templates"
            description="Pre-built instruction snippets you can add to your custom instructions"
          >
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { label: 'Safety First', text: 'Always confirm before any destructive actions (delete, bulk send, etc). Never proceed without explicit user approval for irreversible operations.' },
                { label: 'Brand Voice', text: 'Maintain a consistent brand voice. Use the company name when referencing the business. Keep communications professional and on-brand.' },
                { label: 'Data Privacy', text: 'Never expose PII, API keys, or internal system details in responses. Mask sensitive data in logs and reports.' },
                { label: 'Timezone & Locale', text: 'Default timezone: America/New_York. Format dates as MM/DD/YYYY. Use USD for currency unless specified otherwise.' },
              ].map((template) => (
                <button
                  key={template.label}
                  type="button"
                  className="text-left p-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors group"
                  onClick={() => {
                    const separator = behavior.customInstructions.trim() ? '\n\n' : '';
                    updateBehaviorField('customInstructions', behavior.customInstructions + separator + template.text);
                    toast.success(`Added "${template.label}" template`);
                  }}
                >
                  <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-700">{template.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.text}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Save Instructions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {behaviorDirty && (
              <p className="text-xs text-amber-600">You have unsaved changes</p>
            )}
            <div className="ml-auto">
              <Button
                onClick={handleSaveBehavior}
                disabled={!behaviorDirty || updateBehavior.isPending}
                className={cn(
                  'transition-all',
                  behaviorDirty
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {updateBehavior.isPending ? 'Saving...' : 'Save Instructions'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ============ TOOLS TAB ============ */}
        <TabsContent value="tools" className="space-y-6">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Tools</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Toggle capabilities your agent can use.{' '}
                <span className="font-medium text-emerald-600">{enabledCount}</span> of{' '}
                {skills.length} enabled.
              </p>
            </div>
            <Button
              onClick={handleSaveSkills}
              disabled={!skillsDirty || updateSkills.isPending}
              className={cn(
                'transition-all',
                skillsDirty
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
              size="sm"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {updateSkills.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* Tool Cards Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {skills.map((skill) => (
              <ToolCard key={skill.id} skill={skill} onChange={handleSkillChange} />
            ))}
          </div>

          {/* Unsaved changes notice */}
          {skillsDirty && (
            <p className="text-xs text-amber-600 text-center">
              You have unsaved changes &mdash; click "Save Changes" to apply them.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Global unsaved indicator */}
      {hasUnsaved && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
          <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Unsaved changes
          </div>
        </div>
      )}
    </div>
  );
}
