"use client"

import { useEffect, useRef, useState } from "react"
import {
  ExecutionRun,
  formatDuration,
  getStatusConfig,
  getTriggerConfig,
} from "@/hooks/use-execution-history"
import { cn } from "@/lib/utils"

interface ExecutionDetailModalProps {
  run: ExecutionRun | null
  isOpen: boolean
  onClose: () => void
}

type TabType = "overview" | "logs" | "result"

export function ExecutionDetailModal({
  run,
  isOpen,
  onClose,
}: ExecutionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const modalRef = useRef<HTMLDivElement>(null)

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("overview")
    }
  }, [isOpen])

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !run) return null

  const statusConfig = getStatusConfig(run.status)
  const triggerConfig = getTriggerConfig(run.trigger_type)
  const isRunning = run.status === "running"

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "logs", label: "Logs", count: run.logs?.length || 0 },
    { id: "result", label: "Result" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="w-full max-w-3xl max-h-[90vh] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                statusConfig.color,
                isRunning && "animate-pulse"
              )}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={statusConfig.icon}
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {run.bot?.name || "Bot Execution"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    statusConfig.color
                  )}
                >
                  {statusConfig.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    triggerConfig.color
                  )}
                >
                  {triggerConfig.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-xs text-zinc-500">({tab.count})</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Error Alert */}
              {run.status === "failed" && run.error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <h4 className="font-medium text-red-400">Execution Failed</h4>
                      <p className="text-sm text-red-300 mt-1">{run.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Started"
                  value={new Date(run.started_at).toLocaleTimeString()}
                  subValue={new Date(run.started_at).toLocaleDateString()}
                />
                <StatCard
                  label="Completed"
                  value={
                    run.completed_at
                      ? new Date(run.completed_at).toLocaleTimeString()
                      : "In progress..."
                  }
                  subValue={
                    run.completed_at
                      ? new Date(run.completed_at).toLocaleDateString()
                      : undefined
                  }
                  isActive={isRunning}
                />
                <StatCard
                  label="Duration"
                  value={formatDuration(run.duration_ms)}
                  isActive={isRunning}
                />
                <StatCard
                  label="Trigger"
                  value={triggerConfig.label}
                  icon={triggerConfig.icon}
                />
              </div>

              {/* Execution Details */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/50">
                <div className="px-4 py-3 border-b border-zinc-700">
                  <h3 className="font-medium text-white">Execution Details</h3>
                </div>
                <div className="p-4 space-y-3">
                  <DetailRow label="Run ID" value={run.id} mono />
                  <DetailRow label="Bot ID" value={run.bot_id} mono />
                  <DetailRow label="Status" value={run.status} />
                  <DetailRow label="Trigger Type" value={run.trigger_type} />
                  {run.duration_ms && (
                    <DetailRow
                      label="Duration (ms)"
                      value={run.duration_ms.toLocaleString()}
                    />
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/50">
                <div className="px-4 py-3 border-b border-zinc-700">
                  <h3 className="font-medium text-white">Timeline</h3>
                </div>
                <div className="p-4">
                  <div className="relative pl-6 space-y-4">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-zinc-700" />

                    <TimelineItem
                      time={run.started_at}
                      label="Execution Started"
                      status="completed"
                    />

                    {isRunning && (
                      <TimelineItem
                        time={new Date().toISOString()}
                        label="Executing..."
                        status="active"
                      />
                    )}

                    {run.completed_at && (
                      <TimelineItem
                        time={run.completed_at}
                        label={
                          run.status === "completed"
                            ? "Execution Completed Successfully"
                            : run.status === "failed"
                            ? "Execution Failed"
                            : "Execution Ended"
                        }
                        status={run.status === "completed" ? "completed" : "failed"}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-4">
              {run.logs && run.logs.length > 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                  <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-400">
                      {run.logs.length} log entries
                    </span>
                    <button className="text-xs text-zinc-500 hover:text-white">
                      Copy All
                    </button>
                  </div>
                  <div className="p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    {run.logs.map((log, index) => (
                      <div
                        key={index}
                        className={cn(
                          "py-1 flex gap-3",
                          log.level === "error" && "text-red-400",
                          log.level === "warn" && "text-yellow-400",
                          log.level === "info" && "text-zinc-300",
                          log.level === "debug" && "text-zinc-500"
                        )}
                      >
                        <span className="text-zinc-600 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={cn(
                            "uppercase text-xs py-0.5 px-1.5 rounded shrink-0",
                            log.level === "error" && "bg-red-500/20",
                            log.level === "warn" && "bg-yellow-500/20",
                            log.level === "info" && "bg-blue-500/20",
                            log.level === "debug" && "bg-zinc-700"
                          )}
                        >
                          {log.level}
                        </span>
                        <span className="break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg
                    className="h-12 w-12 text-zinc-600 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-zinc-400">No logs available for this execution</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "result" && (
            <div className="space-y-4">
              {run.result && Object.keys(run.result).length > 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                  <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-400">
                      Execution Result
                    </span>
                    <button className="text-xs text-zinc-500 hover:text-white">
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto max-h-96">
                    {JSON.stringify(run.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg
                    className="h-12 w-12 text-zinc-600 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-zinc-400">
                    {run.status === "running"
                      ? "Results will appear when execution completes"
                      : "No result data available for this execution"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
          <div className="flex gap-2">
            {isRunning && (
              <button className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                Cancel Execution
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper Components
function StatCard({
  label,
  value,
  subValue,
  icon,
  isActive,
}: {
  label: string
  value: string
  subValue?: string
  icon?: string
  isActive?: boolean
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {icon && (
          <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        )}
        <p className={cn("text-lg font-semibold text-white", isActive && "text-blue-400")}>
          {value}
        </p>
      </div>
      {subValue && <p className="text-xs text-zinc-500 mt-0.5">{subValue}</p>}
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("text-white", mono && "font-mono text-xs")}>{value}</span>
    </div>
  )
}

function TimelineItem({
  time,
  label,
  status,
}: {
  time: string
  label: string
  status: "completed" | "active" | "failed"
}) {
  return (
    <div className="relative flex items-center gap-3">
      <div
        className={cn(
          "absolute -left-4 h-3 w-3 rounded-full border-2 border-zinc-900",
          status === "completed" && "bg-green-500",
          status === "active" && "bg-blue-500 animate-pulse",
          status === "failed" && "bg-red-500"
        )}
      />
      <div className="flex-1 flex items-center justify-between">
        <span className="text-sm text-white">{label}</span>
        <span className="text-xs text-zinc-500">
          {new Date(time).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}
