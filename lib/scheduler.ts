import { getServerSupabase } from "./supabase"
import { botEngine, BotConfig } from "./bot-engine"

/**
 * Cron expression parser and matcher
 * Supports standard 5-field cron expressions: minute hour day month weekday
 *
 * Examples:
 * - "* * * * *" - Every minute
 * - "0 * * * *" - Every hour
 * - "0 0 * * *" - Every day at midnight
 * - "0 9 * * 1-5" - 9 AM on weekdays
 * - Every 15 minutes: use star-slash-15 pattern
 */
export class CronParser {
  /**
   * Parse a cron field into a set of matching values
   */
  static parseField(field: string, min: number, max: number): Set<number> {
    const values = new Set<number>()

    // Handle asterisk (all values)
    if (field === "*") {
      for (let i = min; i <= max; i++) {
        values.add(i)
      }
      return values
    }

    // Split by comma for multiple values
    const parts = field.split(",")

    for (const part of parts) {
      // Handle step values (*/n or n-m/step)
      if (part.includes("/")) {
        const [range, stepStr] = part.split("/")
        const step = parseInt(stepStr, 10)

        let start = min
        let end = max

        if (range !== "*") {
          if (range.includes("-")) {
            const [rangeStart, rangeEnd] = range.split("-")
            start = parseInt(rangeStart, 10)
            end = parseInt(rangeEnd, 10)
          } else {
            start = parseInt(range, 10)
          }
        }

        for (let i = start; i <= end; i += step) {
          values.add(i)
        }
      }
      // Handle range values (n-m)
      else if (part.includes("-")) {
        const [start, end] = part.split("-")
        for (let i = parseInt(start, 10); i <= parseInt(end, 10); i++) {
          values.add(i)
        }
      }
      // Handle single value
      else {
        values.add(parseInt(part, 10))
      }
    }

    return values
  }

  /**
   * Check if a date matches a cron expression
   */
  static matches(cronExpression: string, date: Date): boolean {
    const parts = cronExpression.trim().split(/\s+/)

    if (parts.length !== 5) {
      console.error(`Invalid cron expression: ${cronExpression}`)
      return false
    }

    const [minuteField, hourField, dayField, monthField, weekdayField] = parts

    const minute = date.getMinutes()
    const hour = date.getHours()
    const day = date.getDate()
    const month = date.getMonth() + 1 // JavaScript months are 0-indexed
    const weekday = date.getDay() // 0 = Sunday

    const minuteValues = this.parseField(minuteField, 0, 59)
    const hourValues = this.parseField(hourField, 0, 23)
    const dayValues = this.parseField(dayField, 1, 31)
    const monthValues = this.parseField(monthField, 1, 12)
    const weekdayValues = this.parseField(weekdayField, 0, 6)

    return (
      minuteValues.has(minute) &&
      hourValues.has(hour) &&
      dayValues.has(day) &&
      monthValues.has(month) &&
      weekdayValues.has(weekday)
    )
  }

  /**
   * Get next run time for a cron expression
   */
  static getNextRun(cronExpression: string, from: Date = new Date()): Date {
    const next = new Date(from)
    next.setSeconds(0)
    next.setMilliseconds(0)
    next.setMinutes(next.getMinutes() + 1)

    // Search up to 1 year ahead
    const maxIterations = 525600 // minutes in a year

    for (let i = 0; i < maxIterations; i++) {
      if (this.matches(cronExpression, next)) {
        return next
      }
      next.setMinutes(next.getMinutes() + 1)
    }

    throw new Error("Could not find next run time within 1 year")
  }

