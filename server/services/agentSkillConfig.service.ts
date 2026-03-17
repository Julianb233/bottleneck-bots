/**
 * Agent Skill Configuration Service
 *
 * Checks agent skill configuration before executing tools.
 * Maps tool names to skill IDs, checks if skills are enabled,
 * verifies permission levels, and enforces rate limits.
 *
 * Used by the Agent Orchestrator to gate tool execution.
 */

import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { knowledgeEntries } from "../../drizzle/schema-agent";

// ========================================
// TYPES
// ========================================

export interface SkillConfig {
  id: string;
  name: string;
  enabled: boolean;
  permission: "read" | "read-write";
  rateLimit?: number;
}

export interface SkillCheckResult {
  allowed: boolean;
  reason?: string;
  skillId: string;
  permission: "read" | "read-write";
}

// ========================================
// TOOL-TO-SKILL MAPPING
// ========================================

/**
 * Maps tool names to their corresponding skill IDs.
 * Tools not in this map are allowed by default (no skill gating).
 */
const TOOL_TO_SKILL: Record<string, string> = {
  // Browser Automation
  browser_navigate: "browser",
  browser_click: "browser",
  browser_type: "browser",
  browser_extract: "browser",
  browser_screenshot: "browser",
  browser_scroll: "browser",
  browser_select: "browser",
  browser_wait: "browser",
  browser_close: "browser",
  browser_create_session: "browser",

  // GHL API
  http_request: "ghl_api",
  ghl_create_contact: "ghl_api",
  ghl_update_contact: "ghl_api",
  ghl_search_contacts: "ghl_api",
  ghl_create_opportunity: "ghl_api",
  ghl_update_opportunity: "ghl_api",
  ghl_list_pipelines: "ghl_api",

  // Email
  ghl_send_email: "email",
  send_email: "email",

  // SMS
  send_sms: "sms",
  ghl_send_sms: "sms",

  // Voice
  voice_call: "voice",
  make_call: "voice",

  // File Creation
  file_write: "file_creation",
  file_edit: "file_creation",

  // Web Scraping (read-only file/data ops)
  file_read: "web_scraping",
  file_list: "web_scraping",
  file_search: "web_scraping",
  retrieve_data: "web_scraping",
  retrieve_documentation: "web_scraping",

  // Calendar
  calendar_create: "calendar",
  calendar_update: "calendar",
  calendar_list: "calendar",
  calendar_delete: "calendar",

  // CRM
  store_data: "crm",

  // Reporting
  update_plan: "reporting",
  advance_phase: "reporting",
};

/**
 * Determines if a tool operation is a write operation.
 * Write operations require "read-write" permission on the skill.
 */
const WRITE_TOOLS = new Set([
  "browser_click",
  "browser_type",
  "browser_select",
  "browser_scroll",
  "browser_close",
  "browser_create_session",
  "http_request",
  "ghl_create_contact",
  "ghl_update_contact",
  "ghl_create_opportunity",
  "ghl_update_opportunity",
  "ghl_send_email",
  "send_email",
  "send_sms",
  "ghl_send_sms",
  "voice_call",
  "make_call",
  "file_write",
  "file_edit",
  "calendar_create",
  "calendar_update",
  "calendar_delete",
  "store_data",
]);

// ========================================
// DEFAULT SKILLS
// ========================================

const DEFAULT_SKILLS: SkillConfig[] = [
  { id: "browser", name: "Browser Automation", enabled: true, permission: "read-write", rateLimit: 100 },
  { id: "ghl_api", name: "GoHighLevel API", enabled: true, permission: "read-write", rateLimit: 200 },
  { id: "email", name: "Email Sending", enabled: true, permission: "read-write", rateLimit: 50 },
  { id: "sms", name: "SMS Messaging", enabled: false, permission: "read", rateLimit: 50 },
  { id: "voice", name: "Voice Calling", enabled: false, permission: "read", rateLimit: 20 },
  { id: "file_creation", name: "File Creation", enabled: true, permission: "read-write", rateLimit: 100 },
  { id: "web_scraping", name: "Web Scraping", enabled: true, permission: "read", rateLimit: 100 },
  { id: "calendar", name: "Calendar Management", enabled: true, permission: "read-write", rateLimit: 50 },
  { id: "crm", name: "CRM Operations", enabled: true, permission: "read-write", rateLimit: 200 },
  { id: "reporting", name: "Report Generation", enabled: true, permission: "read", rateLimit: 30 },
];

// ========================================
// RATE LIMIT TRACKING (in-memory)
// ========================================

interface RateLimitEntry {
  count: number;
  windowStart: number; // timestamp ms
}

// userId -> skillId -> RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getRateLimitKey(userId: number, skillId: string): string {
  return `${userId}:${skillId}`;
}

