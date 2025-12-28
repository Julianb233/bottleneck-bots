import { getServerSupabase, Database } from "./supabase"

export type BotConfig = {
  type: "schedule" | "webhook" | "manual"
  schedule?: string // cron expression
  webhookUrl?: string
  actions: BotAction[]
  settings?: Record<string, unknown>
}

export type BotAction = {
  type: "http_request" | "email" | "slack" | "custom"
  config: Record<string, unknown>
  order: number
}

export type BotRunStatus = "pending" | "running" | "completed" | "failed"
export type TriggerType = "manual" | "schedule" | "webhook"

export interface BotExecutionResult {
  success: boolean
  runId: string
  output?: Record<string, unknown>
  error?: string
}

/**
 * Main bot execution engine
 * Handles bot execution, logging, and status management
 */
export class BotEngine {
  private supabase = getServerSupabase()

  /**
   * Execute a bot by ID
   * @param botId - Bot identifier
   * @param triggerType - How the bot was triggered
   * @param triggerData - Optional data from the trigger
   */
  async executeBot(
    botId: string,
    triggerType: TriggerType,
    triggerData?: Record<string, unknown>
  ): Promise<BotExecutionResult> {
    // Create bot run record
    const runId = await this.createBotRun(botId)

    try {
      // Fetch bot configuration
      const { data: bot, error: botError } = await this.supabase
        .from("bots")
        .select("*")
        .eq("id", botId)
        .single()

      if (botError || !bot) {
        throw new Error(`Bot not found: ${botId}`)
      }

      // Check if bot is active
      if (bot.status !== "active") {
        throw new Error(`Bot is not active: ${bot.status}`)
      }

      // Update run status to running
      await this.updateBotRunStatus(runId, "running")

      // Parse bot configuration
      const config = bot.config as BotConfig

      // Execute bot actions
      const result = await this.executeBotActions(
        config,
        triggerType,
        triggerData
      )

      // Mark run as completed
      await this.completeBotRun(runId, result)

      return {
        success: true,
        runId,
        output: result,
      }
    } catch (error) {
      // Mark run as failed
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      await this.failBotRun(runId, errorMessage)

      return {
        success: false,
        runId,
        error: errorMessage,
      }
    }
  }

  /**
   * Execute bot actions in sequence
   */
  private async executeBotActions(
    config: BotConfig,
    triggerType: TriggerType,
    triggerData?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {
      triggerType,
      triggerData: triggerData || {},
      actionResults: [],
    }

    // Sort actions by order
    const sortedActions = [...config.actions].sort((a, b) => a.order - b.order)

    for (const action of sortedActions) {
      try {
        const actionResult = await this.executeAction(action, triggerData)
        ;(results.actionResults as unknown[]).push({
          type: action.type,
          success: true,
          result: actionResult,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        ;(results.actionResults as unknown[]).push({
          type: action.type,
          success: false,
          error: errorMessage,
        })
        // Stop execution on first error
        throw error
      }
    }

    return results
  }

  /**
   * Execute a single bot action
   */
  private async executeAction(
    action: BotAction,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    switch (action.type) {
      case "http_request":
        return await this.executeHttpRequest(action.config, triggerData)

      case "email":
        return await this.executeEmail(action.config, triggerData)

      case "slack":
        return await this.executeSlack(action.config, triggerData)

      case "custom":
        return await this.executeCustom(action.config, triggerData)

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Execute HTTP request action
   */
  private async executeHttpRequest(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    const { url, method = "GET", headers = {}, body } = config

    if (!url || typeof url !== "string") {
      throw new Error("HTTP request requires a URL")
    }

    // Replace variables in URL and body with trigger data
    const processedUrl = this.replaceVariables(url, triggerData)
    const processedBody = body
      ? this.replaceVariables(JSON.stringify(body), triggerData)
      : undefined

    const response = await fetch(processedUrl, {
      method: method as string,
      headers: headers as Record<string, string>,
      body: processedBody,
    })

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return await response.json()
    }

    return await response.text()
  }

  /**
   * Execute email action (placeholder)
   */
  private async executeEmail(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    // TODO: Implement email sending
    console.log("Email action:", config, triggerData)
    return { status: "email_sent", config }
  }

  /**
   * Execute Slack action (placeholder)
   */
  private async executeSlack(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    // TODO: Implement Slack integration
    console.log("Slack action:", config, triggerData)
    return { status: "slack_sent", config }
  }

  /**
   * Execute custom action (placeholder)
   */
  private async executeCustom(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    // TODO: Implement custom action execution
    console.log("Custom action:", config, triggerData)
    return { status: "custom_executed", config }
  }

  /**
   * Replace variables in text with trigger data
   * Example: "Hello {{name}}" with { name: "World" } => "Hello World"
   */
  private replaceVariables(
    text: string,
    data?: Record<string, unknown>
  ): string {
    if (!data) return text

    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = data[key.trim()]
      return value !== undefined ? String(value) : match
    })
  }

  /**
   * Create a new bot run record
   */
  private async createBotRun(botId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("bot_runs")
      .insert({
        bot_id: botId,
        status: "pending",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error || !data) {
      throw new Error(`Failed to create bot run: ${error?.message}`)
    }

    return data.id
  }

  /**
   * Update bot run status
   */
  private async updateBotRunStatus(
    runId: string,
    status: BotRunStatus
  ): Promise<void> {
    const { error } = await this.supabase
      .from("bot_runs")
      .update({ status })
      .eq("id", runId)

    if (error) {
      console.error("Failed to update bot run status:", error)
    }
  }

  /**
   * Mark bot run as completed
   */
  private async completeBotRun(
    runId: string,
    result: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase
      .from("bot_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result,
      })
      .eq("id", runId)

    if (error) {
      console.error("Failed to complete bot run:", error)
    }
  }

  /**
   * Mark bot run as failed
   */
  private async failBotRun(runId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from("bot_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: errorMessage,
      })
      .eq("id", runId)

    if (error) {
      console.error("Failed to mark bot run as failed:", error)
    }
  }

  /**
   * Get bot run by ID
   */
  async getBotRun(runId: string) {
    const { data, error } = await this.supabase
      .from("bot_runs")
      .select("*")
      .eq("id", runId)
      .single()

    if (error) {
      throw new Error(`Failed to get bot run: ${error.message}`)
    }

    return data
  }

  /**
   * Get all runs for a bot
   */
  async getBotRuns(botId: string, limit = 50) {
    const { data, error } = await this.supabase
      .from("bot_runs")
      .select("*")
      .eq("bot_id", botId)
      .order("started_at", { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get bot runs: ${error.message}`)
    }

    return data
  }
}

// Export singleton instance
export const botEngine = new BotEngine()
