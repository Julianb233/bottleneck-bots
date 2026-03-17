/**
 * GHL Automation Types & Schemas
 * Shared types for all 48 GoHighLevel automation functions
 */

import { z } from "zod";

// ========================================
// COMMON TYPES
// ========================================

/** Result returned by every GHL automation function */
export interface GHLAutomationResult<T = unknown> {
  success: boolean;
  functionId: string;
  data?: T;
  error?: string;
  executionTimeMs?: number;
}

/** Common options passed to all automation functions */
export interface GHLAutomationContext {
  locationId: string;
  /** Base URL for GHL navigation */
  baseUrl?: string;
}

// ========================================
// MODULE 1: CONTACTS & CRM
// ========================================

export const contactCreateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  assignedUser: z.string().optional(),
  contactType: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export const contactEditSchema = z.object({
  searchTerm: z.string().describe("Name, email, or phone to find the contact"),
  updates: contactCreateSchema.partial(),
});
export type ContactEditInput = z.infer<typeof contactEditSchema>;

export const contactTagSchema = z.object({
  searchTerm: z.string().describe("Name, email, or phone to find the contact"),
  tagsToAdd: z.array(z.string()).optional(),
  tagsToRemove: z.array(z.string()).optional(),
});
export type ContactTagInput = z.infer<typeof contactTagSchema>;

export const contactDeleteSchema = z.object({
  searchTerm: z.string().describe("Name, email, or phone to find the contact"),
  confirmDeletion: z.literal(true).describe("Must be true to confirm deletion"),
});
export type ContactDeleteInput = z.infer<typeof contactDeleteSchema>;

export const contactImportSchema = z.object({
  csvFilePath: z.string().describe("Path to the CSV file to import"),
  columnMapping: z.record(z.string(), z.string()).optional().describe("CSV column to GHL field mapping"),
  tags: z.array(z.string()).optional().describe("Tags to apply to all imported contacts"),
});
export type ContactImportInput = z.infer<typeof contactImportSchema>;

export const customFieldCreateSchema = z.object({
  name: z.string(),
  fieldType: z.enum(["text", "textarea", "number", "date", "dropdown", "checkbox", "file"]),
  options: z.array(z.string()).optional().describe("Options for dropdown/checkbox fields"),
  group: z.string().optional().describe("Custom field group name"),
});
export type CustomFieldCreateInput = z.infer<typeof customFieldCreateSchema>;

export const smartListCreateSchema = z.object({
  name: z.string(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(["is", "is_not", "contains", "not_contains", "greater_than", "less_than"]),
    value: z.string(),
  })),
});
export type SmartListCreateInput = z.infer<typeof smartListCreateSchema>;

// ========================================
// MODULE 2: WORKFLOWS & AUTOMATION
// ========================================

export const workflowCreateSchema = z.object({
  name: z.string(),
  triggerType: z.string().describe("e.g. Contact Tag Added, Form Submitted, etc."),
  triggerConfig: z.record(z.string(), z.string()).optional(),
  actions: z.array(z.object({
    type: z.string().describe("e.g. Send Email, Send SMS, Wait, If/Else, Add Tag"),
    config: z.record(z.string(), z.string()).optional(),
  })).optional(),
  activate: z.boolean().default(false),
});
export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>;

export const workflowEditSchema = z.object({
  workflowName: z.string().describe("Name of the workflow to edit"),
  updates: z.object({
    name: z.string().optional(),
    addActions: z.array(z.object({
      type: z.string(),
      config: z.record(z.string(), z.string()).optional(),
      position: z.number().optional(),
    })).optional(),
    removeActionIndices: z.array(z.number()).optional(),
    activate: z.boolean().optional(),
  }),
});
export type WorkflowEditInput = z.infer<typeof workflowEditSchema>;

export const workflowDuplicateSchema = z.object({
  workflowName: z.string().describe("Name of the workflow to duplicate"),
  newName: z.string().optional().describe("Name for the duplicated workflow"),
});
export type WorkflowDuplicateInput = z.infer<typeof workflowDuplicateSchema>;

export const workflowDeleteSchema = z.object({
  workflowName: z.string(),
  confirmDeletion: z.literal(true),
});
export type WorkflowDeleteInput = z.infer<typeof workflowDeleteSchema>;

export const workflowTestSchema = z.object({
  workflowName: z.string(),
  testContactEmail: z.string().email().optional(),
});
export type WorkflowTestInput = z.infer<typeof workflowTestSchema>;

// ========================================
// MODULE 3: FUNNELS & WEBSITES
// ========================================

