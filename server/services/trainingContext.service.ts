/**
 * Training Context Service
 * Loads user's training configuration (workflows, skills, behavior) from knowledge_entries
 * and makes it available during agent execution as part of the system prompt.
 */

import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { knowledgeEntries } from "../../drizzle/schema-agent";
import { serviceLoggers } from "../lib/logger";

const logger = serviceLoggers.rag;

// ========================================
// TYPES
// ========================================

export interface WorkflowStep {
  order: number;
  action: string;
  description: string;
  expectedInput?: string;
  expectedOutput?: string;
}

export interface WorkflowTraining {
  id: number;
  name: string;
  description: string;
  platform: string;
  steps: WorkflowStep[];
}

export interface SkillConfig {
  id: string;
  name: string;
  enabled: boolean;
  permission: "read" | "read-write";
  rateLimit?: number;
}

export interface BehaviorConfig {
  personality: string;
  responseStyle: "professional" | "casual" | "technical";
  verbosity: "concise" | "detailed" | "balanced";
  escalationRules: { condition: string; action: string }[];
  customInstructions?: string;
}

export interface TrainingContext {
  workflows: WorkflowTraining[];
  skills: SkillConfig[];
  behavior: BehaviorConfig | null;
  /** Pre-built prompt fragment ready to inject into agent system prompt */
  promptFragment: string;
}

// ========================================
// DEFAULT VALUES
// ========================================

const DEFAULT_SKILLS: SkillConfig[] = [
  { id: "browser", name: "Browser Automation", enabled: true, permission: "read-write" },
  { id: "ghl_api", name: "GoHighLevel API", enabled: true, permission: "read-write" },
  { id: "email", name: "Email Sending", enabled: true, permission: "read-write" },
  { id: "sms", name: "SMS Messaging", enabled: false, permission: "read" },
  { id: "voice", name: "Voice Calling", enabled: false, permission: "read" },
  { id: "file_creation", name: "File Creation", enabled: true, permission: "read-write" },
  { id: "web_scraping", name: "Web Scraping", enabled: true, permission: "read" },
  { id: "calendar", name: "Calendar Management", enabled: true, permission: "read-write" },
  { id: "crm", name: "CRM Operations", enabled: true, permission: "read-write" },
  { id: "reporting", name: "Report Generation", enabled: true, permission: "read" },
];

// ========================================
// SERVICE
// ========================================

class TrainingContextService {
  /**
   * Load all training context for a user: workflows, skills, behavior.
   * Returns a TrainingContext with a pre-built prompt fragment.
   */
  async loadForUser(userId: number): Promise<TrainingContext> {
    const db = await getDb();
    if (!db) {
      logger.warn("Database not available, returning empty training context");
      return this.emptyContext();
    }

    try {
      // Fetch all active knowledge entries for this user in one query
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, userId),
            eq(knowledgeEntries.isActive, true)
          )
        );

      // Parse by category
      const workflows: WorkflowTraining[] = [];
      let skills: SkillConfig[] = DEFAULT_SKILLS;
      let behavior: BehaviorConfig | null = null;

      for (const row of rows) {
        try {
          switch (row.category) {
            case "workflow_training": {
              const config = JSON.parse(row.content) as {
                name: string;
                description: string;
                platform: string;
                steps: WorkflowStep[];
              };
              workflows.push({ id: row.id, ...config });
              break;
            }
            case "skill_config": {
              const parsed = JSON.parse(row.content) as { skills: SkillConfig[] };
              if (parsed.skills?.length) {
                skills = parsed.skills;
              }
              break;
            }
            case "behavior_config": {
              behavior = JSON.parse(row.content) as BehaviorConfig;
              break;
            }
            // Other categories (workflow, brand_voice, etc.) are ignored here
          }
        } catch {
          logger.warn({ rowId: row.id, category: row.category }, "Failed to parse knowledge entry");
        }
      }

      const promptFragment = this.buildPromptFragment(workflows, skills, behavior);

      logger.info({
        userId,
        workflowCount: workflows.length,
        skillCount: skills.length,
        hasBehavior: !!behavior,
      }, "Training context loaded");

      return { workflows, skills, behavior, promptFragment };
    } catch (error) {
      logger.error({ error, userId }, "Failed to load training context");
      return this.emptyContext();
    }
  }

  /**
   * Build a prompt fragment from training data.
   * This gets injected into the agent's system prompt.
   */
  private buildPromptFragment(
    workflows: WorkflowTraining[],
    skills: SkillConfig[],
    behavior: BehaviorConfig | null
  ): string {
    const sections: string[] = [];

    // Behavior / personality
    if (behavior) {
      sections.push(this.buildBehaviorSection(behavior));
    }

    // Skill permissions
    const enabledSkills = skills.filter((s) => s.enabled);
    const disabledSkills = skills.filter((s) => !s.enabled);
    if (enabledSkills.length > 0 || disabledSkills.length > 0) {
      sections.push(this.buildSkillsSection(enabledSkills, disabledSkills));
    }

    // Trained workflows
    if (workflows.length > 0) {
      sections.push(this.buildWorkflowsSection(workflows));
    }

    if (sections.length === 0) {
      return "";
    }

    return `\n\n<training_context>\n${sections.join("\n\n")}\n</training_context>`;
  }

  private buildBehaviorSection(behavior: BehaviorConfig): string {
    let section = `**Agent Behavior Configuration**\n`;
    section += `- Personality: ${behavior.personality}\n`;
    section += `- Response style: ${behavior.responseStyle}\n`;
    section += `- Verbosity: ${behavior.verbosity}\n`;

    if (behavior.customInstructions) {
      section += `- Custom instructions: ${behavior.customInstructions}\n`;
    }

    if (behavior.escalationRules.length > 0) {
      section += `\n**Escalation Rules** (MUST follow):\n`;
      for (const rule of behavior.escalationRules) {
        section += `- When: "${rule.condition}" → ${rule.action}\n`;
      }
    }

    return section;
  }

  private buildSkillsSection(
    enabled: SkillConfig[],
    disabled: SkillConfig[]
  ): string {
    let section = `**Skill Permissions**\n`;
    section += `Enabled: ${enabled.map((s) => `${s.name} (${s.permission})`).join(", ")}\n`;
    if (disabled.length > 0) {
      section += `Disabled (DO NOT use): ${disabled.map((s) => s.name).join(", ")}\n`;
    }
    return section;
  }

  private buildWorkflowsSection(workflows: WorkflowTraining[]): string {
    let section = `**Trained Workflows** (follow these exact steps when the task matches):\n`;

    for (const wf of workflows) {
      section += `\n### ${wf.name} [${wf.platform}]\n`;
      section += `${wf.description}\n`;
      section += `Steps:\n`;
      for (const step of wf.steps) {
        section += `  ${step.order + 1}. ${step.action}: ${step.description}\n`;
        if (step.expectedInput) section += `     Input: ${step.expectedInput}\n`;
        if (step.expectedOutput) section += `     Expected output: ${step.expectedOutput}\n`;
      }
    }

    return section;
  }

  private emptyContext(): TrainingContext {
    return {
      workflows: [],
      skills: DEFAULT_SKILLS,
      behavior: null,
      promptFragment: "",
    };
  }
}

export const trainingContextService = new TrainingContextService();
