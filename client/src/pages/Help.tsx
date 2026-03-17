import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  Link2,
  Zap,
  FileText,
  Sparkles,
  Calendar,
  Globe,
  Workflow,
  GraduationCap,
  LayoutDashboard,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  Rocket,
  HelpCircle,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickstartStep {
  number: number;
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const quickstartSteps: QuickstartStep[] = [
  {
    number: 1,
    title: 'Connect GoHighLevel',
    description: 'Link your GHL account to unlock CRM automation and contact syncing.',
    path: '/settings',
    icon: Link2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    number: 2,
    title: 'Upload Training Documents',
    description: 'Add SOPs and process docs so your agent understands your business workflows.',
    path: '/training',
    icon: GraduationCap,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    number: 3,
    title: 'Run Your First Task',
    description: 'Give your AI agent a task and watch it execute in real-time.',
    path: '/agent',
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  {
    number: 4,
    title: 'Use Task Templates',
    description: 'Browse pre-built templates for common automation tasks to save time.',
    path: '/agent',
    icon: Sparkles,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  {
    number: 5,
    title: 'Schedule Recurring Tasks',
    description: 'Automate daily lead follow-ups and other recurring work on autopilot.',
    path: '/scheduled-tasks',
    icon: Calendar,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
];

interface HowToArticle {
  id: string;
  title: string;
  icon: React.ElementType;
  steps: string[];
}

const howToArticles: HowToArticle[] = [
  {
    id: 'connect-ghl',
    title: 'How to Connect GoHighLevel',
    icon: Link2,
    steps: [
      'Navigate to Settings from the sidebar.',
      'Click the "OAuth Integrations" tab.',
      'Click "Connect GoHighLevel" to start the OAuth flow.',
      'Authorize access in the GoHighLevel popup window.',
      'Once connected, you will see a green "Connected" status.',
    ],
  },
  {
    id: 'first-task',
    title: 'How to Create Your First Agent Task',
    icon: Zap,
    steps: [
      'Go to the AI Agent page from the sidebar.',
      'Type your task in the input box at the top (e.g., "Search for contacts tagged new-lead").',
      'Click "Run" or press Enter to start the execution.',
      'Watch the agent think and act in the main panel.',
      'If the agent opens a browser, see it live in the right panel.',
    ],
  },
  {
    id: 'use-templates',
    title: 'How to Use Task Templates',
    icon: Sparkles,
    steps: [
      'Go to the AI Agent page.',
      'Click the "Templates" tab in the right panel (desktop) or the Templates button.',
      'Browse available templates by category.',
      'Click a template to auto-fill the task input.',
      'Customize the pre-filled task if needed, then click "Run".',
    ],
  },
  {
    id: 'train-sops',
    title: 'How to Train Your Agent with SOPs',
    icon: FileText,
    steps: [
      'Navigate to the Training page from the sidebar.',
      'In the Documents tab, select a category (e.g., "SOPs").',
      'Drag and drop your PDF, DOCX, or text file into the upload zone, or click to browse.',
      'Your document is automatically processed and chunked for the AI.',
      'The agent will reference these documents when executing tasks.',
    ],
  },
  {
    id: 'schedule-tasks',
    title: 'How to Schedule Recurring Tasks',
    icon: Calendar,
    steps: [
      'Go to Scheduled Tasks from the sidebar.',
      'Click "Create Task" to open the creation dialog.',
      'Enter a task description (what the agent should do).',
      'Set a schedule using the interval or cron options.',
      'Toggle the task active and save. It will run automatically on schedule.',
    ],
  },
  {
    id: 'execution-history',
    title: 'How to View Execution History',
    icon: LayoutDashboard,
    steps: [
      'Go to the AI Agent page.',
      'The left sidebar shows all past executions.',
      'Click any execution to view its details, thinking steps, and results.',
      'Use the stats at the top to see success rate and average duration.',
    ],
  },
  {
    id: 'build-workflows',
    title: 'How to Build Workflows',
    icon: Workflow,
    steps: [
      'Go to the Workflow Builder from the sidebar.',
      'Click "New Workflow" or start from a template.',
      'Drag nodes from the palette onto the canvas.',
      'Connect nodes by dragging from one handle to another.',
      'Configure each node by clicking it and editing in the side panel.',
    ],
  },
  {
    id: 'browser-sessions',
    title: 'How to Manage Browser Sessions',
    icon: Globe,
    steps: [
      'Browser sessions are automatically created when agents run browser tasks.',
      'Go to Browser Sessions from the sidebar to view all sessions.',
      'Click a session to see its logs, screenshots, and extracted data.',
      'Running sessions show live previews in the Agent Dashboard.',
    ],
  },
];

export default function Help() {
  const [, setLocation] = useLocation();
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const toggleArticle = (id: string) => {
    setExpandedArticle((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Breadcrumb items={[{ label: 'Help & Getting Started' }]} />
        <h1 className="text-3xl font-bold tracking-tight mt-4 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-emerald-600" />
          Help Center
        </h1>
        <p className="text-muted-foreground mt-2">
          Everything you need to get started and make the most of Bottleneck Bots.
        </p>
      </div>

      {/* Quickstart Guide */}
      <Card className="border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-emerald-600" />
            Quickstart Guide
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Follow these 5 steps to get your AI agent up and running in under 5 minutes.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {quickstartSteps.map((step) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.number}
                  onClick={() => setLocation(step.path)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left group bg-white"
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                      {step.number}
                    </span>
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', step.bgColor)}>
                      <Icon className={cn('w-5 h-5', step.color)} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 shrink-0 mt-2 transition-colors" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How-To Guides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            How-To Guides
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Step-by-step instructions for common tasks.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {howToArticles.map((article) => {
              const Icon = article.icon;
              const isExpanded = expandedArticle === article.id;
              return (
                <div key={article.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleArticle(article.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 flex-1">
                      {article.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 ml-11">
                      <ol className="space-y-3">
                        {article.steps.map((stepText, index) => (
                          <li key={index} className="flex gap-3 text-sm">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-semibold">
                              {index + 1}
                            </span>
                            <span className="text-gray-600 pt-0.5">{stepText}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card className="bg-gradient-to-br from-slate-50 to-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            Need More Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-4">
                Can't find what you're looking for? Our support team is here to help you get the most out of Bottleneck Bots.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open('mailto:support@bottleneckbots.com', '_blank')}
                >
                  <Mail className="w-4 h-4" />
                  Email Support
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setLocation('/settings')}
                >
                  <Link2 className="w-4 h-4" />
                  Check Integrations
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
