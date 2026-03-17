import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrainingOverview } from '@/components/training/TrainingOverview';
import { AgentConfigTab } from '@/components/training/AgentConfigTab';
import { PatternsTab } from '@/components/training/PatternsTab';
import { BrandVoiceTab } from '@/components/training/BrandVoiceTab';
import { FeedbackTab } from '@/components/training/FeedbackTab';
import { DocumentsTab } from '@/components/training/DocumentsTab';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  BarChart3,
  Settings2,
  Workflow,
  Palette,
  MessageSquare,
  FileText,
} from 'lucide-react';

export default function Training() {
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useAuth();

  // Default userId for agent memory calls
  const userId = user?.id ? Number(user.id) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Training</h1>
        <p className="text-gray-500 mt-1">
          Customize, train, and monitor your AI agent&apos;s performance
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="patterns" className="gap-1.5">
            <Workflow className="w-4 h-4" />
            <span className="hidden sm:inline">Patterns</span>
          </TabsTrigger>
          <TabsTrigger value="brand-voice" className="gap-1.5">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Brand Voice</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Feedback</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TrainingOverview />
        </TabsContent>

        <TabsContent value="config">
          <AgentConfigTab userId={userId} />
        </TabsContent>

        <TabsContent value="patterns">
          <PatternsTab />
        </TabsContent>

        <TabsContent value="brand-voice">
          <BrandVoiceTab />
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackTab />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
