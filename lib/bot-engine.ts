import { getServerSupabase, Database } from "./supabase"
import { sendSlackMessage, sendEmail, sendDiscordMessage, httpRequest, scrapeUrl } from "./integrations"

export type BotConfig = {
  type: "schedule" | "webhook" | "manual"
  schedule?: string // cron expression
  webhookUrl?: string
  actions: BotAction[]
  settings?: Record<string, unknown>
}

export type BotAction = {
  type: "http_request" | "email" | "slack" | "discord" | "scrape" | "custom"
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

      case "discord":
        return await this.executeDiscord(action.config, triggerData)

      case "scrape":
        return await this.executeScrape(action.config, triggerData)

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
   * Execute email action via Resend
   */
  private async executeEmail(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    const { to, subject, html, text, from } = config
    if (!to || !subject) {
      throw new Error("Email requires 'to' and 'subject' fields")
    }

    const result = await sendEmail(
      { to: to as string, subject: subject as string, html: html as string, text: text as string, from: from as string },
      triggerData
    )

    if (!result.success) {
      throw new Error(result.error || "Email failed")
    }
    return { status: "email_sent", messageId: result.messageId }
  }

  /**
   * Execute Slack action via webhook
   */
  private async executeSlack(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    const { webhookUrl, message, channel, username, iconEmoji } = config
    if (!webhookUrl || !message) {
      throw new Error("Slack requires 'webhookUrl' and 'message' fields")
    }

    const result = await sendSlackMessage(
      { webhookUrl: webhookUrl as string, message: message as string, channel: channel as string, username: username as string, iconEmoji: iconEmoji as string },
      triggerData
    )

    if (!result.success) {
      throw new Error(result.error || "Slack failed")
    }
    return { status: "slack_sent" }
  }

  /**
   * Execute Discord action via webhook
   */
  private async executeDiscord(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    const { webhookUrl, content, username, avatarUrl, embeds } = config
    if (!webhookUrl) {
      throw new Error("Discord requires 'webhookUrl' field")
    }

    const result = await sendDiscordMessage(
      { webhookUrl: webhookUrl as string, content: content as string, username: username as string, avatarUrl: avatarUrl as string, embeds: embeds as [] },
      triggerData
    )

    if (!result.success) {
      throw new Error(result.error || "Discord failed")
    }
    return { status: "discord_sent" }
  }

  /**
   * Execute web scraping action
   */
  private async executeScrape(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    const { url, selector } = config
    if (!url) {
      throw new Error("Scrape requires 'url' field")
    }

    const result = await scrapeUrl(
      { url: url as string, selector: selector as string },
      triggerData
    )

    if (!result.success) {
      throw new Error(result.error || "Scrape failed")
    }
    return { status: "scraped", data: result.data }
  }

  /**
   * Execute custom action (webhook callback)
   */
  private async executeCustom(
    config: Record<string, unknown>,
    triggerData?: Record<string, unknown>
  ): Promise<unknown> {
    const { callbackUrl, method = "POST" } = config
    if (!callbackUrl) {
      throw new Error("Custom action requires 'callbackUrl' field")
    }

    const result = await httpRequest(
      { url: callbackUrl as string, method: method as string, body: triggerData },
      triggerData
    )

    if (!result.success) {
      throw new Error(result.error || "Custom action failed")
    }
    return { status: "custom_executed", response: result.data }
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
