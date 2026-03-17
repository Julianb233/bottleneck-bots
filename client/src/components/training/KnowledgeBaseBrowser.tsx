/**
 * Knowledge Base Browser Component
 *
 * Provides a browseable view of all uploaded documents with:
 * - Document status (processing, ready, error)
 * - Preview of extracted chunks
 * - Delete and re-process actions
 * - Category filtering and search
 * - SOP step extraction display
 */

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Trash2,
  RefreshCw,
  Eye,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ListOrdered,
  Tag,
  ArrowUpDown,
  Database,
  BookOpen,
  Shield,
  FileCheck,
  GraduationCap,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  sop: { label: 'SOP', color: 'bg-blue-100 text-blue-700', icon: ListOrdered },
  process: { label: 'Process', color: 'bg-purple-100 text-purple-700', icon: ArrowUpDown },
  policy: { label: 'Policy', color: 'bg-amber-100 text-amber-700', icon: Shield },
  reference: { label: 'Reference', color: 'bg-gray-100 text-gray-700', icon: BookOpen },
  training: { label: 'Training', color: 'bg-emerald-100 text-emerald-700', icon: GraduationCap },
  general: { label: 'General', color: 'bg-slate-100 text-slate-600', icon: File },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ready: { label: 'Ready', color: 'text-emerald-600', icon: CheckCircle2 },
  processing: { label: 'Processing', color: 'text-amber-600', icon: Loader2 },
  error: { label: 'Error', color: 'text-red-600', icon: AlertCircle },
};

function getStatus(metadata: any): string {
  return metadata?.processingStatus || 'ready';
}

function getPriority(metadata: any): number {
  return metadata?.sopProcessing?.priority || 5;
}

function getSOPSteps(metadata: any): any[] {
  return metadata?.sopProcessing?.steps || [];
}

function getSummary(metadata: any): string {
  return metadata?.sopProcessing?.summary || '';
}

