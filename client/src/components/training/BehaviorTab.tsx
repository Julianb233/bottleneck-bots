import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageSquare,
  SlidersHorizontal,
  AlertTriangle,
  FileText,
  Languages,
  Plus,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

// Types

type ResponseStyle = 'professional' | 'friendly' | 'casual' | 'technical';
type Verbosity = 'concise' | 'balanced' | 'detailed';

interface LanguagePreferences {
  primaryLanguage: string;
  supportedLanguages: string[];
  autoDetect: boolean;
}

interface EscalationRule {
  condition: string;
  action: string;
}

interface BehaviorConfig {
  personality: string;
  responseStyle: ResponseStyle;
  verbosity: Verbosity;
  languagePreferences: LanguagePreferences;
  escalationRules: EscalationRule[];
  customInstructions: string;
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

const DEFAULT_CONFIG: BehaviorConfig = {
  personality: 'You are a helpful, professional AI assistant for agency operations.',
  responseStyle: 'professional',
  verbosity: 'balanced',
  languagePreferences: {
    primaryLanguage: 'en',
    supportedLanguages: ['en'],
    autoDetect: true,
  },
  escalationRules: [],
  customInstructions: '',
};

const EMPTY_RULE: EscalationRule = { condition: '', action: '' };

// Section wrapper component

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-600" />
          {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Escalation rule row

function EscalationRuleRow({
  rule,
  index,
  onChange,
  onRemove,
}: {
  rule: EscalationRule;
  index: number;
  onChange: (updated: EscalationRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0 text-xs text-gray-400 w-4 text-right">{index + 1}.</span>
      <Input
        className="flex-1 h-8 text-xs"
        placeholder="Condition (e.g. user asks about billing)"
        value={rule.condition}
        onChange={(e) => onChange({ ...rule, condition: e.target.value })}
      />
      <span className="flex-shrink-0 text-xs text-gray-400">→</span>
      <Input
        className="flex-1 h-8 text-xs"
        placeholder="Action (e.g. escalate to human agent)"
        value={rule.action}
        onChange={(e) => onChange({ ...rule, action: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-gray-400 hover:text-red-500"
        onClick={onRemove}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// Main component

export default function BehaviorTab() {
  const [config, setConfig] = useState<BehaviorConfig>(DEFAULT_CONFIG);
  const [isDirty, setIsDirty] = useState(false);

  const configQuery = trpc.agentTraining.getBehaviorConfig.useQuery();

  const updateMutation = trpc.agentTraining.updateBehaviorConfig.useMutation({
    onSuccess: () => {
      toast.success('Behavior configuration saved');
      setIsDirty(false);
      void configQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed to save behavior: ${err.message}`),
  });

  // Sync fetched config into local state
  // Backend returns { success, behavior, isDefault }
  useEffect(() => {
    if (configQuery.data?.behavior) {
      const fetched = configQuery.data.behavior;
      setConfig({
        personality: fetched.personality ?? DEFAULT_CONFIG.personality,
        responseStyle: (fetched.responseStyle ?? 'professional') as ResponseStyle,
        verbosity: (fetched.verbosity ?? 'balanced') as Verbosity,
        escalationRules: Array.isArray(fetched.escalationRules) ? fetched.escalationRules : [],
        customInstructions: fetched.customInstructions ?? '',
      });
      setIsDirty(false);
    }
  }, [configQuery.data]);

  function update<K extends keyof BehaviorConfig>(key: K, value: BehaviorConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  function addRule() {
    setConfig((prev) => ({
      ...prev,
      escalationRules: [...prev.escalationRules, { ...EMPTY_RULE }],
    }));
    setIsDirty(true);
  }

  function updateRule(index: number, updated: EscalationRule) {
    setConfig((prev) => {
      const rules = [...prev.escalationRules];
      rules[index] = updated;
      return { ...prev, escalationRules: rules };
    });
    setIsDirty(true);
  }

  function removeRule(index: number) {
    setConfig((prev) => ({
      ...prev,
      escalationRules: prev.escalationRules.filter((_, i) => i !== index),
    }));
    setIsDirty(true);
  }

  function handleSave() {
    updateMutation.mutate({
      personality: config.personality,
      responseStyle: config.responseStyle,
      verbosity: config.verbosity,
      escalationRules: config.escalationRules,
      customInstructions: config.customInstructions,
    });
  }

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-medium">Failed to load behavior configuration</p>
        <p className="text-sm text-gray-400 mt-1">{configQuery.error?.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => configQuery.refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agent Behavior</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Define how your agent communicates and handles situations
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className={cn(
            'transition-all',
            isDirty
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
          size="sm"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Section 1: Personality */}
      <Section
        icon={Bot}
        title="Personality"
        description="Describe the character and tone your agent should embody"
      >
        <div className="space-y-1.5">
          <Label htmlFor="personality">Agent Personality</Label>
          <Textarea
            id="personality"
            placeholder="Describe how your agent should behave. Example: You are a professional, efficient assistant that represents our agency. Always be polite, concise, and solution-focused. Never make commitments without confirming with the client first."
            rows={5}
            value={config.personality}
            onChange={(e) => update('personality', e.target.value)}
            className="resize-none"
          />
          <p className="text-xs text-gray-400">
            This text is prepended to every agent session as a system prompt.
          </p>
        </div>
      </Section>

      {/* Section 2: Response Style */}
      <Section
        icon={MessageSquare}
        title="Communication Style"
        description="Control the tone and length of agent responses"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="response-style">Response Style</Label>
            <Select
              value={config.responseStyle}
              onValueChange={(val) => update('responseStyle', val as ResponseStyle)}
            >
              <SelectTrigger id="response-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">
                  <div>
                    <span className="font-medium">Professional</span>
                    <span className="text-xs text-gray-500 ml-2">Formal, business-appropriate</span>
                  </div>
                </SelectItem>
                <SelectItem value="casual">
                  <div>
                    <span className="font-medium">Casual</span>
                    <span className="text-xs text-gray-500 ml-2">Friendly, conversational</span>
                  </div>
                </SelectItem>
                <SelectItem value="technical">
                  <div>
                    <span className="font-medium">Technical</span>
                    <span className="text-xs text-gray-500 ml-2">Precise, detail-oriented</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="verbosity">Verbosity</Label>
            <Select
              value={config.verbosity}
              onValueChange={(val) => update('verbosity', val as Verbosity)}
            >
              <SelectTrigger id="verbosity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">
                  <div>
                    <span className="font-medium">Concise</span>
                    <span className="text-xs text-gray-500 ml-2">Short, to-the-point</span>
                  </div>
                </SelectItem>
                <SelectItem value="balanced">
                  <div>
                    <span className="font-medium">Balanced</span>
                    <span className="text-xs text-gray-500 ml-2">Moderate detail level</span>
                  </div>
                </SelectItem>
                <SelectItem value="detailed">
                  <div>
                    <span className="font-medium">Detailed</span>
                    <span className="text-xs text-gray-500 ml-2">Thorough explanations</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Section 3: Escalation Rules */}
      <Section
        icon={AlertTriangle}
        title="Escalation Rules"
        description="Define when your agent should escalate to a human or take a specific action"
      >
        <div className="space-y-3">
          {/* Column headers */}
          {config.escalationRules.length > 0 && (
            <div className="flex items-center gap-2 px-6">
              <span className="flex-1 text-xs font-medium text-gray-500">Condition</span>
              <span className="w-4" />
              <span className="flex-1 text-xs font-medium text-gray-500">Action</span>
              <span className="w-7" />
            </div>
          )}

          {/* Rules */}
          <div className="space-y-2">
            {config.escalationRules.map((rule, i) => (
              <EscalationRuleRow
                key={i}
                rule={rule}
                index={i}
                onChange={(updated) => updateRule(i, updated)}
                onRemove={() => removeRule(i)}
              />
            ))}
          </div>

          {/* Empty state */}
          {config.escalationRules.length === 0 && (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
              <AlertTriangle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No escalation rules defined</p>
              <p className="text-xs text-gray-300 mt-0.5">
                Add rules to handle edge cases automatically
              </p>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addRule}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Rule
          </Button>
        </div>
      </Section>

      {/* Section 4: Custom Instructions */}
      <Section
        icon={FileText}
        title="Custom Instructions"
        description="Additional guidance appended to every agent session (optional)"
      >
        <div className="space-y-1.5">
          <Label htmlFor="custom-instructions">Additional Instructions</Label>
          <Textarea
            id="custom-instructions"
            placeholder="Any extra rules, constraints, or context your agent should always follow. Example: Always confirm before deleting any records. Default timezone is America/New_York. When unsure about pricing, direct users to the pricing page."
            rows={4}
            value={config.customInstructions}
            onChange={(e) => update('customInstructions', e.target.value)}
            className="resize-none"
          />
          <p className="text-xs text-gray-400">
            These instructions supplement the personality above. Use for rules, constraints, and
            domain-specific knowledge.
          </p>
        </div>
      </Section>

      {/* Unsaved indicator */}
      {isDirty && (
        <p className="text-xs text-amber-600 text-center">
          You have unsaved changes — click "Save Changes" to apply them.
        </p>
      )}

      {/* Bottom save button for convenience on long forms */}
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className={cn(
            'transition-all',
            isDirty
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          <Save className="w-4 h-4 mr-1.5" />
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
