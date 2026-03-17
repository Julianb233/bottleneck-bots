import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../../_core/trpc";
import { eq, and, or, desc, asc, sql, isNull, count } from "drizzle-orm";
import {
  taskTemplates,
  taskTemplateCategories,
} from "../../../drizzle/schema-task-templates";
import { agencyTasks } from "../../../drizzle/schema-webhooks";
import { requireDb, withTrpcErrorHandling, notFoundError } from "../../_core/dbHelper";
import { taskTypeEnum, priorityEnum, urgencyEnum } from "../schemas/common";

// ========================================
// SEED DATA — Pre-built system templates
// ========================================

const SYSTEM_CATEGORIES = [
  {
    slug: "marketing",
    name: "Marketing Campaigns",
    description: "Launch and manage marketing campaigns across channels",
    icon: "Megaphone",
    color: "bg-purple-500",
    sortOrder: 0,
  },
  {
    slug: "outreach",
    name: "Outreach Sequences",
    description: "Automate prospect outreach and follow-up sequences",
    icon: "Send",
    color: "bg-blue-500",
    sortOrder: 1,
  },
  {
    slug: "sales",
    name: "Sales Pipelines",
    description: "Manage deals, proposals, and sales processes",
    icon: "TrendingUp",
    color: "bg-green-500",
    sortOrder: 2,
  },
  {
    slug: "ghl",
    name: "GHL Automations",
    description: "GoHighLevel workflow automations and integrations",
    icon: "Zap",
    color: "bg-orange-500",
    sortOrder: 3,
  },
];

