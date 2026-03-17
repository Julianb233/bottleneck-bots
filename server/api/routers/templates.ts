import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { automationTemplates } from "../../../drizzle/schema";
import { agencyTasks } from "../../../drizzle/schema-webhooks";
import { eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ========================================
// TEMPLATE TYPES
// ========================================

/**
 * Template input field definition
 * Describes a form field that the user must fill before running the template
 */
const templateInputFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "email", "url", "number", "select", "multi-select", "date", "boolean"]),
  placeholder: z.string().optional(),
  required: z.boolean().default(true),
  defaultValue: z.any().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  helpText: z.string().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

/**
 * Template step definition
 * Describes what the agent does at each step
 */
const templateStepSchema = z.object({
  order: z.number(),
  name: z.string(),
  description: z.string(),
  actionType: z.enum(["browser", "api", "email", "data_processing", "ai_generation", "notification"]),
  config: z.record(z.string(), z.any()).optional(),
  estimatedDuration: z.number().optional(), // seconds
});

// ========================================
// SEEDED TEMPLATES
// ========================================

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string; // lucide icon name
  tags: string[];
  estimatedDuration: number; // minutes
  creditCost: number;
  platformRequirements: string[];
  inputs: z.infer<typeof templateInputFieldSchema>[];
  steps: z.infer<typeof templateStepSchema>[];
  difficulty: "beginner" | "intermediate" | "advanced";
  popularity: number; // 0-100
  isNew: boolean;
}

