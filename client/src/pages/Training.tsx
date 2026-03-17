import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Upload, Search, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FileText,
  Workflow,
  Zap,
  MessageSquare,
  Database,
} from 'lucide-react';
import WorkflowsTab from '@/components/training/WorkflowsTab';
import SkillsTab from '@/components/training/SkillsTab';
import BehaviorTab from '@/components/training/BehaviorTab';
import KnowledgeBaseBrowser from '@/components/training/KnowledgeBaseBrowser';
import { DocumentsTab } from '@/components/training/DocumentsTab';

export default function Training() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Training</h1>
          <p className="text-muted-foreground mt-1">
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

        {/* Documents Tab - Knowledge Base with SOP processing */}
        <TabsContent value="documents" className="space-y-6">
          <DocumentsTab />
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
    </div>
  );
}
