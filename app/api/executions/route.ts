import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase"
import {
  getExecutions,
  type ExecutionFilters,
  type ExecutionStatus,
  type TriggerType,
} from "@/lib/db/bots"

/**
 * GET /api/executions
 * List executions with filtering (botId, status, dateRange)
 * Supports pagination
 *
 * Query parameters:
 * - botId: Filter by bot ID
 * - status: Filter by status (pending, running, completed, failed, cancelled)
 * - triggerType: Filter by trigger type (manual, schedule, webhook)
 * - dateFrom: Filter by start date (ISO 8601)
 * - dateTo: Filter by end date (ISO 8601)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    const botId = searchParams.get("botId") || undefined
    const status = searchParams.get("status") as ExecutionStatus | null
    const triggerType = searchParams.get("triggerType") as TriggerType | null
    const dateFrom = searchParams.get("dateFrom") || undefined
    const dateTo = searchParams.get("dateTo") || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))

    // Validate status if provided
    const validStatuses: ExecutionStatus[] = ["pending", "running", "completed", "failed", "cancelled"]
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate trigger type if provided
    const validTriggerTypes: TriggerType[] = ["manual", "schedule", "webhook"]
    if (triggerType && !validTriggerTypes.includes(triggerType)) {
      return NextResponse.json(
        { error: `Invalid triggerType. Must be one of: ${validTriggerTypes.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate date formats if provided
    if (dateFrom) {
      const date = new Date(dateFrom)
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid dateFrom format. Please provide an ISO 8601 date string" },
          { status: 400 }
        )
      }
    }

    if (dateTo) {
      const date = new Date(dateTo)
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Invalid dateTo format. Please provide an ISO 8601 date string" },
          { status: 400 }
        )
      }
    }

    // Build filters
    const filters: ExecutionFilters = {
      userId: session.user.id, // Always filter by authenticated user
      botId,
      status: status || undefined,
      triggerType: triggerType || undefined,
      dateFrom,
      dateTo,
    }

    // TODO: Replace mock DB with Supabase integration
    // let query = supabase
    //   .from('bot_runs')
    //   .select('*, bots!inner(user_id)', { count: 'exact' })
    //   .eq('bots.user_id', session.user.id)
    //
    // if (filters.botId) query = query.eq('bot_id', filters.botId)
    // if (filters.status) query = query.eq('status', filters.status)
    // if (filters.dateFrom) query = query.gte('started_at', filters.dateFrom)
    // if (filters.dateTo) query = query.lte('started_at', filters.dateTo)
    //
    // const { data, count, error } = await query
    //   .order('started_at', { ascending: false })
    //   .range(offset, offset + limit - 1)

    // Fetch executions from mock database
    const result = await getExecutions(filters, { page, limit })

    return NextResponse.json(
      {
        executions: result.data,
        pagination: result.pagination,
        filters: {
          botId: botId || null,
          status: status || null,
          triggerType: triggerType || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
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