const SEEDED_TEMPLATES: TaskTemplate[] = [
  // ========== GHL Templates ==========
  {
    id: "ghl-add-contact-pipeline",
    name: "GHL: Add Contact to Pipeline",
    description: "Create a new contact in GoHighLevel and automatically add them to a specific pipeline stage. Perfect for inbound lead processing.",
    category: "GHL",
    icon: "UserPlus",
    tags: ["ghl", "contacts", "pipeline", "crm"],
    estimatedDuration: 3,
    creditCost: 1,
    platformRequirements: ["GHL account"],
    difficulty: "beginner",
    popularity: 95,
    isNew: false,
    inputs: [
      { key: "contactName", label: "Contact Name", type: "text", placeholder: "John Doe", required: true },
      { key: "contactEmail", label: "Email Address", type: "email", placeholder: "john@example.com", required: true },
      { key: "contactPhone", label: "Phone Number", type: "text", placeholder: "+1 (555) 123-4567", required: false },
      { key: "pipelineName", label: "Pipeline", type: "select", required: true, options: [
        { label: "Sales Pipeline", value: "sales" },
        { label: "Onboarding Pipeline", value: "onboarding" },
        { label: "Support Pipeline", value: "support" },
        { label: "Custom Pipeline", value: "custom" },
      ]},
      { key: "stageName", label: "Pipeline Stage", type: "text", placeholder: "New Lead", required: true },
      { key: "notes", label: "Notes", type: "textarea", placeholder: "Any additional context...", required: false },
    ],
    steps: [
      { order: 1, name: "Navigate to GHL", description: "Open GoHighLevel CRM", actionType: "browser", estimatedDuration: 5 },
      { order: 2, name: "Create Contact", description: "Fill in contact details form", actionType: "browser", estimatedDuration: 15 },
      { order: 3, name: "Add to Pipeline", description: "Navigate to pipeline and add contact to specified stage", actionType: "browser", estimatedDuration: 10 },
      { order: 4, name: "Verify & Confirm", description: "Confirm contact appears in correct pipeline stage", actionType: "browser", estimatedDuration: 5 },
    ],
  },
  {
    id: "ghl-launch-email-campaign",
    name: "GHL: Launch Email Campaign",
    description: "Select contacts by segment, create an email campaign with your content, and launch it through GoHighLevel's email system.",
    category: "GHL",
    icon: "Mail",
    tags: ["ghl", "email", "campaign", "marketing"],
    estimatedDuration: 10,
    creditCost: 3,
    platformRequirements: ["GHL account", "Email domain configured"],
    difficulty: "intermediate",
    popularity: 88,
    isNew: false,
    inputs: [
      { key: "campaignName", label: "Campaign Name", type: "text", placeholder: "Spring Promo 2026", required: true },
      { key: "contactSegment", label: "Contact Segment", type: "select", required: true, options: [
        { label: "All Contacts", value: "all" },
        { label: "Active Leads", value: "active_leads" },
        { label: "Customers", value: "customers" },
        { label: "Tag-based", value: "tag_based" },
      ]},
      { key: "tagFilter", label: "Tag Filter (if tag-based)", type: "text", placeholder: "newsletter-subscriber", required: false, helpText: "Comma-separated tags to filter contacts" },
      { key: "subject", label: "Email Subject", type: "text", placeholder: "Your exclusive offer inside", required: true },
      { key: "emailBody", label: "Email Body", type: "textarea", placeholder: "Write your email content or paste HTML...", required: true },
      { key: "sendTime", label: "Send Time", type: "select", required: true, options: [
        { label: "Send Immediately", value: "now" },
        { label: "Schedule for Tomorrow 9am", value: "tomorrow_9am" },
        { label: "Schedule for Next Monday 10am", value: "next_monday" },
      ]},
    ],
    steps: [
      { order: 1, name: "Open GHL Marketing", description: "Navigate to marketing section in GHL", actionType: "browser", estimatedDuration: 5 },
      { order: 2, name: "Create Campaign", description: "Set up new email campaign with name and settings", actionType: "browser", estimatedDuration: 20 },
      { order: 3, name: "Select Contacts", description: "Apply segment filters to select target contacts", actionType: "browser", estimatedDuration: 15 },
      { order: 4, name: "Compose Email", description: "Enter subject line and email body content", actionType: "browser", estimatedDuration: 30 },
      { order: 5, name: "Review & Send", description: "Preview campaign and schedule or send immediately", actionType: "browser", estimatedDuration: 10 },
    ],
  },
  {
    id: "ghl-create-workflow",
    name: "GHL: Create Workflow",
    description: "Build an automation workflow in GoHighLevel. Define triggers, conditions, and actions to automate your client processes.",
    category: "GHL",
    icon: "Workflow",
    tags: ["ghl", "automation", "workflow"],
    estimatedDuration: 15,
    creditCost: 5,
    platformRequirements: ["GHL account"],
    difficulty: "advanced",
    popularity: 72,
    isNew: false,
    inputs: [
      { key: "workflowName", label: "Workflow Name", type: "text", placeholder: "New Lead Follow-up", required: true },
      { key: "triggerType", label: "Trigger Type", type: "select", required: true, options: [
        { label: "Form Submission", value: "form_submission" },
        { label: "Pipeline Stage Change", value: "pipeline_change" },
        { label: "Tag Applied", value: "tag_applied" },
        { label: "New Contact Created", value: "contact_created" },
        { label: "Appointment Booked", value: "appointment_booked" },
      ]},
      { key: "triggerDetails", label: "Trigger Details", type: "textarea", placeholder: "Describe the specific trigger conditions...", required: true },
      { key: "actions", label: "Actions to Perform", type: "textarea", placeholder: "List the actions in order:\n1. Send welcome email\n2. Wait 2 days\n3. Send follow-up SMS\n4. Assign to team member", required: true },
      { key: "isActive", label: "Activate Immediately", type: "boolean", required: false, defaultValue: false },
    ],
    steps: [
      { order: 1, name: "Open Workflows", description: "Navigate to GHL Workflows section", actionType: "browser", estimatedDuration: 5 },
      { order: 2, name: "Create Workflow", description: "Create new workflow with specified name", actionType: "browser", estimatedDuration: 10 },
      { order: 3, name: "Configure Trigger", description: "Set up the workflow trigger based on type", actionType: "browser", estimatedDuration: 30 },
      { order: 4, name: "Add Actions", description: "Add and configure each action step", actionType: "browser", estimatedDuration: 120 },
      { order: 5, name: "Test & Activate", description: "Review workflow and optionally activate", actionType: "browser", estimatedDuration: 15 },
    ],
  },
  {
    id: "ghl-update-contact-tags",
    name: "GHL: Update Contact Tags",
    description: "Bulk update tags on contacts matching specific criteria. Add or remove tags to keep your CRM organized.",
    category: "GHL",
    icon: "Tags",
    tags: ["ghl", "contacts", "tags", "bulk"],
    estimatedDuration: 5,
    creditCost: 2,
    platformRequirements: ["GHL account"],
    difficulty: "beginner",
    popularity: 80,
    isNew: false,
    inputs: [
      { key: "filterCriteria", label: "Contact Filter", type: "select", required: true, options: [
        { label: "All contacts in pipeline", value: "pipeline" },
        { label: "Contacts with specific tag", value: "existing_tag" },
        { label: "Contacts created after date", value: "date_filter" },
        { label: "Contacts matching search", value: "search" },
      ]},
      { key: "filterValue", label: "Filter Value", type: "text", placeholder: "Pipeline name, tag, date, or search term", required: true },
      { key: "action", label: "Tag Action", type: "select", required: true, options: [
        { label: "Add Tags", value: "add" },
        { label: "Remove Tags", value: "remove" },
        { label: "Replace Tags", value: "replace" },
      ]},
      { key: "tags", label: "Tags", type: "text", placeholder: "tag1, tag2, tag3", required: true, helpText: "Comma-separated list of tags" },
    ],
    steps: [
      { order: 1, name: "Open Contacts", description: "Navigate to GHL contacts section", actionType: "browser", estimatedDuration: 5 },
      { order: 2, name: "Apply Filters", description: "Filter contacts based on specified criteria", actionType: "browser", estimatedDuration: 10 },
      { order: 3, name: "Select Contacts", description: "Select all matching contacts", actionType: "browser", estimatedDuration: 5 },
      { order: 4, name: "Update Tags", description: "Apply tag changes to selected contacts", actionType: "browser", estimatedDuration: 15 },
      { order: 5, name: "Verify Changes", description: "Confirm tags were applied correctly", actionType: "browser", estimatedDuration: 5 },
    ],
  },
  {
    id: "ghl-export-pipeline-report",
    name: "GHL: Export Pipeline Report",
    description: "Pull pipeline data from GoHighLevel, compile statistics, and generate a downloadable CSV report of all deals and their stages.",
    category: "GHL",
    icon: "FileSpreadsheet",
    tags: ["ghl", "pipeline", "report", "csv", "analytics"],
    estimatedDuration: 8,
    creditCost: 2,
    platformRequirements: ["GHL account"],
    difficulty: "beginner",
    popularity: 76,
    isNew: false,
    inputs: [
      { key: "pipelineName", label: "Pipeline", type: "select", required: true, options: [
        { label: "Sales Pipeline", value: "sales" },
        { label: "Onboarding Pipeline", value: "onboarding" },
        { label: "All Pipelines", value: "all" },
      ]},
      { key: "dateRange", label: "Date Range", type: "select", required: true, options: [
        { label: "Last 7 days", value: "7d" },
        { label: "Last 30 days", value: "30d" },
        { label: "Last 90 days", value: "90d" },
        { label: "All time", value: "all" },
      ]},
      { key: "includeContactDetails", label: "Include Contact Details", type: "boolean", required: false, defaultValue: true },
      { key: "includeNotes", label: "Include Notes", type: "boolean", required: false, defaultValue: false },
    ],
    steps: [
      { order: 1, name: "Open Pipeline", description: "Navigate to the specified pipeline in GHL", actionType: "browser", estimatedDuration: 5 },
      { order: 2, name: "Extract Data", description: "Scrape pipeline data including stages, contacts, and values", actionType: "data_processing", estimatedDuration: 30 },
      { order: 3, name: "Compile Report", description: "Process and format data into report structure", actionType: "data_processing", estimatedDuration: 15 },
      { order: 4, name: "Generate CSV", description: "Create downloadable CSV file with pipeline data", actionType: "data_processing", estimatedDuration: 5 },
      { order: 5, name: "Deliver Report", description: "Provide download link and summary statistics", actionType: "notification", estimatedDuration: 5 },
    ],
  },
  // ========== Research & Analysis Templates ==========
  {
    id: "lead-enrichment",
    name: "Lead Enrichment",
    description: "Research a company online, find key decision makers, gather contact info, and compile a detailed lead profile for your sales team.",
    category: "Research",
    icon: "Search",
    tags: ["leads", "research", "enrichment", "sales"],
    estimatedDuration: 12,
    creditCost: 3,
    platformRequirements: [],
    difficulty: "intermediate",
    popularity: 91,
    isNew: false,
    inputs: [
      { key: "companyName", label: "Company Name", type: "text", placeholder: "Acme Corporation", required: true },
      { key: "companyWebsite", label: "Company Website", type: "url", placeholder: "https://acme.com", required: false },
      { key: "industry", label: "Industry", type: "text", placeholder: "SaaS, Marketing, Healthcare...", required: false },
      { key: "targetRoles", label: "Target Roles", type: "text", placeholder: "CEO, CTO, VP of Marketing", required: true, helpText: "Comma-separated roles to find" },
      { key: "enrichmentDepth", label: "Research Depth", type: "select", required: true, options: [
        { label: "Quick (company overview + key contacts)", value: "quick" },
        { label: "Standard (+ social profiles + tech stack)", value: "standard" },
        { label: "Deep (+ news, funding, competitors)", value: "deep" },
      ]},
    ],
    steps: [
      { order: 1, name: "Company Research", description: "Browse company website and extract key information", actionType: "browser", estimatedDuration: 60 },
      { order: 2, name: "LinkedIn Lookup", description: "Find decision makers on LinkedIn", actionType: "browser", estimatedDuration: 90 },
      { order: 3, name: "Contact Discovery", description: "Find email addresses and phone numbers", actionType: "browser", estimatedDuration: 60 },
      { order: 4, name: "Tech Stack Analysis", description: "Identify technologies used by the company", actionType: "browser", estimatedDuration: 30 },
      { order: 5, name: "Compile Profile", description: "Compile all data into structured lead profile", actionType: "data_processing", estimatedDuration: 20 },
    ],
  },
  {
    id: "competitor-analysis",
    name: "Competitor Analysis",
    description: "Browse competitor websites, analyze their offerings, pricing, and positioning. Get a comprehensive report to sharpen your strategy.",
    category: "Research",
    icon: "BarChart3",
    tags: ["competitors", "research", "analysis", "strategy"],
    estimatedDuration: 20,
    creditCost: 4,
    platformRequirements: [],
    difficulty: "intermediate",
    popularity: 84,
    isNew: false,
    inputs: [
      { key: "yourCompany", label: "Your Company/Client", type: "text", placeholder: "Your company name", required: true },
      { key: "competitors", label: "Competitor URLs", type: "textarea", placeholder: "https://competitor1.com\nhttps://competitor2.com\nhttps://competitor3.com", required: true, helpText: "One URL per line (max 5)" },
      { key: "focusAreas", label: "Focus Areas", type: "multi-select", required: true, options: [
        { label: "Pricing", value: "pricing" },
        { label: "Features", value: "features" },
        { label: "Messaging & Positioning", value: "messaging" },
        { label: "SEO & Content", value: "seo" },
        { label: "Social Media", value: "social" },
        { label: "Reviews & Reputation", value: "reviews" },
      ]},
      { key: "outputFormat", label: "Output Format", type: "select", required: true, options: [
        { label: "Executive Summary", value: "summary" },
        { label: "Detailed Report", value: "detailed" },
        { label: "Comparison Table", value: "table" },
      ]},
    ],
    steps: [
      { order: 1, name: "Browse Competitors", description: "Visit each competitor website and capture key pages", actionType: "browser", estimatedDuration: 180 },
      { order: 2, name: "Analyze Pricing", description: "Extract and compare pricing models", actionType: "data_processing", estimatedDuration: 60 },
      { order: 3, name: "Feature Comparison", description: "Map features across competitors", actionType: "data_processing", estimatedDuration: 60 },
      { order: 4, name: "Generate Report", description: "Compile findings into chosen output format", actionType: "ai_generation", estimatedDuration: 60 },
    ],
  },
  // ========== Content Templates ==========
  {
    id: "content-creation",
    name: "Content Creation",
    description: "Create a blog post and matching social media posts from a topic brief. Get SEO-optimized content ready to publish.",
    category: "Content",
    icon: "PenTool",
    tags: ["content", "blog", "social", "marketing", "writing"],
    estimatedDuration: 15,
    creditCost: 3,
    platformRequirements: [],
    difficulty: "beginner",
    popularity: 89,
    isNew: true,
    inputs: [
      { key: "topic", label: "Topic / Brief", type: "textarea", placeholder: "Write about the benefits of AI automation for marketing agencies...", required: true },
      { key: "targetAudience", label: "Target Audience", type: "text", placeholder: "Marketing agency owners", required: true },
      { key: "tone", label: "Tone", type: "select", required: true, options: [
        { label: "Professional", value: "professional" },
        { label: "Conversational", value: "conversational" },
        { label: "Authoritative", value: "authoritative" },
        { label: "Friendly", value: "friendly" },
      ]},
      { key: "contentTypes", label: "Content Types", type: "multi-select", required: true, options: [
        { label: "Blog Post (1000-1500 words)", value: "blog" },
        { label: "LinkedIn Post", value: "linkedin" },
        { label: "Twitter/X Thread", value: "twitter" },
        { label: "Instagram Caption", value: "instagram" },
        { label: "Email Newsletter", value: "email" },
      ]},
      { key: "keywords", label: "Target Keywords", type: "text", placeholder: "AI automation, marketing agency, efficiency", required: false, helpText: "Comma-separated SEO keywords to target" },
      { key: "callToAction", label: "Call to Action", type: "text", placeholder: "Book a demo at...", required: false },
    ],
    steps: [
      { order: 1, name: "Research Topic", description: "Research the topic for current trends and data", actionType: "browser", estimatedDuration: 60 },
      { order: 2, name: "Create Blog Post", description: "Write SEO-optimized blog post", actionType: "ai_generation", estimatedDuration: 120 },
      { order: 3, name: "Generate Social Posts", description: "Create social media content variants", actionType: "ai_generation", estimatedDuration: 60 },
      { order: 4, name: "SEO Optimization", description: "Add meta descriptions, alt tags, internal links", actionType: "ai_generation", estimatedDuration: 30 },
      { order: 5, name: "Deliver Content", description: "Package all content pieces for review", actionType: "notification", estimatedDuration: 10 },
    ],
  },
];

