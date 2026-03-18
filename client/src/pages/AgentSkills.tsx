import { useState, useEffect, useMemo } from 'react';
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
  Search,
  Calendar,
  Database,
  FileSearch,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// UI metadata for each skill ID from the backend service
const SKILL_UI_META: Record<string, {
  icon: typeof Globe;
  description: string;
  category: 'safe' | 'moderate' | 'dangerous';
  color: string;
  bgColor: string;
}> = {
  browser: {
    icon: Globe,
    description: 'Navigate websites, click elements, fill forms, extract data, and take screenshots using BrowserBase.',
    category: 'moderate',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  ghl_api: {
    icon: Zap,
    description: 'Manage contacts, pipelines, campaigns, workflows, and appointments through the GHL API.',
    category: 'moderate',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  email: {
    icon: Mail,
    description: 'Send emails, manage campaigns, and process email templates on behalf of your agency.',
    category: 'moderate',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  sms: {
    icon: MessageSquare,
    description: 'Send SMS messages to contacts through GHL or integrated messaging platforms.',
    category: 'moderate',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  voice: {
    icon: Phone,
    description: 'Make and receive voice calls using VAPI AI voice integration.',
    category: 'moderate',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  file_creation: {
    icon: FileOutput,
    description: 'Generate documents, spreadsheets, PDFs, and CSV reports from collected data.',
    category: 'dangerous',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  web_scraping: {
    icon: Search,
    description: 'Extract structured data from web pages and take screenshots for analysis.',
    category: 'moderate',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  calendar: {
    icon: Calendar,
    description: 'Create, update, and delete calendar events and schedule appointments.',
    category: 'moderate',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  crm: {
    icon: Database,
    description: 'Store, retrieve, update, and delete CRM records and data entries.',
    category: 'moderate',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  reporting: {
    icon: FileSearch,
    description: 'Generate analytics reports and query execution data.',
    category: 'safe',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
  },
};

// Fallback for skills not in UI meta
const DEFAULT_UI_META = {
  icon: Shield,
  description: 'Agent capability',
  category: 'moderate' as const,
  color: 'text-gray-600',
  bgColor: 'bg-gray-50',
};

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  safe: { label: 'Safe', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: ShieldCheck },
  moderate: { label: 'Moderate', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Shield },
  dangerous: { label: 'Elevated', color: 'text-red-600 bg-red-50 border-red-200', icon: ShieldAlert },
};

// Local state type matching server SkillDefinition
interface LocalSkillConfig {
  id: string;
  name: string;
  enabled: boolean;
  permission: 'read' | 'read-write';
  rateLimit: number;
}

export default function AgentSkills() {
  const [skills, setSkills] = useState<LocalSkillConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Backend queries
  const skillDefsQuery = trpc.agentSkillConfig.getSkillDefinitions.useQuery();
  const myConfigQuery = trpc.agentSkillConfig.getMySkillConfigs.useQuery();
  const analyticsQuery = trpc.agentSkillConfig.getSkillAnalytics.useQuery();
  const permLevelQuery = trpc.agentPermissions.getPermissionLevel.useQuery();
  const limitsQuery = trpc.agentPermissions.checkExecutionLimits.useQuery();

  const saveMutation = trpc.agentSkillConfig.saveSkillConfigs.useMutation({
    onSuccess: () => {
      toast.success('Skill configuration saved');
      setHasChanges(false);
      myConfigQuery.refetch();
      analyticsQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Save failed: ${err.message}`);
    },
  });

  const permissionLevel = permLevelQuery.data?.permissionLevel ?? 'view_only';
  const permissionDescription = permLevelQuery.data?.description ?? '';

  // Initialize local state from server configs
  useEffect(() => {
    const configs = myConfigQuery.data?.configs;
    if (configs && configs.length > 0) {
      setSkills(
        configs.map((c: any) => ({
          id: c.id,
          name: c.name,
          enabled: c.enabled,
          permission: c.permission,
          rateLimit: c.rateLimit ?? 30,
        }))
      );
    } else if (skillDefsQuery.data?.skills) {
      setSkills(
        skillDefsQuery.data.skills.map((s: any) => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled,
          permission: s.permission,
          rateLimit: s.rateLimit ?? 30,
        }))
      );
    }
  }, [myConfigQuery.data, skillDefsQuery.data]);

  const analyticsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (analyticsQuery.data?.analytics) {
      for (const a of analyticsQuery.data.analytics) {
        map.set(a.skillId, a);
      }
    }
    return map;
  }, [analyticsQuery.data]);

  const updateSkill = (skillId: string, updates: Partial<LocalSkillConfig>) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, ...updates } : s))
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled,
        permission: s.permission,
        rateLimit: s.rateLimit,
      })),
    });
  };

  const handleResetDefaults = () => {
    if (skillDefsQuery.data?.skills) {
      setSkills(
        skillDefsQuery.data.skills.map((s: any) => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled,
          permission: s.permission,
          rateLimit: s.rateLimit ?? 30,
        }))
      );
      setHasChanges(true);
      toast.info('Reset to default configuration');
    }
  };

  const enabledCount = skills.filter((s) => s.enabled).length;

  const totalExecutions = useMemo(() => {
    let sum = 0;
    analyticsMap.forEach((a) => { sum += a.totalExecutions ?? 0; });
    return sum;
  }, [analyticsMap]);

  const avgSuccessRate = useMemo(() => {
    const values: number[] = [];
    analyticsMap.forEach((a) => {
      if (a.totalExecutions > 0) values.push(a.successRate);
    });
    return values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
  }, [analyticsMap]);

  const isLoading = skillDefsQuery.isLoading || myConfigQuery.isLoading;

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
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              disabled={saveMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              )}
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
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
                      {permissionLevel.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
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
                  <p className="text-2xl font-bold">{enabledCount}/{skills.length}</p>
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
                  <p className="text-2xl font-bold">{skills.length}</p>
                  <p className="text-xs text-gray-500">Total Skills</p>
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
                  <p className="text-2xl font-bold">{totalExecutions.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold">{avgSuccessRate}%</p>
                  <p className="text-xs text-gray-500">Avg Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mr-2" />
            <span className="text-gray-500">Loading skill configuration...</span>
          </div>
        )}

        {/* Skills List */}
        {!isLoading && skills.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Skill Configuration</h2>

            {skills.map((skill) => {
              const uiMeta = SKILL_UI_META[skill.id] ?? DEFAULT_UI_META;
              const analytics = analyticsMap.get(skill.id);
              const catInfo = CATEGORY_LABELS[uiMeta.category];
              const CatIcon = catInfo.icon;
              const SkillIcon = uiMeta.icon;

              return (
                <Card
                  key={skill.id}
                  className={cn(
                    'transition-all',
                    !skill.enabled && 'opacity-60 bg-gray-50'
                  )}
                >
                  <CardContent className="py-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={cn('p-2.5 rounded-lg shrink-0', uiMeta.bgColor)}>
                        <SkillIcon className={cn('w-5 h-5', uiMeta.color)} />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                          <Badge variant="outline" className={cn('text-[10px] border', catInfo.color)}>
                            <CatIcon className="w-3 h-3 mr-1" />
                            {catInfo.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{uiMeta.description}</p>

                        {/* Config row */}
                        {skill.enabled && (
                          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t">
                            {/* Permission mode */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                                Permission:
                              </label>
                              <Select
                                value={skill.permission}
                                onValueChange={(val: 'read' | 'read-write') =>
                                  updateSkill(skill.id, { permission: val })
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="read">
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
                                value={[skill.rateLimit]}
                                onValueChange={([val]) => updateSkill(skill.id, { rateLimit: val })}
                                min={1}
                                max={200}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-xs text-gray-500 w-[60px] text-right whitespace-nowrap">
                                {skill.rateLimit}/hr
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Usage analytics from backend */}
                        {skill.enabled && analytics && analytics.totalExecutions > 0 && (
                          <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {analytics.totalExecutions.toLocaleString()} executions
                            </span>
                            <span className="flex items-center gap-1">
                              {analytics.successRate >= 95 ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : analytics.successRate >= 80 ? (
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-red-500" />
                              )}
                              {Math.round(analytics.successRate)}% success
                            </span>
                            {analytics.lastUsed && (
                              <span>Last: {new Date(analytics.lastUsed).toLocaleDateString()}</span>
                            )}
                            {analytics.topTools?.length > 0 && (
                              <span className="text-gray-400">
                                Top tool: {analytics.topTools[0].toolName}
                              </span>
                            )}
                            <div className="flex-1 max-w-[120px]">
                              <Progress value={analytics.successRate} className="h-1.5" />
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
                                checked={skill.enabled}
                                onCheckedChange={(checked) =>
                                  updateSkill(skill.id, { enabled: checked })
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{skill.enabled ? 'Disable' : 'Enable'} {skill.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Risk Categories Reference */}
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
