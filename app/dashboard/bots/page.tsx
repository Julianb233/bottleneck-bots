'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Bot {
  id: string
  name: string
  description: string | null
  status: string
  bot_type: string
  last_run_at: string | null
  created_at: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'stopped'>('all')

  useEffect(() => {
    fetchBots()
  }, [])

  const fetchBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBots(data || [])
    } catch (error) {
      console.error('Error fetching bots:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBots = filter === 'all'
    ? bots
    : bots.filter(bot => bot.status === filter)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-500/10 border-green-500/50'
      case 'paused':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50'
      case 'stopped':
        return 'text-red-400 bg-red-500/10 border-red-500/50'
      default:
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500 mx-auto"></div>
          <p className="mt-4 text-zinc-400">Loading bots...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Bots</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage and monitor your automation bots</p>
        </div>
        <Link
          href="/dashboard/bots/new"
          className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Create New Bot
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'active', 'paused', 'stopped'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Bots Grid */}
      {filteredBots.length === 0 ? (
        <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-12 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-white mb-2">No bots yet</h3>
          <p className="text-sm text-zinc-400 mb-6">
            {filter === 'all'
              ? 'Create your first bot to start automating tasks'
              : `No ${filter} bots found`
            }
          </p>
          {filter === 'all' && (
            <Link
              href="/dashboard/bots/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
            >
              Create Your First Bot
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBots.map((bot) => (
            <Link
              key={bot.id}
              href={`/dashboard/bots/${bot.id}`}
              className="group rounded-xl bg-zinc-800 border border-zinc-700 p-6 hover:border-blue-500 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                    bot.status
                  )}`}
                >
                  {bot.status}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                {bot.name}
              </h3>

              {bot.description && (
                <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{bot.description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="capitalize">{bot.bot_type}</span>
                <span>
                  {bot.last_run_at
                    ? `Last run: ${new Date(bot.last_run_at).toLocaleDateString()}`
                    : 'Never run'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
