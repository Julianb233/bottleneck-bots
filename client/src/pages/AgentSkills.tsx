import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Globe,
  Zap,
  Mail,
  MessageSquare,
  Phone,
  FileOutput,
  Shield,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  Activity,
  Lock,
  Unlock,
  Info,
  RefreshCw,
  Loader2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Skill definitions with metadata
interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: typeof Globe;
  category: 'safe' | 'moderate' | 'dangerous';
  tools: string[];
  color: string;
  bgColor: string;
}

const SKILLS: SkillDefinition[] = [
  {
    id: 'browser_automation',
    name: 'Browser Automation',
    description: 'Navigate websites, click elements, fill forms, extract data, and take screenshots using BrowserBase.',
    icon: Globe,
    category: 'moderate',
    tools: ['browser_navigate', 'browser_click', 'browser_type', 'browser_extract', 'browser_screenshot', 'browser_scroll', 'browser_wait', 'browser_select'],
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'ghl_api',
    name: 'GoHighLevel API',
    description: 'Manage contacts, pipelines, campaigns, workflows, and appointments through the GHL API.',
    icon: Zap,
    category: 'moderate',
    tools: ['http_request', 'store_data', 'retrieve_data'],
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Send emails, manage campaigns, and process email templates on behalf of your agency.',
    icon: Mail,
    category: 'moderate',
    tools: ['http_request'],
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'sms',
    name: 'SMS Messaging',
    description: 'Send SMS messages to contacts through GHL or integrated messaging platforms.',
    icon: MessageSquare,
    category: 'moderate',
    tools: ['http_request'],
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    id: 'voice',
    name: 'Voice Calling',
    description: 'Make and receive voice calls using VAPI AI voice integration.',
    icon: Phone,
    category: 'moderate',
    tools: ['http_request'],
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    id: 'file_creation',
    name: 'File Creation',
    description: 'Generate documents, spreadsheets, PDFs, and CSV reports from collected data.',
    icon: FileOutput,
    category: 'dangerous',
    tools: ['file_write', 'file_edit'],
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    id: 'data_read',
    name: 'Data & Documentation',
    description: 'Read files, search documents, and retrieve knowledge from the RAG system.',
    icon: Shield,
    category: 'safe',
    tools: ['file_read', 'file_list', 'file_search', 'retrieve_documentation', 'retrieve_data'],
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
];

type PermissionMode = 'read-only' | 'read-write';

interface SkillConfig {
  enabled: boolean;
  permission: PermissionMode;
  rateLimit: number; // executions per hour
}

const DEFAULT_RATE_LIMITS: Record<string, number> = {
  browser_automation: 30,
  ghl_api: 60,
  email: 20,
  sms: 15,
  voice: 10,
  file_creation: 20,
  data_read: 100,
};

// Simulated usage data (would come from analytics API in production)
const USAGE_STATS: Record<string, { totalExecutions: number; successRate: number; lastUsed: string }> = {
  browser_automation: { totalExecutions: 247, successRate: 94, lastUsed: '2h ago' },
  ghl_api: { totalExecutions: 512, successRate: 98, lastUsed: '15m ago' },
  email: { totalExecutions: 89, successRate: 99, lastUsed: '1d ago' },
  sms: { totalExecutions: 34, successRate: 97, lastUsed: '3d ago' },
  voice: { totalExecutions: 12, successRate: 91, lastUsed: '5d ago' },
  file_creation: { totalExecutions: 67, successRate: 100, lastUsed: '4h ago' },
  data_read: { totalExecutions: 1023, successRate: 99, lastUsed: '5m ago' },
};

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  safe: { label: 'Safe', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: ShieldCheck },
  moderate: { label: 'Moderate', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Shield },
  dangerous: { label: 'Elevated', color: 'text-red-600 bg-red-50 border-red-200', icon: ShieldAlert },
};

