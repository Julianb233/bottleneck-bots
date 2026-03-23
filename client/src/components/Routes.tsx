import { Route, Switch } from 'wouter';
import DashboardHome from '@/pages/DashboardHome';
import { AgentDashboard } from '@/pages/AgentDashboard';
import ScheduledTasksPage from '@/pages/ScheduledTasks';
import { Settings } from '@/pages/Settings';
import WorkflowBuilder from '@/pages/WorkflowBuilder';
import BrowserSessions from '@/pages/BrowserSessions';
import Quizzes from '@/pages/Quizzes';
import QuizBuilder from '@/pages/QuizBuilder';
import QuizTake from '@/pages/QuizTake';
import QuizResults from '@/pages/QuizResults';
import MyAttempts from '@/pages/MyAttempts';
import LeadLists from '@/pages/LeadLists';
import LeadUpload from '@/pages/LeadUpload';
import LeadDetails from '@/pages/LeadDetails';
import AICampaigns from '@/pages/AICampaigns';
import CampaignDetails from '@/pages/CampaignDetails';
import CreditPurchase from '@/pages/CreditPurchase';
import Training from '@/pages/Training';
import GHLContacts from '@/pages/GHLContacts';
import GHLPipeline from '@/pages/GHLPipeline';
import GHLCampaigns from '@/pages/GHLCampaigns';
import GHLWebhookLog from '@/pages/GHLWebhookLog';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UserManagement } from '@/pages/admin/UserManagement';
import { SystemHealth } from '@/pages/admin/SystemHealth';
import { AuditLog } from '@/pages/admin/AuditLog';
import { ConfigCenter } from '@/pages/admin/ConfigCenter';
import { CostsPage } from '@/pages/admin/CostsPage';
import DashboardLayout from './DashboardLayout';
import { Toaster } from '@/components/ui/sonner';

export function Routes() {
  return (
    <>
      <DashboardLayout>
        <Switch>
          {/* Dashboard routes — all prefixed with /dashboard to avoid conflict with public routes */}
          <Route path="/dashboard" component={DashboardHome} />
          <Route path="/dashboard/agent" component={AgentDashboard} />
          <Route path="/dashboard/scheduled-tasks" component={ScheduledTasksPage} />
          <Route path="/dashboard/workflow-builder" component={WorkflowBuilder} />
          <Route path="/dashboard/browser-sessions" component={BrowserSessions} />
          <Route path="/dashboard/settings" component={Settings} />
          <Route path="/dashboard/quizzes" component={Quizzes} />
          <Route path="/dashboard/quizzes/create" component={QuizBuilder} />
          <Route path="/dashboard/quizzes/:id/edit" component={QuizBuilder} />
          <Route path="/dashboard/quizzes/:id/take" component={QuizTake} />
          <Route path="/dashboard/quizzes/:id/results/:attemptId" component={QuizResults} />
          <Route path="/dashboard/quizzes/my-attempts" component={MyAttempts} />
          <Route path="/dashboard/lead-lists" component={LeadLists} />
          <Route path="/dashboard/lead-lists/upload" component={LeadUpload} />
          <Route path="/dashboard/lead-lists/:id" component={LeadDetails} />
          <Route path="/dashboard/ai-campaigns" component={AICampaigns} />
          <Route path="/dashboard/ai-campaigns/:id" component={CampaignDetails} />
          <Route path="/dashboard/credits" component={CreditPurchase} />
          <Route path="/dashboard/training" component={Training} />
          {/* GHL CRM routes */}
          <Route path="/dashboard/ghl/contacts" component={GHLContacts} />
          <Route path="/dashboard/ghl/pipeline" component={GHLPipeline} />
          <Route path="/dashboard/ghl/campaigns" component={GHLCampaigns} />
          <Route path="/dashboard/ghl/webhooks" component={GHLWebhookLog} />
          {/* Admin routes */}
          <Route path="/dashboard/admin" component={AdminDashboard} />
          <Route path="/dashboard/admin/users" component={UserManagement} />
          <Route path="/dashboard/admin/costs" component={CostsPage} />
          <Route path="/dashboard/admin/system" component={SystemHealth} />
          <Route path="/dashboard/admin/audit" component={AuditLog} />
          <Route path="/dashboard/admin/config" component={ConfigCenter} />
          <Route>
            {() => (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold">404</h1>
                <p className="text-muted-foreground">Page not found</p>
              </div>
            )}
          </Route>
        </Switch>
      </DashboardLayout>
      <Toaster />
    </>
  );
}
