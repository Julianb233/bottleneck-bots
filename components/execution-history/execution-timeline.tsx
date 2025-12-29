"use client"

import { useState } from "react"
import {
  ExecutionRun,
  formatDuration,
  formatRelativeTime,
  getStatusConfig,
  getTriggerConfig,
} from "@/hooks/use-execution-history"
import { cn } from "@/lib/utils"

interface ExecutionTimelineProps {
  runs: ExecutionRun[]
  loading?: boolean
  onRunClick?: (run: ExecutionRun) => void
  showBotName?: boolean
  className?: string
}

export function ExecutionTimeline({
  runs,
  loading = false,
  onRunClick,
  showBotName = true,
  className,
}: ExecutionTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="h-10 w-10 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-zinc-800" />
              <div className="h-3 w-1/2 rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed border-zinc-700 p-12 text-center", className)}>
        <div className="mx-auto h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-1">No executions yet</h3>
        <p className="text-zinc-500">Bot execution history will appear here</p>
      </div>
    )
  }

  // Group runs by date
  const groupedRuns = runs.reduce<Record<string, ExecutionRun[]>>((acc, run) => {
    const date = new Date(run.started_at).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(run)
    return acc
  }, {})

  return (
    <div className={cn("space-y-6", className)}>
      {Object.entries(groupedRuns).map(([date, dateRuns]) => (
        <div key={date}>
          {/* Date Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-sm font-medium text-zinc-400">{date}</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* Timeline Items */}
          <div className="relative pl-6">
            {/* Timeline Line */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-zinc-800" />

            <div className="space-y-3">
              {dateRuns.map((run, index) => {
                const statusConfig = getStatusConfig(run.status)
                const triggerConfig = getTriggerConfig(run.trigger_type)
                const isExpanded = expandedId === run.id
                const isRunning = run.status === "running"

                return (
                  <div
                    key={run.id}
                    className={cn(
                      "relative rounded-xl border transition-all duration-200 cursor-pointer",
                      "hover:border-zinc-600",
                      isExpanded
                        ? "border-zinc-600 bg-zinc-800/50"
                        : "border-zinc-800 bg-zinc-900/50"
                    )}
                    onClick={() => {
                      if (onRunClick) {
                        onRunClick(run)
                      } else {
                        setExpandedId(isExpanded ? null : run.id)
                      }
                    }}
                  >
                    {/* Timeline Dot */}
                    <div
                      className={cn(
                        "absolute -left-4 top-5 h-3 w-3 rounded-full border-2 border-zinc-900",
                        statusConfig.bgColor,
                        isRunning && "animate-pulse"
                      )}
                    />

                    {/* Main Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left Side: Status Icon & Info */}
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                              statusConfig.color
                            )}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={statusConfig.icon}
                              />
                            </svg>
                          </div>

                          <div className="min-w-0">
                            {showBotName && run.bot && (
                              <h4 className="font-semibold text-white truncate">
                                {run.bot.name}
                              </h4>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                                  statusConfig.color
                                )}
                              >
                                {statusConfig.label}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                  triggerConfig.color
                                )}
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={triggerConfig.icon}
                                  />
                                </svg>
                                {triggerConfig.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Time & Duration */}
                        <div className="text-right shrink-0">
                          <p className="text-sm text-white">
                            {new Date(run.started_at).toLocaleTimeString()}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {run.status === "running" ? (
                              <span className="text-blue-400">In progress...</span>
                            ) : (
                              <>Duration: {formatDuration(run.duration_ms)}</>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Error Message (if failed) */}
                      {run.status === "failed" && run.error && (
                        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                          <p className="text-sm text-red-400 line-clamp-2">{run.error}</p>
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && !onRunClick && (
                        <div className="mt-4 pt-4 border-t border-zinc-700 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-500">Started</p>
                              <p className="text-white">
                                {new Date(run.started_at).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Completed</p>
                              <p className="text-white">
                                {run.completed_at
                                  ? new Date(run.completed_at).toLocaleString()
                                  : "In progress"}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Run ID</p>
                              <p className="text-white font-mono text-xs">{run.id}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Trigger</p>
                              <p className="text-white capitalize">{run.trigger_type}</p>
                            </div>
                          </div>

                          {/* Result Preview */}
                          {run.result && Object.keys(run.result).length > 0 && (
                            <div>
                              <p className="text-zinc-500 text-sm mb-1">Result</p>
                              <pre className="text-xs text-zinc-300 bg-zinc-900 rounded-lg p-3 overflow-x-auto max-h-32">
                                {JSON.stringify(run.result, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Logs Preview */}
                          {run.logs && run.logs.length > 0 && (
                            <div>
                              <p className="text-zinc-500 text-sm mb-1">
                                Logs ({run.logs.length} entries)
                              </p>
                              <div className="text-xs bg-zinc-900 rounded-lg p-3 max-h-32 overflow-y-auto font-mono">
                                {run.logs.slice(0, 5).map((log, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "py-0.5",
                                      log.level === "error" && "text-red-400",
                                      log.level === "warn" && "text-yellow-400",
                                      log.level === "info" && "text-zinc-300"
                                    )}
                                  >
                                    <span className="text-zinc-500">
                                      [{new Date(log.timestamp).toLocaleTimeString()}]
                                    </span>{" "}
                                    <span className="uppercase">[{log.level}]</span> {log.message}
                                  </div>
                                ))}
                                {run.logs.length > 5 && (
                                  <p className="text-zinc-500 pt-1">
                                    ... and {run.logs.length - 5} more
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand Indicator */}
                    {!onRunClick && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <svg
                          className={cn(
                            "h-5 w-5 text-zinc-500 transition-transform",
                            isExpanded && "rotate-180"
                          )}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
