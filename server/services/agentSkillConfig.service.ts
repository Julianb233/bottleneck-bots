/**
 * Agent Skill Configuration Service
 * Maps tools to skills, enforces skill-based access control, and tracks skill usage.
 *
 * Integration points:
 * - Called by AgentOrchestrator before each tool execution
 * - Reads skill config from knowledge_entries (via agentTraining router pattern)
 * - Writes skill usage analytics to knowledge_entries (category='skill_usage')
 *
 * Skill -> Tool mapping:
 *   browser        -> browser_*, stagehand_*
 *   ghl_api        -> http_request (GHL), ghl_*
 *   email          -> send_email, email_*
 *   sms            -> send_sms, sms_*
 *   voice          -> make_call, voice_*, ai_calling_*
 *   file_creation  -> file_write, file_edit, file_create
 *   web_scraping   -> browser_extract, browser_screenshot, scrape_*
 *   calendar       -> calendar_*, schedule_*
 *   crm            -> store_data, retrieve_data, update_record, delete_record
 *   reporting      -> generate_report, analytics_*
 */

import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { knowledgeEntries } from "../../drizzle/schema-agent";

// ========================================
// TYPES
// ========================================

export interface SkillDefinition {
  id: string;
  name: string;
  enabled: boolean;
  permission: "read" | "read-write";
  rateLimit?: number; // max executions per hour
}

export interface SkillCheckResult {
  allowed: boolean;
  reason?: string;
  skillId: string;
  skillName: string;
  permission: "read" | "read-write";
}

export interface SkillUsageRecord {
  skillId: string;
  toolName: string;
  success: boolean;
  timestamp: string;
  durationMs?: number;
}

export interface SkillAnalytics {
  skillId: string;
  skillName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number;
  lastUsed: string | null;
  topTools: Array<{ toolName: string; count: number }>;
}

// ========================================
// TOOL -> SKILL MAPPING
// ========================================

/**
 * Maps a tool name to its parent skill ID.
 * Uses prefix matching for efficiency.
 */
const TOOL_SKILL_MAP: Record<string, string> = {
  // Browser automation
  browser_navigate: "browser",
  browser_click: "browser",
  browser_type: "browser",
  browser_select: "browser",
  browser_scroll: "browser",
  browser_wait: "browser",
  browser_close: "browser",
  browser_create_session: "browser",
  stagehand_act: "browser",
  stagehand_extract: "browser",
  stagehand_observe: "browser",
  stagehand_navigate: "browser",

  // GHL API
  ghl_create_contact: "ghl_api",
  ghl_update_contact: "ghl_api",
  ghl_search_contacts: "ghl_api",
  ghl_create_opportunity: "ghl_api",
  ghl_update_opportunity: "ghl_api",
  ghl_send_message: "ghl_api",
  ghl_create_task: "ghl_api",

  // Email
  send_email: "email",
  email_send: "email",
  email_draft: "email",

  // SMS
  send_sms: "sms",
  sms_send: "sms",

  // Voice
  make_call: "voice",
  voice_call: "voice",
  ai_calling_start: "voice",
  ai_calling_transfer: "voice",

  // File creation
  file_write: "file_creation",
  file_edit: "file_creation",
  file_create: "file_creation",

  // Web scraping
  browser_extract: "web_scraping",
  browser_screenshot: "web_scraping",
  scrape_page: "web_scraping",

  // Calendar
  calendar_create: "calendar",
  calendar_update: "calendar",
  calendar_delete: "calendar",
  schedule_appointment: "calendar",

  // CRM
  store_data: "crm",
  retrieve_data: "crm",
  update_record: "crm",
  delete_record: "crm",

  // Reporting
  generate_report: "reporting",
  analytics_query: "reporting",
};

/** Prefix-based fallback mapping */
const TOOL_SKILL_PREFIXES: Array<{ prefix: string; skillId: string }> = [
  { prefix: "browser_", skillId: "browser" },
  { prefix: "stagehand_", skillId: "browser" },
  { prefix: "ghl_", skillId: "ghl_api" },
  { prefix: "email_", skillId: "email" },
  { prefix: "sms_", skillId: "sms" },
  { prefix: "voice_", skillId: "voice" },
  { prefix: "ai_calling_", skillId: "voice" },
  { prefix: "file_", skillId: "file_creation" },
  { prefix: "scrape_", skillId: "web_scraping" },
  { prefix: "calendar_", skillId: "calendar" },
  { prefix: "schedule_", skillId: "calendar" },
  { prefix: "analytics_", skillId: "reporting" },
];

