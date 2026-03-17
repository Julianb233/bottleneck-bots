/**
 * GHL Workflows Index
 * Central export point for all GoHighLevel automation workflows
 */

// Login and authentication
export {
  ghlLogin,
  ghlLogout,
  isGHLLoggedIn,
  ghlLoginSchema,
  type GHLLoginCredentials,
  type GHLLoginResult,
} from "./login";

// Data extraction
export {
  extractContacts,
  extractWorkflows,
  extractPipelines,
  extractDashboardMetrics,
  extractContactDetails,
  extractCampaignStats,
  contactSchema,
  workflowSchema,
  pipelineSchema,
  type GHLContact,
  type GHLWorkflow,
  type GHLPipeline,
} from "./extract";

// Types and schemas for all 48 automation functions
export {
  type GHLAutomationResult,
  type GHLAutomationContext,
  type GHLFunctionId,
  FUNCTION_TIERS,
} from "./types";

// Module 1: Contacts & CRM (7 functions)
export {
  contactCreate,
  contactImportCsv,
  contactEdit,
  contactAddTags,
  contactDelete,
  customFieldCreate,
  smartListCreate,
} from "./contacts";

// Module 2: Workflows & Automation (5 functions)
export {
  workflowCreate,
  workflowEdit,
  workflowDuplicate,
  workflowDelete,
  workflowTest,
} from "./workflows-automation";

// Module 3: Funnels & Websites (4 functions)
export {
  funnelCreate,
  funnelPageEdit,
  formCreate,
  websiteCreate,
} from "./funnels";

// Module 4: Email Marketing (3 functions)
export {
  emailCampaignCreate,
  emailTemplateCreate,
  emailAbTest,
} from "./email-marketing";

// Module 5: SMS Marketing (2 functions)
export {
  smsCampaignCreate,
  smsTemplateCreate,
} from "./sms-marketing";

// Module 6: Calendars & Appointments (5 functions)
export {
  calendarCreate,
  appointmentTypeCreate,
  appointmentBook,
  appointmentReschedule,
  appointmentCancel,
} from "./calendars";

// Module 7: Opportunities & Pipelines (3 functions)
export {
  pipelineCreate,
  opportunityCreate,
  opportunityUpdateStage,
} from "./opportunities";

// Module 8: Conversations & Messaging (2 functions)
export {
  conversationSendMessage,
  conversationAiSetup,
} from "./conversations";

// Module 9: Reputation Management (2 functions)
export {
  reviewRequestCreate,
  reviewMonitor,
} from "./reputation";

// Module 10: Social Planner (1 function)
export { socialPostCreate } from "./social";

// Module 11: Memberships & Courses (2 functions)
export {
  membershipCreate,
  courseCreate,
} from "./memberships";

// Module 12: Payments & Commerce (3 functions)
export {
  productCreate,
  orderFormCreate,
  stripeConnect,
} from "./payments";

// Module 13: Reporting & Analytics (2 functions)
export {
  dashboardView,
  reportCreate,
} from "./reporting";

// Module 14: Settings & Configuration (4 functions)
export {
  subaccountCreate,
  userCreate,
  integrationSetup,
  customDomainSetup,
} from "./settings-automation";

// Module 15: Trigger Links (1 function)
export { triggerLinkCreate } from "./trigger-links";

// Module 16: Forms / Surveys (1 function)
export { surveyCreate } from "./surveys";

// Module 17: Tasks (1 function)
export { taskCreate } from "./tasks-automation";

// Workflow types for external use
export type GHLWorkflowType =
  | "login"
  | "extractContacts"
  | "extractWorkflows"
  | "extractPipelines"
  | "extractDashboard"
  | "extractCampaigns"
  | "custom";

// Workflow execution configuration
export interface GHLWorkflowConfig {
  workflowType: GHLWorkflowType;
  credentials?: {
    email: string;
    password: string;
    locationId?: string;
    twoFactorCode?: string;
  };
  options?: Record<string, any>;
}

// Workflow execution result
export interface GHLWorkflowResult {
  success: boolean;
  workflowType: GHLWorkflowType;
  data?: any;
  error?: string;
  sessionId?: string;
  executionTime?: number;
}
