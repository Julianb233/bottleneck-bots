import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
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
  Globe,
  Zap,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  Search,
  Calendar,
  Database,
  BarChart3,
  Save,
  RefreshCw,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Gauge,
} from 'lucide-react';

// Types

type Permission = 'read' | 'read-write';

interface Skill {
  id: string;
  name: string;
  enabled: boolean;
  permission: Permission;
  rateLimit?: number;
}

interface SkillUsageStat {
  skillId: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastUsed: string | null;
  avgDurationMs: number;
}

// Skill metadata: icon and description per skill id

interface SkillMeta {
  icon: React.ElementType;
  description: string;
  color: string;
}

const SKILL_META: Record<string, SkillMeta> = {
  'browser': {
    icon: Globe,
    description: 'Navigate websites, fill forms, click buttons',
    color: 'text-blue-600 bg-blue-50',
  },
  'ghl_api': {
    icon: Zap,
    description: 'Manage contacts, pipelines, campaigns in GHL',
    color: 'text-emerald-600 bg-emerald-50',
  },
  'email': {
    icon: Mail,
    description: 'Send emails on behalf of your agency',
    color: 'text-purple-600 bg-purple-50',
  },
  'sms': {
    icon: MessageSquare,
    description: 'Send text messages to contacts',
    color: 'text-sky-600 bg-sky-50',
  },
  'voice': {
    icon: Phone,
    description: 'Make outbound phone calls',
    color: 'text-amber-600 bg-amber-50',
  },
  'file_creation': {
    icon: FileText,
    description: 'Generate documents, spreadsheets, reports',
    color: 'text-indigo-600 bg-indigo-50',
  },
  'web_scraping': {
    icon: Search,
    description: 'Extract data from websites',
    color: 'text-rose-600 bg-rose-50',
  },
  'calendar': {
    icon: Calendar,
    description: 'Schedule and manage appointments',
    color: 'text-teal-600 bg-teal-50',
  },
  'crm': {
    icon: Database,
    description: 'CRUD operations on your CRM data',
    color: 'text-orange-600 bg-orange-50',
  },
  'reporting': {
    icon: BarChart3,
    description: 'Create analytics and performance reports',
    color: 'text-cyan-600 bg-cyan-50',
  },
};

// Fallback meta for unknown skills
function getSkillMeta(skillId: string): SkillMeta {
  return (
    SKILL_META[skillId] ?? {
      icon: Zap,
      description: 'AI capability module',
      color: 'text-gray-600 bg-gray-50',
    }
  );
}

// Default skills if backend returns empty (mirroring server defaults)
const DEFAULT_SKILLS: Skill[] = [
  { id: 'browser',       name: 'Browser Automation',   enabled: true,  permission: 'read-write', rateLimit: 100 },
  { id: 'ghl_api',       name: 'GoHighLevel API',       enabled: true,  permission: 'read-write', rateLimit: 200 },
  { id: 'email',         name: 'Email Sending',         enabled: true,  permission: 'read-write', rateLimit: 50 },
  { id: 'sms',           name: 'SMS Messaging',         enabled: false, permission: 'read',       rateLimit: 50 },
  { id: 'voice',         name: 'Voice Calling',         enabled: false, permission: 'read',       rateLimit: 20 },
  { id: 'file_creation', name: 'File Creation',         enabled: true,  permission: 'read-write', rateLimit: 100 },
  { id: 'web_scraping',  name: 'Web Scraping',          enabled: true,  permission: 'read',       rateLimit: 100 },
  { id: 'calendar',      name: 'Calendar Management',   enabled: true,  permission: 'read-write', rateLimit: 50 },
  { id: 'crm',           name: 'CRM Operations',        enabled: true,  permission: 'read-write', rateLimit: 200 },
  { id: 'reporting',     name: 'Report Generation',     enabled: true,  permission: 'read',       rateLimit: 30 },
];

// Format relative time
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ===== Skill Usage Analytics Card =====

