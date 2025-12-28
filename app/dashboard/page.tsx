"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Bot {
  id: string
  name: string
  description: string | null
  status: "active" | "paused" | "stopped"
  created_at: string
  config: Record<string, unknown>
}

export default function DashboardPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBot, setNewBot] = useState({ name: "", description: "" })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchBots()
  }, [])

  async function fetchBots() {
    const { data, error } = await supabase.from("bots").select("*").order("created_at", { ascending: false })
    if (!error && data) setBots(data)
    setLoading(false)
  }

  async function createBot() {
    if (!newBot.name.trim()) return
    setCreating(true)
    const { error } = await supabase.from("bots").insert({
      name: newBot.name,
      description: newBot.description || null,
      user_id: "00000000-0000-0000-0000-000000000000",
      status: "stopped",
      config: {}
    })
    if (!error) {
      setNewBot({ name: "", description: "" })
      setShowCreateModal(false)
      fetchBots()
    }
    setCreating(false)
  }

  async function deleteBot(id: string) {
    if (!confirm("Delete this bot?")) return
    await supabase.from("bots").delete().eq("id", id)
    fetchBots()
  }

  async function toggleBotStatus(bot: Bot) {
    const newStatus = bot.status === "active" ? "paused" : "active"
    await supabase.from("bots").update({ status: newStatus }).eq("id", bot.id)
    fetchBots()
  }

  const statusColors = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    stopped: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Bots</h1>
          <p className="text-zinc-400 mt-1">Manage your automation bots</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Bot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
        </div>
      ) : bots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No bots yet</h3>
          <p className="text-zinc-500 mb-4">Create your first bot to get started</p>
          <button onClick={() => setShowCreateModal(true)} className="text-blue-400 hover:text-blue-300 text-sm font-medium">Create a bot →</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <div key={bot.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[bot.status]}`}>{bot.status}</span>
              </div>
              <h3 className="font-semibold text-white mb-1">{bot.name}</h3>
              <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{bot.description || "No description"}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleBotStatus(bot)} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${bot.status === "active" ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                  {bot.status === "active" ? "Pause" : "Start"}
                </button>
                <button onClick={() => deleteBot(bot.id)} className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Bot</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
                <input type="text" value={newBot.name} onChange={(e) => setNewBot({ ...newBot, name: e.target.value })} placeholder="My Awesome Bot" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
                <textarea value={newBot.description} onChange={(e) => setNewBot({ ...newBot, description: e.target.value })} placeholder="What does this bot do?" rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={createBot} disabled={creating || !newBot.name.trim()} className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                {creating ? "Creating..." : "Create Bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
