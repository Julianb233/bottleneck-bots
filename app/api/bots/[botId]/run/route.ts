import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getBotByIdForUser,
  createExecution,
  updateExecution,
  addExecutionLog,
} from "@/lib/db/bots"

type RouteContext = {
  params: Promise<{ botId: string }>
}

/**
 * POST /api/bots/[botId]/run
 * Trigger immediate execution of a bot
 * Returns execution ID for tracking
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // TODO: Replace mock DB with Supabase integration
    // const { data: bot, error: botError } = await supabase
    //   .from("bots")
    //   .select("id, user_id, status, config")
    //   .eq("id", botId)
    //   .eq("user_id", session.user.id)
    //   .single()

    // Verify bot ownership and get bot details
    const bot = await getBotByIdForUser(botId, session.user.id)

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Check if bot is active
    if (bot.status !== "active") {
      return NextResponse.json(
        { error: "Bot must be active to run. Current status: " + bot.status },
        { status: 400 }
      )
    }

    // Parse optional trigger data from request body
    let triggerData: Record<string, unknown> = {}
    try {
      const body = await request.json()
      triggerData = body.data || {}
    } catch {
      // No body or invalid JSON, use empty trigger data
    }

    // Create execution record
    const execution = await createExecution(
      botId,
      session.user.id,
      "manual",
      triggerData
    )

    // Log execution start
    await addExecutionLog(
      execution.id,
      "info",
      "Bot execution started manually",
      { botId, botName: bot.name, triggeredBy: session.user.id }
    )

    // Update status to running
    await updateExecution(execution.id, "running")

    // TODO: Replace with actual bot engine execution
    // For now, simulate execution with mock results
    // In production, this should call: await botEngine.executeBot(botId, "manual", triggerData)

    try {
      // Simulate bot execution (replace with actual bot engine)
      await addExecutionLog(
        execution.id,
        "info",
        `Executing ${bot.config.actions.length} action(s)`,
        { actions: bot.config.actions.map((a) => a.type) }
      )

      // Simulate action execution
      const actionResults = bot.config.actions.map((action, index) => ({
        actionId: action.id || `action-${index}`,
        type: action.type,
        success: true,
        result: { status: "simulated", message: "Mock execution successful" },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: Math.floor(Math.random() * 1000) + 100,
      }))

      // Complete execution
      await updateExecution(execution.id, "completed", {
        actionResults,
      })

      await addExecutionLog(
        execution.id,
        "info",
        "Bot execution completed successfully",
        { duration: Date.now() - new Date(execution.startedAt).getTime() }
      )

      return NextResponse.json(
        {
          message: "Bot execution triggered successfully",
          executionId: execution.id,
          status: "completed",
          botId,
          botName: bot.name,
          actionResults,
        },
        { status: 200 }
      )
    } catch (execError) {
      const errorMessage = execError instanceof Error ? execError.message : "Unknown execution error"

      // Mark execution as failed
      await updateExecution(execution.id, "failed", {
        error: errorMessage,
      })

      await addExecutionLog(execution.id, "error", `Bot execution failed: ${errorMessage}`)

      return NextResponse.json(
        {
          error: "Bot execution failed",
          executionId: execution.id,
          status: "failed",
          details: errorMessage,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
