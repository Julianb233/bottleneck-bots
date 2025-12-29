import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import { getBots, createBot, type CreateBotInput, type BotConfig } from "@/lib/db/bots"

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

    // TODO: Replace mock DB with Supabase integration
    // const { data: bots, error } = await supabase
    //   .from("bots")
    //   .select("*")
    //   .eq("user_id", session.user.id)
    //   .order("created_at", { ascending: false })

    // Fetch user's bots from mock database
    const bots = await getBots(session.user.id)

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
 * Create a new bot with configuration
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
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Bot name is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "Bot configuration is required and must be an object" },
        { status: 400 }
      )
    }

    // Validate config structure
    const botConfig = config as BotConfig
    if (!botConfig.type || !["schedule", "webhook", "manual"].includes(botConfig.type)) {
      return NextResponse.json(
        { error: "Bot config must have a valid type: schedule, webhook, or manual" },
        { status: 400 }
      )
    }

    if (!Array.isArray(botConfig.actions)) {
      return NextResponse.json(
        { error: "Bot config must have an actions array" },
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

    // TODO: Replace mock DB with Supabase integration
    // const { data: bot, error } = await supabase
    //   .from("bots")
    //   .insert({
    //     user_id: session.user.id,
    //     name,
    //     description: description || null,
    //     config,
    //     status,
    //   })
    //   .select()
    //   .single()

    // Create bot in mock database
    const botInput: CreateBotInput = {
      name: name.trim(),
      description: description || null,
      config: botConfig,
      status,
    }

    const bot = await createBot(session.user.id, botInput)

    return NextResponse.json({ bot }, { status: 201 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
