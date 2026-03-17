import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Settings2,
  Shield,
  Zap,
  Clock,
  RotateCw,
  Save,
  RefreshCw,
} from 'lucide-react';

interface AgentConfigTabProps {
  userId: number;
}

export function AgentConfigTab({ userId }: AgentConfigTabProps) {
  const memoryQuery = trpc.agentMemory.getUserMemory.useQuery({ userId });
  const statsQuery = trpc.agentMemory.getUserStats.useQuery({ userId });
  const updatePrefs = trpc.agentMemory.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success('Preferences saved');
      memoryQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const prefs = (memoryQuery.data?.memory?.preferences as any) ?? {};
  const stats = statsQuery.data?.stats as any;

  const [actionSpeed, setActionSpeed] = useState<string>(prefs.actionSpeed ?? 'normal');
  const [approvalRequired, setApprovalRequired] = useState<boolean>(prefs.approvalRequired ?? true);
  const [defaultTimeout, setDefaultTimeout] = useState<number>(prefs.defaultTimeout ?? 30000);
  const [maxRetries, setMaxRetries] = useState<number>(prefs.maxRetries ?? 3);

  // Sync state when data loads
  const currentPrefs = memoryQuery.data?.memory?.preferences as any;
  if (currentPrefs && actionSpeed === 'normal' && currentPrefs.actionSpeed && currentPrefs.actionSpeed !== actionSpeed) {
    setActionSpeed(currentPrefs.actionSpeed);
    setApprovalRequired(currentPrefs.approvalRequired ?? true);
    setDefaultTimeout(currentPrefs.defaultTimeout ?? 30000);
    setMaxRetries(currentPrefs.maxRetries ?? 3);
  }

  const handleSave = () => {
    updatePrefs.mutate({
      userId,
      preferences: {
        actionSpeed: actionSpeed as 'careful' | 'normal' | 'fast',
        approvalRequired,
        defaultTimeout,
        maxRetries,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Agent Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalExecutions ?? 0}</p>
                  <p className="text-xs text-gray-500">Total Runs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.successfulExecutions ?? 0}</p>
                  <p className="text-xs text-gray-500">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.avgExecutionTime ? `${(stats.avgExecutionTime / 1000).toFixed(1)}s` : '--'}
                  </p>
                  <p className="text-xs text-gray-500">Avg Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <RotateCw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.totalExecutions
                      ? `${((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(0)}%`
                      : '--'}
                  </p>
                  <p className="text-xs text-gray-500">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Agent Behavior
          </CardTitle>
          <CardDescription>Configure how your agent approaches tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Action Speed */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Speed</label>
              <Select value={actionSpeed} onValueChange={setActionSpeed}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="careful">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Careful</Badge>
                      <span className="text-xs text-gray-500">Extra verification between steps</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="normal">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Normal</Badge>
                      <span className="text-xs text-gray-500">Balanced speed and accuracy</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="fast">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Fast</Badge>
                      <span className="text-xs text-gray-500">Minimal waits, max throughput</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Controls delay between browser actions</p>
            </div>

            {/* Approval Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Approval Required</label>
              <Select
                value={approvalRequired ? 'yes' : 'no'}
                onValueChange={(v) => setApprovalRequired(v === 'yes')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Require approval before critical actions</SelectItem>
                  <SelectItem value="no">Auto-approve all actions</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                When enabled, destructive actions require manual approval
              </p>
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Timeout (ms)</label>
              <Input
                type="number"
                value={defaultTimeout}
                onChange={(e) => setDefaultTimeout(Number(e.target.value))}
                min={5000}
                max={120000}
                step={1000}
              />
              <p className="text-xs text-gray-500">
                How long to wait for page elements ({(defaultTimeout / 1000).toFixed(0)}s)
              </p>
            </div>

            {/* Max Retries */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Retries</label>
              <Input
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                min={0}
                max={10}
              />
              <p className="text-xs text-gray-500">
                Number of retries on failed actions
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => memoryQuery.refetch()}
              disabled={memoryQuery.isRefetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${memoryQuery.isRefetching ? 'animate-spin' : ''}`} />
              Reset
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSave}
              disabled={updatePrefs.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
