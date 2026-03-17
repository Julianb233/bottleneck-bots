import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Trash2, RefreshCw, Link2, Database, BookOpen, Sparkles, CheckCircle2, ChevronDown, ChevronRight, RotateCcw, Eye, ListOrdered, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'training', label: 'Training Docs' }, { value: 'sop', label: 'SOPs' },
  { value: 'process', label: 'Processes' }, { value: 'policy', label: 'Policies' },
  { value: 'business', label: 'Business Docs' }, { value: 'technical', label: 'Technical' },
  { value: 'reference', label: 'Reference' }, { value: 'general', label: 'General' },
];

const PLATFORMS = [
  { value: 'general', label: 'General' }, { value: 'ghl', label: 'GoHighLevel' },
  { value: 'hubspot', label: 'HubSpot' }, { value: 'salesforce', label: 'Salesforce' },
];

const CATEGORY_COLORS: Record<string, string> = {
  sop: 'bg-violet-100 text-violet-700', process: 'bg-blue-100 text-blue-700',
  policy: 'bg-orange-100 text-orange-700', reference: 'bg-gray-100 text-gray-700',
  training: 'bg-emerald-100 text-emerald-700', general: 'bg-slate-100 text-slate-600',
  business: 'bg-cyan-100 text-cyan-700', technical: 'bg-indigo-100 text-indigo-700',
};

function ChunkPreview({ sourceId }: { sourceId: number }) {
  const chunksQuery = trpc.rag.getSourceChunks.useQuery({ sourceId }, { enabled: true });
  if (chunksQuery.isLoading) return <div className="py-4 text-center text-gray-400 text-sm">Loading chunks...</div>;
  const chunks = chunksQuery.data?.chunks || [];
  if (!chunks.length) return <div className="py-4 text-center text-gray-400 text-sm">No chunks found</div>;
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {chunks.map((chunk: any) => {
        const meta = chunk.metadata || {};
        const knowledgeCategory = meta.knowledgeCategory || meta.category || 'general';
        return (
          <div key={chunk.id} className="border rounded-lg p-3 bg-white text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">Chunk {chunk.chunkIndex + 1}</Badge>
              <Badge className={cn('text-xs', CATEGORY_COLORS[knowledgeCategory] || CATEGORY_COLORS.general)}>{knowledgeCategory}</Badge>
              <Badge variant="outline" className="text-xs">{chunk.tokenCount} tokens</Badge>
              {(meta.priority || 5) >= 7 && <Badge className="bg-amber-100 text-amber-700 text-xs">High Priority</Badge>}
            </div>
            <p className="text-gray-600 whitespace-pre-wrap line-clamp-4">{chunk.content}</p>
          </div>
        );
      })}
    </div>
  );
}