export const funnelCreateSchema = z.object({
  name: z.string(),
  templateId: z.string().optional().describe("Template to use, or blank for scratch"),
  pages: z.array(z.object({
    name: z.string(),
    type: z.enum(["landing", "optin", "thankyou", "sales", "order", "upsell", "downsell", "webinar", "appointment"]).optional(),
  })).optional(),
});
export type FunnelCreateInput = z.infer<typeof funnelCreateSchema>;

export const funnelPageEditSchema = z.object({
  funnelName: z.string(),
  pageName: z.string(),
  operations: z.array(z.object({
    action: z.enum(["add_element", "edit_element", "remove_element", "add_section"]),
    elementType: z.string().optional(),
    content: z.string().optional(),
    properties: z.record(z.string(), z.string()).optional(),
  })),
});
export type FunnelPageEditInput = z.infer<typeof funnelPageEditSchema>;

export const formCreateSchema = z.object({
  name: z.string(),
  fields: z.array(z.object({
    label: z.string(),
    type: z.enum(["text", "email", "phone", "textarea", "dropdown", "radio", "checkbox", "date", "file", "hidden"]),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
  })),
  submitButtonText: z.string().default("Submit"),
  successMessage: z.string().optional(),
  redirectUrl: z.string().optional(),
  notifyEmail: z.string().optional(),
});
export type FormCreateInput = z.infer<typeof formCreateSchema>;

export const websiteCreateSchema = z.object({
  name: z.string(),
  templateId: z.string().optional(),
  pages: z.array(z.string()).optional().describe("Page names to create"),
  customDomain: z.string().optional(),
});
export type WebsiteCreateInput = z.infer<typeof websiteCreateSchema>;

// ========================================
// MODULE 4: EMAIL MARKETING
// ========================================

export const emailCampaignCreateSchema = z.object({
  name: z.string(),
  subject: z.string(),
  previewText: z.string().optional(),
  fromName: z.string(),
  fromEmail: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  templateId: z.string().optional(),
  htmlContent: z.string().optional(),
  recipientTags: z.array(z.string()).optional(),
  recipientSmartList: z.string().optional(),
  scheduleAt: z.string().optional().describe("ISO datetime to schedule, or empty for immediate"),
});
export type EmailCampaignCreateInput = z.infer<typeof emailCampaignCreateSchema>;

export const emailTemplateCreateSchema = z.object({
  name: z.string(),
  subject: z.string().optional(),
  htmlContent: z.string().optional(),
  category: z.string().optional(),
});
export type EmailTemplateCreateInput = z.infer<typeof emailTemplateCreateSchema>;

export const emailAbTestSchema = z.object({
  campaignName: z.string(),
  variantBSubject: z.string(),
  variantBContent: z.string().optional(),
  splitPercentage: z.number().min(10).max(50).default(50),
  winnerCriteria: z.enum(["open_rate", "click_rate"]).default("open_rate"),
});
export type EmailAbTestInput = z.infer<typeof emailAbTestSchema>;

// ========================================
// MODULE 5: SMS MARKETING
// ========================================

export const smsCampaignCreateSchema = z.object({
  name: z.string(),
  message: z.string().max(1600),
  senderPhone: z.string().optional(),
  recipientTags: z.array(z.string()).optional(),
  recipientSmartList: z.string().optional(),
  scheduleAt: z.string().optional(),
  includeOptOut: z.boolean().default(true),
});
export type SmsCampaignCreateInput = z.infer<typeof smsCampaignCreateSchema>;

export const smsTemplateCreateSchema = z.object({
  name: z.string(),
  message: z.string().max(1600),
});
export type SmsTemplateCreateInput = z.infer<typeof smsTemplateCreateSchema>;

// ========================================
// MODULE 6: CALENDARS & APPOINTMENTS
// ========================================

export const calendarCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  availability: z.record(z.string(), z.object({
    enabled: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })).optional().describe("Keyed by day: monday, tuesday, etc."),
  bufferTime: z.number().optional().describe("Buffer in minutes"),
  minimumNotice: z.number().optional().describe("Minimum notice in hours"),
  dateRange: z.number().optional().describe("Days into the future for bookings"),
  assignedUsers: z.array(z.string()).optional(),
});
export type CalendarCreateInput = z.infer<typeof calendarCreateSchema>;

