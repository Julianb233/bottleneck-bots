import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Link2,
  Zap,
  FileText,
  Sparkles,
  Calendar,
  Globe,
  Workflow,
  Settings,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuickstartStep {
  number: number;
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
  color: string;
}

const quickstartSteps: QuickstartStep[] = [
  {
    number: 1,
    title: 'Connect GoHighLevel',
    description: 'Link your GHL account to unlock CRM automation.',
    path: '/settings',
    icon: Link2,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    number: 2,
    title: 'Upload Training Documents',
    description: 'Add SOPs and process docs so your agent understands your workflows.',
    path: '/training',
    icon: GraduationCap,
    color: 'text-purple-600 bg-purple-100',
  },
  {
    number: 3,
    title: 'Run Your First Task',
    description: 'Give your agent a task and watch it work in real-time.',
    path: '/agent',
    icon: Zap,
    color: 'text-amber-600 bg-amber-100',
  },
  {
    number: 4,
    title: 'Use Task Templates',
    description: 'Browse pre-built templates for common automation tasks.',
    path: '/agent',
    icon: Sparkles,
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    number: 5,
    title: 'Schedule Recurring Tasks',
    description: 'Automate daily lead follow-ups and other recurring work.',
    path: '/scheduled-tasks',
    icon: Calendar,
    color: 'text-orange-600 bg-orange-100',
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

export function HelpDrawer({ open, onOpenChange }: HelpDrawerProps) {
  const [, setLocation] = useLocation();
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    setLocation(path);
  };

  const toggleArticle = (id: string) => {
    setExpandedArticle((prev) => (prev === id ? null : id));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
        <SheetHeader className="p-4 border-b sticky top-0 bg-white z-10">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Help & Getting Started
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {/* Quickstart Guide */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Quickstart Guide
            </h3>
            <div className="space-y-2">
              {quickstartSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.number}
                    onClick={() => handleNavigate(step.path)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors text-left group"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        step.color
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">
                          Step {step.number}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 flex-shrink-0 mt-1 transition-colors" />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* How-To Articles */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              How-To Guides
            </h3>
            <div className="space-y-1">
              {howToArticles.map((article) => {
                const Icon = article.icon;
                const isExpanded = expandedArticle === article.id;
                return (
                  <div key={article.id} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleArticle(article.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
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
                      <div className="px-3 pb-3 pt-1">
                        <ol className="space-y-2">
                          {article.steps.map((stepText, index) => (
                            <li key={index} className="flex gap-2 text-sm">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                                {index + 1}
                              </span>
                              <span className="text-gray-600">{stepText}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
