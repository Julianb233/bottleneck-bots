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
import TaskTemplates from '@/pages/TaskTemplates';
import AgentSkills from '@/pages/AgentSkills';
import Help from '@/pages/Help';
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
          <Route path="/" component={DashboardHome} />
          <Route path="/agent" component={AgentDashboard} />
          <Route path="/scheduled-tasks" component={ScheduledTasksPage} />
          <Route path="/workflow-builder" component={WorkflowBuilder} />
          <Route path="/browser-sessions" component={BrowserSessions} />
          <Route path="/settings" component={Settings} />
          <Route path="/quizzes" component={Quizzes} />
          <Route path="/quizzes/create" component={QuizBuilder} />
          <Route path="/quizzes/:id/edit" component={QuizBuilder} />
          <Route path="/quizzes/:id/take" component={QuizTake} />
          <Route path="/quizzes/:id/results/:attemptId" component={QuizResults} />
          <Route path="/quizzes/my-attempts" component={MyAttempts} />
          <Route path="/lead-lists" component={LeadLists} />
          <Route path="/lead-lists/upload" component={LeadUpload} />
          <Route path="/lead-lists/:id" component={LeadDetails} />
          <Route path="/ai-campaigns" component={AICampaigns} />
          <Route path="/ai-campaigns/:id" component={CampaignDetails} />
          <Route path="/credits" component={CreditPurchase} />
          <Route path="/training" component={Training} />
          <Route path="/templates" component={TaskTemplates} />
          <Route path="/agent-skills" component={AgentSkills} />
          <Route path="/support" component={Help} />
          {/* Admin routes */}
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/users" component={UserManagement} />
          <Route path="/admin/costs" component={CostsPage} />
          <Route path="/admin/system" component={SystemHealth} />
          <Route path="/admin/audit" component={AuditLog} />
          <Route path="/admin/config" component={ConfigCenter} />
          {/* Catch-all 404 */}
          <Route>
            {() => (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-5 mb-5">
                  <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
                <p className="text-gray-500 text-sm mb-6">This page does not exist or has been moved.</p>
                <a href="/dashboard" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
                  Back to Dashboard
                </a>
              </div>
            )}
          </Route>
        </Switch>
      </DashboardLayout>
      <Toaster />
    </>
  );
}
