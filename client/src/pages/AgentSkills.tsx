import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Globe,
  Database,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  BarChart3,
  Settings2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

// Map skill icon strings to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Globe,
  Database,
  Mail,
  MessageSquare,
  Phone,
  FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  automation: 'bg-blue-100 text-blue-700',
  communication: 'bg-purple-100 text-purple-700',
  integration: 'bg-amber-100 text-amber-700',
  content: 'bg-emerald-100 text-emerald-700',
};

export default function AgentSkills() {
  const [activeTab, setActiveTab] = useState('configuration');

  // Fetch skills list
  const skillsQuery = trpc.agentSkillConfig.list.useQuery();

  // Fetch analytics
  const analyticsQuery = trpc.agentSkillConfig.analytics.useQuery({ periodDays: 30 });

  // Update mutation
  const updateMutation = trpc.agentSkillConfig.update.useMutation({
    onSuccess: () => {
      skillsQuery.refetch();
      analyticsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  const handleToggle = (skillId: string, enabled: boolean) => {
    updateMutation.mutate({ skillId, enabled });
    toast.success(`Skill ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handlePermissionChange = (skillId: string, permission: 'read-only' | 'read-write') => {
    updateMutation.mutate({ skillId, permission });
    toast.success('Permission updated');
  };

  const handleRateLimitChange = (skillId: string, rateLimit: number) => {
    if (rateLimit < 1 || rateLimit > 1000) return;
    updateMutation.mutate({ skillId, rateLimit });
    toast.success('Rate limit updated');
  };

  const skills = skillsQuery.data?.skills ?? [];
  const analytics = analyticsQuery.data?.analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Skills</h1>
        <p className="text-muted-foreground mt-1">
          Configure which capabilities your AI agent can use, set permissions, and monitor usage.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Zap className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Skills</p>
                <p className="text-2xl font-bold">
                  {skillsQuery.isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    skills.filter(s => s.enabled).length
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Executions (30d)</p>
                <p className="text-2xl font-bold">
                  {analyticsQuery.isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    analytics?.totalExecutions.toLocaleString() ?? '0'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {analyticsQuery.isLoading ? (
                    <Skeleton className="h-8 w-14" />
                  ) : (
                    `${analytics?.overallSuccessRate ?? 0}%`
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Settings2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Skills</p>
                <p className="text-2xl font-bold">
                  {skillsQuery.isLoading ? (
                    <Skeleton className="h-8 w-10" />
                  ) : (
                    skills.length
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="mt-4">
          {skillsQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-60" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {skills.map((skill) => {
                const IconComponent = ICON_MAP[skill.icon] ?? Settings2;
                return (
                  <Card
                    key={skill.skillId}
                    className={`transition-all ${!skill.enabled ? 'opacity-60' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${skill.enabled ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                            <IconComponent
                              className={`h-5 w-5 ${skill.enabled ? 'text-emerald-600' : 'text-gray-400'}`}
                            />
                          </div>
                          <div>
                            <CardTitle className="text-base">{skill.name}</CardTitle>
                            <Badge
                              variant="secondary"
                              className={`mt-1 text-xs ${CATEGORY_COLORS[skill.category] ?? ''}`}
                            >
                              {skill.category}
                            </Badge>
                          </div>
                        </div>
                        <Switch
                          checked={skill.enabled}
                          onCheckedChange={(checked) => handleToggle(skill.skillId, checked)}
                          disabled={updateMutation.isPending}
                        />
                      </div>
                      <CardDescription className="mt-2 text-xs">
                        {skill.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Permission */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Permission Level</Label>
                        <Select
                          value={skill.permission}
                          onValueChange={(value) =>
                            handlePermissionChange(skill.skillId, value as 'read-only' | 'read-write')
                          }
                          disabled={!skill.enabled || updateMutation.isPending}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read-only">Read Only</SelectItem>
                            <SelectItem value="read-write">Read & Write</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Rate Limit */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Rate Limit (per hour)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={skill.rateLimit}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                handleRateLimitChange(skill.skillId, val);
                              }
                            }}
                            className="h-8 text-sm"
                            disabled={!skill.enabled || updateMutation.isPending}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">/hr</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          {analyticsQuery.isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : analytics ? (
            <>
              {/* Usage Bar Chart (CSS-based) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Executions by Skill (Last {analytics.periodDays} days)</CardTitle>
                  <CardDescription>Total executions and success rates per skill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.skills
                      .filter(s => s.totalExecutions > 0)
                      .sort((a, b) => b.totalExecutions - a.totalExecutions)
                      .map((record) => {
                        const skill = skills.find(s => s.skillId === record.skillId);
                        const maxExec = Math.max(...analytics.skills.map(s => s.totalExecutions), 1);
                        const pct = (record.totalExecutions / maxExec) * 100;

                        return (
                          <div key={record.skillId} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{skill?.name ?? record.skillId}</span>
                              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                                <span>{record.totalExecutions} executions</span>
                                <Badge
                                  variant="secondary"
                                  className={
                                    record.successRate >= 90
                                      ? 'bg-green-100 text-green-700'
                                      : record.successRate >= 70
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }
                                >
                                  {record.successRate}% success
                                </Badge>
                              </div>
                            </div>
                            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {analytics.skills.every(s => s.totalExecutions === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No usage data available yet. Enable skills and start using your agent.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detailed Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Skill</TableHead>
                        <TableHead className="text-right">Executions</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                        <TableHead className="text-right">Failures</TableHead>
                        <TableHead className="text-right">Success Rate</TableHead>
                        <TableHead className="text-right">Avg Duration</TableHead>
                        <TableHead className="text-right">Last Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.skills.map((record) => {
                        const skill = skills.find(s => s.skillId === record.skillId);
                        return (
                          <TableRow key={record.skillId}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {skill?.enabled ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-gray-400" />
                                )}
                                {skill?.name ?? record.skillId}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{record.totalExecutions}</TableCell>
                            <TableCell className="text-right text-green-600">{record.successCount}</TableCell>
                            <TableCell className="text-right text-red-600">{record.failureCount}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="secondary"
                                className={
                                  record.successRate >= 90
                                    ? 'bg-green-100 text-green-700'
                                    : record.successRate >= 70
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : record.totalExecutions === 0
                                        ? 'bg-gray-100 text-gray-500'
                                        : 'bg-red-100 text-red-700'
                                }
                              >
                                {record.successRate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {record.avgDurationMs > 0 ? `${(record.avgDurationMs / 1000).toFixed(1)}s` : '-'}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-xs">
                              {record.lastUsed
                                ? new Date(record.lastUsed).toLocaleDateString()
                                : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