export function DocumentsTab() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('training');
  const [selectedPlatform, setSelectedPlatform] = useState('general');
  const [urlToIngest, setUrlToIngest] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const sourcesQuery = trpc.rag.listSources.useQuery({ limit: 50, isActive: true, ...(filterCategory !== 'all' ? { category: filterCategory } : {}) });
  const uploadMutation = trpc.rag.uploadDocument.useMutation({
    onSuccess: (data) => { toast.success(`Uploaded: ${data.message}`); setUploadProgress(100); setTimeout(() => { setUploadProgress(0); setIsUploading(false); }, 1000); sourcesQuery.refetch(); },
    onError: (error) => { toast.error(`Upload failed: ${error.message}`); setUploadProgress(0); setIsUploading(false); },
  });
  const ingestUrlMutation = trpc.rag.ingestUrl.useMutation({
    onSuccess: (data) => { toast.success(data.message); setUrlToIngest(''); sourcesQuery.refetch(); },
    onError: (error) => { toast.error(`Failed to ingest URL: ${error.message}`); },
  });
  const deleteMutation = trpc.rag.deleteSource.useMutation({
    onSuccess: () => { toast.success('Document deleted'); setDeleteId(null); sourcesQuery.refetch(); },
    onError: (error) => { toast.error(`Delete failed: ${error.message}`); },
  });
  const reprocessMutation = trpc.rag.reprocessSource.useMutation({
    onSuccess: (data) => { toast.success(data.message); sourcesQuery.refetch(); },
    onError: (error) => { toast.error(`Reprocess failed: ${error.message}`); },
  });

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true); setUploadProgress(10);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const allowedTypes = ['application/pdf', 'text/plain', 'text/html', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(file.type) && ext !== 'md' && ext !== 'markdown') { toast.error(`Unsupported: ${file.name}`); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`Too large: ${file.name}`); continue; }
      try {
        setUploadProgress(30 + (i / files.length) * 40);
        const reader = new FileReader();
        const base64Content = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        setUploadProgress(70 + (i / files.length) * 20);
        await uploadMutation.mutateAsync({ fileContent: base64Content, filename: file.name, mimeType: file.type || 'text/markdown', category: selectedCategory, platform: selectedPlatform });
      } catch (error) { console.error('Upload error:', error); }
    }
  }, [uploadMutation, selectedCategory, selectedPlatform]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }, [handleFileUpload]);
  const handleIngestUrl = () => {
    if (!urlToIngest.trim()) { toast.error('Please enter a URL'); return; }
    try { new URL(urlToIngest); } catch { toast.error('Invalid URL'); return; }
    ingestUrlMutation.mutate({ url: urlToIngest, category: selectedCategory, platform: selectedPlatform });
  };

  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const sources = sourcesQuery.data?.sources || [];
  const totalChunks = sources.reduce((acc: number, s: any) => acc + (s.chunkCount || 0), 0);
  const sopCount = sources.filter((s: any) => { const m = (s.metadata as Record<string, any>) || {}; return m.sopProcessing?.category === 'sop' || s.category === 'sop'; }).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Database className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{sourcesQuery.data?.count || 0}</p><p className="text-xs text-gray-500">Documents</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 rounded-lg"><BookOpen className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{totalChunks}</p><p className="text-xs text-gray-500">Knowledge Chunks</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><ListOrdered className="w-5 h-5 text-violet-600" /></div><div><p className="text-2xl font-bold">{sopCount}</p><p className="text-xs text-gray-500">SOPs Detected</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-amber-100 rounded-lg"><Sparkles className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">RAG</p><p className="text-xs text-gray-500">Active</p></div></div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Upload className="w-5 h-5" />Upload Documents</CardTitle><CardDescription>Drag & drop or click to upload. SOPs are auto-detected and tagged.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Category</label><Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Platform</label><Select value={selectedPlatform} onValueChange={setSelectedPlatform}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className={cn('border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer', isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400')} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => document.getElementById('doc-file-upload')?.click()}>
              <input id="doc-file-upload" type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown,.html" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" /><p className="text-sm text-gray-600 mb-1">{isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}</p><p className="text-xs text-gray-400">PDF, DOCX, TXT, MD (max 10MB each)</p>
            </div>
            {isUploading && <div className="space-y-2"><Progress value={uploadProgress} className="h-2" /><p className="text-xs text-gray-500 text-center">Processing... {uploadProgress}%</p></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Link2 className="w-5 h-5" />Import from URL</CardTitle><CardDescription>Fetch and process documentation from a web page</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">URL</label><Input placeholder="https://example.com/documentation" value={urlToIngest} onChange={(e) => setUrlToIngest(e.target.value)} /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleIngestUrl} disabled={ingestUrlMutation.isPending}>{ingestUrlMutation.isPending ? 'Importing...' : 'Import URL'}</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" />Knowledge Base</CardTitle><CardDescription>Browse, preview, and manage your agent&apos;s training documents</CardDescription></div>
          <div className="flex items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger className="w-[140px]"><Tag className="w-3 h-3 mr-1" /><SelectValue placeholder="Filter" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="sm" onClick={() => sourcesQuery.refetch()} disabled={sourcesQuery.isRefetching}><RefreshCw className={cn('w-4 h-4 mr-2', sourcesQuery.isRefetching && 'animate-spin')} />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {sourcesQuery.isLoading ? <div className="text-center py-8 text-gray-500">Loading...</div> : !sources.length ? (
            <div className="text-center py-8"><FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No documents uploaded yet</p><p className="text-sm text-gray-400">Upload your first document above</p></div>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Title</TableHead><TableHead className="hidden md:table-cell">Category</TableHead><TableHead className="hidden md:table-cell">Platform</TableHead><TableHead className="text-center">Chunks</TableHead><TableHead className="hidden sm:table-cell">Status</TableHead><TableHead className="hidden sm:table-cell">Added</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{sources.map((source: any) => {
                const meta = (source.metadata as Record<string, any>) || {};
                const sopData = meta.sopProcessing || {};
                const kCat = sopData.category || meta.knowledgeCategory || source.category || 'general';
                const sopSteps = sopData.stepsExtracted || meta.sopStepCount || 0;
                const isExp = expandedId === source.id;
                const status = meta.processingStatus || (source.chunkCount > 0 ? 'ready' : 'unknown');
                return (<>
                  <TableRow key={source.id} className={cn(isExp && 'bg-gray-50')}>
                    <TableCell><Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpandedId(isExp ? null : source.id)}>{isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</Button></TableCell>
                    <TableCell><div className="flex items-center gap-2">{kCat === 'sop' ? <ListOrdered className="w-4 h-4 text-violet-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />}<div><span className="font-medium truncate max-w-[200px] block">{source.title}</span>{sopSteps > 0 && <span className="text-xs text-violet-600">{sopSteps} SOP steps</span>}</div></div></TableCell>
                    <TableCell className="hidden md:table-cell"><Badge className={cn('text-xs', CATEGORY_COLORS[kCat] || CATEGORY_COLORS.general)}><Tag className="w-3 h-3 mr-1" />{kCat}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-xs">{source.platform}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-700">{source.chunkCount}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell">{status === 'ready' || source.chunkCount > 0 ? <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-xs text-emerald-600">Ready</span></div> : status === 'error' ? <span className="text-xs text-red-600">Error</span> : <span className="text-xs text-gray-500">Pending</span>}</TableCell>
                    <TableCell className="hidden sm:table-cell text-gray-500 text-sm">{formatDate(source.createdAt)}</TableCell>
                    <TableCell className="text-right"><div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600" onClick={() => setExpandedId(isExp ? null : source.id)} title="Preview chunks"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600" onClick={() => reprocessMutation.mutate({ sourceId: source.id })} disabled={reprocessMutation.isPending} title="Reprocess"><RotateCcw className={cn('w-4 h-4', reprocessMutation.isPending && 'animate-spin')} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(source.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0" title="Delete"><Trash2 className="w-4 h-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                  {isExp && <TableRow key={`${source.id}-chunks`}><TableCell colSpan={8} className="bg-gray-50 p-4"><div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700"><BookOpen className="w-4 h-4" />Knowledge Chunks Preview</div>
                    {sopData.steps?.length > 0 && <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-3"><p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-1"><ListOrdered className="w-4 h-4" />Extracted SOP Steps</p><ol className="list-decimal list-inside space-y-1 text-sm text-violet-700">{(sopData.steps as any[]).map((s: any, i: number) => <li key={i}>{s.instruction || s.title || s.description}</li>)}</ol></div>}
                    <ChunkPreview sourceId={source.id} />
                  </div></TableCell></TableRow>}
                </>);
              })}</TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Document</AlertDialogTitle><AlertDialogDescription>Are you sure? This removes all knowledge chunks and cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId && deleteMutation.mutate({ sourceId: deleteId })}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