export const appointmentTypeCreateSchema = z.object({
  calendarName: z.string().optional(),
  name: z.string(),
  duration: z.number().describe("Duration in minutes"),
  description: z.string().optional(),
  color: z.string().optional(),
  meetingLocation: z.enum(["zoom", "google_meet", "phone", "in_person", "custom"]).optional(),
  customLocationUrl: z.string().optional(),
  confirmationMessage: z.string().optional(),
  formFields: z.array(z.object({
    label: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
  })).optional(),
});
export type AppointmentTypeCreateInput = z.infer<typeof appointmentTypeCreateSchema>;

export const appointmentBookSchema = z.object({
  contactSearchTerm: z.string(),
  calendarName: z.string().optional(),
  appointmentType: z.string().optional(),
  date: z.string().describe("YYYY-MM-DD"),
  time: z.string().describe("HH:MM"),
  notes: z.string().optional(),
});
export type AppointmentBookInput = z.infer<typeof appointmentBookSchema>;

export const appointmentRescheduleSchema = z.object({
  contactSearchTerm: z.string(),
  originalDate: z.string().optional(),
  newDate: z.string().describe("YYYY-MM-DD"),
  newTime: z.string().describe("HH:MM"),
  reason: z.string().optional(),
});
export type AppointmentRescheduleInput = z.infer<typeof appointmentRescheduleSchema>;

export const appointmentCancelSchema = z.object({
  contactSearchTerm: z.string(),
  appointmentDate: z.string().optional(),
  reason: z.string().optional(),
  notifyContact: z.boolean().default(true),
});
export type AppointmentCancelInput = z.infer<typeof appointmentCancelSchema>;

// ========================================
// MODULE 7: OPPORTUNITIES & PIPELINES
// ========================================

export const pipelineCreateSchema = z.object({
  name: z.string(),
  stages: z.array(z.object({
    name: z.string(),
    order: z.number().optional(),
  })),
});
export type PipelineCreateInput = z.infer<typeof pipelineCreateSchema>;

export const opportunityCreateSchema = z.object({
  contactSearchTerm: z.string(),
  pipelineName: z.string(),
  stageName: z.string(),
  name: z.string().optional(),
  value: z.number().optional(),
  status: z.enum(["open", "won", "lost", "abandoned"]).default("open"),
  assignedUser: z.string().optional(),
  notes: z.string().optional(),
});
export type OpportunityCreateInput = z.infer<typeof opportunityCreateSchema>;

export const opportunityUpdateStageSchema = z.object({
  contactSearchTerm: z.string().optional(),
  opportunityName: z.string().optional(),
  pipelineName: z.string().optional(),
  newStageName: z.string(),
});
export type OpportunityUpdateStageInput = z.infer<typeof opportunityUpdateStageSchema>;

// ========================================
// MODULE 8: CONVERSATIONS & MESSAGING
// ========================================

export const conversationSendMessageSchema = z.object({
  contactSearchTerm: z.string(),
  channel: z.enum(["sms", "email", "whatsapp"]).default("sms"),
  message: z.string(),
  subject: z.string().optional().describe("Required for email channel"),
});
export type ConversationSendMessageInput = z.infer<typeof conversationSendMessageSchema>;

export const conversationAiSetupSchema = z.object({
  botName: z.string(),
  instructions: z.string(),
  channels: z.array(z.enum(["sms", "email", "webchat", "whatsapp"])).default(["webchat"]),
  responseDelay: z.number().optional().describe("Delay in seconds before responding"),
  handoffKeywords: z.array(z.string()).optional(),
});
export type ConversationAiSetupInput = z.infer<typeof conversationAiSetupSchema>;

// ========================================
// MODULE 9: REPUTATION MANAGEMENT
// ========================================

export const reviewRequestCreateSchema = z.object({
  name: z.string(),
  recipientTags: z.array(z.string()).optional(),
  channel: z.enum(["sms", "email", "both"]).default("both"),
  reviewUrl: z.string().describe("Google/Facebook review URL"),
  message: z.string().optional(),
  followUpDays: z.number().optional(),
});
export type ReviewRequestCreateInput = z.infer<typeof reviewRequestCreateSchema>;

export const reviewMonitorSchema = z.object({
  platforms: z.array(z.enum(["google", "facebook", "yelp"])).default(["google"]),
  autoRespond: z.boolean().default(false),
  notifyEmail: z.string().optional(),
});
export type ReviewMonitorInput = z.infer<typeof reviewMonitorSchema>;

// ========================================
// MODULE 10: SOCIAL PLANNER
// ========================================

