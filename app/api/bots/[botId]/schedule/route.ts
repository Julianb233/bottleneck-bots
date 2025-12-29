import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getBotByIdForUser,
  getBotSchedule,
  updateBotSchedule,
  disableBotSchedule,
  type BotSchedule,
  type ScheduleType,
} from "@/lib/db/bots"
import { CronParser } from "@/lib/scheduler"

type RouteContext = {
  params: Promise<{ botId: string }>
}

/**
 * GET /api/bots/[botId]/schedule
 * Get current schedule for a bot
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { botId } = await context.params
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify bot ownership
    const bot = await getBotByIdForUser(botId, session.user.id)

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Get schedule
    const schedule = await getBotSchedule(botId, session.user.id)

    if (!schedule) {
      return NextResponse.json(
        {
          schedule: null,
          message: "No schedule configured for this bot",
        },
        { status: 200 }
      )
    }

    // Calculate next run times if schedule is enabled and is cron type
    let nextRuns: string[] = []
    let humanReadable: string | null = null

    if (schedule.enabled && schedule.type === "cron" && schedule.cronExpression) {
      try {
        const nextRunDates = []
        let from = new Date()
        for (let i = 0; i < 5; i++) {
          const next = CronParser.getNextRun(schedule.cronExpression, from)
          nextRunDates.push(next.toISOString())
          from = new Date(next.getTime() + 60000)
        }
        nextRuns = nextRunDates
        humanReadable = CronParser.describe(schedule.cronExpression)
      } catch {
        // Invalid cron expression, skip next runs calculation
      }
    } else if (schedule.enabled && schedule.type === "one-time" && schedule.oneTimeDate) {
      const oneTimeDate = new Date(schedule.oneTimeDate)
      if (oneTimeDate > new Date()) {
        nextRuns = [oneTimeDate.toISOString()]
        humanReadable = `One-time execution at ${oneTimeDate.toLocaleString()}`
      } else {
        humanReadable = "One-time execution (already passed)"
      }
    }

    return NextResponse.json(
      {
        schedule,
        nextRuns,
        humanReadable,
        botId,
        botName: bot.name,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bots/[botId]/schedule
 * Update schedule (cron expression or one-time)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { botId } = await context.params
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify bot ownership
    const bot = await getBotByIdForUser(botId, session.user.id)

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { type, cronExpression, oneTimeDate, timezone, enabled = true } = body

    // Validate schedule type
    if (!type || !["cron", "one-time"].includes(type)) {
      return NextResponse.json(
        { error: "Schedule type is required and must be 'cron' or 'one-time'" },
        { status: 400 }
      )
    }

    // Validate based on schedule type
    if (type === "cron") {
      if (!cronExpression || typeof cronExpression !== "string") {
        return NextResponse.json(
          { error: "Cron expression is required for cron schedule type" },
          { status: 400 }
        )
      }

      // Validate cron expression
      const validation = CronParser.validate(cronExpression)
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid cron expression: ${validation.error}` },
          { status: 400 }
        )
      }
    } else if (type === "one-time") {
      if (!oneTimeDate || typeof oneTimeDate !== "string") {
        return NextResponse.json(
          { error: "One-time date is required for one-time schedule type" },
          { status: 400 }
        )
      }

      // Validate date
      const date = new Date(oneTimeDate)
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Please provide an ISO 8601 date string" },
          { status: 400 }
        )
      }

      // Check if date is in the future
      if (date <= new Date()) {
        return NextResponse.json(
          { error: "One-time schedule date must be in the future" },
          { status: 400 }
        )
      }
    }

    // Build schedule object
    const schedule: BotSchedule = {
      type: type as ScheduleType,
      cronExpression: type === "cron" ? cronExpression : undefined,
      oneTimeDate: type === "one-time" ? oneTimeDate : undefined,
      timezone: timezone || "UTC",
      enabled,
    }

    // Update schedule
    const updatedBot = await updateBotSchedule(botId, session.user.id, schedule)

    if (!updatedBot) {
      return NextResponse.json(
        { error: "Failed to update schedule" },
        { status: 500 }
      )
    }

    // Calculate next runs for response
    let nextRuns: string[] = []
    let humanReadable: string | null = null

    if (enabled && type === "cron" && cronExpression) {
      try {
        const nextRunDates = []
        let from = new Date()
        for (let i = 0; i < 5; i++) {
          const next = CronParser.getNextRun(cronExpression, from)
          nextRunDates.push(next.toISOString())
          from = new Date(next.getTime() + 60000)
        }
        nextRuns = nextRunDates
        humanReadable = CronParser.describe(cronExpression)
      } catch {
        // Skip if calculation fails
      }
    } else if (enabled && type === "one-time") {
      nextRuns = [oneTimeDate]
      humanReadable = `One-time execution at ${new Date(oneTimeDate).toLocaleString()}`
    }

    return NextResponse.json(
      {
        message: "Schedule updated successfully",
        schedule,
        nextRuns,
        humanReadable,
        botId,
        botName: updatedBot.name,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bots/[botId]/schedule
 * Disable schedule for a bot
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { botId } = await context.params
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify bot ownership
    const bot = await getBotByIdForUser(botId, session.user.id)

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Disable schedule
    const updatedBot = await disableBotSchedule(botId, session.user.id)

    if (!updatedBot) {
      return NextResponse.json(
        { error: "Failed to disable schedule" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: "Schedule disabled successfully",
        botId,
        botName: updatedBot.name,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
