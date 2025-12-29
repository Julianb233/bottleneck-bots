/**
 * Agent Knowledge Base Loader
 *
 * Loads platform-specific knowledge for agents to use as context.
 * Each agent can be configured with expertise in multiple platforms.
 */

import fs from "fs";
import path from "path";

// Knowledge base file paths
const KNOWLEDGE_DIR = path.join(process.cwd(), "lib/knowledge");

// Available integrations with their metadata
export const INTEGRATION_METADATA: Record<
  string,
  {
    name: string;
    description: string;
    icon: string;
    category: "crm" | "automation" | "browser" | "productivity" | "marketing";
    capabilities: string[];
  }
> = {
  stagehand: {
    name: "Stagehand",
    description: "AI-powered web automation with natural language control",
    icon: "🎭",
    category: "browser",
    capabilities: [
      "Natural language web automation",
      "Structured data extraction",
      "Form filling and submission",
      "Multi-step workflows",
      "Screenshot capture",
    ],
  },
  browserbase: {
    name: "Browserbase",
    description: "Cloud browser infrastructure for web automation",
    icon: "🌐",
    category: "browser",
    capabilities: [
      "Cloud browser sessions",
      "Playwright automation",
      "Session persistence",
      "Proxy rotation",
      "Screenshot and PDF generation",
    ],
  },
  gohighlevel: {
    name: "GoHighLevel",
    description: "All-in-one marketing and CRM platform",
    icon: "🚀",
    category: "crm",
    capabilities: [
      "Contact management",
      "Opportunity tracking",
      "SMS and email messaging",
      "Calendar and appointments",
      "Workflow automation",
      "Pipeline management",
    ],
  },
  hubspot: {
    name: "HubSpot",
    description: "Comprehensive CRM with marketing, sales, and service hubs",
    icon: "🧡",
    category: "crm",
    capabilities: [
      "Contact and company management",
      "Deal tracking",
      "Email logging",
      "Task management",
      "Workflow enrollment",
      "Custom properties",
    ],
  },
  clickup: {
    name: "ClickUp",
    description: "Project management and productivity platform",
    icon: "✅",
    category: "productivity",
    capabilities: [
      "Task creation and management",
      "Space and folder organization",
      "Time tracking",
      "Comments and checklists",
      "Custom fields",
      "Goal tracking",
    ],
  },
  salesforce: {
    name: "Salesforce",
    description: "Enterprise CRM platform",
    icon: "☁️",
    category: "crm",
    capabilities: [
      "Account and contact management",
      "Lead processing and conversion",
      "Opportunity tracking",
      "Case management",
      "SOQL queries",
      "Custom objects",
    ],
  },
  zapier: {
    name: "Zapier",
    description: "App integration and workflow automation",
    icon: "⚡",
    category: "automation",
    capabilities: [
      "Webhook integration",
      "Multi-app workflows",
      "Event triggering",
      "Data transformation",
      "Conditional logic",
    ],
  },
};

// Cache for loaded knowledge
const knowledgeCache = new Map<string, string>();

/**
 * Load knowledge content for a specific integration
 */
export function loadKnowledge(integration: string): string | null {
  // Check cache first
  if (knowledgeCache.has(integration)) {
    return knowledgeCache.get(integration)!;
  }

  const filePath = path.join(KNOWLEDGE_DIR, `${integration}.md`);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      knowledgeCache.set(integration, content);
      return content;
    }
  } catch (error) {
    console.error(`Failed to load knowledge for ${integration}:`, error);
  }

  return null;
}

/**
 * Get combined knowledge for an agent based on their expertise
 */
export function getKnowledgeForAgent(expertise: string[]): string {
  const knowledgeParts: string[] = [];

  for (const integration of expertise) {
    const knowledge = loadKnowledge(integration);
    if (knowledge) {
      const metadata = INTEGRATION_METADATA[integration];
      knowledgeParts.push(
        `## ${metadata?.name || integration} Knowledge\n\n${knowledge}`
      );
    }
  }

  if (knowledgeParts.length === 0) {
    return "";
  }

  return `# Agent Integration Knowledge\n\nYou have expertise in the following platforms:\n\n${knowledgeParts.join("\n\n---\n\n")}`;
}

