/**
 * Seed data for 14 automation templates across 5 categories:
 * GHL (5), Marketing (2), Research (3), Content (2), Ops (2)
 */
import { getDb } from "../db";
import { automationTemplates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

interface TemplateSeed {
  name: string;
  description: string;
  category: string;
  steps: string; // JSON string of steps
}

export const SEED_TEMPLATES: TemplateSeed[] = [
  // ========================================
  // GHL Templates (5)
  // ========================================
  {
    name: "Add Contact to Pipeline",
    description: "Create a new contact in GHL and add them to a specific pipeline stage.",
    category: "ghl",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open GoHighLevel contacts page" },
      { action: "Click", description: 'Click "Add Contact" button' },
      { action: "Type", description: "Fill in contact details (name, email, phone)" },
      { action: "Click", description: "Save contact" },
      { action: "Navigate", description: "Go to pipeline view" },
      { action: "Click", description: "Add contact to specified pipeline stage" },
    ]),
  },
  {
    name: "Launch Email Campaign",
    description: "Select contacts by tag/segment and launch an email campaign in GHL.",
    category: "ghl",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open GHL marketing campaigns" },
      { action: "Click", description: "Create new campaign" },
      { action: "Type", description: "Set campaign name and email content" },
      { action: "Click", description: "Select target contacts by tag" },
      { action: "Verify", description: "Review campaign settings" },
      { action: "Click", description: "Launch campaign" },
    ]),
  },
  {
    name: "Bulk Update Contact Tags",
    description: "Search for contacts matching criteria and add/remove tags in bulk.",
    category: "ghl",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open GHL contacts" },
      { action: "Click", description: "Apply search filters" },
      { action: "Click", description: "Select all matching contacts" },
      { action: "Click", description: "Bulk actions > Add/Remove tags" },
      { action: "Type", description: "Enter tag name" },
      { action: "Verify", description: "Confirm bulk update" },
    ]),
  },
  {
    name: "Export Pipeline Report",
    description: "Pull pipeline data from GHL and generate a CSV report.",
    category: "ghl",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open GHL pipeline view" },
      { action: "Extract", description: "Gather all opportunities and their stages" },
      { action: "Extract", description: "Collect values, dates, and assigned users" },
      { action: "API Call", description: "Format data as CSV" },
      { action: "Verify", description: "Validate report completeness" },
    ]),
  },
  {
    name: "Create GHL Workflow",
    description: "Build an automation workflow in GoHighLevel with triggers and actions.",
    category: "ghl",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open GHL automations" },
      { action: "Click", description: "Create new workflow" },
      { action: "Type", description: "Set workflow name and trigger" },
      { action: "Click", description: "Add action steps" },
      { action: "Type", description: "Configure each action" },
      { action: "Click", description: "Save and activate workflow" },
    ]),
  },

  // ========================================
  // Marketing Templates (2)
  // ========================================
  {
    name: "Schedule Social Posts",
    description: "Create and schedule social media posts across platforms.",
    category: "marketing",
    steps: JSON.stringify([
      { action: "API Call", description: "Generate post content from brief" },
      { action: "Navigate", description: "Open social media scheduler" },
      { action: "Type", description: "Enter post content" },
      { action: "Click", description: "Select platforms and schedule time" },
      { action: "Verify", description: "Confirm scheduling" },
    ]),
  },
  {
    name: "Email Drip Sequence Setup",
    description: "Design and configure a multi-step email drip sequence for nurturing leads.",
    category: "marketing",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open email marketing platform" },
      { action: "Click", description: "Create new automation sequence" },
      { action: "Type", description: "Set sequence name and trigger conditions" },
      { action: "Type", description: "Write email content for each step" },
      { action: "Click", description: "Set delays between emails" },
      { action: "Verify", description: "Review and activate sequence" },
    ]),
  },

  // ========================================
  // Research Templates (3)
  // ========================================
  {
    name: "Lead Enrichment",
    description: "Research a company and find key decision makers with contact info.",
    category: "research",
    steps: JSON.stringify([
      { action: "Navigate", description: "Search for company website" },
      { action: "Extract", description: "Gather company info (size, industry, location)" },
      { action: "Navigate", description: "Search LinkedIn for decision makers" },
      { action: "Extract", description: "Collect names, titles, and contact info" },
      { action: "API Call", description: "Compile enrichment report" },
    ]),
  },
  {
    name: "Competitor Analysis",
    description: "Browse competitor websites and compile a comparison report.",
    category: "research",
    steps: JSON.stringify([
      { action: "Navigate", description: "Visit competitor website" },
      { action: "Extract", description: "Analyze features, pricing, positioning" },
      { action: "Navigate", description: "Check competitor reviews and social" },
      { action: "Extract", description: "Gather strengths and weaknesses" },
      { action: "API Call", description: "Generate comparison report" },
    ]),
  },
  {
    name: "Website Audit",
    description: "Crawl a website and generate a comprehensive SEO/UX audit report.",
    category: "research",
    steps: JSON.stringify([
      { action: "Navigate", description: "Load target website" },
      { action: "Extract", description: "Check page speed, meta tags, structure" },
      { action: "Navigate", description: "Test key user flows" },
      { action: "Extract", description: "Identify broken links and issues" },
      { action: "API Call", description: "Compile audit report with recommendations" },
    ]),
  },

  // ========================================
  // Content Templates (2)
  // ========================================
  {
    name: "Content Creation",
    description: "Write a blog post and social media posts from a content brief.",
    category: "content",
    steps: JSON.stringify([
      { action: "Navigate", description: "Research topic online" },
      { action: "Extract", description: "Gather key points and data" },
      { action: "API Call", description: "Generate blog post draft" },
      { action: "API Call", description: "Create social media variations" },
      { action: "Verify", description: "Review content quality" },
    ]),
  },
  {
    name: "Monthly Report Generation",
    description: "Compile a comprehensive monthly performance report from multiple data sources.",
    category: "content",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open analytics dashboard" },
      { action: "Extract", description: "Pull KPIs and metrics for the period" },
      { action: "Navigate", description: "Check CRM for sales data" },
      { action: "Extract", description: "Gather revenue, pipeline, and conversion data" },
      { action: "API Call", description: "Generate formatted report with charts" },
      { action: "Verify", description: "Review report accuracy and completeness" },
    ]),
  },

  // ========================================
  // Ops Templates (2)
  // ========================================
  {
    name: "CRM Data Cleanup",
    description: "Identify and fix duplicate contacts, missing fields, and stale records in your CRM.",
    category: "ops",
    steps: JSON.stringify([
      { action: "Navigate", description: "Open CRM contacts list" },
      { action: "Extract", description: "Identify duplicate contacts by email/phone" },
      { action: "Click", description: "Merge duplicate records" },
      { action: "Extract", description: "Find contacts with missing required fields" },
      { action: "Type", description: "Fill in missing data from available sources" },
      { action: "Verify", description: "Generate cleanup summary report" },
    ]),
  },
  {
    name: "Client Onboarding Checklist",
    description: "Execute a step-by-step onboarding process for a new client account.",
    category: "ops",
    steps: JSON.stringify([
      { action: "Navigate", description: "Create new sub-account in GHL" },
      { action: "Type", description: "Set up client profile and branding" },
      { action: "Click", description: "Configure default pipelines and workflows" },
      { action: "Type", description: "Import initial contact list" },
      { action: "Click", description: "Set up tracking and analytics" },
      { action: "Verify", description: "Run checklist verification" },
      { action: "API Call", description: "Send welcome email to client" },
    ]),
  },
];

/**
 * Seeds the automation_templates table with the 14 default templates.
 * Uses upsert logic: skips templates that already exist by name.
 */
export async function seedTemplates(): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized for seeding");

  let inserted = 0;
  let skipped = 0;

  for (const template of SEED_TEMPLATES) {
    const existing = await db
      .select({ id: automationTemplates.id })
      .from(automationTemplates)
      .where(eq(automationTemplates.name, template.name))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(automationTemplates).values({
      name: template.name,
      description: template.description,
      category: template.category,
      steps: template.steps,
    });
    inserted++;
  }

  return { inserted, skipped };
}