/** Read-only tools that are allowed even when a skill is set to read-only */
const READ_ONLY_TOOLS = new Set([
  "browser_navigate",
  "browser_extract",
  "browser_screenshot",
  "browser_scroll",
  "browser_wait",
  "retrieve_data",
  "file_read",
  "file_list",
  "file_search",
  "retrieve_documentation",
  "ghl_search_contacts",
  "stagehand_extract",
  "stagehand_observe",
  "analytics_query",
]);

// ========================================
// DEFAULT SKILLS
// ========================================

const DEFAULT_SKILLS: SkillDefinition[] = [
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

export class AgentSkillConfigService {
  /**
   * Resolve which skill a tool belongs to. Returns null if the tool
   * doesn't map to any configurable skill (e.g. internal tools like
   * update_plan, advance_phase, ask_user).
   */
  resolveToolSkill(toolName: string): string | null {
    // Exact match first
    if (TOOL_SKILL_MAP[toolName]) {
      return TOOL_SKILL_MAP[toolName];
    }

    // Prefix-based fallback
    for (const { prefix, skillId } of TOOL_SKILL_PREFIXES) {
      if (toolName.startsWith(prefix)) {
        return skillId;
      }
    }

    return null;
  }

  /**
   * Load the user's skill configuration from the database.
   * Returns DEFAULT_SKILLS if no custom config is found.
   */
  async getUserSkillConfig(userId: number): Promise<SkillDefinition[]> {
    const db = await getDb();
    if (!db) return DEFAULT_SKILLS;

    try {
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, userId),
            eq(knowledgeEntries.category, "skill_config"),
            eq(knowledgeEntries.isActive, true)
          )
        )
        .limit(1);

      if (rows.length === 0) return DEFAULT_SKILLS;

      try {
        const parsed = JSON.parse(rows[0].content) as { skills: SkillDefinition[] };
        return parsed.skills ?? DEFAULT_SKILLS;
      } catch {
        return DEFAULT_SKILLS;
      }
    } catch {
      return DEFAULT_SKILLS;
    }
  }

  /**
   * Check whether a specific tool execution is allowed given the user's skill config.
   *
   * Rules:
   * 1. If the tool doesn't map to a skill, it's allowed (internal tools).
   * 2. If the mapped skill is disabled, the tool is blocked.
   * 3. If the skill is read-only and the tool is a write operation, it's blocked.
   * 4. Rate limits are checked if configured.
   */
  async checkSkillPermission(
    userId: number,
    toolName: string
  ): Promise<SkillCheckResult> {
    const skillId = this.resolveToolSkill(toolName);

    // Tool doesn't map to any skill — allow
    if (!skillId) {
      return {
        allowed: true,
        skillId: "_internal",
        skillName: "Internal",
        permission: "read-write",
      };
    }

    const skills = await this.getUserSkillConfig(userId);
    const skill = skills.find((s) => s.id === skillId);

    // Skill not in config — allow by default (forward compatibility)
    if (!skill) {
      return {
        allowed: true,
        skillId,
        skillName: skillId,
        permission: "read-write",
      };
    }

    // Skill disabled
    if (!skill.enabled) {
      return {
        allowed: false,
        reason: `Skill "${skill.name}" is disabled. Enable it in Agent Training > Skills to use this capability.`,
        skillId: skill.id,
        skillName: skill.name,
        permission: skill.permission,
      };
    }

    // Permission: read-only skills can only use read-only tools
    if (skill.permission === "read" && !READ_ONLY_TOOLS.has(toolName)) {
      return {
        allowed: false,
        reason: `Skill "${skill.name}" is set to read-only. The tool "${toolName}" requires read-write permission. Update the skill permission to "Read-Write" to allow this action.`,
        skillId: skill.id,
        skillName: skill.name,
        permission: skill.permission,
      };
    }

    // Rate limit check
    if (skill.rateLimit && skill.rateLimit > 0) {
      const withinLimit = await this.checkRateLimit(userId, skillId, skill.rateLimit);
      if (!withinLimit) {
        return {
          allowed: false,
          reason: `Skill "${skill.name}" has reached its rate limit of ${skill.rateLimit} executions per hour. Try again later or increase the rate limit.`,
          skillId: skill.id,
          skillName: skill.name,
          permission: skill.permission,
        };
      }
    }

    return {
      allowed: true,
      skillId: skill.id,
      skillName: skill.name,
      permission: skill.permission,
    };
  }

  /**
   * Check rate limit for a skill by counting recent usage records.
   */
  private async checkRateLimit(
    userId: number,
    skillId: string,
    maxPerHour: number
  ): Promise<boolean> {
    const db = await getDb();
    if (!db) return true;

    try {
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, userId),
            eq(knowledgeEntries.category, "skill_usage"),
            eq(knowledgeEntries.context, skillId),
            eq(knowledgeEntries.isActive, true)
          )
        )
        .limit(1);

      if (rows.length === 0) return true;

      try {
        const usage = JSON.parse(rows[0].content) as { records: SkillUsageRecord[] };
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentCount = (usage.records || []).filter(
          (r) => r.timestamp > oneHourAgo
        ).length;
        return recentCount < maxPerHour;
      } catch {
        return true;
      }
    } catch {
      return true;
    }
  }

  /**
   * Record a skill usage event for analytics tracking.
   */
  async recordSkillUsage(
    userId: number,
    toolName: string,
    success: boolean,
    durationMs?: number
  ): Promise<void> {
    const skillId = this.resolveToolSkill(toolName);
    if (!skillId) return; // Don't track internal tools

    const db = await getDb();
    if (!db) return;

    const record: SkillUsageRecord = {
      skillId,
      toolName,
      success,
      timestamp: new Date().toISOString(),
      durationMs,
    };

    try {
      // Load existing usage data for this skill
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, userId),
            eq(knowledgeEntries.category, "skill_usage"),
            eq(knowledgeEntries.context, skillId),
            eq(knowledgeEntries.isActive, true)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        // Create new usage record
        await db.insert(knowledgeEntries).values({
          userId,
          category: "skill_usage",
          context: skillId,
          content: JSON.stringify({ records: [record] }),
          isActive: true,
        });
      } else {
        // Append to existing — keep last 1000 records per skill
        let existing: { records: SkillUsageRecord[] } = { records: [] };
        try {
          existing = JSON.parse(rows[0].content) as { records: SkillUsageRecord[] };
        } catch {
          existing = { records: [] };
        }

        const records = [...(existing.records || []), record].slice(-1000);

        await db
          .update(knowledgeEntries)
          .set({
            content: JSON.stringify({ records }),
          })
          .where(eq(knowledgeEntries.id, rows[0].id));
      }
    } catch (error) {
      // Non-critical — log but don't throw
      console.error("[SkillConfig] Failed to record skill usage:", error);
    }
  }

  /**
   * Get skill usage analytics for a user.
   * Returns per-skill metrics including execution count, success rate, etc.
   */
  async getSkillAnalytics(userId: number): Promise<SkillAnalytics[]> {
    const db = await getDb();
    if (!db) return [];

    const skills = await this.getUserSkillConfig(userId);

    try {
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, userId),
            eq(knowledgeEntries.category, "skill_usage"),
            eq(knowledgeEntries.isActive, true)
          )
        );

      const usageBySkill = new Map<string, SkillUsageRecord[]>();
      for (const row of rows) {
        try {
          const data = JSON.parse(row.content) as { records: SkillUsageRecord[] };
          usageBySkill.set(row.context, data.records || []);
        } catch {
          // skip corrupt rows
        }
      }

      return skills.map((skill) => {
        const records = usageBySkill.get(skill.id) || [];
        const successCount = records.filter((r) => r.success).length;
        const failureCount = records.filter((r) => !r.success).length;
        const totalDuration = records.reduce((sum, r) => sum + (r.durationMs || 0), 0);
        const withDuration = records.filter((r) => r.durationMs != null);

        // Count tool usage
        const toolCounts = new Map<string, number>();
        for (const r of records) {
          toolCounts.set(r.toolName, (toolCounts.get(r.toolName) || 0) + 1);
        }
        const topTools = Array.from(toolCounts.entries())
          .map(([toolName, count]) => ({ toolName, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const lastRecord = records.length > 0 ? records[records.length - 1] : null;

        return {
          skillId: skill.id,
          skillName: skill.name,
          totalExecutions: records.length,
          successCount,
          failureCount,
          successRate: records.length > 0 ? (successCount / records.length) * 100 : 0,
          avgDurationMs: withDuration.length > 0 ? totalDuration / withDuration.length : 0,
          lastUsed: lastRecord?.timestamp ?? null,
          topTools,
        };
      });
    } catch (error) {
      console.error("[SkillConfig] Failed to get skill analytics:", error);
      return [];
    }
  }
}

// ========================================
// SINGLETON
// ========================================

let instance: AgentSkillConfigService | null = null;

export function getAgentSkillConfigService(): AgentSkillConfigService {
  if (!instance) {
    instance = new AgentSkillConfigService();
  }
  return instance;
}
