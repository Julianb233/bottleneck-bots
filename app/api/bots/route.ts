import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"

/**
 * GET /api/bots
 * List all bots for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch user's bots
    const { data: bots, error } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching bots:", error)
      return NextResponse.json(
        { error: "Failed to fetch bots" },
        { status: 500 }
      )
    }

    return NextResponse.json({ bots }, { status: 200 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bots
 * Create a new bot
 */
export async function POST(request: NextRequest) {
  try {
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
    const { name, description, config, status = "active" } = body

    // Validate required fields
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Bot name is required" },
        { status: 400 }
      )
    }

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "Bot configuration is required" },
        { status: 400 }
      )
    }

    // Validate status
    if (!["active", "paused", "stopped"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: active, paused, or stopped" },
        { status: 400 }
      )
    }

    // Create bot
    const { data: bot, error } = await supabase
      .from("bots")
      .insert({
        user_id: session.user.id,
        name,
        description: description || null,
        config,
        status,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating bot:", error)
      return NextResponse.json(
        { error: "Failed to create bot" },
        { status: 500 }
      )
    }

    return NextResponse.json({ bot }, { status: 201 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
