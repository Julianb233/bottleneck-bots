import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FileText,
  Workflow,
  Zap,
  MessageSquare,
  BarChart3,
  Eye,
} from 'lucide-react';
import { DocumentsTab } from '@/components/training/DocumentsTab';
import WorkflowsTab from '@/components/training/WorkflowsTab';
import SkillsTab from '@/components/training/SkillsTab';
import BehaviorTab from '@/components/training/BehaviorTab';
import { TrainingOverview } from '@/components/training/TrainingOverview';
import PromptPreview from '@/components/training/PromptPreview';

export default function Training() {
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
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Documents</span>
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
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <TrainingOverview />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <DocumentsTab />
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

        {/* Prompt Preview Tab */}
        <TabsContent value="preview">
          <PromptPreview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