function SkillUsageAnalytics({ usageData }: { usageData: SkillUsageStat[] }) {
  if (!usageData || usageData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Skill Usage Analytics
          </CardTitle>
          <CardDescription>
            No usage data yet. Analytics will appear once the agent starts executing tasks.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalCalls = usageData.reduce((sum, s) => sum + s.totalCalls, 0);
  const overallSuccessRate =
    totalCalls > 0
      ? Math.round(
          (usageData.reduce((sum, s) => sum + s.successCount, 0) / totalCalls) * 100
        )
      : 0;
  const mostUsed = usageData.reduce(
    (best, s) => (s.totalCalls > best.totalCalls ? s : best),
    usageData[0]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Skill Usage Analytics
        </CardTitle>
        <CardDescription>How your agent uses each skill across executions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-gray-500 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-xs">Total Calls</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{totalCalls.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-gray-500 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs">Success Rate</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{overallSuccessRate}%</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-gray-500 mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-xs">Most Used</span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate">
              {getSkillMeta(mostUsed.skillId) ? SKILL_META[mostUsed.skillId]?.icon ? mostUsed.skillId : mostUsed.skillId : mostUsed.skillId}
            </p>
          </div>
        </div>

        {/* Per-skill usage bars */}
        <div className="space-y-3">
          {usageData
            .sort((a, b) => b.totalCalls - a.totalCalls)
            .map((stat) => {
              const meta = getSkillMeta(stat.skillId);
              const Icon = meta.icon;
              const barWidth = totalCalls > 0 ? (stat.totalCalls / totalCalls) * 100 : 0;

              return (
                <div key={stat.skillId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('w-3.5 h-3.5', meta.color.split(' ')[0])} />
                      <span className="font-medium text-gray-700 capitalize">
                        {stat.skillId.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>{stat.totalCalls} calls</span>
                      <span
                        className={cn(
                          stat.successRate >= 80
                            ? 'text-emerald-600'
                            : stat.successRate >= 50
                              ? 'text-amber-600'
                              : 'text-red-500'
                        )}
                      >
                        {Math.round(stat.successRate)}% success
                      </span>
                      <span className="text-gray-400">{formatRelativeTime(stat.lastUsed)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Skill Card Component =====

function SkillCard({
  skill,
  usage,
  onChange,
}: {
  skill: Skill;
  usage?: SkillUsageStat;
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
          {/* Icon */}
          <div className={cn('p-2 rounded-lg flex-shrink-0', meta.color)}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
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

            {/* Usage mini-stats when enabled */}
            {skill.enabled && usage && usage.totalCalls > 0 && (
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {usage.totalCalls} calls
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {Math.round(usage.successRate)}%
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(usage.lastUsed)}
                </span>
              </div>
            )}

            {/* Permission + Rate Limit — only shown when enabled */}
            {skill.enabled && (
              <div className="space-y-2 mt-3 pt-2 border-t border-gray-100">
                {/* Permission row */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-500 flex-shrink-0 w-16">Permission</Label>
                  <Select
                    value={skill.permission}
                    onValueChange={(val) =>
                      onChange({ ...skill, permission: val as Permission })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read" className="text-xs">
                        Read Only
                      </SelectItem>
                      <SelectItem value="read-write" className="text-xs">
                        Read-Write
                      </SelectItem>
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

                {/* Rate limit row */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-500 flex-shrink-0 w-16">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3" />
                      Limit
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={skill.rateLimit ?? 100}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) {
                        onChange({ ...skill, rateLimit: val });
                      }
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="calls/hour"
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">/ hour</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Main Component =====

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const configQuery = trpc.agentTraining.getSkillConfig.useQuery();
  const usageQuery = trpc.agentTraining.getSkillUsage.useQuery();

  const updateMutation = trpc.agentTraining.updateSkillConfig.useMutation({
    onSuccess: () => {
      toast.success('Skill configuration saved');
      setIsDirty(false);
      void configQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed to save skills: ${err.message}`),
  });

  // Sync fetched config into local state
  useEffect(() => {
    if (configQuery.data) {
      const fetched = configQuery.data.skills;
      if (Array.isArray(fetched) && fetched.length > 0) {
        // Merge sub-permissions from defaults for skills that support them
        const merged = (fetched as Skill[]).map((skill) => {
          const defaultSkill = DEFAULT_SKILLS.find((d) => d.id === skill.id);
          if (defaultSkill?.subPermissions && !skill.subPermissions) {
            return { ...skill, subPermissions: defaultSkill.subPermissions };
          }
          return skill;
        });
        setSkills(merged);
      } else {
        setSkills(DEFAULT_SKILLS);
      }
      setIsDirty(false);
    }
  }, [configQuery.data]);

  function handleSkillChange(updated: Skill) {
    setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setIsDirty(true);
  }

  function handleSave() {
    updateMutation.mutate({ skills });
  }

  const enabledCount = skills.filter((s) => s.enabled).length;

  // Build usage map keyed by skillId
  const usageMap: Record<string, SkillUsageStat> = {};
  if (usageQuery.data?.usage) {
    for (const stat of usageQuery.data.usage) {
      usageMap[stat.skillId] = stat;
    }
  }

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-medium">Failed to load skill configuration</p>
        <p className="text-sm text-gray-400 mt-1">{configQuery.error?.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => configQuery.refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agent Skills</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Toggle capabilities, set permissions, and configure rate limits.{' '}
            <span className="font-medium text-emerald-600">{enabledCount}</span> of{' '}
            {skills.length} enabled.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className={cn(
            'transition-all',
            isDirty
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
          size="sm"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Usage Analytics */}
      <SkillUsageAnalytics usageData={usageQuery.data?.usage ?? []} />

      {/* Skills grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            usage={usageMap[skill.id]}
            onChange={handleSkillChange}
          />
        ))}
      </div>

      {/* Unsaved changes notice */}
      {isDirty && (
        <p className="text-xs text-amber-600 text-center">
          You have unsaved changes -- click "Save Changes" to apply them.
        </p>
      )}
    </div>
  );
}