export default function KnowledgeBaseBrowser() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewSourceId, setPreviewSourceId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch documents
  const sourcesQuery = trpc.rag.listSources.useQuery({
    limit: 100,
    isActive: true,
  });

  // Get knowledge summary
  const summaryQuery = trpc.rag.knowledgeSummary.useQuery(undefined);

  // Source detail with chunks
  const sourceDetailQuery = trpc.rag.getSource.useQuery(
    { sourceId: previewSourceId! },
    { enabled: previewSourceId !== null }
  );

  // Mutations
  const deleteMutation = trpc.rag.deleteSource.useMutation({
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleteId(null);
      sourcesQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const reprocessMutation = trpc.rag.reprocessSource.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      sourcesQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Reprocess failed: ${error.message}`);
    },
  });

  // Filter sources
  const sources = (sourcesQuery.data?.sources || []).filter((source: any) => {
    const meta = source.metadata || {};
    const sopCategory = meta?.sopProcessing?.category || source.category || 'general';

    if (filterCategory !== 'all' && sopCategory !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        source.title.toLowerCase().includes(q) ||
        sopCategory.toLowerCase().includes(q) ||
        source.platform.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Knowledge Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryQuery.data?.totalDocuments || 0}</p>
                <p className="text-xs text-gray-500">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryQuery.data?.totalChunks || 0}</p>
                <p className="text-xs text-gray-500">Knowledge Chunks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ListOrdered className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Object.keys(summaryQuery.data?.categories || {}).length}
                </p>
                <p className="text-xs text-gray-500">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {summaryQuery.data?.sopSteps?.length || 0}
                </p>
                <p className="text-xs text-gray-500">SOP Steps</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      {summaryQuery.data?.categories && Object.keys(summaryQuery.data.categories).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summaryQuery.data.categories).map(([cat, count]) => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
            const Icon = config.icon;
            return (
              <Badge
                key={cat}
                variant="secondary"
                className={cn('text-xs cursor-pointer', config.color)}
                onClick={() => setFilterCategory(cat === filterCategory ? 'all' : cat)}
              >
                <Icon className="w-3 h-3 mr-1" />
                {config.label}: {count}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Filters & Search */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5" />
              Knowledge Base
            </CardTitle>
            <CardDescription>
              Browse, preview, and manage all training documents and their extracted knowledge
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              sourcesQuery.refetch();
              summaryQuery.refetch();
            }}
            disabled={sourcesQuery.isRefetching}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', sourcesQuery.isRefetching && 'animate-spin')} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Documents Table */}
          {sourcesQuery.isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
              Loading knowledge base...
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {searchQuery || filterCategory !== 'all'
                  ? 'No documents match your filters'
                  : 'No documents in knowledge base yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden lg:table-cell">Platform</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Chunks</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Priority</TableHead>
                    <TableHead className="hidden sm:table-cell">Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source: any) => {
                    const meta = source.metadata || {};
                    const status = getStatus(meta);
                    const priority = getPriority(meta);
                    const sopSteps = getSOPSteps(meta);
                    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.ready;
                    const StatusIcon = statusConfig.icon;
                    const sopCategory = meta?.sopProcessing?.category || source.category || 'general';
                    const catConfig = CATEGORY_CONFIG[sopCategory] || CATEGORY_CONFIG.general;
                    const CatIcon = catConfig.icon;

                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium truncate block max-w-[200px]">
                                {source.title}
                              </span>
                              {sopSteps.length > 0 && (
                                <span className="text-xs text-gray-400">
                                  {sopSteps.length} steps extracted
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className={cn('text-xs', catConfig.color)}>
                            <CatIcon className="w-3 h-3 mr-1" />
                            {catConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {source.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={cn('flex items-center justify-center gap-1', statusConfig.color)}>
                            <StatusIcon className={cn('w-4 h-4', status === 'processing' && 'animate-spin')} />
                            <span className="text-xs hidden sm:inline">{statusConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            {source.chunkCount || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          <div className="flex items-center justify-center">
                            <div
                              className={cn(
                                'w-8 h-2 rounded-full bg-gray-200 overflow-hidden',
                              )}
                            >
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  priority >= 8 ? 'bg-red-500' :
                                  priority >= 6 ? 'bg-amber-500' :
                                  'bg-blue-500'
                                )}
                                style={{ width: `${priority * 10}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 ml-1">{priority}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                          {formatDate(source.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setPreviewSourceId(source.id)}
                              title="Preview chunks"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => reprocessMutation.mutate({ sourceId: source.id })}
                              disabled={reprocessMutation.isPending}
                              title="Re-process document"
                            >
                              <RefreshCw className={cn('w-4 h-4', reprocessMutation.isPending && 'animate-spin')} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleteId(source.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Delete document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chunk Preview Dialog */}
      <Dialog open={previewSourceId !== null} onOpenChange={() => setPreviewSourceId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Document Preview
            </DialogTitle>
            <DialogDescription>
              Extracted knowledge chunks from this document
            </DialogDescription>
          </DialogHeader>

          {sourceDetailQuery.isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-gray-400" />
              <p className="text-gray-500">Loading chunks...</p>
            </div>
          ) : sourceDetailQuery.data ? (
            <div className="space-y-4">
              {/* Source info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">{sourceDetailQuery.data.source.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{sourceDetailQuery.data.source.category}</Badge>
                  <Badge variant="outline">{sourceDetailQuery.data.source.platform}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">
                    {sourceDetailQuery.data.chunkCount} chunks
                  </Badge>
                </div>

                {/* SOP Steps if available */}
                {(() => {
                  const meta = (sourceDetailQuery.data.source as any).metadata || {};
                  const steps = meta?.sopProcessing?.steps || [];
                  if (steps.length === 0) return null;
                  return (
                    <div className="mt-3 border-t pt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <ListOrdered className="w-4 h-4" />
                        Extracted SOP Steps ({steps.length})
                      </h4>
                      <ol className="space-y-1 text-sm text-gray-600">
                        {steps.slice(0, 10).map((step: any, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-mono text-xs text-gray-400 mt-0.5">
                              {step.order || i + 1}.
                            </span>
                            <span>{step.instruction}</span>
                          </li>
                        ))}
                        {steps.length > 10 && (
                          <li className="text-gray-400 text-xs">
                            ...and {steps.length - 10} more steps
                          </li>
                        )}
                      </ol>
                    </div>
                  );
                })()}

                {/* Tags */}
                {(() => {
                  const tags = (sourceDetailQuery.data.source as any).tags || [];
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Chunks */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Knowledge Chunks ({sourceDetailQuery.data.chunks.length})
                </h4>
                {sourceDetailQuery.data.chunks.map((chunk: any, index: number) => (
                  <div
                    key={chunk.id}
                    className="border rounded-lg p-3 space-y-1 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        Chunk {chunk.chunkIndex + 1}
                      </span>
                      <span className="text-xs text-gray-400">
                        {chunk.tokenCount} tokens
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load document details
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document from the knowledge base?
              All extracted chunks and embeddings will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ sourceId: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
