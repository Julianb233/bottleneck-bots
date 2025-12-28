"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface BotRun {
  id: string
  bot_id: string
  status: "pending" | "running" | "completed" | "failed"
  started_at: string
  completed_at: string | null
  result: Record<string, unknown> | null
  error: string | null
  bot?: { name: string }
}

export default function RunsPage() {
  const [runs, setRuns] = useState<BotRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 5000)
    return () => clearInterval(interval)
  }, [])

  async function fetchRuns() {
    const { data, error } = await supabase
      .from("bot_runs")
      .select("*, bot:bots(name)")
      .order("started_at", { ascending: false })
      .limit(50)
    if (!error && data) setRuns(data as BotRun[])
    setLoading(false)
  }

  const statusConfig = {
    pending: { color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    running: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
    completed: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString()
  }

  function formatDuration(start: string, end: string | null) {
    if (!end) return "Running..."
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 1000) return ms + "ms"
    if (ms < 60000) return (ms / 1000).toFixed(1) + "s"
    return (ms / 60000).toFixed(1) + "m"
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Bot Runs</h1>
        <p className="text-zinc-400 mt-1">Monitor execution history and results</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No runs yet</h3>
          <p className="text-zinc-500">Bot execution history will appear here</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Bot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Started</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {runs.map((run) => {
                const config = statusConfig[run.status]
                return (
                  <tr key={run.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{run.bot?.name || "Unknown Bot"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                        </svg>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{formatDate(run.started_at)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{formatDuration(run.started_at, run.completed_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {run.error ? (
                        <span className="text-red-400">{run.error}</span>
                      ) : run.result ? (
                        <span className="text-green-400">Success</span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
