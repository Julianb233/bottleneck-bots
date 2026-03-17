import React, { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  CheckCircle2,
  Link2,
  Database,
  BookOpen,
  Sparkles,
  Workflow,
  Zap,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Eye,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import WorkflowsTab from '@/components/training/WorkflowsTab';
import SkillsTab from '@/components/training/SkillsTab';
import BehaviorTab from '@/components/training/BehaviorTab';
import KnowledgeBaseBrowser from '@/components/training/KnowledgeBaseBrowser';

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

export default function Training() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('training');
  const [selectedPlatform, setSelectedPlatform] = useState('general');
  const [urlToIngest, setUrlToIngest] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);

  // Fetch training documents
  const sourcesQuery = trpc.rag.listSources.useQuery({
    limit: 50,
    isActive: true,
  });

  // Upload mutation
  const uploadMutation = trpc.rag.uploadDocument.useMutation({
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

  // Ingest URL mutation
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

  // Delete mutation
  const deleteMutation = trpc.rag.deleteSource.useMutation({
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleteId(null);
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  // Reprocess mutation
  const reprocessMutation = trpc.rag.reprocessDocument.useMutation({
    onSuccess: (data) => {
      toast.success(`Re-processed: ${data.chunkCount} chunks`);
      setReprocessingId(null);
      sourcesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Reprocess failed: ${error.message}`);
      setReprocessingId(null);
    },
  });

  // Chunks query (only when a document is expanded)
  const chunksQuery = trpc.rag.getDocumentChunks.useQuery(
    { sourceId: expandedDocId! },
    { enabled: expandedDocId !== null }
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsUploading(true);
      setUploadProgress(10);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file type
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

        // Check file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        try {
          setUploadProgress(30 + (i / files.length) * 40);

          // Read file as base64
          const reader = new FileReader();
          const base64Content = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1]; // Remove data:... prefix
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          setUploadProgress(70 + (i / files.length) * 20);

          // Upload to API
          await uploadMutation.mutateAsync({
            fileContent: base64Content,
            filename: file.name,
            mimeType: file.type || 'text/markdown',
            category: selectedCategory,
            platform: selectedPlatform,
          });
        } catch (error) {
          console.error('Upload error:', error);
        }
      }
    },
    [uploadMutation, selectedCategory, selectedPlatform]
  );

  // Drag and drop handlers
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

  // Handle URL ingestion
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

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Training</h1>
          <p className="text-gray-500 mt-1">
            Train your AI agent with documents, workflows, skills, and behavior settings
          </p>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Knowledge Base</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5">
            <Workflow className="w-4 h-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1.5">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Behavior</span>
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab - existing functionality */}
        <TabsContent value="documents" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sourcesQuery.data?.count || 0}</p>
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
                    <p className="text-2xl font-bold">
                      {sourcesQuery.data?.sources?.reduce((acc: number, s: any) => acc + (s.chunkCount || 0), 0) || 0}
                    </p>
                    <p className="text-xs text-gray-500">Chunks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">RAG</p>
                    <p className="text-xs text-gray-500">Enabled</p>
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
                    <p className="text-xs text-gray-500">Status</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Drag & drop or click to upload PDFs, Word docs, Markdown, or text files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category & Platform selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Platform</label>
                    <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-300 hover:border-emerald-400'
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input
                    id="file-upload"
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

                {/* Upload progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-gray-500 text-center">Uploading... {uploadProgress}%</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* URL Ingestion */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Import from URL
                </CardTitle>
                <CardDescription>
                  Fetch and process documentation from a web page
                </CardDescription>
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

          {/* Documents List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Training Documents
                </CardTitle>
                <CardDescription>
                  Documents that your AI agent uses for context during tasks
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sourcesQuery.refetch()}
                disabled={sourcesQuery.isRefetching}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', sourcesQuery.isRefetching && 'animate-spin')} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {sourcesQuery.isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : !sourcesQuery.data?.sources?.length ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No documents uploaded yet</p>
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
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Chunks</TableHead>
                        <TableHead className="hidden sm:table-cell">Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourcesQuery.data.sources.map((source: any) => {
                        const meta = source.metadata || {};
                        const isSOP = meta.isSOP;
                        const docCategory = meta.detectedCategory;
                        const isExpanded = expandedDocId === source.id;
                        const isReprocessing = reprocessingId === source.id;
                        const status = source.chunkCount > 0 ? 'ready' : 'processing';

                        return (
                          <React.Fragment key={source.id}>
                            <TableRow className={cn(isExpanded && 'bg-gray-50')}>
                              <TableCell className="w-8 px-2">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setExpandedDocId(isExpanded ? null : source.id)}
                                  className="h-6 w-6"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div>
                                    <span className="font-medium truncate max-w-[200px] block">{source.title}</span>
                                    {isSOP && (
                                      <span className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                        <Tag className="w-3 h-3" />
                                        SOP {meta.sopStepCount ? `(${meta.sopStepCount} steps)` : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-xs',
                                    docCategory === 'sop' && 'bg-blue-100 text-blue-700',
                                    docCategory === 'process' && 'bg-purple-100 text-purple-700',
                                    docCategory === 'policy' && 'bg-amber-100 text-amber-700',
                                  )}
                                >
                                  {docCategory || source.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className="text-xs">
                                  {source.platform}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {status === 'ready' ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Ready
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Processing
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  {source.chunkCount}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-gray-500 text-sm">
                                {formatDate(source.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      setReprocessingId(source.id);
                                      reprocessMutation.mutate({ sourceId: source.id });
                                    }}
                                    disabled={isReprocessing}
                                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                    title="Re-process document"
                                  >
                                    {isReprocessing ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-4 h-4" />
                                    )}
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
                            {/* Expanded chunk preview */}
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-gray-50 p-0">
                                  <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Eye className="w-4 h-4" />
                                        Document Chunks
                                      </h4>
                                      {source.sourceType && (
                                        <Badge variant="outline" className="text-xs">
                                          {source.sourceType}
                                        </Badge>
                                      )}
                                    </div>
                                    {chunksQuery.isLoading ? (
                                      <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading chunks...
                                      </div>
                                    ) : chunksQuery.data?.chunks?.length ? (
                                      <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {chunksQuery.data.chunks.map((chunk: any, index: number) => (
                                          <div
                                            key={chunk.id || index}
                                            className="bg-white border rounded-lg p-3 text-sm"
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-xs font-medium text-gray-500">
                                                Chunk {chunk.chunkIndex + 1}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {chunk.metadata?.isSOP && (
                                                  <Badge className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0">
                                                    SOP
                                                  </Badge>
                                                )}
                                                {chunk.metadata?.documentCategory && (
                                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                                    {chunk.metadata.documentCategory}
                                                  </Badge>
                                                )}
                                                <span className="text-xs text-gray-400">
                                                  {chunk.tokenCount} tokens
                                                </span>
                                              </div>
                                            </div>
                                            <p className="text-gray-700 whitespace-pre-wrap line-clamp-4">
                                              {chunk.content}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 py-2">No chunks found</p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Browser Tab */}
        <TabsContent value="knowledge">
          <KnowledgeBaseBrowser />
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows">
          <WorkflowsTab />
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <SkillsTab />
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior">
          <BehaviorTab />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training document? This action cannot be undone.
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
