import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Eye,
  Copy,
  Check,
  RefreshCw,
  Bot,
  Zap,
  MessageSquare,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PromptPreview() {
  const [copied, setCopied] = useState(false);

  const behaviorQuery = trpc.agentTraining.getBehaviorConfig.useQuery();
  const skillsQuery = trpc.agentTraining.getSkillConfig.useQuery();

  const isLoading = behaviorQuery.isLoading || skillsQuery.isLoading;

  const behavior = behaviorQuery.data?.behavior;
  const skills = skillsQuery.data?.skills;

  function buildPrompt(): string {
    if (!behavior || !skills) return '';

    const lines: string[] = [];

    // Personality
    lines.push('## System Personality');
    lines.push(behavior.personality || 'You are a helpful AI assistant.');
    lines.push('');

    // Communication style
    lines.push('## Communication Style');
    lines.push(`- Response Style: ${behavior.responseStyle || 'professional'}`);
    lines.push(`- Verbosity: ${behavior.verbosity || 'balanced'}`);
    lines.push('');

    // Enabled skills
    const enabledSkills = (skills as Array<{ id: string; name: string; enabled: boolean; permission: string }>).filter((s) => s.enabled);
    if (enabledSkills.length > 0) {
      lines.push('## Available Tools');
      for (const skill of enabledSkills) {
        lines.push(`- ${skill.name} (${skill.permission})`);
      }
      lines.push('');
    }

    // Disabled skills
    const disabledSkills = (skills as Array<{ id: string; name: string; enabled: boolean; permission: string }>).filter((s) => !s.enabled);
    if (disabledSkills.length > 0) {
      lines.push('## Disabled Tools (DO NOT USE)');
      for (const skill of disabledSkills) {
        lines.push(`- ${skill.name}`);
      }
      lines.push('');
    }

    // Escalation rules
    const rules = behavior.escalationRules;
    if (Array.isArray(rules) && rules.length > 0) {
      lines.push('## Escalation Rules');
      for (const rule of rules) {
        lines.push(`- When: ${rule.condition} → ${rule.action}`);
      }
      lines.push('');
    }

    // Custom instructions
    if (behavior.customInstructions) {
      lines.push('## Additional Instructions');
      lines.push(behavior.customInstructions);
      lines.push('');
    }

    return lines.join('\n');
  }

  const prompt = buildPrompt();
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  const charCount = prompt.length;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }

  function handleRefresh() {
    void behaviorQuery.refetch();
    void skillsQuery.refetch();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Prompt Preview</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Preview the assembled system prompt your agent will use
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleCopy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {copied ? (
              <Check className="w-4 h-4 mr-1.5" />
            ) : (
              <Copy className="w-4 h-4 mr-1.5" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <Badge variant="secondary" className="text-xs">
          {wordCount} words
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {charCount} characters
        </Badge>
        <Badge
          className={cn(
            'text-xs',
            behaviorQuery.data?.isDefault
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
          )}
        >
          {behaviorQuery.data?.isDefault ? 'Using Defaults' : 'Custom Config'}
        </Badge>
      </div>

      {/* Prompt sections breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-medium text-gray-700">Personality</p>
                <p className="text-xs text-gray-400">
                  {behavior?.personality ? 'Configured' : 'Default'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-medium text-gray-700">Skills</p>
                <p className="text-xs text-gray-400">
                  {(skills as Array<{ enabled: boolean }>)?.filter((s) => s.enabled).length || 0} enabled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-xs font-medium text-gray-700">Escalation</p>
                <p className="text-xs text-gray-400">
                  {(behavior?.escalationRules as Array<unknown>)?.length || 0} rules
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-medium text-gray-700">Style</p>
                <p className="text-xs text-gray-400 capitalize">
                  {behavior?.responseStyle || 'professional'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rendered prompt */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-600" />
            Assembled System Prompt
          </CardTitle>
          <CardDescription className="text-xs">
            This is the exact prompt sent to the AI model at the start of every agent session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
            {prompt || (
              <span className="text-gray-400 italic">
                No configuration found. Set up your agent's behavior, skills, and personality to see the preview.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tip */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">How this works</p>
          <p className="text-xs text-blue-600 mt-0.5">
            The system prompt is automatically assembled from your Behavior, Skills, and Documents configuration.
            Changes you make in those tabs are reflected here in real-time. Training documents are injected via
            RAG retrieval at query time — they are not shown here but augment every response.
          </p>
        </div>
      </div>
    </div>
  );
}
