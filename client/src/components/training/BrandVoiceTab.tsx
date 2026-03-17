import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Palette,
  Plus,
  Save,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

export function BrandVoiceTab() {
  const voicesQuery = trpc.knowledge.listBrandVoices.useQuery();
  const contextsQuery = trpc.knowledge.listClientContexts.useQuery();
  const saveBrandVoice = trpc.knowledge.saveBrandVoice.useMutation({
    onSuccess: () => {
      toast.success('Brand voice saved');
      voicesQuery.refetch();
      setEditing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [expandedVoice, setExpandedVoice] = useState<number | null>(null);

  // Edit form state
  const [formName, setFormName] = useState('');
  const [formTone, setFormTone] = useState('');
  const [formVocab, setFormVocab] = useState('');
  const [formAvoid, setFormAvoid] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formAudience, setFormAudience] = useState('');

  const startEditing = (voice?: any) => {
    if (voice) {
      setFormName(voice.name ?? '');
      setFormTone((voice.tone ?? []).join(', '));
      setFormVocab((voice.vocabulary ?? []).join(', '));
      setFormAvoid((voice.avoidWords ?? []).join(', '));
      setFormIndustry(voice.industry ?? '');
      setFormAudience(voice.targetAudience ?? '');
      setEditing(voice);
    } else {
      setFormName('');
      setFormTone('');
      setFormVocab('');
      setFormAvoid('');
      setFormIndustry('');
      setFormAudience('');
      setEditing({ isNew: true });
    }
  };

  const handleSave = () => {
    const clientId = editing?.clientId ?? 1;
    saveBrandVoice.mutate({
      clientId,
      name: formName,
      tone: formTone.split(',').map((s: string) => s.trim()).filter(Boolean),
      vocabulary: formVocab.split(',').map((s: string) => s.trim()).filter(Boolean),
      avoidWords: formAvoid.split(',').map((s: string) => s.trim()).filter(Boolean),
      examples: editing?.examples ?? [],
      industry: formIndustry || undefined,
      targetAudience: formAudience || undefined,
    });
  };

  const voices = voicesQuery.data?.brandVoices ?? [];
  const contexts = contextsQuery.data?.contexts ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Brand Voice Profiles</h3>
          <p className="text-sm text-gray-500">Define how your agent writes for each client</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => voicesQuery.refetch()}
            disabled={voicesQuery.isRefetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${voicesQuery.isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => startEditing()}>
            <Plus className="w-4 h-4 mr-2" />
            New Voice
          </Button>
        </div>
      </div>

      {/* Editing Form */}
      {editing && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5" />
              {editing.isNew ? 'Create Brand Voice' : `Edit: ${editing.name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Professional Agency" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Industry</label>
                <Input value={formIndustry} onChange={(e) => setFormIndustry(e.target.value)} placeholder="e.g., Real Estate, Healthcare" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tone (comma-separated)</label>
                <Input value={formTone} onChange={(e) => setFormTone(e.target.value)} placeholder="professional, friendly, authoritative" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Audience</label>
                <Input value={formAudience} onChange={(e) => setFormAudience(e.target.value)} placeholder="e.g., Small business owners" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Key Vocabulary (comma-separated)</label>
                <Input value={formVocab} onChange={(e) => setFormVocab(e.target.value)} placeholder="innovate, transform, empower" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Words to Avoid (comma-separated)</label>
                <Input value={formAvoid} onChange={(e) => setFormAvoid(e.target.value)} placeholder="cheap, basic, simple" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSave}
                disabled={!formName || saveBrandVoice.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {saveBrandVoice.isPending ? 'Saving...' : 'Save Voice'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voices List */}
      {voicesQuery.isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading brand voices...</div>
      ) : !voices.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Palette className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No brand voices configured</p>
            <p className="text-sm text-gray-400 mb-4">Create a brand voice to control how your agent writes content</p>
            <Button size="sm" variant="outline" onClick={() => startEditing()}>
              <Plus className="w-4 h-4 mr-2" /> Create First Voice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {voices.map((voice: any) => {
            const isExpanded = expandedVoice === voice.clientId;
            return (
              <Card key={voice.clientId} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedVoice(isExpanded ? null : voice.clientId)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Palette className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{voice.name}</p>
                      <p className="text-xs text-gray-500">
                        {voice.industry ? `${voice.industry} • ` : ''}
                        Client #{voice.clientId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(voice.tone ?? []).slice(0, 3).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500">Tone: </span>
                        <span className="text-gray-700">{(voice.tone ?? []).join(', ') || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Audience: </span>
                        <span className="text-gray-700">{voice.targetAudience || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Vocabulary: </span>
                        <span className="text-gray-700">{(voice.vocabulary ?? []).join(', ') || 'Not set'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Avoid: </span>
                        <span className="text-gray-700">{(voice.avoidWords ?? []).join(', ') || 'Not set'}</span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => startEditing(voice)}>
                        Edit Voice
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Client Contexts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Client Contexts
            <Badge variant="secondary" className="ml-2">{contexts.length}</Badge>
          </CardTitle>
          <CardDescription>
            Business context that helps the agent understand each client&apos;s needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!contexts.length ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              No client contexts configured. Contexts are created when you set up client profiles.
            </p>
          ) : (
            <div className="space-y-3">
              {contexts.map((ctx: any) => (
                <div key={ctx.clientId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{ctx.businessType || `Client #${ctx.clientId}`}</p>
                    <p className="text-xs text-gray-500">
                      {ctx.industry} • {ctx.targetMarket}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ctx.products?.length ?? 0} products
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ctx.customerPersonas?.length ?? 0} personas
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