  /**
   * Validate a cron expression
   */
  static validate(cronExpression: string): { valid: boolean; error?: string } {
    const parts = cronExpression.trim().split(/\s+/)

    if (parts.length !== 5) {
      return {
        valid: false,
        error: `Expected 5 fields, got ${parts.length}. Format: minute hour day month weekday`,
      }
    }

    const fieldNames = ["minute", "hour", "day", "month", "weekday"]
    const ranges = [
      [0, 59],
      [0, 23],
      [1, 31],
      [1, 12],
      [0, 6],
    ]

    for (let i = 0; i < 5; i++) {
      try {
        const values = this.parseField(parts[i], ranges[i][0], ranges[i][1])
        for (const value of values) {
          if (value < ranges[i][0] || value > ranges[i][1]) {
            return {
              valid: false,
              error: `${fieldNames[i]} value ${value} out of range (${ranges[i][0]}-${ranges[i][1]})`,
            }
          }
        }
      } catch {
        return {
          valid: false,
          error: `Invalid ${fieldNames[i]} field: ${parts[i]}`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * Convert cron expression to human-readable description
   */
  static describe(cronExpression: string): string {
    const parts = cronExpression.trim().split(/\s+/)
    if (parts.length !== 5) return cronExpression

    const [minute, hour, day, month, weekday] = parts

    // Common patterns
    if (minute === "*" && hour === "*" && day === "*" && month === "*" && weekday === "*") {
      return "Every minute"
    }
    if (minute === "0" && hour === "*" && day === "*" && month === "*" && weekday === "*") {
      return "Every hour"
    }
    if (minute === "0" && hour === "0" && day === "*" && month === "*" && weekday === "*") {
      return "Every day at midnight"
    }
    if (minute.startsWith("*/")) {
      const interval = minute.slice(2)
      return `Every ${interval} minutes`
    }
    if (minute === "0" && hour !== "*" && day === "*" && month === "*" && weekday === "*") {
      return `Every day at ${hour}:00`
    }
    if (minute === "0" && hour !== "*" && weekday === "1-5") {
      return `Weekdays at ${hour}:00`
    }

    return cronExpression
  }
}

/**
 * Bot Scheduler
 * Checks which scheduled bots need to run and triggers them
 */
export class BotScheduler {
  private supabase = getServerSupabase()

  /**
   * Get all bots that are due to run
   */
  async getBotsToRun(): Promise<
    Array<{
      id: string
      name: string
      config: BotConfig
      schedule: string
    }>
  > {
    const now = new Date()
    const botsToRun: Array<{
      id: string
      name: string
      config: BotConfig
      schedule: string
    }> = []

    // Fetch all active scheduled bots
    const { data: bots, error } = await this.supabase
      .from("bots")
      .select("id, name, config")
      .eq("status", "active")

    if (error) {
      console.error("Error fetching scheduled bots:", error)
      return []
    }

    for (const bot of bots || []) {
      const config = bot.config as BotConfig

      // Check if bot is scheduled type with a cron expression
      if (config?.type === "schedule" && config?.schedule) {
        try {
          if (CronParser.matches(config.schedule, now)) {
            botsToRun.push({
              id: bot.id,
              name: bot.name,
              config,
              schedule: config.schedule,
            })
          }
        } catch (err) {
          console.error(`Invalid cron for bot ${bot.id}:`, err)
        }
      }
    }

    return botsToRun
  }

  /**
   * Execute all bots that are due to run
   */
  async runDueBots(): Promise<{
    executed: number
    successful: number
    failed: number
    results: Array<{
      botId: string
      botName: string
      success: boolean
      runId?: string
      error?: string
    }>
  }> {
    const botsToRun = await this.getBotsToRun()
    const results: Array<{
      botId: string
      botName: string
      success: boolean
      runId?: string
      error?: string
    }> = []

    let successful = 0
    let failed = 0

    for (const bot of botsToRun) {
      try {
        console.log(`Executing scheduled bot: ${bot.name} (${bot.id})`)
        const result = await botEngine.executeBot(bot.id, "schedule")

        if (result.success) {
          successful++
          results.push({
            botId: bot.id,
            botName: bot.name,
            success: true,
            runId: result.runId,
          })
        } else {
          failed++
          results.push({
            botId: bot.id,
            botName: bot.name,
            success: false,
            runId: result.runId,
            error: result.error,
          })
        }
      } catch (error) {
        failed++
        results.push({
          botId: bot.id,
          botName: bot.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return {
      executed: botsToRun.length,
      successful,
      failed,
      results,
    }
  }

  /**
   * Get upcoming scheduled runs for a bot
   */
  async getUpcomingRuns(
    botId: string,
    count: number = 5
  ): Promise<Date[]> {
    const { data: bot, error } = await this.supabase
      .from("bots")
      .select("config")
      .eq("id", botId)
      .single()

    if (error || !bot) {
      return []
    }

    const config = bot.config as BotConfig
    if (config?.type !== "schedule" || !config?.schedule) {
      return []
    }

    const upcoming: Date[] = []
    let from = new Date()

    for (let i = 0; i < count; i++) {
      try {
        const next = CronParser.getNextRun(config.schedule, from)
        upcoming.push(next)
        from = new Date(next.getTime() + 60000) // Start from 1 minute after last
      } catch {
        break
      }
    }

    return upcoming
  }
}

// Export singleton instance
export const scheduler = new BotScheduler()

// Export cron parser for direct use
export { CronParser as cronParser }
