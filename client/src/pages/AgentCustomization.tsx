import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  FileText,
  Wrench,
  Eye,
  Save,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Globe,
  Zap,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Calendar,
  Database,
  BarChart3,
} from 'lucide-react';

// Types

type ResponseStyle = 'professional' | 'casual' | 'technical';
type Verbosity = 'concise' | 'balanced' | 'detailed';
type Permission = 'read' | 'read-write';

interface BehaviorConfig {
  personality: string;
  responseStyle: ResponseStyle;
  verbosity: Verbosity;
  escalationRules: Array<{ condition: string; action: string }>;
  customInstructions: string;
}

interface Skill {
  id: string;
  name: string;
  enabled: boolean;
  permission: Permission;
}

const DEFAULT_BEHAVIOR: BehaviorConfig = {
  personality: 'You are a helpful, professional AI assistant for agency operations.',
  responseStyle: 'professional',
  verbosity: 'balanced',
  escalationRules: [],
  customInstructions: '',
};

// Skill icon mapping
const SKILL_ICONS: Record<string, React.ElementType> = {
  browser: Globe,
  ghl_api: Zap,
  email: Mail,
  sms: MessageSquare,
  voice: Phone,
  file_creation: FileText,
  web_scraping: Search,
  calendar: Calendar,
  crm: Database,
  reporting: BarChart3,
};

