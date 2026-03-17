import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Search,
  Trash2,
  RefreshCw,
  Workflow,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';

export function PatternsTab() {
  const [search, setSearch] = useState('');
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const patternsQuery = trpc.knowledge.listPatterns.useQuery();
  const deleteMutation = trpc.knowledge.deletePattern.useMutation({
    onSuccess: () => {
      toast.success('Pattern deleted');
      setDeleteTarget(null);
      patternsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const patterns = patternsQuery.data?.patterns ?? [];
  const filtered = patterns.filter((p: any) =>
    (p.taskType?.toLowerCase().includes(search.toLowerCase()) ||
     p.taskName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search patterns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => patternsQuery.refetch()}
          disabled={patternsQuery.isRefetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${patternsQuery.isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Patterns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Action Patterns
            <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
          <CardDescription>
            Learned automation patterns the agent uses to complete GHL tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {patternsQuery.isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading patterns...</div>
          ) : !filtered.length ? (
            <div className="text-center py-8">
              <Layers className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {search ? 'No patterns match your search' : 'No action patterns learned yet'}
              </p>
              <p className="text-sm text-gray-400">
                Patterns are automatically created as the agent completes tasks
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Task Type</TableHead>
                    <TableHead className="hidden md:table-cell">Name</TableHead>
                    <TableHead className="text-center">Steps</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Success</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Failures</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((pattern: any) => {
                    const isExpanded = expandedPattern === pattern.taskType;
                    const total = (pattern.successCount ?? 0) + (pattern.failureCount ?? 0);
                    const rate = total > 0 ? ((pattern.successCount ?? 0) / total) * 100 : 0;

                    return (
                      <>
                        <TableRow
                          key={pattern.taskType}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedPattern(isExpanded ? null : pattern.taskType)}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-sm">{pattern.taskType}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-gray-600">{pattern.taskName || '--'}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{pattern.steps?.length ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              {pattern.successCount ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell">
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                              {pattern.failureCount ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(pattern.taskType);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${pattern.taskType}-detail`}>
                            <TableCell colSpan={7} className="bg-gray-50 p-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-4">
                                  <span className="text-xs font-medium text-gray-500">URL:</span>
                                  <span className="text-xs text-gray-600">{pattern.pageUrl || '--'}</span>
                                  <span className="text-xs font-medium text-gray-500 ml-4">Success Rate:</span>
                                  <Badge className={rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                                    {rate.toFixed(0)}%
                                  </Badge>
                                </div>
                                {pattern.steps?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-2">Steps:</p>
                                    <div className="space-y-1">
                                      {pattern.steps.map((step: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                          <Badge variant="outline" className="w-6 h-5 flex items-center justify-center p-0 text-[10px]">
                                            {i + 1}
                                          </Badge>
                                          <Badge variant="secondary" className="text-[10px]">
                                            {step.action}
                                          </Badge>
                                          {step.selector && (
                                            <code className="text-gray-500 bg-gray-100 px-1 py-0.5 rounded text-[10px] truncate max-w-[300px]">
                                              {step.selector}
                                            </code>
                                          )}
                                          {step.instruction && (
                                            <span className="text-gray-600 truncate">{step.instruction}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pattern</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the pattern &quot;{deleteTarget}&quot;? The agent will need to re-learn this task type.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate({ taskType: deleteTarget })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
