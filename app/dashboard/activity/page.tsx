"use client"

import { useState } from "react"

interface ActivityLog {
  id: string
  type: "bot_run" | "bot_created" | "bot_updated" | "bot_deleted" | "webhook" | "error"
  botName?: string
  botId?: string
  message: string
  status?: "success" | "failed" | "pending"
  timestamp: string
  details?: Record<string, unknown>
}

// Mock data - replace with real API calls
const mockLogs: ActivityLog[] = [
  {
    id: "1",
    type: "bot_run",
    botName: "Daily Report Bot",
    botId: "bot-1",
    message: "Bot execution completed successfully",
    status: "success",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    details: { duration: "2.3s", records: 150 }
  },
  {
    id: "2",
    type: "error",
    botName: "API Sync Bot",
    botId: "bot-2",
    message: "Connection timeout after 30s",
    status: "failed",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    details: { error: "ETIMEDOUT", retries: 3 }
  },
  {
    id: "3",
    type: "webhook",
    botName: "Slack Notifier",
    botId: "bot-3",
    message: "Webhook triggered by external service",
    status: "success",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "4",
    type: "bot_created",
    botName: "New Data Pipeline",
    botId: "bot-4",
    message: "New bot created from template",
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "5",
    type: "bot_run",
    botName: "Email Digest",
    botId: "bot-5",
    message: "Scheduled execution completed",
    status: "success",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    details: { emails: 45, opened: 12 }
  },
]

const typeIcons: Record<string, string> = {
  bot_run: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
  bot_created: "M12 4v16m8-8H4",
  bot_updated: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  bot_deleted: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  webhook: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  error: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
}

const typeColors: Record<string, string> = {
  bot_run: "text-blue-500 bg-blue-100",
  bot_created: "text-green-500 bg-green-100",
  bot_updated: "text-yellow-500 bg-yellow-100",
  bot_deleted: "text-red-500 bg-red-100",
  webhook: "text-purple-500 bg-purple-100",
  error: "text-red-500 bg-red-100",
}

const statusColors: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
}

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<string>("all")
  const [logs] = useState<ActivityLog[]>(mockLogs)

  const filteredLogs = filter === "all"
    ? logs
    : logs.filter(log => log.type === filter || (filter === "errors" && log.status === "failed"))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-600">Monitor all bot executions and system events</p>
        </div>
        <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: "all", label: "All" },
          { value: "bot_run", label: "Executions" },
          { value: "webhook", label: "Webhooks" },
          { value: "errors", label: "Errors" },
          { value: "bot_created", label: "Created" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No activity found
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-2 rounded-lg ${typeColors[log.type]}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcons[log.type]} />
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {log.botName && (
                      <span className="font-medium text-gray-900">{log.botName}</span>
                    )}
                    {log.status && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[log.status]}`}>
                        {log.status}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mt-0.5">{log.message}</p>
                  {log.details && (
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      {Object.entries(log.details).map(([key, value]) => (
                        <span key={key}>
                          <span className="font-medium">{key}:</span> {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {formatTimeAgo(log.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      <div className="text-center">
        <button className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800">
          Load more activity
        </button>
      </div>
    </div>
  )
}
