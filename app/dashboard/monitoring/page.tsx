"use client"

import { useState, useEffect, useCallback } from "react"

interface BotStatus {
  id: string
  name: string
  status: "active" | "paused" | "stopped" | "running" | "error"
  health: "healthy" | "warning" | "critical" | "unknown"
  lastRun: string | null
  lastDuration: number | null
  successRate: number
  runsToday: number
  errorsToday: number
  avgResponseTime: number
  uptime: number
  currentAction?: string
}

// Mock data - in production this would come from real-time WebSocket/polling
const mockBots: BotStatus[] = [
  {
    id: "1",
    name: "Data Sync Bot",
    status: "running",
    health: "healthy",
    lastRun: new Date(Date.now() - 60000).toISOString(),
    lastDuration: 2340,
    successRate: 99.2,
    runsToday: 156,
    errorsToday: 1,
    avgResponseTime: 234,
    uptime: 99.9,
    currentAction: "Syncing records 1,234 - 1,500",
  },
  {
    id: "2",
    name: "Email Automation",
    status: "active",
    health: "healthy",
    lastRun: new Date(Date.now() - 300000).toISOString(),
    lastDuration: 1250,
    successRate: 98.5,
    runsToday: 42,
    errorsToday: 0,
    avgResponseTime: 180,
    uptime: 99.5,
  },
  {
    id: "3",
    name: "Report Generator",
    status: "running",
    health: "warning",
    lastRun: new Date(Date.now() - 120000).toISOString(),
    lastDuration: 8500,
    successRate: 95.0,
    runsToday: 12,
    errorsToday: 1,
    avgResponseTime: 4500,
    uptime: 98.2,
    currentAction: "Generating Q4 report...",
  },
  {
    id: "4",
    name: "Webhook Handler",
    status: "active",
    health: "healthy",
    lastRun: new Date(Date.now() - 5000).toISOString(),
    lastDuration: 89,
    successRate: 99.9,
    runsToday: 1892,
    errorsToday: 2,
    avgResponseTime: 45,
    uptime: 100,
  },
  {
    id: "5",
    name: "Backup Bot",
    status: "error",
    health: "critical",
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    lastDuration: null,
    successRate: 75.0,
    runsToday: 3,
    errorsToday: 1,
    avgResponseTime: 12000,
    uptime: 85.5,
  },
  {
    id: "6",
    name: "Lead Scraper",
    status: "paused",
    health: "unknown",
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    lastDuration: 5600,
    successRate: 92.3,
    runsToday: 0,
    errorsToday: 0,
    avgResponseTime: 3200,
    uptime: 0,
  },
]

