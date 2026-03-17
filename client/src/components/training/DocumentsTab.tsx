import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Link2,
  Database,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'training', label: 'Training Docs' },
  { value: 'sop', label: 'SOPs' },
  { value: 'business', label: 'Business Docs' },
  { value: 'technical', label: 'Technical' },
  { value: 'general', label: 'General' },
];

const PLATFORMS = [
  { value: 'general', label: 'General' },
  { value: 'ghl', label: 'GoHighLevel' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'salesforce', label: 'Salesforce' },
];

const CATEGORY_COLORS: Record<string, string> = {
  sop: 'bg-blue-100 text-blue-700',
  process: 'bg-indigo-100 text-indigo-700',
  policy: 'bg-orange-100 text-orange-700',
  reference: 'bg-gray-100 text-gray-700',
  training: 'bg-emerald-100 text-emerald-700',
  business: 'bg-purple-100 text-purple-700',
  technical: 'bg-cyan-100 text-cyan-700',
  general: 'bg-gray-100 text-gray-500',
};

export function DocumentsTab() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('training');
  const [selectedPlatform, setSelectedPlatform] = useState('general');
  const [urlToIngest, setUrlToIngest] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const sourcesQuery = trpc.rag.listSources.useQuery({
    limit: 50,
    isActive: true,
  });

  // Chunk preview query - only fetched when a source is expanded
  const chunksQuery = trpc.rag.getSourceChunks.useQuery(
    { sourceId: expandedSourceId! },
    { enabled: expandedSourceId !== null }
  );

  const uploadMutation = trpc.rag.uploadDocumentWithSOPProcessing.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploadProgress(0);
      setIsUploading(false);
    },
  });

  // Fallback to original upload if SOP endpoint isn't available yet
  const uploadFallback = trpc.rag.uploadDocument.useMutation({
    onSuccess: (data) => {
      toast.success(`Uploaded: ${data.message}`);
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploadProgress(0);
      setIsUploading(false);
    },
  });

  const ingestUrlMutation = trpc.rag.ingestUrl.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setUrlToIngest('');
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to ingest URL: ${error.message}`);
    },
  });

  const deleteMutation = trpc.rag.deleteSource.useMutation({
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleteId(null);
      if (expandedSourceId === deleteId) setExpandedSourceId(null);
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const reprocessMutation = trpc.rag.reprocessDocument.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      sourcesQuery.refetch();
      if (expandedSourceId) chunksQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Re-process failed: ${error.message}`);
    },
  });

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsUploading(true);
      setUploadProgress(10);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const allowedTypes = [
          'application/pdf',
          'text/plain',
          'text/html',
          'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        const extension = file.name.split('.').pop()?.toLowerCase();
        const isMarkdown = extension === 'md' || extension === 'markdown';

        if (!allowedTypes.includes(file.type) && !isMarkdown) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        try {
          setUploadProgress(30 + (i / files.length) * 40);

          const reader = new FileReader();
          const base64Content = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          setUploadProgress(70 + (i / files.length) * 20);

          // Try SOP-aware upload first, fallback to standard
          try {
            await uploadMutation.mutateAsync({
              fileContent: base64Content,
              filename: file.name,
              mimeType: file.type || 'text/markdown',
              category: selectedCategory,
              platform: selectedPlatform,
            });
          } catch {
            await uploadFallback.mutateAsync({
              fileContent: base64Content,
              filename: file.name,
              mimeType: file.type || 'text/markdown',
              category: selectedCategory,
              platform: selectedPlatform,
            });
          }
        } catch (error) {
          console.error('Upload error:', error);
        }
      }
    },
    [uploadMutation, uploadFallback, selectedCategory, selectedPlatform]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleIngestUrl = () => {
    if (!urlToIngest.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    try {
      new URL(urlToIngest);
    } catch {
      toast.error('Invalid URL');
      return;
    }
    ingestUrlMutation.mutate({
      url: urlToIngest,
      category: selectedCategory,
      platform: selectedPlatform,
    });
  };

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const toggleExpand = (sourceId: number) => {
    setExpandedSourceId(expandedSourceId === sourceId ? null : sourceId);
  };

  // Filter sources by category
  const filteredSources = sourcesQuery.data?.sources?.filter((s: any) =>
    filterCategory === 'all' ? true : s.category === filterCategory
  ) || [];

  // Compute stats
  const totalDocs = sourcesQuery.data?.count || 0;
  const totalChunks = sourcesQuery.data?.sources?.reduce((acc: number, s: any) => acc + (s.chunkCount || 0), 0) || 0;
  const sopCount = sourcesQuery.data?.sources?.filter((s: any) => s.category === 'sop' || s.category === 'process').length || 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDocs}</p>
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
                <p className="text-2xl font-bold">{totalChunks}</p>
                <p className="text-xs text-gray-500">Chunks</p>
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
                <p className="text-2xl font-bold">{sopCount}</p>
                <p className="text-xs text-gray-500">SOPs / Processes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Active</p>
                <p className="text-xs text-gray-500">RAG Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Documents
            </CardTitle>
            <CardDescription>
              Upload SOPs, process docs, or training materials. Documents are auto-categorized and SOP steps are extracted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Platform</label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('doc-file-upload')?.click()}
            >
              <input
                id="doc-file-upload"
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.markdown,.html"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-1">
                {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-xs text-gray-400">PDF, DOCX, TXT, MD (max 10MB each)</p>
            </div>
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-gray-500 text-center">Processing... {uploadProgress}%</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Import from URL
            </CardTitle>
            <CardDescription>Fetch and process documentation from a web page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">URL</label>
              <Input
                placeholder="https://example.com/documentation"
                value={urlToIngest}
                onChange={(e) => setUrlToIngest(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleIngestUrl}
              disabled={ingestUrlMutation.isPending}
            >
              {ingestUrlMutation.isPending ? 'Importing...' : 'Import URL'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Base Browser */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Knowledge Base
            </CardTitle>
            <CardDescription>
              Browse, preview, and manage your agent's training documents
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Category filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Tag className="w-3 h-3 mr-1" />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="sop">SOPs</SelectItem>
                <SelectItem value="process">Processes</SelectItem>
                <SelectItem value="policy">Policies</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sourcesQuery.refetch()}
              disabled={sourcesQuery.isRefetching}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', sourcesQuery.isRefetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sourcesQuery.isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : !filteredSources.length ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {filterCategory !== 'all' ? `No ${filterCategory} documents found` : 'No documents uploaded yet'}
              </p>
              <p className="text-sm text-gray-400">Upload your first document above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Platform</TableHead>
                    <TableHead className="text-center">Chunks</TableHead>
                    <TableHead className="hidden lg:table-cell">Priority</TableHead>
                    <TableHead className="hidden sm:table-cell">Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSources.map((source: any) => {
                    const isExpanded = expandedSourceId === source.id;
                    const metadata = source.metadata || {};
                    const categoryColor = CATEGORY_COLORS[source.category] || CATEGORY_COLORS.general;
                    const priority = metadata.priority;
                    const sopStepCount = metadata.stepCount;

                    return (
                      <>
                        <TableRow key={source.id} className={cn(isExpanded && 'bg-gray-50')}>
                          <TableCell className="w-8 p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleExpand(source.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <span className="font-medium truncate max-w-[200px] block">{source.title}</span>
                                {sopStepCount > 0 && (
                                  <span className="text-xs text-blue-600">{sopStepCount} SOP steps</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge className={cn('text-xs', categoryColor)}>
                              {source.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="text-xs">{source.platform}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              {source.chunkCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {priority !== undefined ? (
                              <div className="flex items-center gap-1">
                                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={cn(
                                      'h-1.5 rounded-full',
                                      priority >= 0.8 ? 'bg-blue-600' :
                                      priority >= 0.6 ? 'bg-emerald-500' :
                                      priority >= 0.4 ? 'bg-amber-500' : 'bg-gray-400'
                                    )}
                                    style={{ width: `${priority * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{Math.round(priority * 100)}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">--</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                            {formatDate(source.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => toggleExpand(source.id)}
                                title="Preview chunks"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600 hover:bg-amber-50"
                                onClick={() => reprocessMutation.mutate({ sourceId: source.id })}
                                disabled={reprocessMutation.isPending}
                                title="Re-process with SOP detection"
                              >
                                <RotateCcw className={cn('w-4 h-4', reprocessMutation.isPending && 'animate-spin')} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(source.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded chunk preview row */}
                        {isExpanded && (
                          <TableRow key={`${source.id}-chunks`}>
                            <TableCell colSpan={8} className="bg-gray-50 p-0">
                              <div className="p-4 space-y-3">
                                {/* SOP Steps (if any) */}
                                {metadata.sopSteps && metadata.sopSteps.length > 0 && (
                                  <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                      <ListOrdered className="w-4 h-4" />
                                      Extracted SOP Steps
                                    </h4>
                                    <div className="space-y-1">
                                      {metadata.sopSteps.map((step: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                          <Badge variant="outline" className="text-xs min-w-[24px] justify-center mt-0.5">
                                            {step.order}
                                          </Badge>
                                          <div>
                                            <span className="font-medium">{step.title}</span>
                                            {step.substeps && step.substeps.length > 0 && (
                                              <ul className="mt-1 ml-4 text-xs text-gray-500 list-disc">
                                                {step.substeps.map((sub: string, sidx: number) => (
                                                  <li key={sidx}>{sub}</li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Chunk Preview */}
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" />
                                    Document Chunks ({chunksQuery.data?.count || source.chunkCount})
                                  </h4>
                                  {chunksQuery.isLoading ? (
                                    <p className="text-sm text-gray-500">Loading chunks...</p>
                                  ) : chunksQuery.data?.chunks?.length ? (
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                      {chunksQuery.data.chunks.map((chunk: any, idx: number) => (
                                        <div
                                          key={chunk.id || idx}
                                          className="border rounded-md p-3 bg-white text-sm"
                                        >
                                          <div className="flex items-center justify-between mb-1">
                                            <Badge variant="outline" className="text-xs">
                                              Chunk {chunk.chunkIndex + 1}
                                            </Badge>
                                            <span className="text-xs text-gray-400">
                                              {chunk.tokenCount} tokens
                                            </span>
                                          </div>
                                          <p className="text-gray-600 text-xs leading-relaxed line-clamp-4 whitespace-pre-wrap">
                                            {chunk.content}
                                          </p>
                                          {chunk.metadata?.documentCategory && (
                                            <Badge className={cn('text-xs mt-2', CATEGORY_COLORS[chunk.metadata.documentCategory] || '')} >
                                              {chunk.metadata.documentCategory}
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No chunks found</p>
                                  )}
                                </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training document? This will remove all associated chunks and cannot be undone.
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