// ========================================
// TEMPLATE CATEGORIES
// ========================================

const TEMPLATE_CATEGORIES = [
  { id: "ghl", name: "GHL", description: "GoHighLevel CRM automations", icon: "Zap", count: 0 },
  { id: "research", name: "Research", description: "Lead research and competitor analysis", icon: "Search", count: 0 },
  { id: "content", name: "Content", description: "Blog posts, social media, and marketing content", icon: "PenTool", count: 0 },
];

// Calculate counts
TEMPLATE_CATEGORIES.forEach(cat => {
  cat.count = SEEDED_TEMPLATES.filter(t => t.category.toLowerCase() === cat.id).length;
});

// ========================================
// ROUTER
// ========================================

export const templatesRouter = router({
  /**
   * Get all task templates (seeded + database)
   */
  getAll: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      let templates = [...SEEDED_TEMPLATES];

      // Filter by category
      if (input?.category && input.category !== "all") {
        templates = templates.filter(t => t.category.toLowerCase() === input.category!.toLowerCase());
      }

      // Filter by search
      if (input?.search) {
        const q = input.search.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some(tag => tag.includes(q))
        );
      }

      // Sort by popularity
      templates.sort((a, b) => b.popularity - a.popularity);

      return templates;
    }),

  /**
   * Get template categories with counts
   */
  getCategories: publicProcedure.query(() => {
    return TEMPLATE_CATEGORIES;
  }),

  /**
   * Get a single template by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const template = SEEDED_TEMPLATES.find(t => t.id === input.id);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return template;
    }),

  /**
   * Execute a template - creates an agency task with pre-filled configuration
   */
  execute: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      inputs: z.record(z.string(), z.any()),
    }))
    .mutation(async ({ input, ctx }) => {
      const template = SEEDED_TEMPLATES.find(t => t.id === input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Validate required inputs
      for (const field of template.inputs) {
        if (field.required && !input.inputs[field.key]) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required field: ${field.label}`,
          });
        }
      }

      const db = await getDb();
      if (!db) throw new Error("Database not initialized");

      // Determine task type from template category
      const taskTypeMap: Record<string, string> = {
        "GHL": "ghl_action",
        "Research": "browser_automation",
        "Content": "custom",
      };
      const taskType = taskTypeMap[template.category] || "custom";

      // Create an agency task from the template
      const [task] = await db.insert(agencyTasks).values({
        userId: ctx.user!.id,
        title: `${template.name}: ${input.inputs[template.inputs[0]?.key] || "New Task"}`,
        description: template.description,
        category: template.category.toLowerCase(),
        taskType,
        sourceType: "manual",
        priority: "medium",
        urgency: "normal",
        executionType: "automatic",
        executionConfig: {
          templateId: template.id,
          templateName: template.name,
          templateInputs: input.inputs,
          steps: template.steps,
          estimatedDuration: template.estimatedDuration,
          creditCost: template.creditCost,
        },
        tags: template.tags,
        metadata: {
          fromTemplate: true,
          templateCategory: template.category,
          userInputs: input.inputs,
        },
      }).returning();

      return {
        success: true,
        taskId: task.id,
        taskUuid: task.taskUuid,
        message: `Task created from template: ${template.name}`,
      };
    }),

  /**
   * Get database-stored automation templates (legacy support)
   */
  getLegacy: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");
    return await db.select().from(automationTemplates);
  }),
});