const SYSTEM_TEMPLATES = [
  // Marketing templates
  {
    categorySlug: "marketing",
    name: "Social Media Content Calendar",
    description: "Plan and schedule social media posts across platforms. Auto-generates content ideas, creates posts, and schedules them for optimal engagement times.",
    icon: "Calendar",
    color: "bg-purple-100",
    taskType: "browser_automation",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Analyze brand voice", description: "Review existing content and brand guidelines", actionType: "ai_decision" },
      { title: "Generate content ideas", description: "Create 7-day content calendar with post topics", actionType: "ai_decision" },
      { title: "Draft social posts", description: "Write posts for each platform (IG, FB, LinkedIn, X)", actionType: "ai_decision" },
      { title: "Schedule posts", description: "Queue posts in scheduling tool at optimal times", actionType: "browser_automation" },
    ],
    defaultTags: ["social-media", "content", "scheduling"],
    estimatedDuration: 45,
    difficulty: "beginner",
  },
  {
    categorySlug: "marketing",
    name: "Email Newsletter Campaign",
    description: "Design, write, and send email newsletters to your subscriber list. Includes A/B testing subject lines and tracking open rates.",
    icon: "Mail",
    color: "bg-purple-100",
    taskType: "browser_automation",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Define campaign goal", description: "Set the objective: promote, inform, or convert", actionType: "manual" },
      { title: "Write email content", description: "Draft subject line, preview text, and body copy", actionType: "ai_decision" },
      { title: "Design email template", description: "Create responsive HTML email layout", actionType: "ai_decision" },
      { title: "Set up A/B test", description: "Configure subject line variants for testing", actionType: "browser_automation" },
      { title: "Schedule send", description: "Choose optimal send time and queue campaign", actionType: "browser_automation" },
    ],
    defaultTags: ["email", "newsletter", "campaign"],
    estimatedDuration: 60,
    difficulty: "intermediate",
  },
  {
    categorySlug: "marketing",
    name: "Google Ads Campaign Setup",
    description: "Set up and optimize Google Ads campaigns with keyword research, ad copy creation, and bid strategy configuration.",
    icon: "Target",
    color: "bg-purple-100",
    taskType: "browser_automation",
    priority: "high",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Keyword research", description: "Identify high-intent keywords with search volume data", actionType: "ai_decision" },
      { title: "Create ad groups", description: "Organize keywords into themed ad groups", actionType: "browser_automation" },
      { title: "Write ad copy", description: "Create responsive search ads with headlines and descriptions", actionType: "ai_decision" },
      { title: "Set bid strategy", description: "Configure automated bidding based on campaign goals", actionType: "browser_automation" },
      { title: "Set up conversion tracking", description: "Install conversion tags and define goals", actionType: "browser_automation" },
    ],
    defaultTags: ["google-ads", "ppc", "campaign"],
    estimatedDuration: 90,
    difficulty: "advanced",
  },
  {
    categorySlug: "marketing",
    name: "SEO Content Brief",
    description: "Research keywords, analyze competitors, and create an optimized content brief for blog posts or landing pages.",
    icon: "Search",
    color: "bg-purple-100",
    taskType: "data_extraction",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "automatic",
    steps: [
      { title: "Keyword analysis", description: "Research primary and secondary keywords with metrics", actionType: "ai_decision" },
      { title: "SERP analysis", description: "Review top 10 results for content gaps", actionType: "data_extraction" },
      { title: "Competitor content review", description: "Analyze competing articles for depth and angle", actionType: "data_extraction" },
      { title: "Generate content brief", description: "Create outline with headers, word count, and key points", actionType: "ai_decision" },
    ],
    defaultTags: ["seo", "content", "research"],
    estimatedDuration: 30,
    difficulty: "beginner",
  },

  // Outreach templates
  {
    categorySlug: "outreach",
    name: "Cold Email Sequence",
    description: "Multi-step cold email outreach with personalized messages, follow-ups, and response tracking. Optimized for deliverability.",
    icon: "Mail",
    color: "bg-blue-100",
    taskType: "browser_automation",
    priority: "high",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Build prospect list", description: "Compile target contacts with verified emails", actionType: "data_extraction" },
      { title: "Personalize messages", description: "Research each prospect and customize email copy", actionType: "ai_decision" },
      { title: "Set up email sequence", description: "Configure 3-5 step sequence with delays", actionType: "browser_automation" },
      { title: "Warm up sending domain", description: "Gradually increase send volume for deliverability", actionType: "browser_automation" },
      { title: "Launch sequence", description: "Activate campaign and monitor initial sends", actionType: "browser_automation" },
    ],
    defaultTags: ["outreach", "cold-email", "sequence"],
    estimatedDuration: 60,
    difficulty: "intermediate",
  },
  {
    categorySlug: "outreach",
    name: "LinkedIn Connection Campaign",
    description: "Automated LinkedIn outreach with connection requests, messaging sequences, and profile engagement.",
    icon: "UserPlus",
    color: "bg-blue-100",
    taskType: "browser_automation",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Define ICP", description: "Set ideal customer profile criteria for targeting", actionType: "manual" },
      { title: "Search and filter", description: "Find matching profiles using LinkedIn Sales Navigator", actionType: "browser_automation" },
      { title: "Draft connection notes", description: "Write personalized connection request messages", actionType: "ai_decision" },
      { title: "Send connection requests", description: "Send requests in batches respecting daily limits", actionType: "browser_automation" },
      { title: "Follow-up messages", description: "Send follow-up messages to accepted connections", actionType: "browser_automation" },
    ],
    defaultTags: ["linkedin", "outreach", "connections"],
    estimatedDuration: 45,
    difficulty: "intermediate",
  },
  {
    categorySlug: "outreach",
    name: "Review Request Campaign",
    description: "Reach out to happy customers requesting reviews on Google, Yelp, or industry-specific platforms.",
    icon: "Star",
    color: "bg-blue-100",
    taskType: "browser_automation",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "automatic",
    steps: [
      { title: "Identify satisfied customers", description: "Pull recent clients with positive interactions", actionType: "data_extraction" },
      { title: "Craft review request", description: "Write friendly, personalized review request message", actionType: "ai_decision" },
      { title: "Send via preferred channel", description: "Email or SMS the request with direct review link", actionType: "browser_automation" },
      { title: "Follow up", description: "Send a gentle reminder after 3 days if no response", actionType: "browser_automation" },
    ],
    defaultTags: ["reviews", "reputation", "outreach"],
    estimatedDuration: 20,
    difficulty: "beginner",
  },
  {
    categorySlug: "outreach",
    name: "Partnership Outreach",
    description: "Identify and reach out to potential business partners, affiliates, or co-marketing opportunities.",
    icon: "Handshake",
    color: "bg-blue-100",
    taskType: "browser_automation",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Research potential partners", description: "Identify complementary businesses in your niche", actionType: "data_extraction" },
      { title: "Score and prioritize", description: "Rank prospects by partnership potential", actionType: "ai_decision" },
      { title: "Draft partnership proposal", description: "Create value-driven outreach message", actionType: "ai_decision" },
      { title: "Send initial outreach", description: "Contact via email with partnership pitch", actionType: "browser_automation" },
    ],
    defaultTags: ["partnerships", "affiliates", "outreach"],
    estimatedDuration: 40,
    difficulty: "intermediate",
  },

  // Sales templates
  {
    categorySlug: "sales",
    name: "Lead Qualification Workflow",
    description: "Automatically score and qualify inbound leads based on criteria like company size, budget, and intent signals.",
    icon: "Filter",
    color: "bg-green-100",
    taskType: "data_extraction",
    priority: "high",
    urgency: "soon",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "automatic",
    steps: [
      { title: "Enrich lead data", description: "Pull company info, social profiles, and tech stack", actionType: "data_extraction" },
      { title: "Score lead", description: "Apply scoring model based on ICP fit and intent", actionType: "ai_decision" },
      { title: "Route qualified leads", description: "Assign to sales rep or nurture sequence based on score", actionType: "api_call" },
      { title: "Notify team", description: "Alert sales team of high-scoring leads via Slack/email", actionType: "notification" },
    ],
    defaultTags: ["leads", "qualification", "scoring"],
    estimatedDuration: 15,
    difficulty: "beginner",
  },
  {
    categorySlug: "sales",
    name: "Proposal Generator",
    description: "Create professional proposals using client data, scope of work, pricing, and case studies. Auto-populates from CRM data.",
    icon: "FileText",
    color: "bg-green-100",
    taskType: "report_generation",
    priority: "high",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Pull client data", description: "Gather client info, past interactions, and needs from CRM", actionType: "data_extraction" },
      { title: "Generate scope of work", description: "Create detailed deliverables based on requirements", actionType: "ai_decision" },
      { title: "Build pricing table", description: "Calculate pricing with tiers and add-ons", actionType: "ai_decision" },
      { title: "Add case studies", description: "Select relevant success stories to include", actionType: "ai_decision" },
      { title: "Format proposal", description: "Generate branded PDF proposal document", actionType: "report_generation" },
    ],
    defaultTags: ["proposal", "sales", "document"],
    estimatedDuration: 30,
    difficulty: "intermediate",
  },
  {
    categorySlug: "sales",
    name: "Pipeline Follow-Up Automator",
    description: "Automatically follow up with stale deals in your pipeline. Sends personalized nudges based on deal stage and last activity.",
    icon: "RefreshCw",
    color: "bg-green-100",
    taskType: "browser_automation",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "scheduled",
    steps: [
      { title: "Scan pipeline", description: "Identify deals with no activity in 3+ days", actionType: "data_extraction" },
      { title: "Craft follow-up", description: "Generate stage-appropriate follow-up message", actionType: "ai_decision" },
      { title: "Send follow-up", description: "Deliver via email, SMS, or CRM activity", actionType: "browser_automation" },
      { title: "Update CRM", description: "Log the follow-up activity in the deal record", actionType: "api_call" },
    ],
    defaultTags: ["pipeline", "follow-up", "automation"],
    estimatedDuration: 15,
    difficulty: "beginner",
  },
  {
    categorySlug: "sales",
    name: "Meeting Scheduler & Prep",
    description: "Send scheduling links, confirm meetings, and prepare briefing docs with client research before each call.",
    icon: "CalendarCheck",
    color: "bg-green-100",
    taskType: "browser_automation",
    priority: "high",
    urgency: "soon",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "automatic",
    steps: [
      { title: "Send calendar link", description: "Share booking page or propose time slots", actionType: "browser_automation" },
      { title: "Confirm meeting", description: "Send confirmation with agenda and meeting link", actionType: "api_call" },
      { title: "Research prospect", description: "Pull LinkedIn, company news, and past interactions", actionType: "data_extraction" },
      { title: "Generate briefing doc", description: "Create pre-meeting prep sheet with key talking points", actionType: "ai_decision" },
    ],
    defaultTags: ["meetings", "scheduling", "prep"],
    estimatedDuration: 20,
    difficulty: "beginner",
  },

  // GHL Automation templates
  {
    categorySlug: "ghl",
    name: "GHL Contact Import & Tag",
    description: "Import contacts from CSV or external source into GoHighLevel, apply tags, and assign to pipeline stages.",
    icon: "Upload",
    color: "bg-orange-100",
    taskType: "ghl_action",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "automatic",
    steps: [
      { title: "Validate contact data", description: "Check for required fields and format emails/phones", actionType: "ai_decision" },
      { title: "Import to GHL", description: "Bulk import contacts via GHL API or browser", actionType: "ghl_action" },
      { title: "Apply tags", description: "Tag contacts based on source, campaign, or segment", actionType: "ghl_action" },
      { title: "Assign pipeline stage", description: "Move contacts to appropriate pipeline opportunity", actionType: "ghl_action" },
    ],
    defaultTags: ["ghl", "contacts", "import"],
    estimatedDuration: 15,
    difficulty: "beginner",
  },
  {
    categorySlug: "ghl",
    name: "GHL Workflow Builder",
    description: "Create automated workflows in GoHighLevel with triggers, conditions, and multi-step actions for lead nurturing.",
    icon: "GitBranch",
    color: "bg-orange-100",
    taskType: "ghl_action",
    priority: "high",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Define trigger", description: "Set workflow trigger (form submit, tag added, pipeline change)", actionType: "manual" },
      { title: "Map workflow steps", description: "Design the automation flow with wait times and conditions", actionType: "ai_decision" },
      { title: "Create in GHL", description: "Build the workflow in GoHighLevel automation builder", actionType: "browser_automation" },
      { title: "Set up notifications", description: "Configure alerts for key workflow events", actionType: "ghl_action" },
      { title: "Test workflow", description: "Run test contact through workflow and verify each step", actionType: "browser_automation" },
    ],
    defaultTags: ["ghl", "workflow", "automation"],
    estimatedDuration: 60,
    difficulty: "advanced",
  },
  {
    categorySlug: "ghl",
    name: "GHL Funnel Clone & Customize",
    description: "Clone an existing GHL funnel template, customize branding, copy, and integrations for a new client.",
    icon: "Copy",
    color: "bg-orange-100",
    taskType: "ghl_action",
    priority: "high",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: true,
    executionType: "manual_trigger",
    steps: [
      { title: "Clone funnel template", description: "Duplicate base funnel in GHL sub-account", actionType: "browser_automation" },
      { title: "Update branding", description: "Replace logo, colors, and fonts to match client brand", actionType: "browser_automation" },
      { title: "Customize copy", description: "Rewrite headlines, body text, and CTAs for client niche", actionType: "ai_decision" },
      { title: "Connect integrations", description: "Set up form submissions, payment, and email integrations", actionType: "browser_automation" },
      { title: "Publish and test", description: "Publish funnel and test all pages and forms", actionType: "browser_automation" },
    ],
    defaultTags: ["ghl", "funnel", "client-setup"],
    estimatedDuration: 45,
    difficulty: "intermediate",
  },
  {
    categorySlug: "ghl",
    name: "GHL Reputation Management",
    description: "Set up automated review requests, monitor reviews across platforms, and respond to feedback via GoHighLevel.",
    icon: "Shield",
    color: "bg-orange-100",
    taskType: "ghl_action",
    priority: "medium",
    urgency: "normal",
    assignedToBot: true,
    requiresHumanReview: false,
    executionType: "automatic",
    steps: [
      { title: "Configure review request", description: "Set up automated review request SMS/email after service", actionType: "ghl_action" },
      { title: "Monitor new reviews", description: "Check Google and Facebook for new reviews", actionType: "data_extraction" },
      { title: "Draft responses", description: "Generate professional responses for positive and negative reviews", actionType: "ai_decision" },
      { title: "Post responses", description: "Publish review responses on the platforms", actionType: "browser_automation" },
    ],
    defaultTags: ["ghl", "reviews", "reputation"],
    estimatedDuration: 25,
    difficulty: "beginner",
  },
];

