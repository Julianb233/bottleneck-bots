import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getExecutionByIdForUser,
  cancelExecution,
  getBotById,
} from "@/lib/db/bots"

type RouteContext = {
  params: Promise<{ executionId: string }>
}

/**
 * GET /api/executions/[executionId]
 * Get execution details including action results
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { executionId } = await context.params
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
    // const { data: execution, error } = await supabase
    //   .from("bot_runs")
    //   .select("*, bots!inner(id, name, user_id)")
    //   .eq("id", executionId)
    //   .eq("bots.user_id", session.user.id)
    //   .single()

    // Fetch execution from mock database
    const execution = await getExecutionByIdForUser(executionId, session.user.id)

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 })
    }

    // Get bot details for additional context
    const bot = await getBotById(execution.botId)

    // Calculate summary statistics
    const actionSummary = {
      total: execution.actionResults.length,
      successful: execution.actionResults.filter((r) => r.success).length,
      failed: execution.actionResults.filter((r) => !r.success).length,
    }

    return NextResponse.json(
      {
        execution: {
          ...execution,
          bot: bot
            ? {
                id: bot.id,
                name: bot.name,
                status: bot.status,
              }
            : null,
        },
        summary: {
          status: execution.status,
          triggerType: execution.triggerType,
          duration: execution.duration,
          actionSummary,
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

/**
 * DELETE /api/executions/[executionId]
 * Cancel a running execution (if possible)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { executionId } = await context.params
    const supabase = getServerSupabase()

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current execution to check status
    const execution = await getExecutionByIdForUser(executionId, session.user.id)

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 })
    }

    // Check if execution can be cancelled
    if (!["pending", "running"].includes(execution.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel execution with status '${execution.status}'. Only pending or running executions can be cancelled.`,
        },
        { status: 400 }
      )
    }

    // TODO: Replace mock DB with Supabase integration
    // const { data: updatedExecution, error } = await supabase
    //   .from("bot_runs")
    //   .update({
    //     status: "cancelled",
    //     completed_at: new Date().toISOString(),
    //     error: "Execution cancelled by user",
    //   })
    //   .eq("id", executionId)
    //   .select()
    //   .single()

    // Cancel execution in mock database
    const cancelledExecution = await cancelExecution(executionId, session.user.id)

    if (!cancelledExecution) {
      return NextResponse.json(
        { error: "Failed to cancel execution" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: "Execution cancelled successfully",
        execution: cancelledExecution,
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
