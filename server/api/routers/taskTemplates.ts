import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";

// ── Seed Data ──────────────────────────────────────────────────────────
export interface TaskTemplateInput {
  key: string;
  label: string;
  type: "text" | "select" | "number" | "textarea";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: "crm" | "marketing" | "automation" | "reporting" | "ai";
  icon: string; // lucide icon name
  estimatedTime: string;
  difficulty: "easy" | "medium" | "hard";
  inputs: TaskTemplateInput[];
  steps: string[];
  tags: string[];
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "add-contact-to-pipeline",
    name: "Add Contact to Pipeline",
    description:
      "Automatically add a contact to a specific GHL pipeline stage. The agent will look up the contact, create them if needed, and move them into the selected pipeline.",
    category: "crm",
    icon: "UserPlus",
    estimatedTime: "2-5 min",
    difficulty: "easy",
    inputs: [
      {
        key: "contactEmail",
        label: "Contact Email",
        type: "text",
        placeholder: "jane@example.com",
        required: true,
      },
      {
        key: "contactName",
        label: "Contact Name",
        type: "text",
        placeholder: "Jane Smith",
        required: true,
      },
      {
        key: "pipelineName",
        label: "Pipeline",
        type: "select",
        required: true,
        options: [
          { value: "new-leads", label: "New Leads" },
          { value: "sales", label: "Sales Pipeline" },
          { value: "onboarding", label: "Client Onboarding" },
        ],
      },
      {
        key: "stageName",
        label: "Stage",
        type: "select",
        required: true,
        options: [
          { value: "new", label: "New" },
          { value: "contacted", label: "Contacted" },
          { value: "qualified", label: "Qualified" },
          { value: "proposal", label: "Proposal Sent" },
        ],
      },
    ],
    steps: [
      "Search for contact by email in GHL",
      "Create contact if not found",
      "Locate target pipeline and stage",
      "Add contact to pipeline stage",
      "Log activity on contact record",
    ],
    tags: ["ghl", "pipeline", "contacts"],
  },
  {
    id: "launch-email-campaign",
    name: "Launch Email Campaign",
    description:
      "Set up and launch an email campaign in GoHighLevel. Configure the audience, email content, and scheduling to reach your contacts at the right time.",
    category: "marketing",
    icon: "Mail",
    estimatedTime: "5-10 min",
    difficulty: "medium",
    inputs: [
      {
        key: "campaignName",
        label: "Campaign Name",
        type: "text",
        placeholder: "Spring 2026 Promo",
        required: true,
      },
      {
        key: "subject",
        label: "Email Subject",
        type: "text",
        placeholder: "You won't want to miss this...",
        required: true,
      },
      {
        key: "audience",
        label: "Target Audience",
        type: "select",
        required: true,
        options: [
          { value: "all", label: "All Contacts" },
          { value: "leads", label: "Leads Only" },
          { value: "customers", label: "Existing Customers" },
          { value: "inactive", label: "Inactive Contacts" },
        ],
      },
      {
        key: "body",
        label: "Email Body",
        type: "textarea",
        placeholder: "Write your email content here...",
        required: true,
      },
    ],
    steps: [
      "Create new email campaign in GHL",
      "Set campaign name and subject line",
      "Configure target audience segment",
      "Add email body content",
      "Schedule and launch campaign",
    ],
    tags: ["ghl", "email", "campaigns"],
  },
  {
    id: "create-workflow",
    name: "Create Workflow",
    description:
      "Build an automation workflow in GoHighLevel with triggers, conditions, and actions. Automate repetitive processes like follow-ups and notifications.",
    category: "automation",
    icon: "Workflow",
    estimatedTime: "10-15 min",
    difficulty: "hard",
    inputs: [
      {
        key: "workflowName",
        label: "Workflow Name",
        type: "text",
        placeholder: "New Lead Follow-up",
        required: true,
      },
      {
        key: "triggerType",
        label: "Trigger",
        type: "select",
        required: true,
        options: [
          { value: "contact-created", label: "Contact Created" },
          { value: "form-submitted", label: "Form Submitted" },
          { value: "tag-added", label: "Tag Added" },
          { value: "pipeline-stage-changed", label: "Pipeline Stage Changed" },
          { value: "appointment-booked", label: "Appointment Booked" },
        ],
      },
      {
        key: "description",
        label: "Workflow Description",
        type: "textarea",
        placeholder: "Describe what this workflow should do...",
        required: false,
      },
    ],
    steps: [
      "Create new workflow in GHL",
      "Configure trigger event",
      "Build action sequence based on description",
      "Set conditions and filters",
      "Activate workflow",
    ],
    tags: ["ghl", "workflows", "automation"],
  },
  {
    id: "update-contact-tags",
    name: "Update Contact Tags",
    description:
      "Bulk update tags on contacts matching specific criteria. Add or remove tags to keep your CRM organized and segments up to date.",
    category: "crm",
    icon: "Tags",
    estimatedTime: "2-5 min",
    difficulty: "easy",
    inputs: [
      {
        key: "searchCriteria",
        label: "Search Criteria",
        type: "text",
        placeholder: "e.g., contacts from last 30 days",
        required: true,
      },
      {
        key: "action",
        label: "Action",
        type: "select",
        required: true,
        options: [
          { value: "add", label: "Add Tags" },
          { value: "remove", label: "Remove Tags" },
          { value: "replace", label: "Replace Tags" },
        ],
      },
      {
        key: "tags",
        label: "Tags (comma-separated)",
        type: "text",
        placeholder: "hot-lead, follow-up, q1-2026",
        required: true,
      },
    ],
    steps: [
      "Search contacts matching criteria",
      "Preview matching contacts",
      "Apply tag changes to all matches",
      "Verify tag updates",
      "Log bulk action",
    ],
    tags: ["ghl", "contacts", "tags"],
  },
  {
    id: "export-pipeline-report",
    name: "Export Pipeline Report",
    description:
      "Generate a detailed report of pipeline data including deal values, stage distribution, and conversion rates. Export as a summary or detailed CSV.",
    category: "reporting",
    icon: "FileBarChart",
    estimatedTime: "3-7 min",
    difficulty: "medium",
    inputs: [
      {
        key: "pipeline",
        label: "Pipeline",
        type: "select",
        required: true,
        options: [
          { value: "all", label: "All Pipelines" },
          { value: "new-leads", label: "New Leads" },
          { value: "sales", label: "Sales Pipeline" },
          { value: "onboarding", label: "Client Onboarding" },
        ],
      },
      {
        key: "dateRange",
        label: "Date Range",
        type: "select",
        required: true,
        options: [
          { value: "7d", label: "Last 7 Days" },
          { value: "30d", label: "Last 30 Days" },
          { value: "90d", label: "Last 90 Days" },
          { value: "all", label: "All Time" },
        ],
      },
      {
        key: "format",
        label: "Report Format",
        type: "select",
        required: false,
        options: [
          { value: "summary", label: "Summary" },
          { value: "detailed", label: "Detailed CSV" },
        ],
        defaultValue: "summary",
      },
    ],
    steps: [
      "Connect to GHL pipeline data",
      "Query deals and stages for selected pipeline",
      "Calculate conversion rates and metrics",
      "Generate report in selected format",
      "Return report download link",
    ],
    tags: ["ghl", "pipeline", "reporting"],
  },
  {
    id: "lead-enrichment",
    name: "Lead Enrichment",
    description:
      "Enrich contact records with additional data from public sources. The AI agent will research each lead and update their profile with company info, social links, and more.",
    category: "ai",
    icon: "Sparkles",
    estimatedTime: "5-15 min",
    difficulty: "medium",
    inputs: [
      {
        key: "contactIdentifier",
        label: "Contact Email or Name",
        type: "text",
        placeholder: "jane@example.com",
        required: true,
      },
      {
        key: "enrichFields",
        label: "Fields to Enrich",
        type: "select",
        required: true,
        options: [
          { value: "all", label: "All Available" },
          { value: "company", label: "Company Info" },
          { value: "social", label: "Social Profiles" },
          { value: "demographics", label: "Demographics" },
        ],
      },
    ],
    steps: [
      "Look up contact in GHL",
      "Research contact online using AI",
      "Gather company details and social profiles",
      "Update contact record with enriched data",
      "Generate enrichment summary",
    ],
    tags: ["ai", "leads", "enrichment"],
  },
  {
    id: "competitor-analysis",
    name: "Competitor Analysis",
    description:
      "Run an AI-powered competitor analysis. The agent will research a competitor's online presence, offerings, and positioning, then generate a comparison report.",
    category: "ai",
    icon: "Search",
    estimatedTime: "10-20 min",
    difficulty: "hard",
    inputs: [
      {
        key: "competitorUrl",
        label: "Competitor Website",
        type: "text",
        placeholder: "https://competitor.com",
        required: true,
      },
      {
        key: "focusAreas",
        label: "Focus Areas",
        type: "select",
        required: true,
        options: [
          { value: "all", label: "Full Analysis" },
          { value: "pricing", label: "Pricing & Packages" },
          { value: "services", label: "Services Offered" },
          { value: "positioning", label: "Market Positioning" },
        ],
      },
      {
        key: "yourCompanyContext",
        label: "Your Company Context",
        type: "textarea",
        placeholder: "Briefly describe your company and offerings for comparison...",
        required: false,
      },
    ],
    steps: [
      "Navigate to competitor website",
      "Analyze services, pricing, and positioning",
      "Research competitor on review sites",
      "Compare against your company context",
      "Generate detailed comparison report",
    ],
    tags: ["ai", "research", "competitors"],
  },
  {
    id: "content-creation",
    name: "Content Creation",
    description:
      "Generate marketing content using AI. Create blog posts, social media content, email sequences, or ad copy tailored to your brand and audience.",
    category: "marketing",
    icon: "PenLine",
    estimatedTime: "5-10 min",
    difficulty: "easy",
    inputs: [
      {
        key: "contentType",
        label: "Content Type",
        type: "select",
        required: true,
        options: [
          { value: "blog", label: "Blog Post" },
          { value: "social", label: "Social Media Posts" },
          { value: "email-sequence", label: "Email Sequence" },
          { value: "ad-copy", label: "Ad Copy" },
        ],
      },
      {
        key: "topic",
        label: "Topic / Subject",
        type: "text",
        placeholder: "e.g., Benefits of marketing automation",
        required: true,
      },
      {
        key: "tone",
        label: "Tone",
        type: "select",
        required: false,
        options: [
          { value: "professional", label: "Professional" },
          { value: "casual", label: "Casual & Friendly" },
          { value: "persuasive", label: "Persuasive" },
          { value: "educational", label: "Educational" },
        ],
        defaultValue: "professional",
      },
      {
        key: "additionalContext",
        label: "Additional Instructions",
        type: "textarea",
        placeholder: "Any specific points to cover, keywords, brand voice notes...",
        required: false,
      },
    ],
    steps: [
      "Analyze topic and content requirements",
      "Research relevant information and trends",
      "Generate content draft with AI",
      "Format for selected content type",
      "Deliver final content",
    ],
    tags: ["ai", "content", "marketing"],
  },
];

