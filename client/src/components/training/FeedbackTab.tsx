import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import {
  MessageSquare,
  Star,
  Filter,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

const feedbackTypeIcon = {
  success: ThumbsUp,
  partial: AlertTriangle,
  failure: ThumbsDown,
  suggestion: Lightbulb,
};

const feedbackTypeColor = {
  success: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-yellow-100 text-yellow-700',
  failure: 'bg-red-100 text-red-700',
  suggestion: 'bg-blue-100 text-blue-700',
};

export function FeedbackTab() {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRating, setFilterRating] = useState<string>('all');

  const feedbackQuery = trpc.knowledge.getFeedback.useQuery(
    filterType === 'all' && filterRating === 'all'
      ? { limit: 50 }
      : {
          ...(filterRating !== 'all' ? { rating: Number(filterRating) } : {}),
          limit: 50,
        }
  );
  const statsQuery = trpc.knowledge.getFeedbackStats.useQuery();

  const feedback = feedbackQuery.data?.feedback ?? [];
  const stats = statsQuery.data?.stats;

  // Client-side type filter
  const filtered = filterType === 'all'
    ? feedback
    : feedback.filter((f: any) => f.feedbackType === filterType);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total ?? 0}</p>
                <p className="text-xs text-gray-500">Total Feedback</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <p className="text-2xl font-bold">{Number(stats.averageRating ?? 0).toFixed(1)}</p>
                </div>
                <p className="text-xs text-gray-500">Avg Rating</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.byType?.success ?? 0}</p>
                <p className="text-xs text-gray-500">Successes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.byType?.partial ?? 0}</p>
                <p className="text-xs text-gray-500">Partial</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.byType?.failure ?? 0}</p>
                <p className="text-xs text-gray-500">Failures</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="suggestion">Suggestion</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => feedbackQuery.refetch()}
          disabled={feedbackQuery.isRefetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${feedbackQuery.isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Feedback History
            <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
          <CardDescription>
            Review and corrections from past agent executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackQuery.isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading feedback...</div>
          ) : !filtered.length ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No feedback yet</p>
              <p className="text-sm text-gray-400">
                Feedback is collected after each agent execution from the Agent Dashboard
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item: any) => {
                const FeedbackIcon = feedbackTypeIcon[item.feedbackType as keyof typeof feedbackTypeIcon] ?? MessageSquare;
                const colorClass = feedbackTypeColor[item.feedbackType as keyof typeof feedbackTypeColor] ?? 'bg-gray-100 text-gray-700';

                return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                      <FeedbackIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{item.taskType}</Badge>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < (item.rating ?? 0) ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`}
                            />
                          ))}
                        </div>
                        {item.createdAt && (
                          <span className="text-xs text-gray-400 ml-auto">{formatDate(item.createdAt)}</span>
                        )}
                      </div>
                      {item.comment && (
                        <p className="text-sm text-gray-600">{item.comment}</p>
                      )}
                      {item.corrections && (
                        <p className="text-sm text-blue-600 mt-1">
                          <span className="font-medium">Correction:</span> {item.corrections}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