// ========================================
// VALIDATION SCHEMAS
// ========================================

const listTemplatesSchema = z.object({
  category: z.string().optional(),
  search: z.string().max(200).optional(),
  includeUserTemplates: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const createTemplateSchema = z.object({
  categorySlug: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(30).optional(),
  taskType: z.string().max(50).default("custom"),
  priority: z.string().max(20).default("medium"),
  urgency: z.string().max(20).default("normal"),
  assignedToBot: z.boolean().default(true),
  requiresHumanReview: z.boolean().default(false),
  executionType: z.string().max(30).default("automatic"),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    actionType: z.string().optional(),
    config: z.record(z.string(), z.any()).optional(),
  })).default([]),
  executionConfig: z.record(z.string(), z.any()).optional(),
  defaultTags: z.array(z.string()).default([]),
  estimatedDuration: z.number().int().positive().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

const createFromTemplateSchema = z.object({
  templateId: z.number().int().positive(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  scheduledFor: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
});

// ========================================
// TASK TEMPLATES ROUTER
// ========================================

export const taskTemplatesRouter = router({
  /**
   * Get all template categories
   */
  getCategories: publicProcedure.query(async () => {
    const db = await requireDb();
    return withTrpcErrorHandling(async () => {
      const categories = await db
        .select()
        .from(taskTemplateCategories)
        .orderBy(asc(taskTemplateCategories.sortOrder));
      return categories;
    }, "Failed to fetch template categories");
  }),

  /**
   * List templates with filtering
   */
  list: protectedProcedure
    .input(listTemplatesSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        const conditions: any[] = [
          // Show system templates + user's own templates
          or(
            eq(taskTemplates.isSystem, true),
            eq(taskTemplates.userId, userId)
          ),
          eq(taskTemplates.isPublished, true),
        ];

        if (input.category) {
          conditions.push(eq(taskTemplates.categorySlug, input.category));
        }

        if (input.search) {
          conditions.push(
            or(
              sql`${taskTemplates.name} ILIKE ${'%' + input.search + '%'}`,
              sql`${taskTemplates.description} ILIKE ${'%' + input.search + '%'}`
            )
          );
        }

        const templates = await db
          .select()
          .from(taskTemplates)
          .where(and(...conditions))
          .orderBy(desc(taskTemplates.isSystem), desc(taskTemplates.usageCount), asc(taskTemplates.name))
          .limit(input.limit)
          .offset(input.offset);

        const [countResult] = await db
          .select({ count: count() })
          .from(taskTemplates)
          .where(and(...conditions));

        return {
          templates,
          total: countResult?.count || 0,
        };
      }, "Failed to list templates");
    }),

  /**
   * Get a single template
   */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        const [template] = await db
          .select()
          .from(taskTemplates)
          .where(eq(taskTemplates.id, input.id))
          .limit(1);

        if (!template) {
          throw notFoundError("Template", input.id);
        }

        return template;
      }, "Failed to fetch template");
    }),

  /**
   * Create a custom template (user-owned)
   */
  create: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        const [template] = await db
          .insert(taskTemplates)
          .values({
            userId,
            categorySlug: input.categorySlug,
            name: input.name,
            description: input.description,
            icon: input.icon,
            color: input.color,
            taskType: input.taskType,
            priority: input.priority,
            urgency: input.urgency,
            assignedToBot: input.assignedToBot,
            requiresHumanReview: input.requiresHumanReview,
            executionType: input.executionType,
            steps: input.steps,
            executionConfig: input.executionConfig,
            defaultTags: input.defaultTags,
            estimatedDuration: input.estimatedDuration,
            difficulty: input.difficulty,
            isSystem: false,
            isPublished: true,
          })
          .returning();

        return template;
      }, "Failed to create template");
    }),

  /**
   * Delete a user-created template
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        const [template] = await db
          .select()
          .from(taskTemplates)
          .where(and(
            eq(taskTemplates.id, input.id),
            eq(taskTemplates.userId, userId),
            eq(taskTemplates.isSystem, false)
          ))
          .limit(1);

        if (!template) {
          throw notFoundError("Template", input.id);
        }

        await db.delete(taskTemplates).where(eq(taskTemplates.id, input.id));
        return { success: true, id: input.id };
      }, "Failed to delete template");
    }),

  /**
   * Create a task from a template
   */
  createTask: protectedProcedure
    .input(createFromTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        // Fetch the template
        const [template] = await db
          .select()
          .from(taskTemplates)
          .where(eq(taskTemplates.id, input.templateId))
          .limit(1);

        if (!template) {
          throw notFoundError("Template", input.templateId);
        }

        // Create the task using template defaults
        const [task] = await db
          .insert(agencyTasks)
          .values({
            userId,
            sourceType: "manual",
            title: input.title || template.name,
            description: input.description || template.description,
            category: template.categorySlug,
            taskType: template.taskType as any,
            priority: template.priority as any,
            urgency: template.urgency as any,
            status: "pending",
            assignedToBot: template.assignedToBot,
            requiresHumanReview: template.requiresHumanReview,
            executionType: template.executionType as any,
            executionConfig: {
              ...((template.executionConfig as Record<string, any>) || {}),
              templateId: template.id,
              templateSteps: template.steps,
            },
            scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
            deadline: input.deadline ? new Date(input.deadline) : null,
            tags: (template.defaultTags as string[]) || [],
            metadata: {
              fromTemplate: true,
              templateId: template.id,
              templateName: template.name,
            },
            notifyOnComplete: true,
            notifyOnFailure: true,
          })
          .returning();

        // Increment usage counter
        await db
          .update(taskTemplates)
          .set({ usageCount: sql`${taskTemplates.usageCount} + 1` })
          .where(eq(taskTemplates.id, input.templateId));

        return task;
      }, "Failed to create task from template");
    }),

  /**
   * Seed system templates (called once or on demand)
   */
  seed: protectedProcedure.mutation(async () => {
    const db = await requireDb();

    return withTrpcErrorHandling(async () => {
      // Upsert categories
      for (const cat of SYSTEM_CATEGORIES) {
        const [existing] = await db
          .select()
          .from(taskTemplateCategories)
          .where(eq(taskTemplateCategories.slug, cat.slug))
          .limit(1);

        if (!existing) {
          await db.insert(taskTemplateCategories).values(cat);
        }
      }

      // Upsert templates
      let seeded = 0;
      for (const tmpl of SYSTEM_TEMPLATES) {
        const [existing] = await db
          .select()
          .from(taskTemplates)
          .where(and(
            eq(taskTemplates.name, tmpl.name),
            eq(taskTemplates.isSystem, true)
          ))
          .limit(1);

        if (!existing) {
          await db.insert(taskTemplates).values({
            ...tmpl,
            isSystem: true,
            isPublished: true,
            userId: null,
          });
          seeded++;
        }
      }

      return {
        success: true,
        categoriesCount: SYSTEM_CATEGORIES.length,
        templatesSeeded: seeded,
        totalSystemTemplates: SYSTEM_TEMPLATES.length,
      };
    }, "Failed to seed templates");
  }),
});
