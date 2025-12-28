import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/bots/[id]/runs
 * List all runs for a specific bot
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
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
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50"),
      100
    )
    const offset = parseInt(searchParams.get("offset") || "0")
    const status = searchParams.get("status")

    // Build query
    let query = supabase
      .from("bot_runs")
      .select("*", { count: "exact" })
      .eq("bot_id", id)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by status if provided
    if (status && ["pending", "running", "completed", "failed"].includes(status)) {
      query = query.eq("status", status)
    }

    const { data: runs, error, count } = await query

    if (error) {
      console.error("Error fetching bot runs:", error)
      return NextResponse.json(
        { error: "Failed to fetch bot runs" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        runs,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit,
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