function checkRateLimit(userId: number, skillId: string, limit: number): { allowed: boolean; remaining: number } {
  const key = getRateLimitKey(userId, skillId);
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Start new window
    entry = { count: 0, windowStart: now };
    rateLimitStore.set(key, entry);
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

function incrementRateLimit(userId: number, skillId: string): void {
  const key = getRateLimitKey(userId, skillId);
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 1, windowStart: now };
  } else {
    entry.count++;
  }

  rateLimitStore.set(key, entry);
}

// ========================================
// SERVICE CLASS
// ========================================

export class AgentSkillConfigService {
  private skillConfigCache = new Map<number, { skills: SkillConfig[]; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the skill ID for a given tool name.
   * Returns null if the tool is not mapped to any skill (i.e., ungated).
   */
  getSkillForTool(toolName: string): string | null {
    return TOOL_TO_SKILL[toolName] ?? null;
  }

  /**
   * Determine if a tool performs write operations.
   */
  isWriteOperation(toolName: string): boolean {
    return WRITE_TOOLS.has(toolName);
  }

  /**
   * Load skill config for a user. Uses a short-lived cache to avoid
   * hitting the DB on every tool call within an execution.
   */
  async getSkillConfig(userId: number): Promise<SkillConfig[]> {
    // Check cache
    const cached = this.skillConfigCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.skills;
    }

    const db = await getDb();
    if (!db) {
      return DEFAULT_SKILLS;
    }

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

      let skills: SkillConfig[] = DEFAULT_SKILLS;

      if (rows.length > 0) {
        try {
          const parsed = JSON.parse(rows[0].content) as { skills: SkillConfig[] };
          if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
            skills = parsed.skills;
          }
        } catch {
          // Corrupt JSON -- use defaults
        }
      }

      this.skillConfigCache.set(userId, { skills, cachedAt: Date.now() });
      return skills;
    } catch {
      return DEFAULT_SKILLS;
    }
  }

  /**
   * Invalidate the skill config cache for a user (e.g., after updating config).
   */
  invalidateCache(userId: number): void {
    this.skillConfigCache.delete(userId);
  }

  /**
   * Check if a tool execution is allowed based on the user's skill config.
   *
   * Checks:
   * 1. Is the skill for this tool enabled?
   * 2. Does the permission level allow this type of operation (read vs write)?
   * 3. Is the rate limit exceeded?
   *
   * Returns SkillCheckResult with allowed=true if the tool can execute.
   * Tools not mapped to any skill are always allowed.
   */
  async checkToolAllowed(userId: number, toolName: string): Promise<SkillCheckResult> {
    const skillId = this.getSkillForTool(toolName);

    // Tools not mapped to a skill are ungated
    if (!skillId) {
      return {
        allowed: true,
        skillId: "ungated",
        permission: "read-write",
      };
    }

    const skills = await this.getSkillConfig(userId);
    const skillConfig = skills.find((s) => s.id === skillId);

    // If skill not found in config, use defaults
    if (!skillConfig) {
      return {
        allowed: true,
        skillId,
        permission: "read-write",
      };
    }

    // Check 1: Is skill enabled?
    if (!skillConfig.enabled) {
      return {
        allowed: false,
        reason: `Skill "${skillConfig.name}" is disabled. Enable it in Training > Skills to use ${toolName}.`,
        skillId,
        permission: skillConfig.permission,
      };
    }

    // Check 2: Permission level
    const isWrite = this.isWriteOperation(toolName);
    if (isWrite && skillConfig.permission === "read") {
      return {
        allowed: false,
        reason: `Skill "${skillConfig.name}" is set to read-only. Tool "${toolName}" requires read-write permission.`,
        skillId,
        permission: skillConfig.permission,
      };
    }

    // Check 3: Rate limit
    if (skillConfig.rateLimit) {
      const rateLimitResult = checkRateLimit(userId, skillId, skillConfig.rateLimit);
      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: `Rate limit exceeded for skill "${skillConfig.name}" (${skillConfig.rateLimit}/hour). Try again later.`,
          skillId,
          permission: skillConfig.permission,
        };
      }
    }

    return {
      allowed: true,
      skillId,
      permission: skillConfig.permission,
    };
  }

  /**
   * Record that a tool was used (for rate limiting).
   * Call this AFTER successful tool execution.
   */
  recordToolUsage(userId: number, toolName: string): void {
    const skillId = this.getSkillForTool(toolName);
    if (skillId) {
      incrementRateLimit(userId, skillId);
    }
  }
}

// ========================================
// SINGLETON
// ========================================

let skillConfigServiceInstance: AgentSkillConfigService | null = null;

export function getAgentSkillConfigService(): AgentSkillConfigService {
  if (!skillConfigServiceInstance) {
    skillConfigServiceInstance = new AgentSkillConfigService();
  }
  return skillConfigServiceInstance;
}

// Alias for backward compatibility
export const getSkillConfigService = getAgentSkillConfigService;
