import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getExecutionByIdForUser,
  getExecutionLogs,
  getBotById,
  type ExecutionLog,
} from "@/lib/db/bots"

type RouteContext = {
  params: Promise<{ executionId: string }>
}

/**
 * GET /api/executions/[executionId]/logs
 * Get detailed logs for an execution
 *
 * Query parameters:
 * - level: Filter by log level (info, warn, error, debug)
 * - limit: Maximum number of logs to return (default: 100, max: 1000)
 * - offset: Number of logs to skip (for pagination)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { executionId } = await context.params
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify execution ownership
    const execution = await getExecutionByIdForUser(executionId, session.user.id)

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    const level = searchParams.get("level") as ExecutionLog["level"] | null
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)))
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10))

    // Validate log level if provided
    const validLevels: ExecutionLog["level"][] = ["info", "warn", "error", "debug"]
    if (level && !validLevels.includes(level)) {
      return NextResponse.json(
        { error: `Invalid level. Must be one of: ${validLevels.join(", ")}` },
        { status: 400 }
      )
    }

    // TODO: Replace mock DB with Supabase integration
    // let query = supabase
    //   .from("execution_logs")
    //   .select("*", { count: "exact" })
    //   .eq("execution_id", executionId)
    //   .order("timestamp", { ascending: true })
    //
    // if (level) query = query.eq("level", level)
    //
    // const { data: logs, count, error } = await query
    //   .range(offset, offset + limit - 1)

    // Fetch logs from mock database
    let logs = await getExecutionLogs(executionId)

    // Filter by level if specified
    if (level) {
      logs = logs.filter((log) => log.level === level)
    }

    // Get total count before pagination
    const totalCount = logs.length

    // Apply pagination
    const paginatedLogs = logs.slice(offset, offset + limit)

    // Get bot details for context
    const bot = await getBotById(execution.botId)

    // Calculate log level statistics
    const allLogs = await getExecutionLogs(executionId)
    const levelCounts = {
      info: allLogs.filter((l) => l.level === "info").length,
      warn: allLogs.filter((l) => l.level === "warn").length,
      error: allLogs.filter((l) => l.level === "error").length,
      debug: allLogs.filter((l) => l.level === "debug").length,
    }

    return NextResponse.json(
      {
        logs: paginatedLogs,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
        execution: {
          id: execution.id,
          status: execution.status,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
          duration: execution.duration,
        },
        bot: bot
          ? {
              id: bot.id,
              name: bot.name,
            }
          : null,
        levelCounts,
        filter: {
          level: level || null,
        },
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