/**
 * Get a summary of available integrations
 */
export function getIntegrationSummary(integration: string): string {
  const metadata = INTEGRATION_METADATA[integration];
  if (!metadata) return "";

  return `${metadata.icon} **${metadata.name}**: ${metadata.description}\nCapabilities: ${metadata.capabilities.join(", ")}`;
}

/**
 * Get all available integrations
 */
export function getAvailableIntegrations(): string[] {
  return Object.keys(INTEGRATION_METADATA);
}

/**
 * Get integrations by category
 */
export function getIntegrationsByCategory(
  category: "crm" | "automation" | "browser" | "productivity" | "marketing"
): string[] {
  return Object.entries(INTEGRATION_METADATA)
    .filter(([_, meta]) => meta.category === category)
    .map(([key]) => key);
}

/**
 * Build system prompt additions for agent expertise
 */
export function buildExpertisePrompt(expertise: string[]): string {
  if (expertise.length === 0) return "";

  const summaries = expertise
    .map((int) => getIntegrationSummary(int))
    .filter(Boolean);

  return `
## Your Integration Expertise

You are an expert in the following platforms and can help users with:

${summaries.join("\n\n")}

When working with these platforms:
1. Use the API patterns and best practices from your knowledge base
2. Handle authentication and rate limits appropriately
3. Provide clear explanations of what you're doing
4. Offer to help with common operations specific to each platform
`;
}

/**
 * Extract API endpoints from knowledge for a platform
 */
export function getCommonOperations(
  integration: string
): { name: string; description: string }[] {
  const operations: Record<string, { name: string; description: string }[]> = {
    gohighlevel: [
      { name: "Create Contact", description: "Add a new contact to GHL" },
      { name: "Create Opportunity", description: "Create a deal in pipeline" },
      { name: "Send SMS", description: "Send text message to contact" },
      { name: "Book Appointment", description: "Schedule a calendar event" },
      { name: "Trigger Workflow", description: "Start automation workflow" },
    ],
    hubspot: [
      { name: "Create Contact", description: "Add contact to HubSpot CRM" },
      { name: "Create Deal", description: "Create new deal/opportunity" },
      { name: "Search Contacts", description: "Find contacts by criteria" },
      { name: "Create Task", description: "Add follow-up task" },
      { name: "Log Activity", description: "Record email/call/note" },
    ],
    clickup: [
      { name: "Create Task", description: "Add task to a list" },
      { name: "Update Task", description: "Modify task properties" },
      { name: "Add Comment", description: "Comment on a task" },
      { name: "Track Time", description: "Log time on task" },
      { name: "Create Subtask", description: "Add subtask to parent" },
    ],
    salesforce: [
      { name: "Create Lead", description: "Add new lead record" },
      { name: "Convert Lead", description: "Convert lead to opportunity" },
      { name: "Query Records", description: "Search with SOQL" },
      { name: "Create Task", description: "Add follow-up task" },
      { name: "Update Record", description: "Modify any object" },
    ],
    stagehand: [
      { name: "Navigate", description: "Go to a URL" },
      { name: "Act", description: "Perform action with natural language" },
      { name: "Extract", description: "Get structured data from page" },
      { name: "Observe", description: "Find available actions" },
      { name: "Screenshot", description: "Capture page image" },
    ],
    browserbase: [
      { name: "Create Session", description: "Start cloud browser" },
      { name: "Navigate", description: "Go to URL" },
      { name: "Fill Form", description: "Enter form data" },
      { name: "Click", description: "Click element" },
      { name: "Extract", description: "Get page content" },
    ],
    zapier: [
      { name: "Send Webhook", description: "Trigger Zapier workflow" },
      { name: "Receive Hook", description: "Accept Zapier POST" },
      { name: "Format Data", description: "Transform for Zapier" },
    ],
  };

  return operations[integration] || [];
}

export type IntegrationKey = keyof typeof INTEGRATION_METADATA;
