import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getBotByIdForUser,
  getExecutions,
  type ExecutionStatus,
} from "@/lib/db/bots"

type RouteContext = {
  params: Promise<{ botId: string }>
}

/**
 * GET /api/bots/[botId]/runs
 * List all executions/runs for a specific bot
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

    // TODO: Replace mock DB with Supabase integration
    // const { data: bot, error: botError } = await supabase
    //   .from("bots")
    //   .select("id, user_id")
    //   .eq("id", botId)
    //   .eq("user_id", session.user.id)
    //   .single()

    // Verify bot ownership
    const bot = await getBotByIdForUser(botId, session.user.id)

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const status = searchParams.get("status") as ExecutionStatus | null

    // Validate status if provided
    const validStatuses: ExecutionStatus[] = ["pending", "running", "completed", "failed", "cancelled"]
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // TODO: Replace mock DB with Supabase integration
    // let query = supabase
    //   .from("bot_runs")
    //   .select("*", { count: "exact" })
    //   .eq("bot_id", botId)
    //   .order("started_at", { ascending: false })
    //   .range(offset, offset + limit - 1)
    //
    // if (status) query = query.eq("status", status)

    // Fetch executions from mock database
    const result = await getExecutions(
      {
        botId,
        userId: session.user.id,
        status: status || undefined,
      },
      { page, limit }
    )

    return NextResponse.json(
      {
        runs: result.data,
        pagination: result.pagination,
        bot: {
          id: bot.id,
          name: bot.name,
          status: bot.status,
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