export const socialPostCreateSchema = z.object({
  platforms: z.array(z.enum(["facebook", "instagram", "twitter", "linkedin", "google_business"])),
  content: z.string(),
  mediaUrls: z.array(z.string()).optional(),
  scheduleAt: z.string().optional().describe("ISO datetime to schedule"),
  hashtags: z.array(z.string()).optional(),
});
export type SocialPostCreateInput = z.infer<typeof socialPostCreateSchema>;

// ========================================
// MODULE 11: MEMBERSHIPS & COURSES
// ========================================

export const membershipCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  accessLevel: z.enum(["free", "paid"]).default("free"),
  contentCategories: z.array(z.string()).optional(),
});
export type MembershipCreateInput = z.infer<typeof membershipCreateSchema>;

export const courseCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  modules: z.array(z.object({
    name: z.string(),
    lessons: z.array(z.object({
      title: z.string(),
      contentType: z.enum(["video", "text", "quiz"]).optional(),
    })).optional(),
  })).optional(),
  dripSchedule: z.boolean().default(false),
  certificateEnabled: z.boolean().default(false),
});
export type CourseCreateInput = z.infer<typeof courseCreateSchema>;

// ========================================
// MODULE 12: PAYMENTS & COMMERCE
// ========================================

export const productCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  priceType: z.enum(["one_time", "subscription", "payment_plan"]).default("one_time"),
  recurringInterval: z.enum(["monthly", "yearly", "weekly"]).optional(),
  paymentPlanInstallments: z.number().optional(),
  imageUrl: z.string().optional(),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const orderFormCreateSchema = z.object({
  name: z.string(),
  productName: z.string(),
  fields: z.array(z.object({
    label: z.string(),
    type: z.string(),
    required: z.boolean().default(true),
  })).optional(),
  successRedirectUrl: z.string().optional(),
  bumps: z.array(z.object({
    name: z.string(),
    price: z.number(),
    description: z.string().optional(),
  })).optional(),
});
export type OrderFormCreateInput = z.infer<typeof orderFormCreateSchema>;

export const stripeConnectSchema = z.object({
  redirectAfterConnect: z.boolean().default(true),
});
export type StripeConnectInput = z.infer<typeof stripeConnectSchema>;

// ========================================
// MODULE 13: REPORTING & ANALYTICS
// ========================================