export default function AgentCustomization() {
  const [behavior, setBehavior] = useState<BehaviorConfig>(DEFAULT_BEHAVIOR);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [behaviorDirty, setBehaviorDirty] = useState(false);
  const [skillsDirty, setSkillsDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  const behaviorQuery = trpc.agentTraining.getBehaviorConfig.useQuery();
  const skillsQuery = trpc.agentTraining.getSkillConfig.useQuery();

  const updateBehavior = trpc.agentTraining.updateBehaviorConfig.useMutation({
    onSuccess: () => {
      toast.success('Agent personality & instructions saved');
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
    if (skillsQuery.data?.skills) {
      setSkills(skillsQuery.data.skills as Skill[]);
      setSkillsDirty(false);
    }
  }, [skillsQuery.data]);

  function updateBehaviorField<K extends keyof BehaviorConfig>(key: K, value: BehaviorConfig[K]) {
    setBehavior((prev) => ({ ...prev, [key]: value }));
    setBehaviorDirty(true);
  }

  function toggleSkill(skillId: string, enabled: boolean) {
    setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, enabled } : s)));
    setSkillsDirty(true);
  }

  function updateSkillPermission(skillId: string, permission: Permission) {
    setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, permission } : s)));
    setSkillsDirty(true);
  }

  function handleSaveBehavior() {
    updateBehavior.mutate({
      personality: behavior.personality,
      responseStyle: behavior.responseStyle,
      verbosity: behavior.verbosity,
      escalationRules: behavior.escalationRules.filter((r) => r.condition && r.action),
      customInstructions: behavior.customInstructions,
    });
  }

  function handleSaveSkills() {
    updateSkills.mutate({ skills });
  }

  function handleSaveAll() {
    if (behaviorDirty) handleSaveBehavior();
    if (skillsDirty) handleSaveSkills();
    if (!behaviorDirty && !skillsDirty) toast.info('No changes to save');
  }

  // Build prompt preview
  function buildPrompt(): string {
    const lines: string[] = [];

    lines.push('## System Personality');
    lines.push(behavior.personality || 'You are a helpful AI assistant.');
    lines.push('');

    lines.push('## Communication Style');
    lines.push(`- Response Style: ${behavior.responseStyle}`);
    lines.push(`- Verbosity: ${behavior.verbosity}`);
    lines.push('');

    const enabledSkills = skills.filter((s) => s.enabled);
    if (enabledSkills.length > 0) {
      lines.push('## Available Tools');
      for (const skill of enabledSkills) {
        lines.push(`- ${skill.name} (${skill.permission})`);
      }
      lines.push('');
    }

    const disabledSkills = skills.filter((s) => !s.enabled);
    if (disabledSkills.length > 0) {
      lines.push('## Disabled Tools (DO NOT USE)');
      for (const skill of disabledSkills) {
        lines.push(`- ${skill.name}`);
      }
      lines.push('');
    }

    if (behavior.escalationRules.length > 0) {
      lines.push('## Escalation Rules');
      for (const rule of behavior.escalationRules) {
        if (rule.condition && rule.action) {
          lines.push(`- When: ${rule.condition} → ${rule.action}`);
        }
      }
      lines.push('');
    }

    if (behavior.customInstructions) {
      lines.push('## Additional Instructions');
      lines.push(behavior.customInstructions);
    }

    return lines.join('\n');
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }

  const isLoading = behaviorQuery.isLoading || skillsQuery.isLoading;
  const isDirty = behaviorDirty || skillsDirty;
  const enabledCount = skills.filter((s) => s.enabled).length;
  const prompt = buildPrompt();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Customization</h1>
          <p className="text-gray-500 mt-1">
            Customize your AI agent's personality, instructions, and available tools
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={!isDirty || updateBehavior.isPending || updateSkills.isPending}
          className={cn(
            'transition-all',
            isDirty
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          <Save className="w-4 h-4 mr-1.5" />
          {updateBehavior.isPending || updateSkills.isPending ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personality" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </TabsTrigger>
        </TabsList>

        {/* Personality Tab */}
        <TabsContent value="personality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-600" />
                Agent Personality
              </CardTitle>
              <CardDescription>
                Define how your agent presents itself and communicates with users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="personality">Personality Description</Label>
                <Textarea
                  id="personality"
                  placeholder="Describe how your agent should behave. Example: You are a professional, efficient assistant that represents our agency..."
                  rows={6}
                  value={behavior.personality}
                  onChange={(e) => updateBehaviorField('personality', e.target.value)}
                  className="resize-none"
                />
                <p className="text-xs text-gray-400">
                  This is prepended to every agent session as the system prompt.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Response Style</Label>
                  <Select
                    value={behavior.responseStyle}
                    onValueChange={(val) => updateBehaviorField('responseStyle', val as ResponseStyle)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional — Formal, business-appropriate</SelectItem>
                      <SelectItem value="casual">Casual — Friendly, conversational</SelectItem>
                      <SelectItem value="technical">Technical — Precise, detail-oriented</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Verbosity</Label>
                  <Select
                    value={behavior.verbosity}
                    onValueChange={(val) => updateBehaviorField('verbosity', val as Verbosity)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise — Short, to-the-point</SelectItem>
                      <SelectItem value="balanced">Balanced — Moderate detail</SelectItem>
                      <SelectItem value="detailed">Detailed — Thorough explanations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                System Instructions
              </CardTitle>
              <CardDescription>
                Additional rules, constraints, and context your agent should always follow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instructions">Custom Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder="Any extra rules, constraints, or context. Example: Always confirm before deleting records. Default timezone is America/New_York. When unsure about pricing, direct users to the pricing page."
                  rows={8}
                  value={behavior.customInstructions}
                  onChange={(e) => updateBehaviorField('customInstructions', e.target.value)}
                  className="resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-400">
                  These instructions supplement the personality above. Added to every session.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Quick Templates
              </CardTitle>
              <CardDescription>Common instruction templates to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    label: 'Safety First',
                    instructions: 'Always confirm with the user before:\n- Deleting any records\n- Sending messages to more than 10 contacts\n- Making payments or billing changes\n- Modifying automations or workflows',
                  },
                  {
                    label: 'Brand Voice',
                    instructions: 'Maintain a consistent brand voice:\n- Use "we" instead of "I" when referring to the agency\n- Never badmouth competitors\n- Always be solution-oriented\n- End conversations with a helpful next step',
                  },
                  {
                    label: 'Data Handling',
                    instructions: 'Data handling rules:\n- Never share client data across accounts\n- Log all data access for audit purposes\n- Prefer reading over writing when possible\n- Always verify data before bulk operations',
                  },
                  {
                    label: 'Response Format',
                    instructions: 'Format responses consistently:\n- Use bullet points for lists\n- Include timestamps for actions taken\n- Summarize what was done at the end\n- Provide next steps or recommendations',
                  },
                ].map((template) => (
                  <Button
                    key={template.label}
                    variant="outline"
                    className="h-auto py-3 px-4 text-left justify-start"
                    onClick={() => {
                      const current = behavior.customInstructions;
                      const separator = current ? '\n\n' : '';
                      updateBehaviorField('customInstructions', current + separator + template.instructions);
                    }}
                  >
                    <div>
                      <p className="font-medium text-sm">{template.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{template.instructions.split('\n')[0]}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Tools</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-medium text-emerald-600">{enabledCount}</span> of {skills.length} tools enabled
              </p>
            </div>
            <Button
              onClick={handleSaveSkills}
              disabled={!skillsDirty || updateSkills.isPending}
              className={cn(
                'transition-all',
                skillsDirty
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-gray-100 text-gray-400'
              )}
              size="sm"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {updateSkills.isPending ? 'Saving...' : 'Save Tools'}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {skills.map((skill) => {
              const Icon = SKILL_ICONS[skill.id] || Zap;
              return (
                <Card
                  key={skill.id}
                  className={cn(
                    'relative overflow-hidden transition-all duration-200',
                    skill.enabled
                      ? 'border-l-4 border-l-emerald-500 shadow-sm'
                      : 'border-l-4 border-l-transparent opacity-60'
                  )}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-2 rounded-lg flex-shrink-0',
                        skill.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900 text-sm">{skill.name}</p>
                          <Switch
                            checked={skill.enabled}
                            onCheckedChange={(checked) => toggleSkill(skill.id, checked)}
                            className={cn(skill.enabled && 'data-[state=checked]:bg-emerald-500')}
                          />
                        </div>
                        {skill.enabled && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                            <Label className="text-xs text-gray-500">Permission</Label>
                            <Select
                              value={skill.permission}
                              onValueChange={(val) => updateSkillPermission(skill.id, val as Permission)}
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
            })}
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Prompt Preview</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                See the assembled system prompt your agent will use
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {prompt.split(/\s+/).filter(Boolean).length} words
              </Badge>
              <Button
                size="sm"
                onClick={handleCopyPrompt}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
                {prompt}
              </div>
            </CardContent>
          </Card>

          {/* Live indicator */}
          {isDirty && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-sm text-amber-700">
                Preview shows unsaved changes. Save to apply them.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
