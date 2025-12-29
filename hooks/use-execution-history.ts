"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"

export interface ExecutionRun {
  id: string
  bot_id: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  trigger_type: "manual" | "scheduled" | "webhook"
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  result: Record<string, unknown> | null
  error: string | null
  logs: Array<{ timestamp: string; level: string; message: string }> | null
  bot?: {
    id: string
    name: string
    status: string
  }
}

export interface UseExecutionHistoryOptions {
  botId?: string
  limit?: number
  status?: ExecutionRun["status"]
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface UseExecutionHistoryReturn {
  runs: ExecutionRun[]
  loading: boolean
  error: string | null
  hasMore: boolean
  total: number
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  isRefreshing: boolean
}

export function useExecutionHistory(
  options: UseExecutionHistoryOptions = {}
): UseExecutionHistoryReturn {
  const {
    botId,
    limit = 20,
    status,
    autoRefresh = true,
    refreshInterval = 5000,
  } = options

  const [runs, setRuns] = useState<ExecutionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchRuns = useCallback(
    async (isLoadMore = false, isBackgroundRefresh = false) => {
      try {
        if (!isBackgroundRefresh) {
          if (isLoadMore) {
            setIsRefreshing(true)
          } else {
            setLoading(true)
          }
        }
        setError(null)

        const currentOffset = isLoadMore ? offset : 0

        let query = supabase
          .from("bot_runs")
          .select("*, bot:bots(id, name, status)", { count: "exact" })
          .order("started_at", { ascending: false })
          .range(currentOffset, currentOffset + limit - 1)

        if (botId) {
          query = query.eq("bot_id", botId)
        }

        if (status) {
          query = query.eq("status", status)
        }

        const { data, error: queryError, count } = await query

        if (queryError) {
          throw queryError
        }

        const fetchedRuns = (data || []) as ExecutionRun[]

        if (isLoadMore) {
          setRuns((prev) => [...prev, ...fetchedRuns])
          setOffset((prev) => prev + fetchedRuns.length)
        } else {
          setRuns(fetchedRuns)
          setOffset(fetchedRuns.length)
        }

        setTotal(count || 0)
        setHasMore((count || 0) > currentOffset + fetchedRuns.length)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch execution history")
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [botId, limit, status, offset]
  )

  const refresh = useCallback(async () => {
    setOffset(0)
    await fetchRuns(false, false)
  }, [fetchRuns])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || isRefreshing) return
    await fetchRuns(true, false)
  }, [fetchRuns, hasMore, loading, isRefreshing])

  // Initial fetch
  useEffect(() => {
    fetchRuns(false, false)
  }, [botId, status])

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchRuns(false, true)
      }, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, fetchRuns])

  return {
    runs,
    loading,
    error,
    hasMore,
    total,
    refresh,
    loadMore,
    isRefreshing,
  }
}

// Helper function to format duration
export function formatDuration(ms: number | null): string {
  if (ms === null) return "N/A"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

// Helper function to format relative time
export function formatRelativeTime(date: string | null): string {
  if (!date) return "Never"
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 0) return "Just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

// Helper to get status configuration
export function getStatusConfig(status: ExecutionRun["status"]) {
  const configs = {
    pending: {
      color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
      bgColor: "bg-zinc-500",
      label: "Pending",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    running: {
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      bgColor: "bg-blue-500",
      label: "Running",
      icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    },
    completed: {
      color: "bg-green-500/20 text-green-400 border-green-500/30",
      bgColor: "bg-green-500",
      label: "Completed",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    failed: {
      color: "bg-red-500/20 text-red-400 border-red-500/30",
      bgColor: "bg-red-500",
      label: "Failed",
      icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    cancelled: {
      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      bgColor: "bg-yellow-500",
      label: "Cancelled",
      icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    },
  }
  return configs[status] || configs.pending
}

// Helper to get trigger type configuration
export function getTriggerConfig(triggerType: ExecutionRun["trigger_type"]) {
  const configs = {
    manual: {
      color: "text-purple-400 bg-purple-500/10",
      label: "Manual",
      icon: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122",
    },
    scheduled: {
      color: "text-blue-400 bg-blue-500/10",
      label: "Scheduled",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    webhook: {
      color: "text-green-400 bg-green-500/10",
      label: "Webhook",
      icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
    },
  }
  return configs[triggerType] || configs.manual
}