export const dashboardViewSchema = z.object({
  dateRange: z.enum(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom"]).default("last_30_days"),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
});
export type DashboardViewInput = z.infer<typeof dashboardViewSchema>;

export const reportCreateSchema = z.object({
  name: z.string(),
  type: z.enum(["leads", "appointments", "revenue", "campaigns", "custom"]),
  dateRange: z.enum(["last_7_days", "last_30_days", "last_90_days", "this_year"]).default("last_30_days"),
  groupBy: z.enum(["day", "week", "month"]).optional(),
  filters: z.record(z.string(), z.string()).optional(),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

// ========================================
// MODULE 14: SETTINGS & CONFIGURATION
// ========================================

export const subaccountCreateSchema = z.object({
  businessName: z.string(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  industry: z.string().optional(),
  timezone: z.string().optional(),
  snapshotId: z.string().optional(),
});
export type SubaccountCreateInput = z.infer<typeof subaccountCreateSchema>;

export const userCreateSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]).default("user"),
  permissions: z.array(z.string()).optional(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const integrationSetupSchema = z.object({
  integrationType: z.enum(["zapier", "google_calendar", "google_business", "facebook", "stripe", "twilio", "mailgun", "webhook"]),
  config: z.record(z.string(), z.string()).optional(),
});
export type IntegrationSetupInput = z.infer<typeof integrationSetupSchema>;

export const customDomainSetupSchema = z.object({
  domain: z.string(),
  targetType: z.enum(["funnel", "website", "calendar"]),
  targetName: z.string(),
});
export type CustomDomainSetupInput = z.infer<typeof customDomainSetupSchema>;

// ========================================
// MODULE 15: TRIGGER LINKS
// ========================================

export const triggerLinkCreateSchema = z.object({
  name: z.string(),
  redirectUrl: z.string(),
  actions: z.array(z.object({
    type: z.enum(["add_tag", "remove_tag", "start_workflow", "update_field", "add_campaign", "remove_campaign", "update_opportunity"]),
    value: z.string(),
  })),
});
export type TriggerLinkCreateInput = z.infer<typeof triggerLinkCreateSchema>;

// ========================================
// MODULE 16: FORMS (STANDALONE)
// ========================================

export const surveyCreateSchema = z.object({
  name: z.string(),
  steps: z.array(z.object({
    title: z.string().optional(),
    fields: z.array(z.object({
      label: z.string(),
      type: z.enum(["text", "email", "phone", "textarea", "dropdown", "radio", "checkbox", "date", "file", "signature"]),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
    })),
  })),
  conditionalLogic: z.boolean().default(false),
  thankYouMessage: z.string().optional(),
  redirectUrl: z.string().optional(),
});
export type SurveyCreateInput = z.infer<typeof surveyCreateSchema>;

// ========================================
// MODULE 17: TASKS
// ========================================

export const taskCreateSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  assignedUser: z.string().optional(),
  dueDate: z.string().optional().describe("YYYY-MM-DD"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  relatedContactSearch: z.string().optional(),
  relatedOpportunity: z.string().optional(),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

// ========================================
// FUNCTION REGISTRY
// ========================================

/** All 48 function IDs */
export type GHLFunctionId =
  // Module 1: Contacts (7)
  | "contact_create"
  | "contact_import_csv"
  | "contact_edit"
  | "contact_add_tags"
  | "contact_delete"
  | "custom_field_create"
  | "smart_list_create"
  // Module 2: Workflows (5)
  | "workflow_create"
  | "workflow_edit"
  | "workflow_duplicate"
  | "workflow_delete"
  | "workflow_test"
  // Module 3: Funnels (4)
  | "funnel_create"
  | "funnel_page_edit"
  | "form_create"
  | "website_create"
  // Module 4: Email (3)
  | "email_campaign_create"
  | "email_template_create"
  | "email_ab_test"
  // Module 5: SMS (2)
  | "sms_campaign_create"
  | "sms_template_create"
  // Module 6: Calendars (5)
  | "calendar_create"
  | "appointment_type_create"
  | "appointment_book"
  | "appointment_reschedule"
  | "appointment_cancel"
  // Module 7: Opportunities (3)
  | "pipeline_create"
  | "opportunity_create"
  | "opportunity_update_stage"
  // Module 8: Conversations (2)
  | "conversation_send_message"
  | "conversation_ai_setup"
  // Module 9: Reputation (2)
  | "review_request_create"
  | "review_monitor"
  // Module 10: Social (1)
  | "social_post_create"
  // Module 11: Memberships (2)
  | "membership_create"
  | "course_create"
  // Module 12: Payments (3)
  | "product_create"
  | "order_form_create"
  | "stripe_connect"
  // Module 13: Reporting (2)
  | "dashboard_view"
  | "report_create"
  // Module 14: Settings (4)
  | "subaccount_create"
  | "user_create"
  | "integration_setup"
  | "custom_domain_setup"
  // Module 15: Trigger Links (1)
  | "trigger_link_create"
  // Module 16: Forms (1)
  | "survey_create"
  // Module 17: Tasks (1)
  | "task_create";

/** Priority tiers for function training/execution */
export const FUNCTION_TIERS: Record<GHLFunctionId, 1 | 2 | 3 | 4> = {
  // Tier 1: Critical (11 functions)
  contact_create: 1,
  contact_edit: 1,
  contact_add_tags: 1,
  workflow_create: 1,
  workflow_edit: 1,
  funnel_create: 1,
  funnel_page_edit: 1,
  email_campaign_create: 1,
  calendar_create: 1,
  appointment_type_create: 1,
  form_create: 1,
  // Tier 2: High (17 functions)
  contact_import_csv: 2,
  smart_list_create: 2,
  workflow_duplicate: 2,
  workflow_test: 2,
  website_create: 2,
  email_template_create: 2,
  sms_campaign_create: 2,
  sms_template_create: 2,
  appointment_book: 2,
  appointment_reschedule: 2,
  appointment_cancel: 2,
  pipeline_create: 2,
  opportunity_create: 2,
  opportunity_update_stage: 2,
  trigger_link_create: 2,
  survey_create: 2,
  conversation_send_message: 2,
  // Tier 3: Medium (18 functions)
  contact_delete: 3,
  custom_field_create: 3,
  workflow_delete: 3,
  email_ab_test: 3,
  conversation_ai_setup: 3,
  review_request_create: 3,
  review_monitor: 3,
  social_post_create: 3,
  membership_create: 3,
  course_create: 3,
  product_create: 3,
  order_form_create: 3,
  stripe_connect: 3,
  subaccount_create: 3,
  user_create: 3,
  integration_setup: 3,
  custom_domain_setup: 3,
  task_create: 3,
  // Tier 4: Low (2 functions)
  dashboard_view: 4,
  report_create: 4,
};