export default function AgentSkills() {
  const [skills, setSkills] = useState<Record<string, SkillConfig>>(() => {
    const initial: Record<string, SkillConfig> = {};
    SKILLS.forEach((s) => {
      initial[s.id] = {
        enabled: true,
        permission: 'read-write',
        rateLimit: DEFAULT_RATE_LIMITS[s.id] || 30,
      };
    });
    return initial;
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch current permissions from backend
  const permissionsQuery = trpc.agentPermissions.getMyPermissions.useQuery();
  const permLevelQuery = trpc.agentPermissions.getPermissionLevel.useQuery();
  const limitsQuery = trpc.agentPermissions.checkExecutionLimits.useQuery();

  const permissionLevel = permLevelQuery.data?.permissionLevel ?? 'view_only';
  const permissionDescription = permLevelQuery.data?.description ?? '';

  const updateSkill = (skillId: string, updates: Partial<SkillConfig>) => {
    setSkills((prev) => ({
      ...prev,
      [skillId]: { ...prev[skillId], ...updates },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // In production, this would call a tRPC mutation to persist skill config.
    // For now, simulate a save.
    await new Promise((resolve) => setTimeout(resolve, 800));
    toast.success('Skill configuration saved');
    setHasChanges(false);
    setSaving(false);
  };

  const handleResetDefaults = () => {
    const defaults: Record<string, SkillConfig> = {};
    SKILLS.forEach((s) => {
      defaults[s.id] = {
        enabled: true,
        permission: 'read-write',
        rateLimit: DEFAULT_RATE_LIMITS[s.id] || 30,
      };
    });
    setSkills(defaults);
    setHasChanges(true);
    toast.info('Reset to default configuration');
  };

  const enabledCount = Object.values(skills).filter((s) => s.enabled).length;
  const totalTools = SKILLS.reduce((sum, s) => {
    if (skills[s.id]?.enabled) return sum + s.tools.length;
    return sum;
  }, 0);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Skills</h1>
            <p className="text-gray-500 mt-1">
              Configure which capabilities your AI agent can use during task execution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleResetDefaults} disabled={saving}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Permission Level Card */}
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Permission Level</h3>
                    <Badge
                      className={cn(
                        'text-xs',
                        permissionLevel === 'admin' ? 'bg-purple-100 text-purple-700' :
                        permissionLevel === 'execute_advanced' ? 'bg-blue-100 text-blue-700' :
                        permissionLevel === 'execute_basic' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      )}
                    >
                      {permissionLevel.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{permissionDescription}</p>
                </div>
              </div>
              {limitsQuery.data?.limits && (
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">
                      {limitsQuery.data.limits.currentActive}/{limitsQuery.data.limits.maxConcurrent}
                    </p>
                    <p className="text-xs text-gray-500">Concurrent</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">
                      {limitsQuery.data.limits.monthlyUsed}/{limitsQuery.data.limits.monthlyLimit}
                    </p>
                    <p className="text-xs text-gray-500">Monthly</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{enabledCount}/{SKILLS.length}</p>
                  <p className="text-xs text-gray-500">Skills Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalTools}</p>
                  <p className="text-xs text-gray-500">Tools Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(USAGE_STATS).reduce((s, u) => s + u.totalExecutions, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total Executions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(
                      Object.values(USAGE_STATS).reduce((s, u) => s + u.successRate, 0) /
                        Object.values(USAGE_STATS).length
                    )}%
                  </p>
                  <p className="text-xs text-gray-500">Avg Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Skills List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Skill Configuration</h2>

          {SKILLS.map((skill) => {
            const config = skills[skill.id];
            const usage = USAGE_STATS[skill.id];
            const catInfo = CATEGORY_LABELS[skill.category];
            const CatIcon = catInfo.icon;
            const SkillIcon = skill.icon;

            return (
              <Card
                key={skill.id}
                className={cn(
                  'transition-all',
                  !config.enabled && 'opacity-60 bg-gray-50'
                )}
              >
                <CardContent className="py-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={cn('p-2.5 rounded-lg shrink-0', skill.bgColor)}>
                      <SkillIcon className={cn('w-5 h-5', skill.color)} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                        <Badge variant="outline" className={cn('text-[10px] border', catInfo.color)}>
                          <CatIcon className="w-3 h-3 mr-1" />
                          {catInfo.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {skill.tools.length} tools
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{skill.description}</p>

                      {/* Config row */}
                      {config.enabled && (
                        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t">
                          {/* Permission mode */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                              Permission:
                            </label>
                            <Select
                              value={config.permission}
                              onValueChange={(val: PermissionMode) =>
                                updateSkill(skill.id, { permission: val })
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="read-only">
                                  <span className="flex items-center gap-1.5">
                                    <Lock className="w-3 h-3" />
                                    Read Only
                                  </span>
                                </SelectItem>
                                <SelectItem value="read-write">
                                  <span className="flex items-center gap-1.5">
                                    <Unlock className="w-3 h-3" />
                                    Read + Write
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Rate limit */}
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                              Rate Limit:
                            </label>
                            <Slider
                              value={[config.rateLimit]}
                              onValueChange={([val]) => updateSkill(skill.id, { rateLimit: val })}
                              min={1}
                              max={200}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-xs text-gray-500 w-[60px] text-right whitespace-nowrap">
                              {config.rateLimit}/hr
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Usage analytics */}
                      {config.enabled && usage && (
                        <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {usage.totalExecutions.toLocaleString()} executions
                          </span>
                          <span className="flex items-center gap-1">
                            {usage.successRate >= 95 ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            ) : usage.successRate >= 80 ? (
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-500" />
                            )}
                            {usage.successRate}% success
                          </span>
                          <span>Last used: {usage.lastUsed}</span>
                          <div className="flex-1 max-w-[120px]">
                            <Progress
                              value={usage.successRate}
                              className="h-1.5"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Toggle */}
                    <div className="shrink-0 pt-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={(checked) =>
                                updateSkill(skill.id, { enabled: checked })
                              }
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{config.enabled ? 'Disable' : 'Enable'} {skill.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tool Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4" />
              Risk Categories Reference
            </CardTitle>
            <CardDescription>
              Tools are categorized by their potential impact. Your subscription tier determines which categories you can access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(CATEGORY_LABELS).map(([key, info]) => {
                const CIcon = info.icon;
                return (
                  <div key={key} className={cn('rounded-lg border p-3', info.color.split(' ').slice(1).join(' '))}>
                    <div className="flex items-center gap-2 mb-2">
                      <CIcon className="w-4 h-4" />
                      <h4 className="font-medium text-sm">{info.label} Risk</h4>
                    </div>
                    <p className="text-xs text-gray-600">
                      {key === 'safe' && 'Read-only operations: file reading, documentation lookup, data retrieval, and browser navigation.'}
                      {key === 'moderate' && 'Write operations: API calls, data storage, browser interactions (click, type, scroll), and plan updates.'}
                      {key === 'dangerous' && 'Elevated access: file writing, shell execution, and browser session management. Requires admin permissions.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
