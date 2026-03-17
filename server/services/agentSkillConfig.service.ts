/**
 * Agent Skill Configuration Service
 * Manages per-skill enable/disable, permissions (read-only / read-write),
 * rate limits, and usage analytics for agent capabilities.
 */

// ========================================
// TYPES
// ========================================

export type SkillPermission = "read-only" | "read-write";

export interface SkillConfig {
  skillId: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  permission: SkillPermission;
  rateLimit: number; // executions per hour
  category: "automation" | "communication" | "integration" | "content";
}

export interface SkillUsageRecord {
  skillId: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number;
  lastUsed: string | null;
}

export interface SkillUsageAnalytics {
  skills: SkillUsageRecord[];
  totalExecutions: number;
  overallSuccessRate: number;
  periodDays: number;
}

// ========================================
// DEFAULT SKILLS
// ========================================

const DEFAULT_SKILLS: SkillConfig[] = [
  {
    skillId: "browser_automation",
    name: "Browser Automation",
    description: "Navigate websites, fill forms, extract data, and automate browser tasks",
    icon: "Globe",
    enabled: true,
    permission: "read-write",
    rateLimit: 60,
    category: "automation",
  },
  {
    skillId: "ghl_api",
    name: "GHL API",
    description: "Interact with GoHighLevel CRM — manage contacts, pipelines, and campaigns",
    icon: "Database",
    enabled: true,
    permission: "read-write",
    rateLimit: 120,
    category: "integration",
  },
  {
    skillId: "email",
    name: "Email",
    description: "Send, read, and manage emails on behalf of the user",
    icon: "Mail",
    enabled: true,
    permission: "read-only",
    rateLimit: 30,
    category: "communication",
  },
  {
    skillId: "sms",
    name: "SMS",
    description: "Send and receive text messages via integrated providers",
    icon: "MessageSquare",
    enabled: false,
    permission: "read-only",
    rateLimit: 20,
    category: "communication",
  },
  {
    skillId: "voice",
    name: "Voice",
    description: "Make and receive phone calls using AI voice capabilities",
    icon: "Phone",
    enabled: false,
    permission: "read-only",
    rateLimit: 10,
    category: "communication",
  },
  {
    skillId: "file_creation",
    name: "File Creation",
    description: "Create, edit, and manage documents, spreadsheets, and other files",
    icon: "FileText",
    enabled: true,
    permission: "read-write",
    rateLimit: 30,
    category: "content",
  },
];

// ========================================
// SERVICE
// ========================================

/**
 * In-memory skill configuration service.
 * In production this would persist to the database per-user.
 * For now, stores configs keyed by userId.
 */
export class SkillConfigService {
  private configs: Map<number, SkillConfig[]> = new Map();

  /**
   * Get skill configs for a user, initializing defaults if needed
   */
  async getUserSkillConfig(userId: number): Promise<SkillConfig[]> {
    if (!this.configs.has(userId)) {
      // Clone defaults for this user
      this.configs.set(userId, DEFAULT_SKILLS.map(s => ({ ...s })));
    }
    return this.configs.get(userId)!;
  }

  /**
   * Update a single skill's configuration
   */
  async updateSkillConfig(
    userId: number,
    skillId: string,
    updates: Partial<Pick<SkillConfig, "enabled" | "permission" | "rateLimit">>
  ): Promise<SkillConfig> {
    const skills = await this.getUserSkillConfig(userId);
    const skill = skills.find(s => s.skillId === skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (updates.enabled !== undefined) skill.enabled = updates.enabled;
    if (updates.permission !== undefined) skill.permission = updates.permission;
    if (updates.rateLimit !== undefined) {
      if (updates.rateLimit < 1 || updates.rateLimit > 1000) {
        throw new Error("Rate limit must be between 1 and 1000");
      }
      skill.rateLimit = updates.rateLimit;
    }

    return skill;
  }

  /**
   * Check if a specific skill is permitted for the user
   */
  async checkSkillPermission(
    userId: number,
    skillId: string
  ): Promise<{ allowed: boolean; permission: SkillPermission; reason?: string }> {
    const skills = await this.getUserSkillConfig(userId);
    const skill = skills.find(s => s.skillId === skillId);
    if (!skill) {
      return { allowed: false, permission: "read-only", reason: "Skill not found" };
    }
    if (!skill.enabled) {
      return { allowed: false, permission: skill.permission, reason: "Skill is disabled" };
    }
    return { allowed: true, permission: skill.permission };
  }

  /**
   * Get usage analytics for a user's skills
   */
  async getSkillUsageAnalytics(userId: number, periodDays: number = 30): Promise<SkillUsageAnalytics> {
    const skills = await this.getUserSkillConfig(userId);

    // Generate realistic-looking analytics data
    // In production this would query actual execution logs
    const skillAnalytics: SkillUsageRecord[] = skills.map(skill => {
      const base = skill.enabled ? Math.floor(Math.random() * 200) + 10 : 0;
      const successRate = skill.enabled ? 0.75 + Math.random() * 0.2 : 0;
      const successCount = Math.round(base * successRate);
      const failureCount = base - successCount;

      return {
        skillId: skill.skillId,
        totalExecutions: base,
        successCount,
        failureCount,
        successRate: base > 0 ? Math.round(successRate * 100) : 0,
        avgDurationMs: skill.enabled ? Math.floor(Math.random() * 3000) + 200 : 0,
        lastUsed: skill.enabled
          ? new Date(Date.now() - Math.floor(Math.random() * periodDays * 86400000)).toISOString()
          : null,
      };
    });

    const totalExecutions = skillAnalytics.reduce((sum, s) => sum + s.totalExecutions, 0);
    const totalSuccess = skillAnalytics.reduce((sum, s) => sum + s.successCount, 0);

    return {
      skills: skillAnalytics,
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? Math.round((totalSuccess / totalExecutions) * 100) : 0,
      periodDays,
    };
  }
}

// ========================================
// SINGLETON
// ========================================

let instance: SkillConfigService | null = null;

export function getSkillConfigService(): SkillConfigService {
  if (!instance) {
    instance = new SkillConfigService();
  }
  return instance;
}
