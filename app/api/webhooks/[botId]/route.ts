import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import { botEngine } from "@/lib/bot-engine"

type RouteContext = {
  params: Promise<{ botId: string }>
}

/**
 * POST /api/webhooks/[botId]
 * Webhook endpoint to trigger bot execution
 * This endpoint does NOT require authentication - designed for external services
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { botId } = await context.params
    const supabase = getServerSupabase()

    // Verify bot exists and is active
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, status, config")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json(
        { error: "Bot not found" },
        { status: 404 }
      )
    }

    // Check if bot is active
    if (bot.status !== "active") {
      return NextResponse.json(
        { error: "Bot is not active" },
        { status: 400 }
      )
    }

    // Check if bot type is webhook
    const config = bot.config as { type?: string }
    if (config.type !== "webhook") {
      return NextResponse.json(
        { error: "Bot is not configured for webhook triggers" },
        { status: 400 }
      )
    }

    // Parse webhook payload
    let webhookData: Record<string, unknown> = {}
    try {
      webhookData = await request.json()
    } catch {
      // If no JSON body, try to get query params
      const searchParams = request.nextUrl.searchParams
      webhookData = Object.fromEntries(searchParams.entries())
    }

    // Add webhook metadata
    const triggerData = {
      ...webhookData,
      _webhook: {
        timestamp: new Date().toISOString(),
        headers: Object.fromEntries(request.headers.entries()),
        url: request.url,
      },
    }

    // Execute bot
    const result = await botEngine.executeBot(botId, "webhook", triggerData)

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
        message: "Bot triggered successfully",
        runId: result.runId,
        output: result.output,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/[botId]
 * Verify webhook endpoint is active (useful for webhook setup verification)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { botId } = await context.params
    const supabase = getServerSupabase()

    // Verify bot exists
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("id, name, status, config")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json(
        { error: "Bot not found" },
        { status: 404 }
      )
    }

    // Check if bot type is webhook
    const config = bot.config as { type?: string }
    if (config.type !== "webhook") {
      return NextResponse.json(
        { error: "Bot is not configured for webhook triggers" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        botId: bot.id,
        botName: bot.name,
        status: bot.status,
        webhookUrl: `/api/webhooks/${bot.id}`,
        message: "Webhook endpoint is active",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Webhook verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
