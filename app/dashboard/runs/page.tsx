"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import {
  useExecutionHistory,
  ExecutionRun,
  getStatusConfig,
} from "@/hooks/use-execution-history"
import {
  ExecutionTimeline,
  ExecutionDetailModal,
} from "@/components/execution-history"
import { cn } from "@/lib/utils"

interface Bot {
  id: string
  name: string
  status: string
}

type StatusFilter = ExecutionRun["status"] | "all"

export default function RunsPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [botFilter, setBotFilter] = useState<string>("all")
  const [bots, setBots] = useState<Bot[]>([])
  const [botsLoading, setBotsLoading] = useState(true)

  // Modal state
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Use the execution history hook with filters
  const {
    runs,
    loading,
    error,
    hasMore,
    total,
    refresh,
    loadMore,
    isRefreshing,
  } = useExecutionHistory({
    botId: botFilter !== "all" ? botFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 20,
    autoRefresh: true,
    refreshInterval: 5000,
  })

  // Fetch bots for filter dropdown
  useEffect(() => {
    async function fetchBots() {
      setBotsLoading(true)
      const { data, error } = await supabase
        .from("bots")
        .select("id, name, status")
        .order("name", { ascending: true })
      if (!error && data) {
        setBots(data as Bot[])
      }
      setBotsLoading(false)
    }
    fetchBots()
  }, [])

  // Status options for filter
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "running", label: "Running" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
  ]

  // Stats calculations
  const stats = useMemo(() => {
    const completedRuns = runs.filter((r) => r.status === "completed").length
    const failedRuns = runs.filter((r) => r.status === "failed").length
    const runningRuns = runs.filter((r) => r.status === "running").length
    const successRate =
      completedRuns + failedRuns > 0
        ? Math.round((completedRuns / (completedRuns + failedRuns)) * 100)
        : 0
    return { completedRuns, failedRuns, runningRuns, successRate }
  }, [runs])

  // Handle run click to open modal
  function handleRunClick(run: ExecutionRun) {
    setSelectedRun(run)
    setIsModalOpen(true)
  }

  // Handle modal close
  function handleCloseModal() {
    setIsModalOpen(false)
    setSelectedRun(null)
  }

  // Clear filters
  function clearFilters() {
    setStatusFilter("all")
    setBotFilter("all")
  }

  const hasActiveFilters = statusFilter !== "all" || botFilter !== "all"

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Bot Runs</h1>
            <p className="text-zinc-400 mt-1">
              Monitor execution history and results
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading || isRefreshing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <svg
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Runs"
            value={total.toString()}
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
          <StatCard
            label="Running"
            value={stats.runningRuns.toString()}
            icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            color="text-blue-400"
          />
          <StatCard
            label="Completed"
            value={stats.completedRuns.toString()}
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            color="text-green-400"
          />
          <StatCard
            label="Success Rate"
            value={`${stats.successRate}%`}
            icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            color={stats.successRate >= 80 ? "text-green-400" : stats.successRate >= 50 ? "text-yellow-400" : "text-red-400"}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bot Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Bot:</label>
          <select
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
            disabled={botsLoading}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="all">All Bots</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear Filters
          </button>
        )}

        {/* Results Count */}
        {!loading && (
          <div className="ml-auto text-sm text-zinc-500">
            Showing {runs.length} of {total} runs
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-400 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="font-medium text-red-400">
                Failed to load execution history
              </h4>
              <p className="text-sm text-red-300 mt-1">{error}</p>
              <button
                onClick={refresh}
                className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Component */}
      <ExecutionTimeline
        runs={runs}
        loading={loading}
        onRunClick={handleRunClick}
        showBotName={botFilter === "all"}
      />

      {/* Load More Button */}
      {hasMore && !loading && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={isRefreshing}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-medium transition-colors",
              "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isRefreshing ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <ExecutionDetailModal
        run={selectedRun}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}

// Stats Card Component
function StatCard({
  label,
  value,
  icon,
  color = "text-white",
}: {
  label: string
  value: string
  icon: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
          <svg
            className={cn("h-5 w-5", color)}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={icon}
            />
          </svg>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            {label}
          </p>
          <p className={cn("text-xl font-semibold", color)}>{value}</p>
        </div>
      </div>
    </div>
  )
}
