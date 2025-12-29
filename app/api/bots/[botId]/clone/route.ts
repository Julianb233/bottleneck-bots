import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import { getBotByIdForUser, createBot } from "@/lib/db/bots"

type RouteContext = {
  params: Promise<{ botId: string }>
}

/**
 * POST /api/bots/[botId]/clone
 * Clone a bot with a new name
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

    // Verify bot ownership and get original bot
    const originalBot = await getBotByIdForUser(botId, session.user.id)

    if (!originalBot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Parse optional name from request body
    let newName = `Copy of ${originalBot.name}`
    try {
      const body = await request.json()
      if (body.name && typeof body.name === "string" && body.name.trim()) {
        newName = body.name.trim()
      }
    } catch {
      // No body or invalid JSON, use default name
    }

    // TODO: Replace mock DB with Supabase integration
    // const { data: clonedBot, error } = await supabase
    //   .from("bots")
    //   .insert({
    //     user_id: session.user.id,
    //     name: newName,
    //     description: originalBot.description,
    //     config: originalBot.config,
    //     status: "paused", // Start paused
    //   })
    //   .select()
    //   .single()

    // Clone bot in mock database
    const clonedBot = await createBot(session.user.id, {
      name: newName,
      description: originalBot.description,
      config: originalBot.config,
      status: "paused", // Start paused so user can review before activating
    })

    return NextResponse.json(
      {
        message: "Bot cloned successfully",
        bot: clonedBot,
        originalBot: {
          id: originalBot.id,
          name: originalBot.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
