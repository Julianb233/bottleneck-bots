import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/bots/[id]
 * Get a single bot by ID
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

    // Fetch bot
    const { data: bot, error } = await supabase
      .from("bots")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single()

    if (error || !bot) {
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
 * PATCH /api/bots/[id]
 * Update a bot
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    // Parse request body
    const body = await request.json()
    const { name, description, config, status } = body

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "Bot name must be a non-empty string" },
          { status: 400 }
        )
      }
      updates.name = name
    }

    if (description !== undefined) {
      updates.description = description
    }

    if (config !== undefined) {
      if (typeof config !== "object" || config === null) {
        return NextResponse.json(
          { error: "Bot configuration must be an object" },
          { status: 400 }
        )
      }
      updates.config = config
    }

    if (status !== undefined) {
      if (!["active", "paused", "stopped"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Must be: active, paused, or stopped" },
          { status: 400 }
        )
      }
      updates.status = status
    }

    // Update bot
    const { data: bot, error } = await supabase
      .from("bots")
      .update(updates)
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select()
      .single()

    if (error || !bot) {
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
 * DELETE /api/bots/[id]
 * Delete a bot
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Delete bot
    const { error } = await supabase
      .from("bots")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id)

    if (error) {
      console.error("Error deleting bot:", error)
      return NextResponse.json(
        { error: "Failed to delete bot" },
        { status: 500 }
      )
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
