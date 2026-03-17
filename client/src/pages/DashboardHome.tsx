import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Activity, Calendar, Settings, Users, Plus, Zap, FileText, ArrowUpRight, TrendingUp, Link2, GraduationCap, Rocket, BookOpen } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { SubscriptionUsageCard, UpgradeModal, ExecutionPacksModal } from '@/components/subscription';

export default function DashboardHome() {
  const [, setLocation] = useLocation();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPacksModal, setShowPacksModal] = useState(false);

  // Fetch subscription data
  const subscriptionQuery = trpc.subscription.getMySubscription.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <div data-tour="dashboard-header">
        <Breadcrumb
          items={[
            { label: 'Dashboard' },
          ]}
        />
        <h1 className="text-3xl font-bold tracking-tight mt-4">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to your Bottleneck Bots Dashboard
        </p>
      </div>

      {/* Subscription Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <SubscriptionUsageCard
            onUpgradeClick={() => setShowUpgradeModal(true)}
            onBuyPackClick={() => setShowPacksModal(true)}
          />
        </div>
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">AI Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-900">
                {subscriptionQuery.data?.limits?.maxAgents ?? 0}
              </span>
              <span className="text-sm text-purple-600">agent slots</span>
            </div>
            <Button
              onClick={() => setLocation('/agent')}
              size="sm"
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Launch Agent
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptionQuery.data?.usage?.executionsUsed ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {subscriptionQuery.data?.usage?.executionLimit ?? 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No active workflows</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Just you for now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No integrations configured</p>
          </CardContent>
        </Card>
      </div>

      <Card data-tour="quick-actions">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with your AI-powered agency automation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              onClick={() => setLocation('/ai-campaigns')}
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Plus className="h-6 w-6" />
              <div className="text-center">
                <div className="font-semibold">Create Campaign</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Start a new AI calling campaign
                </div>
              </div>
            </Button>

            <Button
              onClick={() => setLocation('/lead-lists')}
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <FileText className="h-6 w-6" />
              <div className="text-center">
                <div className="font-semibold">Manage Leads</div>
                <div className="text-xs text-muted-foreground font-normal">
                  View and organize your lead lists
                </div>
              </div>
            </Button>

            <Button
              onClick={() => setLocation('/settings')}
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Settings className="h-6 w-6" />
              <div className="text-center">
                <div className="font-semibold">Configure Settings</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Set up API keys and integrations
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-tour="quick-start-guide" className="border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-emerald-600" />
            Get Started in 3 Steps
          </CardTitle>
          <CardDescription>Complete these steps to unlock the full power of your AI agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <button
              onClick={() => setLocation('/settings')}
              className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left bg-white"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Step 1</p>
                <p className="text-sm font-semibold text-gray-900">Connect GoHighLevel</p>
                <p className="text-xs text-gray-500 mt-1">Link your GHL account for CRM automation</p>
              </div>
            </button>

            <button
              onClick={() => setLocation('/training')}
              className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left bg-white"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Step 2</p>
                <p className="text-sm font-semibold text-gray-900">Upload Training Docs</p>
                <p className="text-xs text-gray-500 mt-1">Add SOPs so your agent understands your workflows</p>
              </div>
            </button>

            <button
              onClick={() => setLocation('/agent')}
              className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left bg-white"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Step 3</p>
                <p className="text-sm font-semibold text-gray-900">Run Your First Task</p>
                <p className="text-xs text-gray-500 mt-1">Give your agent a task and watch it work</p>
              </div>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">Need help? Check the full guide.</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setLocation('/support')}
            >
              <BookOpen className="w-4 h-4" />
              Help Center
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Modals */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTierSlug={subscriptionQuery.data?.tier?.slug}
      />
      <ExecutionPacksModal
        isOpen={showPacksModal}
        onClose={() => setShowPacksModal(false)}
      />
    </div>
  );
}
