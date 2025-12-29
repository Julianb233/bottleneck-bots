import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getBotByIdForUser,
  updateBot,
  deleteBot,
  type UpdateBotInput,
  type BotConfig,
} from "@/lib/db/bots"

type RouteContext = {
  params: Promise<{ botId: string }>
}

/**
 * GET /api/bots/[botId]
 * Get bot details and configuration
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
    // const { data: bot, error } = await supabase
    //   .from("bots")
    //   .select("*")
    //   .eq("id", botId)
    //   .eq("user_id", session.user.id)
    //   .single()

    // Fetch bot from mock database
    const bot = await getBotByIdForUser(botId, session.user.id)

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    return NextResponse.json({ bot }, { status: 200 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bots/[botId]
 * Update bot configuration
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

    // Parse request body
    const body = await request.json()
    const { name, description, config, status } = body

    // Validate input if provided
    if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
      return NextResponse.json(
        { error: "Bot name must be a non-empty string" },
        { status: 400 }
      )
    }

    if (config !== undefined) {
      if (typeof config !== "object" || config === null) {
        return NextResponse.json(
          { error: "Bot configuration must be an object" },
          { status: 400 }
        )
      }

      const botConfig = config as BotConfig
      if (botConfig.type && !["schedule", "webhook", "manual"].includes(botConfig.type)) {
        return NextResponse.json(
          { error: "Bot config type must be: schedule, webhook, or manual" },
          { status: 400 }
        )
      }

      if (botConfig.actions !== undefined && !Array.isArray(botConfig.actions)) {
        return NextResponse.json(
          { error: "Bot config actions must be an array" },
          { status: 400 }
        )
      }
    }

    if (status !== undefined && !["active", "paused", "stopped"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: active, paused, or stopped" },
        { status: 400 }
      )
    }

    // TODO: Replace mock DB with Supabase integration
    // const { data: bot, error } = await supabase
    //   .from("bots")
    //   .update({
    //     ...(name !== undefined && { name }),
    //     ...(description !== undefined && { description }),
    //     ...(config !== undefined && { config }),
    //     ...(status !== undefined && { status }),
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq("id", botId)
    //   .eq("user_id", session.user.id)
    //   .select()
    //   .single()

    // Build update input
    const updateInput: UpdateBotInput = {}
    if (name !== undefined) updateInput.name = name.trim()
    if (description !== undefined) updateInput.description = description
    if (config !== undefined) updateInput.config = config
    if (status !== undefined) updateInput.status = status

    // Update bot in mock database
    const bot = await updateBot(botId, session.user.id, updateInput)

    if (!bot) {
      return NextResponse.json(
        { error: "Bot not found or update failed" },
        { status: 404 }
      )
    }

    return NextResponse.json({ bot }, { status: 200 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bots/[botId]
 * Partial update of bot configuration (alias for PUT)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  // PATCH behaves the same as PUT for partial updates
  return PUT(request, context)
}

/**
 * DELETE /api/bots/[botId]
 * Delete a bot
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

    // TODO: Replace mock DB with Supabase integration
    // const { error } = await supabase
    //   .from("bots")
    //   .delete()
    //   .eq("id", botId)
    //   .eq("user_id", session.user.id)

    // Delete bot from mock database
    const deleted = await deleteBot(botId, session.user.id)

    if (!deleted) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    return NextResponse.json(
      { message: "Bot deleted successfully" },
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