export default function MonitoringPage() {
  const [bots, setBots] = useState<BotStatus[]>(mockBots)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [filter, setFilter] = useState<"all" | "running" | "issues">("all")

  const refreshData = useCallback(() => {
    // In production, fetch from API
    // Simulate slight changes for demo
    setBots(prev =>
      prev.map(bot => ({
        ...bot,
        runsToday: bot.status === "running" ? bot.runsToday + Math.floor(Math.random() * 2) : bot.runsToday,
        avgResponseTime: bot.avgResponseTime + Math.floor(Math.random() * 20) - 10,
      }))
    )
    setLastUpdate(new Date())
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshData, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refreshData])

  const getStatusColor = (status: BotStatus["status"]) => {
    switch (status) {
      case "running":
        return "text-blue-400 bg-blue-500/10 border-blue-500/50"
      case "active":
        return "text-green-400 bg-green-500/10 border-green-500/50"
      case "paused":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/50"
      case "stopped":
        return "text-zinc-400 bg-zinc-500/10 border-zinc-500/50"
      case "error":
        return "text-red-400 bg-red-500/10 border-red-500/50"
    }
  }

  const getHealthColor = (health: BotStatus["health"]) => {
    switch (health) {
      case "healthy":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "critical":
        return "bg-red-500"
      case "unknown":
        return "bg-zinc-500"
    }
  }

  const getHealthIcon = (health: BotStatus["health"]) => {
    switch (health) {
      case "healthy":
        return "M5 13l4 4L19 7"
      case "warning":
        return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      case "critical":
        return "M6 18L18 6M6 6l12 12"
      case "unknown":
        return "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    }
  }

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "N/A"
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Never"
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const filteredBots = bots.filter(bot => {
    if (filter === "running") return bot.status === "running"
    if (filter === "issues") return bot.health === "critical" || bot.health === "warning"
    return true
  })

  const stats = {
    total: bots.length,
    running: bots.filter(b => b.status === "running").length,
    healthy: bots.filter(b => b.health === "healthy").length,
    issues: bots.filter(b => b.health === "critical" || b.health === "warning").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Real-Time Monitoring</h1>
          <p className="text-zinc-400">
            Live status updates for all your bots • Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-zinc-400">Auto-refresh:</label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                autoRefresh ? "bg-blue-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoRefresh ? "left-5" : "left-0.5"
                }`}
              />
            </button>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-sm"
              >
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            )}
          </div>
          <button
            onClick={refreshData}
            className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Bots</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Currently Running</p>
          <p className="text-2xl font-bold text-blue-400">{stats.running}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Healthy</p>
          <p className="text-2xl font-bold text-green-400">{stats.healthy}</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Issues</p>
          <p className="text-2xl font-bold text-red-400">{stats.issues}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "running", "issues"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${viewMode === "grid" ? "bg-zinc-700" : ""}`}
          >
            <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${viewMode === "list" ? "bg-zinc-700" : ""}`}
          >
            <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bot Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBots.map((bot) => (
            <div
              key={bot.id}
              className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getHealthColor(bot.health)} ${bot.status === "running" ? "animate-pulse" : ""}`} />
                  <h3 className="font-semibold text-white">{bot.name}</h3>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(bot.status)}`}>
                  {bot.status}
                </span>
              </div>

              {bot.currentAction && (
                <div className="mb-4 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">{bot.currentAction}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500">Last Run</p>
                  <p className="text-zinc-300">{formatTimeAgo(bot.lastRun)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Duration</p>
                  <p className="text-zinc-300">{formatDuration(bot.lastDuration)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Today</p>
                  <p className="text-zinc-300">{bot.runsToday} runs</p>
                </div>
                <div>
                  <p className="text-zinc-500">Errors</p>
                  <p className={bot.errorsToday > 0 ? "text-red-400" : "text-green-400"}>
                    {bot.errorsToday}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Success Rate</span>
                  <span className={bot.successRate >= 95 ? "text-green-400" : bot.successRate >= 85 ? "text-yellow-400" : "text-red-400"}>
                    {bot.successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      bot.successRate >= 95 ? "bg-green-500" : bot.successRate >= 85 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${bot.successRate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-900 border-b border-zinc-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Bot</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Health</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Last Run</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Runs Today</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Errors</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Success Rate</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Avg Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {filteredBots.map((bot) => (
                <tr key={bot.id} className="hover:bg-zinc-700/50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{bot.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(bot.status)}`}>
                      {bot.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getHealthColor(bot.health)}`} />
                      <span className="text-sm text-zinc-400 capitalize">{bot.health}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">
                    {formatTimeAgo(bot.lastRun)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-300">
                    {bot.runsToday}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={bot.errorsToday > 0 ? "text-red-400" : "text-green-400"}>
                      {bot.errorsToday}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={bot.successRate >= 95 ? "text-green-400" : bot.successRate >= 85 ? "text-yellow-400" : "text-red-400"}>
                      {bot.successRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">
                    {bot.avgResponseTime}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Live Activity Feed */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live Activity
        </h2>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{new Date().toLocaleTimeString()}</span>
            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">SUCCESS</span>
            <span className="text-zinc-300">Webhook Handler processed event #4892</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{new Date(Date.now() - 5000).toLocaleTimeString()}</span>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">RUNNING</span>
            <span className="text-zinc-300">Data Sync Bot started batch sync</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{new Date(Date.now() - 15000).toLocaleTimeString()}</span>
            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">SUCCESS</span>
            <span className="text-zinc-300">Email Automation sent 3 emails</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{new Date(Date.now() - 30000).toLocaleTimeString()}</span>
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">WARNING</span>
            <span className="text-zinc-300">Report Generator experiencing slow response</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{new Date(Date.now() - 60000).toLocaleTimeString()}</span>
            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs">ERROR</span>
            <span className="text-zinc-300">Backup Bot failed: connection timeout</span>
          </div>
        </div>
      </div>
    </div>
  )
}
