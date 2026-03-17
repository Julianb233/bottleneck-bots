import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

interface SkillConfig {
  skills: Skill[];
}

// Skill metadata: icon and description per skill id

interface SkillMeta {
  icon: React.ElementType;
  description: string;
  color: string;
}

const SKILL_META: Record<string, SkillMeta> = {
  // IDs match the backend DEFAULT_SKILLS
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
  { id: 'browser',       name: 'Browser Automation',   enabled: true,  permission: 'read-write' },
  { id: 'ghl_api',       name: 'GoHighLevel API',       enabled: true,  permission: 'read-write' },
  { id: 'email',         name: 'Email Sending',         enabled: true,  permission: 'read-write' },
  { id: 'sms',           name: 'SMS Messaging',         enabled: false, permission: 'read' },
  { id: 'voice',         name: 'Voice Calling',         enabled: false, permission: 'read' },
  { id: 'file_creation', name: 'File Creation',         enabled: true,  permission: 'read-write' },
  { id: 'web_scraping',  name: 'Web Scraping',          enabled: true,  permission: 'read' },
  { id: 'calendar',      name: 'Calendar Management',   enabled: true,  permission: 'read-write' },
  { id: 'crm',           name: 'CRM Operations',        enabled: true,  permission: 'read-write' },
  { id: 'reporting',     name: 'Report Generation',     enabled: true,  permission: 'read' },
];

// Skill card component

function SkillCard({
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

            {/* Permission selector — only shown when enabled */}
            {skill.enabled && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                <Label className="text-xs text-gray-500 flex-shrink-0">Permission</Label>
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
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main component

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const configQuery = trpc.agentTraining.getSkillConfig.useQuery();

  const updateMutation = trpc.agentTraining.updateSkillConfig.useMutation({
    onSuccess: () => {
      toast.success('Skill configuration saved');
      setIsDirty(false);
      void configQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed to save skills: ${err.message}`),
  });

  // Sync fetched config into local state
  // Backend returns { success, skills, isDefault }
  useEffect(() => {
    if (configQuery.data) {
      const fetched = configQuery.data.skills;
      if (Array.isArray(fetched) && fetched.length > 0) {
        setSkills(fetched as Skill[]);
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

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
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
            Toggle capabilities your agent can use.{' '}
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

      {/* Skills grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} onChange={handleSkillChange} />
        ))}
      </div>

      {/* Unsaved changes notice */}
      {isDirty && (
        <p className="text-xs text-amber-600 text-center">
          You have unsaved changes — click "Save Changes" to apply them.
        </p>
      )}
    </div>
  );
}
