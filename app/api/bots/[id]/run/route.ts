import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import { botEngine } from "@/lib/bot-engine"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/bots/[id]/run
 * Trigger bot execution manually
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
      .select("id, user_id, status")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Check if bot is active
    if (bot.status !== "active") {
      return NextResponse.json(
        { error: "Bot must be active to run" },
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

    // Execute bot
    const result = await botEngine.executeBot(id, "manual", triggerData)

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Bot execution failed",
          runId: result.runId,
          details: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: "Bot executed successfully",
        runId: result.runId,
        output: result.output,
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
