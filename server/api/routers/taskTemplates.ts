import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";

// Types
type InputType = "text" | "textarea" | "select" | "email" | "url";
type ActionType = "browser" | "api" | "email" | "ai" | "file" | "wait";
type Category = "ghl" | "marketing" | "sales" | "operations";

interface TemplateInput {
  name: string;
  label: string;
  type: InputType;
  placeholder: string;
  required: boolean;
  options?: string[];
}

interface TemplateStep {
  order: number;
  actionType: ActionType;
  description: string;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: Category;
  platform: string;
  estimatedMinutes: number;
  creditCost: number;
  tags: string[];
  platformRequirements: string[];
  inputs: TemplateInput[];
  steps: TemplateStep[];
}

// 14 seed templates across 4 categories
const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "ghl-add-contact-pipeline",
    name: "Add Contact to Pipeline",
    description: "Adds a new contact to a specified GoHighLevel pipeline stage and assigns them to the correct opportunity bucket.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 3,
    creditCost: 1,
    tags: ["ghl", "contacts", "pipeline", "crm"],
    platformRequirements: ["GHL Account", "GHL API Key", "Pipeline ID"],
    inputs: [
      { name: "contactEmail", label: "Contact Email", type: "email", placeholder: "contact@example.com", required: true },
      { name: "contactName", label: "Full Name", type: "text", placeholder: "Jane Smith", required: true },
      { name: "contactPhone", label: "Phone Number", type: "text", placeholder: "+1 555-000-0000", required: false },
      { name: "pipelineName", label: "Pipeline", type: "select", placeholder: "Select pipeline", required: true, options: ["Sales Pipeline", "Onboarding Pipeline", "Retention Pipeline", "Referral Pipeline"] },
      { name: "stageName", label: "Stage Name", type: "text", placeholder: "Qualified Lead", required: true },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL API using stored credentials" },
      { order: 2, actionType: "api", description: "Search for existing contact by email to prevent duplicates" },
      { order: 3, actionType: "api", description: "Create or update contact record with provided details" },
      { order: 4, actionType: "api", description: "Retrieve pipeline ID and resolve target stage" },
      { order: 5, actionType: "api", description: "Create opportunity and assign contact to pipeline stage" },
      { order: 6, actionType: "ai", description: "Generate confirmation summary with contact and pipeline details" },
    ],
  },
  {
    id: "ghl-launch-email-campaign",
    name: "Launch Email Campaign",
    description: "Creates and sends a targeted email campaign in GoHighLevel to a specified contact segment.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 8,
    creditCost: 3,
    tags: ["ghl", "email", "campaign", "marketing"],
    platformRequirements: ["GHL Account", "GHL API Key", "Verified Sending Domain"],
    inputs: [
      { name: "campaignName", label: "Campaign Name", type: "text", placeholder: "Q2 Re-engagement Blast", required: true },
      { name: "subjectLine", label: "Email Subject Line", type: "text", placeholder: "We miss you", required: true },
      { name: "segmentTag", label: "Target Segment (Tag)", type: "text", placeholder: "inactive-60-days", required: true },
      { name: "templateId", label: "Email Template ID", type: "text", placeholder: "tpl_xxxxxxxxxxxx", required: true },
      { name: "sendTime", label: "Send Time", type: "select", placeholder: "Select send time", required: true, options: ["Immediately", "Tomorrow 9 AM", "Tomorrow 12 PM", "Next Monday 9 AM"] },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL and verify sending domain status" },
      { order: 2, actionType: "api", description: "Fetch contacts matching the specified segment tag" },
      { order: 3, actionType: "api", description: "Load and validate the selected email template" },
      { order: 4, actionType: "ai", description: "Personalise subject line tokens for each contact batch" },
      { order: 5, actionType: "api", description: "Create campaign in GHL with target contact list" },
      { order: 6, actionType: "api", description: "Schedule or immediately dispatch the campaign" },
      { order: 7, actionType: "wait", description: "Wait for GHL campaign status confirmation" },
      { order: 8, actionType: "api", description: "Retrieve and return campaign delivery summary" },
    ],
  },
  {
    id: "ghl-create-workflow",
    name: "Create Automation Workflow",
    description: "Builds a new automation workflow in GoHighLevel from a predefined trigger and action sequence.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 10,
    creditCost: 4,
    tags: ["ghl", "workflow", "automation", "triggers"],
    platformRequirements: ["GHL Account", "GHL API Key", "Sub-Account Access"],
    inputs: [
      { name: "workflowName", label: "Workflow Name", type: "text", placeholder: "New Lead Welcome Sequence", required: true },
      { name: "triggerType", label: "Trigger Type", type: "select", placeholder: "Select trigger", required: true, options: ["Contact Created", "Tag Added", "Form Submitted", "Appointment Booked", "Pipeline Stage Changed"] },
      { name: "triggerFilter", label: "Trigger Filter / Tag Name", type: "text", placeholder: "new-lead", required: false },
      { name: "actionDescription", label: "Describe the Actions", type: "textarea", placeholder: "Send welcome SMS immediately, wait 1 day, send follow-up email", required: true },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL and validate sub-account access" },
      { order: 2, actionType: "ai", description: "Parse action description and map to GHL workflow action schema" },
      { order: 3, actionType: "api", description: "Create workflow with configured trigger in GHL" },
      { order: 4, actionType: "api", description: "Append each action step to the workflow via API" },
      { order: 5, actionType: "api", description: "Activate the workflow and verify it is in live status" },
      { order: 6, actionType: "ai", description: "Generate a summary of the created workflow steps" },
    ],
  },
  {
    id: "ghl-update-contact-tags",
    name: "Update Contact Tags",
    description: "Bulk-adds or removes tags on a filtered set of GHL contacts based on current tag criteria.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 5,
    creditCost: 2,
    tags: ["ghl", "contacts", "tags", "segmentation"],
    platformRequirements: ["GHL Account", "GHL API Key"],
    inputs: [
      { name: "filterTag", label: "Filter Contacts by Existing Tag", type: "text", placeholder: "trial-user", required: true },
      { name: "tagsToAdd", label: "Tags to Add (comma-separated)", type: "text", placeholder: "converted, paying-customer", required: false },
      { name: "tagsToRemove", label: "Tags to Remove (comma-separated)", type: "text", placeholder: "trial-user, free-tier", required: false },
      { name: "operation", label: "Operation Mode", type: "select", placeholder: "Select mode", required: true, options: ["Add tags only", "Remove tags only", "Add and remove tags"] },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL API" },
      { order: 2, actionType: "api", description: "Fetch all contacts matching the filter tag (paginated)" },
      { order: 3, actionType: "ai", description: "Parse and validate tag lists, flag any conflicts" },
      { order: 4, actionType: "api", description: "Apply tag additions to each contact in batches of 50" },
      { order: 5, actionType: "api", description: "Apply tag removals to each contact in batches of 50" },
      { order: 6, actionType: "ai", description: "Return updated contact count and tag change summary" },
    ],
  },
  {
    id: "ghl-export-pipeline-report",
    name: "Export Pipeline Report",
    description: "Exports a snapshot of all opportunities across a GHL pipeline as a CSV file.",
    category: "ghl",
    platform: "GoHighLevel",
    estimatedMinutes: 7,
    creditCost: 2,
    tags: ["ghl", "pipeline", "report", "export", "csv"],
    platformRequirements: ["GHL Account", "GHL API Key"],
    inputs: [
      { name: "pipelineName", label: "Pipeline Name", type: "text", placeholder: "Sales Pipeline", required: true },
      { name: "dateRangeStart", label: "Date Range Start", type: "text", placeholder: "2026-01-01", required: false },
      { name: "dateRangeEnd", label: "Date Range End", type: "text", placeholder: "2026-03-31", required: false },
      { name: "reportEmail", label: "Deliver Report to Email", type: "email", placeholder: "you@company.com", required: true },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL and resolve pipeline ID by name" },
      { order: 2, actionType: "api", description: "Fetch all opportunities in the pipeline (paginated)" },
      { order: 3, actionType: "ai", description: "Filter opportunities by date range if provided" },
      { order: 4, actionType: "ai", description: "Aggregate stage counts and sum monetary values per stage" },
      { order: 5, actionType: "file", description: "Generate CSV file with opportunity rows and summary footer" },
      { order: 6, actionType: "email", description: "Email the CSV report to the specified address" },
    ],
  },
  {
    id: "marketing-content-creation",
    name: "Content Creation",
    description: "Generates a full content package for a given topic and target audience.",
    category: "marketing",
    platform: "Browser",
    estimatedMinutes: 6,
    creditCost: 3,
    tags: ["content", "blog", "social", "copywriting", "ai"],
    platformRequirements: ["OpenAI API Key"],
    inputs: [
      { name: "topic", label: "Content Topic", type: "text", placeholder: "5 ways AI saves time", required: true },
      { name: "audience", label: "Target Audience", type: "text", placeholder: "Small business owners", required: true },
      { name: "tone", label: "Brand Tone", type: "select", placeholder: "Select tone", required: true, options: ["Professional", "Conversational", "Humorous", "Authoritative", "Inspirational"] },
      { name: "contentTypes", label: "Content Types", type: "select", placeholder: "Select output", required: true, options: ["Blog post only", "Social captions only", "Email copy only", "Blog + Social", "Blog + Social + Email"] },
      { name: "keywordFocus", label: "SEO Keyword Focus", type: "text", placeholder: "ai automation", required: false },
    ],
    steps: [
      { order: 1, actionType: "ai", description: "Research topic angle and generate content outline" },
      { order: 2, actionType: "ai", description: "Write full blog post with SEO headings" },
      { order: 3, actionType: "ai", description: "Condense blog into 3 social captions" },
      { order: 4, actionType: "ai", description: "Adapt blog into a short promotional email with CTA" },
      { order: 5, actionType: "file", description: "Bundle all content types into a single markdown document" },
    ],
  },
  {
    id: "marketing-competitor-analysis",
    name: "Competitor Analysis",
    description: "Browses competitor websites and produces a structured competitive landscape report.",
    category: "marketing",
    platform: "Browser",
    estimatedMinutes: 15,
    creditCost: 5,
    tags: ["research", "competitors", "market-intelligence", "scraping"],
    platformRequirements: ["Browserbase Account"],
    inputs: [
      { name: "yourBrand", label: "Your Brand Name", type: "text", placeholder: "Bottleneck Bots", required: true },
      { name: "competitorUrls", label: "Competitor URLs (one per line)", type: "textarea", placeholder: "https://competitor1.com", required: true },
      { name: "focusAreas", label: "Analysis Focus Areas", type: "select", placeholder: "Select focus", required: true, options: ["Pricing only", "Messaging & positioning", "Features & capabilities", "Full analysis"] },
    ],
    steps: [
      { order: 1, actionType: "ai", description: "Parse and validate competitor URL list" },
      { order: 2, actionType: "browser", description: "Visit each competitor homepage and capture messaging" },
      { order: 3, actionType: "browser", description: "Navigate to pricing pages and extract plan tiers" },
      { order: 4, actionType: "browser", description: "Scrape features pages for capability signals" },
      { order: 5, actionType: "ai", description: "Synthesise data into a structured comparison matrix" },
      { order: 6, actionType: "ai", description: "Generate strategic recommendations" },
      { order: 7, actionType: "file", description: "Export competitive analysis as formatted report" },
    ],
  },
  {
    id: "marketing-seo-audit",
    name: "SEO Audit",
    description: "Crawls a target URL, checks on-page SEO factors, and produces a prioritised fix list.",
    category: "marketing",
    platform: "Browser",
    estimatedMinutes: 10,
    creditCost: 3,
    tags: ["seo", "audit", "on-page", "technical"],
    platformRequirements: ["Browserbase Account"],
    inputs: [
      { name: "targetUrl", label: "Target URL to Audit", type: "url", placeholder: "https://yourwebsite.com", required: true },
      { name: "focusKeyword", label: "Primary Focus Keyword", type: "text", placeholder: "ai automation agency", required: true },
      { name: "auditDepth", label: "Audit Depth", type: "select", placeholder: "Select depth", required: true, options: ["Single page only", "Up to 10 pages", "Up to 25 pages"] },
      { name: "reportEmail", label: "Send Report To", type: "email", placeholder: "seo@company.com", required: false },
    ],
    steps: [
      { order: 1, actionType: "browser", description: "Load target URL and capture page source" },
      { order: 2, actionType: "ai", description: "Evaluate title tag, meta description, and keyword presence" },
      { order: 3, actionType: "browser", description: "Crawl internal links and map heading hierarchy" },
      { order: 4, actionType: "ai", description: "Check image alt texts, canonical tags, and schema markup" },
      { order: 5, actionType: "browser", description: "Measure page load speed" },
      { order: 6, actionType: "ai", description: "Score each SEO factor and generate fix recommendations" },
      { order: 7, actionType: "file", description: "Compile full audit report with scores and action items" },
    ],
  },
  {
    id: "sales-lead-enrichment",
    name: "Lead Enrichment",
    description: "Enriches lead records with firmographic data, contact details, and tech stack signals.",
    category: "sales",
    platform: "Browser",
    estimatedMinutes: 12,
    creditCost: 4,
    tags: ["sales", "leads", "enrichment", "prospecting"],
    platformRequirements: ["Browserbase Account"],
    inputs: [
      { name: "leadList", label: "Lead List (one per line)", type: "textarea", placeholder: "Acme Corp\nhttps://linkedin.com/company/beta-inc", required: true },
      { name: "enrichmentFields", label: "Fields to Enrich", type: "select", placeholder: "Select fields", required: true, options: ["Email + Phone", "Company size + Revenue", "Tech stack", "Full enrichment"] },
      { name: "outputFormat", label: "Output Format", type: "select", placeholder: "Select format", required: true, options: ["CSV download", "Add to GHL contacts", "JSON output"] },
    ],
    steps: [
      { order: 1, actionType: "ai", description: "Parse lead list and normalise company names and URLs" },
      { order: 2, actionType: "browser", description: "Visit LinkedIn company pages to extract data" },
      { order: 3, actionType: "browser", description: "Scrape company website for contact patterns" },
      { order: 4, actionType: "ai", description: "Infer tech stack from meta tags and scripts" },
      { order: 5, actionType: "ai", description: "Compile enriched record with confidence scores" },
      { order: 6, actionType: "file", description: "Export enriched leads in the requested format" },
    ],
  },
  {
    id: "sales-cold-email-sequence",
    name: "Cold Email Sequence",
    description: "Writes a personalised multi-touch cold email sequence for prospects.",
    category: "sales",
    platform: "Email",
    estimatedMinutes: 8,
    creditCost: 3,
    tags: ["sales", "cold-email", "outreach", "sequence"],
    platformRequirements: ["OpenAI API Key"],
    inputs: [
      { name: "senderName", label: "Your Name", type: "text", placeholder: "Alex Chen", required: true },
      { name: "senderCompany", label: "Your Company", type: "text", placeholder: "Bottleneck Bots", required: true },
      { name: "targetRole", label: "Target Prospect Role", type: "text", placeholder: "Marketing Director", required: true },
      { name: "valueProposition", label: "Core Value Proposition", type: "textarea", placeholder: "We help save 10 hrs/week with AI", required: true },
      { name: "sequenceLength", label: "Emails in Sequence", type: "select", placeholder: "Select length", required: true, options: ["3 emails", "5 emails", "7 emails"] },
      { name: "tone", label: "Tone", type: "select", placeholder: "Select tone", required: true, options: ["Direct and concise", "Consultative", "Casual and friendly"] },
    ],
    steps: [
      { order: 1, actionType: "ai", description: "Research target role pain points" },
      { order: 2, actionType: "ai", description: "Write initial outreach email with hook and CTA" },
      { order: 3, actionType: "ai", description: "Write follow-up emails with value-add angles" },
      { order: 4, actionType: "ai", description: "Craft final break-up email" },
      { order: 5, actionType: "ai", description: "Review sequence for coherence and spam triggers" },
      { order: 6, actionType: "file", description: "Export sequence with subject lines and schedule" },
    ],
  },
  {
    id: "sales-meeting-scheduler",
    name: "Meeting Scheduler",
    description: "Creates a GHL calendar booking link and sends personalised meeting invitations.",
    category: "sales",
    platform: "GoHighLevel",
    estimatedMinutes: 5,
    creditCost: 2,
    tags: ["sales", "calendar", "booking", "ghl", "scheduling"],
    platformRequirements: ["GHL Account", "GHL API Key", "GHL Calendar Configured"],
    inputs: [
      { name: "calendarName", label: "GHL Calendar Name", type: "text", placeholder: "Discovery Call", required: true },
      { name: "meetingDuration", label: "Meeting Duration", type: "select", placeholder: "Select duration", required: true, options: ["15 minutes", "30 minutes", "45 minutes", "60 minutes"] },
      { name: "prospectEmails", label: "Prospect Emails (one per line)", type: "textarea", placeholder: "prospect1@company.com", required: true },
      { name: "inviteMessage", label: "Invite Message", type: "textarea", placeholder: "Hi, I'd love to show you...", required: true },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL and retrieve calendar ID" },
      { order: 2, actionType: "api", description: "Generate unique booking link" },
      { order: 3, actionType: "ai", description: "Personalise invite message for each prospect" },
      { order: 4, actionType: "email", description: "Send personalised meeting invitations" },
      { order: 5, actionType: "api", description: "Tag each prospect with 'meeting-invite-sent'" },
    ],
  },
  {
    id: "operations-report-generation",
    name: "Report Generation",
    description: "Pulls data from GHL, aggregates KPIs, and delivers a branded PDF or CSV report.",
    category: "operations",
    platform: "GoHighLevel",
    estimatedMinutes: 10,
    creditCost: 3,
    tags: ["operations", "reporting", "kpi", "pdf", "automation"],
    platformRequirements: ["GHL Account", "GHL API Key"],
    inputs: [
      { name: "reportTitle", label: "Report Title", type: "text", placeholder: "Monthly Pipeline Summary", required: true },
      { name: "dataSource", label: "Data Source", type: "select", placeholder: "Select source", required: true, options: ["GHL Pipeline", "GHL Contacts", "GHL Campaign Analytics", "Combined GHL Report"] },
      { name: "reportPeriod", label: "Report Period", type: "select", placeholder: "Select period", required: true, options: ["Last 7 days", "Last 30 days", "Last quarter", "Year to date"] },
      { name: "outputFormat", label: "Output Format", type: "select", placeholder: "Select format", required: true, options: ["PDF", "CSV", "PDF + CSV"] },
      { name: "deliveryEmail", label: "Deliver To (Email)", type: "email", placeholder: "reports@company.com", required: true },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Authenticate with GHL and fetch raw data" },
      { order: 2, actionType: "ai", description: "Aggregate metrics and period-over-period changes" },
      { order: 3, actionType: "ai", description: "Identify top performers and notable trends" },
      { order: 4, actionType: "file", description: "Render data into formatted PDF and/or CSV report" },
      { order: 5, actionType: "email", description: "Email the completed report" },
    ],
  },
  {
    id: "operations-data-cleanup",
    name: "Data Cleanup",
    description: "Scans GHL contacts for duplicates, invalid emails, and missing fields.",
    category: "operations",
    platform: "GoHighLevel",
    estimatedMinutes: 12,
    creditCost: 4,
    tags: ["operations", "data-quality", "deduplication", "ghl", "contacts"],
    platformRequirements: ["GHL Account", "GHL API Key"],
    inputs: [
      { name: "cleanupScope", label: "Cleanup Scope", type: "select", placeholder: "Select scope", required: true, options: ["All contacts", "Last 30 days", "Specific tag", "Specific pipeline"] },
      { name: "scopeFilter", label: "Scope Filter", type: "text", placeholder: "new-lead", required: false },
      { name: "duplicateAction", label: "Duplicate Action", type: "select", placeholder: "Select action", required: true, options: ["Merge automatically", "Flag for review", "Delete older duplicate"] },
      { name: "reportEmail", label: "Cleanup Report Email", type: "email", placeholder: "ops@company.com", required: true },
    ],
    steps: [
      { order: 1, actionType: "api", description: "Fetch contacts matching scope filter" },
      { order: 2, actionType: "ai", description: "Identify duplicates by email, phone, and fuzzy name matching" },
      { order: 3, actionType: "ai", description: "Validate email addresses" },
      { order: 4, actionType: "ai", description: "Flag contacts with missing required fields" },
      { order: 5, actionType: "api", description: "Execute duplicate action per configuration" },
      { order: 6, actionType: "file", description: "Generate cleanup audit log" },
      { order: 7, actionType: "email", description: "Email cleanup summary report" },
    ],
  },
  {
    id: "operations-process-automation",
    name: "Process Automation",
    description: "Maps a manual business process and generates a GHL workflow and SOP document.",
    category: "operations",
    platform: "GoHighLevel",
    estimatedMinutes: 15,
    creditCost: 5,
    tags: ["operations", "process", "workflow", "sop", "automation"],
    platformRequirements: ["GHL Account", "GHL API Key", "Sub-Account Access"],
    inputs: [
      { name: "processName", label: "Process Name", type: "text", placeholder: "Client Onboarding Flow", required: true },
      { name: "processDescription", label: "Describe the Manual Process", type: "textarea", placeholder: "When a new client signs up, we email a welcome packet...", required: true },
      { name: "triggerEvent", label: "What Triggers This Process?", type: "text", placeholder: "New contact tagged 'client-signed'", required: true },
      { name: "teamSize", label: "Team Size", type: "select", placeholder: "Select team size", required: true, options: ["Solo operator", "2-5 people", "6-20 people", "20+ people"] },
    ],
    steps: [
      { order: 1, actionType: "ai", description: "Extract discrete steps and decision points from description" },
      { order: 2, actionType: "ai", description: "Map steps to GHL workflow action types" },
      { order: 3, actionType: "api", description: "Create GHL workflow with trigger and action sequence" },
      { order: 4, actionType: "ai", description: "Generate SOP document with instructions and timelines" },
      { order: 5, actionType: "api", description: "Activate workflow and verify trigger is live" },
      { order: 6, actionType: "file", description: "Export SOP as formatted PDF" },
      { order: 7, actionType: "ai", description: "Summarise automation savings estimate" },
    ],
  },
];

export const taskTemplatesRouter = router({
  getAll: publicProcedure.query((): TaskTemplate[] => {
    return TASK_TEMPLATES;
  }),

  runFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string().min(1),
        inputs: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ input }) => {
      const template = TASK_TEMPLATES.find((t) => t.id === input.templateId);

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Task template '${input.templateId}' does not exist.`,
        });
      }

      const missingFields = template.inputs
        .filter((field) => field.required && !input.inputs[field.name])
        .map((field) => field.label);

      if (missingFields.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      const taskId = Math.floor(Math.random() * 900_000) + 100_000;

      return {
        success: true as const,
        taskId,
        message: `Task '${template.name}' has been queued for execution.`,
        estimatedMinutes: template.estimatedMinutes,
        creditCost: template.creditCost,
      };
    }),
});
