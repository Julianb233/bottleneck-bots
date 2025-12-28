import { NextRequest, NextResponse } from "next/server"
import { scheduler } from "@/lib/scheduler"

/**
 * GET /api/cron
 * Vercel Cron Job endpoint - runs every minute
 * Checks for scheduled bots and executes them
 *
 * This endpoint is protected by a secret token to prevent unauthorized access.
 * Vercel automatically adds the Authorization header for cron jobs.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    // In production, Vercel adds an Authorization header with CRON_SECRET
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // Allow in development mode or when CRON_SECRET matches
    const isDev = process.env.NODE_ENV === "development"
    const isValidCron =
      isDev ||
      !cronSecret ||
      authHeader === `Bearer ${cronSecret}`

    if (!isValidCron) {
      console.warn("Unauthorized cron request attempted")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.log(`[Cron] Starting scheduled bot check at ${new Date().toISOString()}`)

    // Run all due bots
    const result = await scheduler.runDueBots()

    console.log(
      `[Cron] Completed: ${result.executed} bots checked, ` +
        `${result.successful} successful, ${result.failed} failed`
    )

    // Log individual results
    for (const botResult of result.results) {
      if (botResult.success) {
        console.log(`[Cron] Bot "${botResult.botName}" executed successfully (run: ${botResult.runId})`)
      } else {
        console.error(`[Cron] Bot "${botResult.botName}" failed: ${botResult.error}`)
      }
    }

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        executed: result.executed,
        successful: result.successful,
        failed: result.failed,
        results: result.results,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Cron] Scheduler error:", error)
    return NextResponse.json(
      {
        error: "Scheduler failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron
 * Manual trigger for testing scheduled bot execution
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // For manual triggers, check for admin token
    const authHeader = request.headers.get("authorization")
    const adminToken = process.env.ADMIN_API_TOKEN

    // Allow in development or with valid admin token
    const isDev = process.env.NODE_ENV === "development"
    const isValidAdmin =
      isDev ||
      (adminToken && authHeader === `Bearer ${adminToken}`)

    if (!isValidAdmin) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { dryRun = false } = body

    if (dryRun) {
      // Just check which bots would run without executing
      const botsToRun = await scheduler.getBotsToRun()
      return NextResponse.json(
        {
          success: true,
          dryRun: true,
          timestamp: new Date().toISOString(),
          botsToRun: botsToRun.map((bot) => ({
            id: bot.id,
            name: bot.name,
            schedule: bot.schedule,
          })),
        },
        { status: 200 }
      )
    }

    // Execute all due bots
    const result = await scheduler.runDueBots()

    return NextResponse.json(
      {
        success: true,
        manual: true,
        timestamp: new Date().toISOString(),
        executed: result.executed,
        successful: result.successful,
        failed: result.failed,
        results: result.results,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Cron] Manual trigger error:", error)
    return NextResponse.json(
      {
        error: "Manual trigger failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