// ── Category metadata ──────────────────────────────────────────────────
const CATEGORIES = {
  crm: { label: "CRM & Contacts", color: "blue" },
  marketing: { label: "Marketing", color: "purple" },
  automation: { label: "Automation", color: "amber" },
  reporting: { label: "Reporting", color: "emerald" },
  ai: { label: "AI-Powered", color: "pink" },
};

// ── Router ─────────────────────────────────────────────────────────────
export const taskTemplatesRouter = router({
  /** List all templates, optionally filtered by category */
  list: publicProcedure
    .input(
      z
        .object({
          category: z
            .enum(["crm", "marketing", "automation", "reporting", "ai"])
            .optional(),
        })
        .optional()
    )
    .query(({ input }) => {
      let templates = TASK_TEMPLATES;
      if (input?.category) {
        templates = templates.filter((t) => t.category === input.category);
      }
      return { templates, categories: CATEGORIES };
    }),

  /** Get a single template by ID */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const template = TASK_TEMPLATES.find((t) => t.id === input.id);
      if (!template) throw new Error("Template not found");
      return template;
    }),

  /** Create a task from a template with user-provided inputs */
  createFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        inputs: z.record(z.string(), z.string()),
      })
    )
    .mutation(({ input }) => {
      const template = TASK_TEMPLATES.find((t) => t.id === input.templateId);
      if (!template) throw new Error("Template not found");

      // Validate required inputs
      for (const field of template.inputs) {
        if (field.required && !input.inputs[field.key]?.trim()) {
          throw new Error(`${field.label} is required`);
        }
      }

      // In a real implementation, this would create an agent task
      // For now, return a success response with a task ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return {
        success: true,
        taskId,
        message: `Task created from template: ${template.name}`,
        template: template.name,
        inputs: input.inputs,
        steps: template.steps,
      };
    }),
});
