import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import {
  Brain,
  Target,
  TrendingUp,
  Zap,
  BookOpen,
  MessageSquare,
  Palette,
  AlertTriangle,
} from 'lucide-react';

export function TrainingOverview() {
  const systemStats = trpc.knowledge.getSystemStats.useQuery();
  const feedbackStats = trpc.knowledge.getFeedbackStats.useQuery();
  const errorStats = trpc.knowledge.getErrorStats.useQuery();
  const topPatterns = trpc.knowledge.getTopPatterns.useQuery({ limit: 5 });

  const stats = systemStats.data?.stats;
  const fbStats = feedbackStats.data?.stats;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalPatterns ?? 0}</p>
                <p className="text-xs text-gray-500">Action Patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Brain className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalSelectors ?? 0}</p>
                <p className="text-xs text-gray-500">Learned Selectors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalBrandVoices ?? 0}</p>
                <p className="text-xs text-gray-500">Brand Voices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fbStats?.total ?? 0}</p>
                <p className="text-xs text-gray-500">Feedback Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Summary + Error Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Feedback Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Feedback Summary
            </CardTitle>
            <CardDescription>Agent performance based on user feedback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fbStats ? (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Average Rating</span>
                    <span className="font-medium">{Number(fbStats.averageRating ?? 0).toFixed(1)} / 5</span>
                  </div>
                  <Progress value={((Number(fbStats.averageRating) || 0) / 5) * 100} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      {fbStats.byType?.success ?? 0}
                    </Badge>
                    <span className="text-sm text-gray-600">Successes</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                    <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                      {fbStats.byType?.partial ?? 0}
                    </Badge>
                    <span className="text-sm text-gray-600">Partial</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                      {fbStats.byType?.failure ?? 0}
                    </Badge>
                    <span className="text-sm text-gray-600">Failures</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      {fbStats.byType?.suggestion ?? 0}
                    </Badge>
                    <span className="text-sm text-gray-600">Suggestions</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm py-4 text-center">No feedback data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Error Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Error Recovery
            </CardTitle>
            <CardDescription>Known error patterns and recovery strategies</CardDescription>
          </CardHeader>
          <CardContent>
            {errorStats.data?.stats && Object.keys(errorStats.data.stats).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(errorStats.data.stats).slice(0, 5).map(([errorType, data]: [string, any]) => (
                  <div key={errorType} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{errorType}</p>
                      <p className="text-xs text-gray-500">{data.occurrences ?? 0} occurrences</p>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      {data.resolutions ?? 0} resolved
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm py-4 text-center">No error patterns recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Top Performing Patterns
          </CardTitle>
          <CardDescription>Most reliable automation patterns based on success rate</CardDescription>
        </CardHeader>
        <CardContent>
          {topPatterns.data?.patterns?.length ? (
            <div className="space-y-3">
              {topPatterns.data.patterns.map((pattern: any) => {
                const total = (pattern.successCount ?? 0) + (pattern.failureCount ?? 0);
                const rate = total > 0 ? ((pattern.successCount ?? 0) / total) * 100 : 0;
                return (
                  <div key={pattern.taskType} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{pattern.taskName || pattern.taskType}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {pattern.steps?.length ?? 0} steps
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-1">{pattern.pageUrl}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">{rate.toFixed(0)}%</p>
                      <p className="text-xs text-gray-500">{total} runs</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No patterns learned yet</p>
              <p className="text-sm text-gray-400">Patterns are automatically created as the agent completes tasks</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
