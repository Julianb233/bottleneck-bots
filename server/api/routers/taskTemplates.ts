/**
 * Task Templates tRPC Router
 *
 * Provides 14 pre-built task templates across GHL, Marketing, Sales, and Operations
 * categories. Templates define multi-step workflows the AI agent can execute.
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";

// ========================================
// TEMPLATE TYPES
// ========================================

interface TemplateStep {
  order: number;
  actionType: "browser" | "api" | "email" | "ai" | "file" | "wait";
  description: string;
}

interface TemplateInput {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "email" | "url";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: "ghl" | "marketing" | "sales" | "operations";
  platform: string;
  estimatedMinutes: number;
  creditCost: number;
  tags: string[];
  platformRequirements: string[];
  steps: TemplateStep[];
  inputs: TemplateInput[];
}

// ========================================
// SEEDED TEMPLATES (14 total)
// ========================================

const TASK_TEMPLATES: TaskTemplate[] = [
  // ── GHL Templates (5) ──────────────────
  {
    id: "ghl-add-contact-pipeline",
    name: "Add Contact to Pipeline",
    description:
      "Create or find a contact in GHL and add them to a specific pipeline stage with custom fields.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 3,
    creditCost: 1,
    tags: ["crm", "pipeline", "contacts", "automation"],
    platformRequirements: ["GHL Connected"],
    steps: [
      { order: 1, actionType: "api", description: "Search for existing contact by email" },
      { order: 2, actionType: "api", description: "Create contact if not found" },
      { order: 3, actionType: "api", description: "Add contact to selected pipeline stage" },
      { order: 4, actionType: "api", description: "Set custom field values" },
    ],
    inputs: [
      { name: "contactName", label: "Contact Name", type: "text", placeholder: "John Doe", required: true },
      { name: "contactEmail", label: "Email", type: "email", placeholder: "john@example.com", required: true },
      { name: "contactPhone", label: "Phone", type: "text", placeholder: "+1 555-0100" },
      { name: "pipelineName", label: "Pipeline", type: "select", required: true, options: ["Sales Pipeline", "Onboarding Pipeline", "Follow-up Pipeline", "Retention Pipeline"] },
      { name: "stageName", label: "Stage", type: "text", placeholder: "New Lead", required: true },
    ],
  },
  {
    id: "ghl-launch-email-campaign",
    name: "Launch Email Campaign",
    description:
      "Set up and launch an email drip campaign in GHL targeting a specific contact segment.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 8,
    creditCost: 3,
    tags: ["email", "campaigns", "drip", "automation"],
    platformRequirements: ["GHL Connected", "Email Verified"],
    steps: [
      { order: 1, actionType: "api", description: "Fetch contacts matching tag/segment" },
      { order: 2, actionType: "ai", description: "Generate email copy based on template and inputs" },
      { order: 3, actionType: "api", description: "Create campaign in GHL" },
      { order: 4, actionType: "api", description: "Add contacts to campaign" },
      { order: 5, actionType: "api", description: "Schedule and activate campaign" },
    ],
    inputs: [
      { name: "campaignName", label: "Campaign Name", type: "text", placeholder: "Spring Promotion 2026", required: true },
      { name: "targetTag", label: "Target Tag/Segment", type: "text", placeholder: "e.g., prospect, vip-client", required: true },
      { name: "emailSubject", label: "Email Subject", type: "text", placeholder: "Exciting news for you!", required: true },
      { name: "emailTone", label: "Tone", type: "select", required: true, options: ["Professional", "Casual", "Urgent", "Friendly"] },
      { name: "emailBody", label: "Key Message (AI will expand)", type: "textarea", placeholder: "Describe the main offer or message..." },
    ],
  },
  {
    id: "ghl-create-workflow",
    name: "Create Automation Workflow",
    description:
      "Design and activate a GHL workflow with triggers, conditions, and actions.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 10,
    creditCost: 4,
    tags: ["workflow", "automation", "triggers", "actions"],
    platformRequirements: ["GHL Connected"],
    steps: [
      { order: 1, actionType: "browser", description: "Navigate to GHL Workflow Builder" },
      { order: 2, actionType: "browser", description: "Create new workflow with trigger" },
      { order: 3, actionType: "browser", description: "Add conditional branches" },
      { order: 4, actionType: "browser", description: "Add action steps (email, SMS, tag, wait)" },
      { order: 5, actionType: "browser", description: "Test and activate workflow" },
    ],
    inputs: [
      { name: "workflowName", label: "Workflow Name", type: "text", placeholder: "New Lead Follow-up", required: true },
      { name: "triggerType", label: "Trigger", type: "select", required: true, options: ["Form Submission", "Tag Added", "Pipeline Stage Change", "Appointment Booked", "Manual"] },
      { name: "description", label: "Workflow Description", type: "textarea", placeholder: "Describe what this workflow should do...", required: true },
    ],
  },
  {
    id: "ghl-update-contact-tags",
    name: "Bulk Tag Contacts",
    description: "Add or remove tags from contacts matching specific criteria in GHL.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 5,
    creditCost: 2,
    tags: ["contacts", "tags", "bulk", "segmentation"],
    platformRequirements: ["GHL Connected"],
    steps: [
      { order: 1, actionType: "api", description: "Search contacts by criteria" },
      { order: 2, actionType: "ai", description: "Validate matching contacts" },
      { order: 3, actionType: "api", description: "Apply tag changes in batches" },
      { order: 4, actionType: "api", description: "Generate summary report" },
    ],
    inputs: [
      { name: "searchCriteria", label: "Search Criteria", type: "text", placeholder: "e.g., tag:prospect AND city:Austin", required: true },
      { name: "addTags", label: "Tags to Add (comma-separated)", type: "text", placeholder: "vip, q1-campaign" },
      { name: "removeTags", label: "Tags to Remove (comma-separated)", type: "text", placeholder: "cold-lead" },
    ],
  },
  {
    id: "ghl-export-pipeline-report",
    name: "Export Pipeline Report",
    description:
      "Generate a detailed pipeline report with deal values, stage distribution, and conversion metrics.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 5,
    creditCost: 2,
    tags: ["reporting", "pipeline", "analytics", "export"],
    platformRequirements: ["GHL Connected"],
    steps: [
      { order: 1, actionType: "api", description: "Fetch pipeline opportunities" },
      { order: 2, actionType: "ai", description: "Calculate stage conversion rates" },
      { order: 3, actionType: "ai", description: "Generate insights and recommendations" },
      { order: 4, actionType: "file", description: "Export CSV + summary report" },
    ],
    inputs: [
      { name: "pipelineName", label: "Pipeline", type: "select", required: true, options: ["Sales Pipeline", "Onboarding Pipeline", "All Pipelines"] },
      { name: "dateRange", label: "Date Range", type: "select", required: true, options: ["Last 7 days", "Last 30 days", "Last 90 days", "This quarter", "This year"] },
    ],
  },

  // ── Marketing Templates (3) ────────────
  {
    id: "marketing-content-creation",
    name: "Create Marketing Content",
    description:
      "Generate blog posts, social media copy, or ad copy using AI, optimized for your brand voice.",
    category: "marketing",
    platform: "AI + Browser",
    estimatedMinutes: 15,
    creditCost: 5,
    tags: ["content", "ai", "blog", "social-media", "copywriting"],
    platformRequirements: [],
    steps: [
      { order: 1, actionType: "ai", description: "Analyze brand voice from training docs" },
      { order: 2, actionType: "ai", description: "Research topic and competitors" },
      { order: 3, actionType: "ai", description: "Generate draft content" },
      { order: 4, actionType: "ai", description: "Optimize for SEO keywords" },
      { order: 5, actionType: "file", description: "Save and format final output" },
    ],
    inputs: [
      { name: "contentType", label: "Content Type", type: "select", required: true, options: ["Blog Post", "Social Media Post", "Email Newsletter", "Ad Copy", "Landing Page Copy"] },
      { name: "topic", label: "Topic", type: "text", placeholder: "e.g., Benefits of CRM automation for agencies", required: true },
      { name: "targetAudience", label: "Target Audience", type: "text", placeholder: "e.g., Small business owners, Marketing agency founders", required: true },
      { name: "tone", label: "Tone", type: "select", required: true, options: ["Professional", "Casual", "Persuasive", "Educational", "Humorous"] },
      { name: "keywords", label: "SEO Keywords (comma-separated)", type: "text", placeholder: "crm automation, lead management" },
    ],
  },
  {
    id: "marketing-competitor-analysis",
    name: "Competitor Analysis Report",
    description:
      "Research competitors' websites, social media, and positioning to create a detailed analysis.",
    category: "marketing",
    platform: "Browser + AI",
    estimatedMinutes: 20,
    creditCost: 8,
    tags: ["research", "competitors", "analysis", "strategy"],
    platformRequirements: ["Browserbase Connected"],
    steps: [
      { order: 1, actionType: "browser", description: "Visit competitor websites" },
      { order: 2, actionType: "browser", description: "Capture pricing, features, positioning" },
      { order: 3, actionType: "browser", description: "Check social media presence" },
      { order: 4, actionType: "ai", description: "Analyze strengths, weaknesses, opportunities" },
      { order: 5, actionType: "file", description: "Generate comparison report" },
    ],
    inputs: [
      { name: "competitors", label: "Competitor URLs (one per line)", type: "textarea", placeholder: "https://competitor1.com\nhttps://competitor2.com", required: true },
      { name: "focusAreas", label: "Focus Areas", type: "select", required: true, options: ["Pricing", "Features", "Messaging", "All"] },
      { name: "yourUrl", label: "Your Website URL", type: "url", placeholder: "https://yoursite.com" },
    ],
  },
  {
    id: "marketing-seo-audit",
    name: "SEO Quick Audit",
    description:
      "Scan a website for common SEO issues and generate a prioritized fix list.",
    category: "marketing",
    platform: "Browser + AI",
    estimatedMinutes: 12,
    creditCost: 4,
    tags: ["seo", "audit", "technical", "optimization"],
    platformRequirements: ["Browserbase Connected"],
    steps: [
      { order: 1, actionType: "browser", description: "Crawl target URL and key pages" },
      { order: 2, actionType: "ai", description: "Analyze meta tags, headings, alt text" },
      { order: 3, actionType: "browser", description: "Check page speed and mobile-friendliness" },
      { order: 4, actionType: "ai", description: "Score and prioritize issues" },
      { order: 5, actionType: "file", description: "Generate SEO audit report" },
    ],
    inputs: [
      { name: "targetUrl", label: "Website URL", type: "url", placeholder: "https://example.com", required: true },
      { name: "pageLimit", label: "Pages to Audit", type: "select", options: ["5", "10", "25", "50"] },
      { name: "focusKeywords", label: "Focus Keywords", type: "text", placeholder: "e.g., crm software, lead automation" },
    ],
  },

  // ── Sales Templates (3) ────────────────
  {
    id: "sales-lead-enrichment",
    name: "Enrich Lead Data",
    description:
      "Look up company and contact information to enrich lead records with firmographic data.",
    category: "sales",
    platform: "Browser + API",
    estimatedMinutes: 5,
    creditCost: 2,
    tags: ["leads", "enrichment", "data", "research"],
    platformRequirements: [],
    steps: [
      { order: 1, actionType: "browser", description: "Search LinkedIn/company website" },
      { order: 2, actionType: "ai", description: "Extract company size, industry, tech stack" },
      { order: 3, actionType: "api", description: "Update contact record with enriched data" },
    ],
    inputs: [
      { name: "contactEmail", label: "Contact Email", type: "email", placeholder: "john@company.com", required: true },
      { name: "companyUrl", label: "Company Website (optional)", type: "url", placeholder: "https://company.com" },
    ],
  },
  {
    id: "sales-cold-email-sequence",
    name: "Generate Cold Email Sequence",
    description:
      "Create a personalized 3-5 email cold outreach sequence using AI based on prospect research.",
    category: "sales",
    platform: "AI",
    estimatedMinutes: 10,
    creditCost: 3,
    tags: ["email", "outreach", "cold-email", "sequence", "personalization"],
    platformRequirements: [],
    steps: [
      { order: 1, actionType: "ai", description: "Research prospect company and role" },
      { order: 2, actionType: "ai", description: "Identify pain points and hooks" },
      { order: 3, actionType: "ai", description: "Generate 4-email sequence with variations" },
      { order: 4, actionType: "ai", description: "Add personalization tokens" },
      { order: 5, actionType: "file", description: "Output ready-to-send email templates" },
    ],
    inputs: [
      { name: "prospectName", label: "Prospect Name", type: "text", placeholder: "Jane Smith", required: true },
      { name: "prospectCompany", label: "Company", type: "text", placeholder: "Acme Corp", required: true },
      { name: "prospectRole", label: "Role/Title", type: "text", placeholder: "VP of Marketing" },
      { name: "yourProduct", label: "Your Product/Service", type: "textarea", placeholder: "Describe what you're selling...", required: true },
      { name: "emailCount", label: "Number of Emails", type: "select", options: ["3", "4", "5"] },
    ],
  },
  {
    id: "sales-meeting-scheduler",
    name: "Schedule Meeting from Calendar",
    description:
      "Find available time slots and send a meeting invite to a prospect.",
    category: "sales",
    platform: "Browser + API",
    estimatedMinutes: 4,
    creditCost: 1,
    tags: ["calendar", "meetings", "scheduling", "outreach"],
    platformRequirements: ["GHL Connected"],
    steps: [
      { order: 1, actionType: "api", description: "Check calendar for available slots" },
      { order: 2, actionType: "ai", description: "Select optimal meeting time" },
      { order: 3, actionType: "api", description: "Create calendar event in GHL" },
      { order: 4, actionType: "email", description: "Send meeting invite to prospect" },
    ],
    inputs: [
      { name: "prospectEmail", label: "Prospect Email", type: "email", placeholder: "prospect@company.com", required: true },
      { name: "meetingType", label: "Meeting Type", type: "select", required: true, options: ["Discovery Call", "Demo", "Follow-up", "Strategy Session"] },
      { name: "duration", label: "Duration", type: "select", options: ["15 min", "30 min", "45 min", "60 min"] },
      { name: "notes", label: "Meeting Notes", type: "textarea", placeholder: "Any context for the meeting..." },
    ],
  },

  // ── Operations Templates (3) ───────────
  {
    id: "ops-report-generation",
    name: "Generate Weekly Report",
    description:
      "Compile data from multiple sources into a formatted weekly performance report.",
    category: "operations",
    platform: "API + AI",
    estimatedMinutes: 10,
    creditCost: 3,
    tags: ["reporting", "analytics", "weekly", "metrics"],
    platformRequirements: [],
    steps: [
      { order: 1, actionType: "api", description: "Pull metrics from connected platforms" },
      { order: 2, actionType: "ai", description: "Calculate week-over-week changes" },
      { order: 3, actionType: "ai", description: "Generate executive summary" },
      { order: 4, actionType: "ai", description: "Identify trends and recommendations" },
      { order: 5, actionType: "file", description: "Format and export report" },
    ],
    inputs: [
      { name: "reportType", label: "Report Type", type: "select", required: true, options: ["Marketing Metrics", "Sales Pipeline", "Customer Support", "Full Business"] },
      { name: "dateRange", label: "Period", type: "select", required: true, options: ["This Week", "Last Week", "Last 2 Weeks", "This Month"] },
      { name: "recipients", label: "Send To (emails)", type: "text", placeholder: "team@company.com" },
    ],
  },
  {
    id: "ops-data-cleanup",
    name: "CRM Data Cleanup",
    description:
      "Identify and fix duplicate contacts, missing fields, and invalid data in your CRM.",
    category: "operations",
    platform: "API + AI",
    estimatedMinutes: 15,
    creditCost: 5,
    tags: ["data", "cleanup", "duplicates", "crm", "quality"],
    platformRequirements: ["GHL Connected"],
    steps: [
      { order: 1, actionType: "api", description: "Export all contacts from CRM" },
      { order: 2, actionType: "ai", description: "Identify duplicate records" },
      { order: 3, actionType: "ai", description: "Detect missing/invalid fields" },
      { order: 4, actionType: "api", description: "Merge duplicates (with confirmation)" },
      { order: 5, actionType: "file", description: "Generate cleanup report" },
    ],
    inputs: [
      { name: "scope", label: "Scope", type: "select", required: true, options: ["All Contacts", "Last 30 Days", "Specific Tag"] },
      { name: "autoFix", label: "Auto-fix Mode", type: "select", required: true, options: ["Report Only", "Fix with Confirmation", "Auto-fix All"] },
      { name: "tagFilter", label: "Tag Filter (optional)", type: "text", placeholder: "e.g., imported-2026" },
    ],
  },
  {
    id: "ops-process-automation",
    name: "Document SOP as Workflow",
    description:
      "Convert a standard operating procedure document into an automated agent workflow.",
    category: "operations",
    platform: "AI",
    estimatedMinutes: 20,
    creditCost: 6,
    tags: ["sop", "automation", "workflow", "process", "documentation"],
    platformRequirements: [],
    steps: [
      { order: 1, actionType: "ai", description: "Parse SOP document content" },
      { order: 2, actionType: "ai", description: "Identify automatable steps" },
      { order: 3, actionType: "ai", description: "Map steps to agent actions" },
      { order: 4, actionType: "ai", description: "Generate workflow definition" },
      { order: 5, actionType: "file", description: "Save workflow template" },
    ],
    inputs: [
      { name: "sopContent", label: "SOP Content (paste or describe)", type: "textarea", placeholder: "Paste your SOP here or describe the process step by step...", required: true },
      { name: "processName", label: "Process Name", type: "text", placeholder: "Client Onboarding", required: true },
      { name: "automationLevel", label: "Automation Level", type: "select", required: true, options: ["Fully Automated", "Semi-Automated (Human Checkpoints)", "Assisted (AI Suggestions Only)"] },
    ],
  },
];

// ========================================
// ROUTER
// ========================================

export const taskTemplatesRouter = router({
  /**
   * Get all task templates.
   */
  getAll: publicProcedure.query(() => {
    return TASK_TEMPLATES;
  }),

  /**
   * Get a single template by ID.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const template = TASK_TEMPLATES.find((t) => t.id === input.id);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template '${input.id}' not found`,
        });
      }
      return template;
    }),

  /**
   * Run a task from a template with user inputs.
   * Creates a task execution based on the template definition.
   */
  runFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        inputs: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = TASK_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Template '${input.templateId}' not found`,
        });
      }

      // Validate required inputs
      for (const templateInput of template.inputs) {
        if (templateInput.required && !input.inputs[templateInput.name]) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required input: ${templateInput.label}`,
          });
        }
      }

      // TODO: Create actual task execution via agentOrchestrator
      // For now, return success with task metadata
      console.log(
        `[TaskTemplates] User ${ctx.user.id} running template '${template.name}' with inputs:`,
        input.inputs
      );

      return {
        success: true,
        message: `Task "${template.name}" queued for execution`,
        taskId: `task-${Date.now()}`,
        templateId: template.id,
        estimatedMinutes: template.estimatedMinutes,
        creditCost: template.creditCost,
        stepCount: template.steps.length,
      };
    }),
});
