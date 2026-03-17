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
  platform: string;
  steps: { action: string; description: string }[];
  estimatedMinutes: number;
  estimatedCredits: number;
  requiredSkills: string[];
  inputs: { label: string; placeholder: string; required: boolean }[];
  isSeedTemplate: true;
  isActive: true;
  isPublic: false;
}

export const SEED_TEMPLATES: TemplateSeed[] = [
  // ========================================
  // GHL Templates (5)
  // ========================================
  {
    name: "Add Contact to Pipeline",
    description: "Create a new contact in GHL and add them to a specific pipeline stage.",
    category: "ghl",
    platform: "GoHighLevel",
    steps: [
      { action: "Navigate", description: "Open GoHighLevel contacts page" },
      { action: "Click", description: 'Click "Add Contact" button' },
      { action: "Type", description: "Fill in contact details (name, email, phone)" },
      { action: "Click", description: "Save contact" },
      { action: "Navigate", description: "Go to pipeline view" },
      { action: "Click", description: "Add contact to specified pipeline stage" },
    ],
    estimatedMinutes: 3,
    estimatedCredits: 2,
    requiredSkills: ["browser", "ghl_api"],
    inputs: [
      { label: "Contact Name", placeholder: "John Doe", required: true },
      { label: "Email", placeholder: "john@example.com", required: true },
      { label: "Phone", placeholder: "+1 555-0123", required: false },
      { label: "Pipeline Name", placeholder: "Sales Pipeline", required: true },
      { label: "Stage", placeholder: "New Lead", required: true },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Launch Email Campaign",
    description: "Select contacts by tag/segment and launch an email campaign in GHL.",
    category: "ghl",
    platform: "GoHighLevel",
    steps: [
      { action: "Navigate", description: "Open GHL marketing campaigns" },
      { action: "Click", description: "Create new campaign" },
      { action: "Type", description: "Set campaign name and email content" },
      { action: "Click", description: "Select target contacts by tag" },
      { action: "Verify", description: "Review campaign settings" },
      { action: "Click", description: "Launch campaign" },
    ],
    estimatedMinutes: 5,
    estimatedCredits: 3,
    requiredSkills: ["browser", "ghl_api", "email"],
    inputs: [
      { label: "Campaign Name", placeholder: "March Newsletter", required: true },
      { label: "Target Tag", placeholder: "active-clients", required: true },
      { label: "Email Subject", placeholder: "Your March Update", required: true },
      { label: "Brief Description", placeholder: "Monthly newsletter with latest updates...", required: true },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Bulk Update Contact Tags",
    description: "Search for contacts matching criteria and add/remove tags in bulk.",
    category: "ghl",
    platform: "GoHighLevel",
    steps: [
      { action: "Navigate", description: "Open GHL contacts" },
      { action: "Click", description: "Apply search filters" },
      { action: "Click", description: "Select all matching contacts" },
      { action: "Click", description: "Bulk actions > Add/Remove tags" },
      { action: "Type", description: "Enter tag name" },
      { action: "Verify", description: "Confirm bulk update" },
    ],
    estimatedMinutes: 3,
    estimatedCredits: 2,
    requiredSkills: ["browser", "ghl_api"],
    inputs: [
      { label: "Search Criteria", placeholder: "e.g., contacts from San Diego", required: true },
      { label: "Tag to Add", placeholder: "vip-client", required: false },
      { label: "Tag to Remove", placeholder: "cold-lead", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Export Pipeline Report",
    description: "Pull pipeline data from GHL and generate a CSV report.",
    category: "ghl",
    platform: "GoHighLevel",
    steps: [
      { action: "Navigate", description: "Open GHL pipeline view" },
      { action: "Extract", description: "Gather all opportunities and their stages" },
      { action: "Extract", description: "Collect values, dates, and assigned users" },
      { action: "API Call", description: "Format data as CSV" },
      { action: "Verify", description: "Validate report completeness" },
    ],
    estimatedMinutes: 4,
    estimatedCredits: 3,
    requiredSkills: ["browser", "ghl_api", "file_creation"],
    inputs: [
      { label: "Pipeline Name", placeholder: "Sales Pipeline", required: true },
      { label: "Date Range", placeholder: "Last 30 days", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Create GHL Workflow",
    description: "Build an automation workflow in GoHighLevel with triggers and actions.",
    category: "ghl",
    platform: "GoHighLevel",
    steps: [
      { action: "Navigate", description: "Open GHL automations" },
      { action: "Click", description: "Create new workflow" },
      { action: "Type", description: "Set workflow name and trigger" },
      { action: "Click", description: "Add action steps" },
      { action: "Type", description: "Configure each action" },
      { action: "Click", description: "Save and activate workflow" },
    ],
    estimatedMinutes: 8,
    estimatedCredits: 5,
    requiredSkills: ["browser", "ghl_api"],
    inputs: [
      { label: "Workflow Name", placeholder: "New Lead Follow-up", required: true },
      { label: "Trigger", placeholder: "When contact is created", required: true },
      { label: "Actions Description", placeholder: "Send welcome email, wait 1 day, send SMS", required: true },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },

  // ========================================
  // Marketing Templates (2)
  // ========================================
  {
    name: "Schedule Social Posts",
    description: "Create and schedule social media posts across platforms.",
    category: "marketing",
    platform: "General",
    steps: [
      { action: "API Call", description: "Generate post content from brief" },
      { action: "Navigate", description: "Open social media scheduler" },
      { action: "Type", description: "Enter post content" },
      { action: "Click", description: "Select platforms and schedule time" },
      { action: "Verify", description: "Confirm scheduling" },
    ],
    estimatedMinutes: 5,
    estimatedCredits: 3,
    requiredSkills: ["browser", "file_creation"],
    inputs: [
      { label: "Post Topic", placeholder: "Product launch announcement", required: true },
      { label: "Platforms", placeholder: "LinkedIn, Twitter, Facebook", required: true },
      { label: "Schedule Date", placeholder: "Next Monday 9am", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Email Drip Sequence Setup",
    description: "Design and configure a multi-step email drip sequence for nurturing leads.",
    category: "marketing",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Open email marketing platform" },
      { action: "Click", description: "Create new automation sequence" },
      { action: "Type", description: "Set sequence name and trigger conditions" },
      { action: "Type", description: "Write email content for each step" },
      { action: "Click", description: "Set delays between emails" },
      { action: "Verify", description: "Review and activate sequence" },
    ],
    estimatedMinutes: 12,
    estimatedCredits: 6,
    requiredSkills: ["browser", "email", "ghl_api"],
    inputs: [
      { label: "Sequence Name", placeholder: "Welcome Drip - New Leads", required: true },
      { label: "Number of Emails", placeholder: "5", required: true },
      { label: "Trigger", placeholder: "When contact fills out form", required: true },
      { label: "Delay Between Emails", placeholder: "2 days", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },

  // ========================================
  // Research Templates (3)
  // ========================================
  {
    name: "Lead Enrichment",
    description: "Research a company and find key decision makers with contact info.",
    category: "research",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Search for company website" },
      { action: "Extract", description: "Gather company info (size, industry, location)" },
      { action: "Navigate", description: "Search LinkedIn for decision makers" },
      { action: "Extract", description: "Collect names, titles, and contact info" },
      { action: "API Call", description: "Compile enrichment report" },
    ],
    estimatedMinutes: 6,
    estimatedCredits: 4,
    requiredSkills: ["browser", "web_scraping"],
    inputs: [
      { label: "Company Name", placeholder: "Acme Corp", required: true },
      { label: "Company Website", placeholder: "https://acme.com", required: false },
      { label: "Target Roles", placeholder: "CEO, CMO, VP Marketing", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Competitor Analysis",
    description: "Browse competitor websites and compile a comparison report.",
    category: "research",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Visit competitor website" },
      { action: "Extract", description: "Analyze features, pricing, positioning" },
      { action: "Navigate", description: "Check competitor reviews and social" },
      { action: "Extract", description: "Gather strengths and weaknesses" },
      { action: "API Call", description: "Generate comparison report" },
    ],
    estimatedMinutes: 10,
    estimatedCredits: 5,
    requiredSkills: ["browser", "web_scraping", "reporting"],
    inputs: [
      { label: "Your Company/Product", placeholder: "Our SaaS Product", required: true },
      { label: "Competitor URLs", placeholder: "https://competitor1.com, https://competitor2.com", required: true },
      { label: "Focus Areas", placeholder: "Pricing, features, UX", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Website Audit",
    description: "Crawl a website and generate a comprehensive SEO/UX audit report.",
    category: "research",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Load target website" },
      { action: "Extract", description: "Check page speed, meta tags, structure" },
      { action: "Navigate", description: "Test key user flows" },
      { action: "Extract", description: "Identify broken links and issues" },
      { action: "API Call", description: "Compile audit report with recommendations" },
    ],
    estimatedMinutes: 12,
    estimatedCredits: 6,
    requiredSkills: ["browser", "web_scraping", "reporting"],
    inputs: [
      { label: "Website URL", placeholder: "https://example.com", required: true },
      { label: "Focus", placeholder: "SEO, performance, accessibility", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },

  // ========================================
  // Content Templates (2)
  // ========================================
  {
    name: "Content Creation",
    description: "Write a blog post and social media posts from a content brief.",
    category: "content",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Research topic online" },
      { action: "Extract", description: "Gather key points and data" },
      { action: "API Call", description: "Generate blog post draft" },
      { action: "API Call", description: "Create social media variations" },
      { action: "Verify", description: "Review content quality" },
    ],
    estimatedMinutes: 8,
    estimatedCredits: 4,
    requiredSkills: ["browser", "web_scraping", "file_creation"],
    inputs: [
      { label: "Topic", placeholder: "How AI is transforming marketing agencies", required: true },
      { label: "Target Audience", placeholder: "Agency owners, 25-45", required: true },
      { label: "Tone", placeholder: "Professional but conversational", required: false },
      { label: "Word Count", placeholder: "1500", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Monthly Report Generation",
    description: "Compile a comprehensive monthly performance report from multiple data sources.",
    category: "content",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Open analytics dashboard" },
      { action: "Extract", description: "Pull KPIs and metrics for the period" },
      { action: "Navigate", description: "Check CRM for sales data" },
      { action: "Extract", description: "Gather revenue, pipeline, and conversion data" },
      { action: "API Call", description: "Generate formatted report with charts" },
      { action: "Verify", description: "Review report accuracy and completeness" },
    ],
    estimatedMinutes: 15,
    estimatedCredits: 7,
    requiredSkills: ["browser", "web_scraping", "file_creation", "reporting"],
    inputs: [
      { label: "Report Period", placeholder: "March 2026", required: true },
      { label: "Client Name", placeholder: "Acme Corp", required: true },
      { label: "Data Sources", placeholder: "Google Analytics, GHL, Stripe", required: false },
      { label: "KPIs to Track", placeholder: "Revenue, leads, conversion rate", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },

  // ========================================
  // Ops Templates (2)
  // ========================================
  {
    name: "CRM Data Cleanup",
    description: "Identify and fix duplicate contacts, missing fields, and stale records in your CRM.",
    category: "ops",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Open CRM contacts list" },
      { action: "Extract", description: "Identify duplicate contacts by email/phone" },
      { action: "Click", description: "Merge duplicate records" },
      { action: "Extract", description: "Find contacts with missing required fields" },
      { action: "Type", description: "Fill in missing data from available sources" },
      { action: "Verify", description: "Generate cleanup summary report" },
    ],
    estimatedMinutes: 10,
    estimatedCredits: 5,
    requiredSkills: ["browser", "ghl_api"],
    inputs: [
      { label: "CRM Platform", placeholder: "GoHighLevel", required: true },
      { label: "Cleanup Scope", placeholder: "All contacts from last 6 months", required: false },
      { label: "Required Fields", placeholder: "email, phone, name", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
  },
  {
    name: "Client Onboarding Checklist",
    description: "Execute a step-by-step onboarding process for a new client account.",
    category: "ops",
    platform: "General",
    steps: [
      { action: "Navigate", description: "Create new sub-account in GHL" },
      { action: "Type", description: "Set up client profile and branding" },
      { action: "Click", description: "Configure default pipelines and workflows" },
      { action: "Type", description: "Import initial contact list" },
      { action: "Click", description: "Set up tracking and analytics" },
      { action: "Verify", description: "Run checklist verification" },
      { action: "API Call", description: "Send welcome email to client" },
    ],
    estimatedMinutes: 20,
    estimatedCredits: 8,
    requiredSkills: ["browser", "ghl_api", "email"],
    inputs: [
      { label: "Client Name", placeholder: "New Client Inc.", required: true },
      { label: "Client Email", placeholder: "owner@newclient.com", required: true },
      { label: "Industry", placeholder: "Real Estate", required: true },
      { label: "Contact List CSV URL", placeholder: "https://...", required: false },
    ],
    isSeedTemplate: true,
    isActive: true,
    isPublic: false,
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
      steps: JSON.stringify(template.steps),
    });
    inserted++;
  }

  return { inserted, skipped };
}
