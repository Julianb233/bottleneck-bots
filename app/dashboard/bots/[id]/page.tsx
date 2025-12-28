'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Bot {
  id: string
  name: string
  description: string | null
  status: string
  bot_type: string
  config: any
  last_run_at: string | null
  created_at: string
  updated_at: string
}

interface BotRun {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  error: string | null
}

export default function BotDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [bot, setBot] = useState<Bot | null>(null)
  const [runs, setRuns] = useState<BotRun[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'paused' | 'stopped',
  })

  useEffect(() => {
    fetchBotDetails()
    fetchBotRuns()
  }, [params.id])

  const fetchBotDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      setBot(data)
      setFormData({
        name: data.name,
        description: data.description || '',
        status: data.status,
      })
    } catch (error) {
      console.error('Error fetching bot:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBotRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_runs')
        .select('*')
        .eq('bot_id', params.id)
        .order('started_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRuns(data || [])
    } catch (error) {
      console.error('Error fetching runs:', error)
    }
  }

  const handleUpdate = async () => {
    try {
      const { error } = await supabase
        .from('bots')
        .update({
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
        })
        .eq('id', params.id)

      if (error) throw error

      await fetchBotDetails()
      setEditing(false)
    } catch (error) {
      console.error('Error updating bot:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('bots')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      router.push('/dashboard/bots')
    } catch (error) {
      console.error('Error deleting bot:', error)
      setDeleting(false)
    }
  }

  const handleRunBot = async () => {
    try {
      const { error } = await supabase
        .from('bot_runs')
        .insert({
          bot_id: params.id,
          status: 'pending',
        })

      if (error) throw error

      await fetchBotRuns()
    } catch (error) {
      console.error('Error running bot:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'text-green-400 bg-green-500/10 border-green-500/50'
      case 'paused':
      case 'running':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50'
      case 'stopped':
      case 'failed':
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
          <p className="mt-4 text-zinc-400">Loading bot...</p>
        </div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Bot not found</p>
        <Link href="/dashboard/bots" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
          Back to Bots
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/bots"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bots
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-3xl">🤖</span>
            </div>
            <div>
              {editing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-3xl font-bold bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1 text-white"
                />
              ) : (
                <h1 className="text-3xl font-bold text-white">{bot.name}</h1>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                    bot.status
                  )}`}
                >
                  {bot.status}
                </span>
                <span className="text-sm text-zinc-500 capitalize">{bot.bot_type}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={handleRunBot}
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Run Bot
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bot Details */}
      <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
            {editing ? (
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-white"
              />
            ) : (
              <p className="text-white">{bot.description || 'No description'}</p>
            )}
          </div>

          {editing && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Status</label>
              <div className="flex gap-3">
                {['active', 'paused', 'stopped'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData({ ...formData, status: status as any })}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${
                      formData.status === status
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-700">
            <div>
              <p className="text-sm text-zinc-400">Created</p>
              <p className="text-white">{new Date(bot.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Last Run</p>
              <p className="text-white">
                {bot.last_run_at ? new Date(bot.last_run_at).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="rounded-xl bg-zinc-800 border border-zinc-700">
        <div className="border-b border-zinc-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Recent Runs</h2>
        </div>
        <div className="p-6">
          {runs.length === 0 ? (
            <p className="text-center text-zinc-400 py-8">No runs yet</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-900 p-4"
                >
                  <div>
                    <p className="text-sm text-zinc-400">
                      {new Date(run.started_at).toLocaleString()}
                    </p>
                    {run.error && <p className="text-xs text-red-400 mt-1">{run.error}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    {run.duration_ms && (
                      <span className="text-sm text-zinc-400">
                        {(run.duration_ms / 1000).toFixed(2)}s
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                        run.status
                      )}`}
                    >
                      {run.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-6">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Once you delete a bot, there is no going back. Please be certain.
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete This Bot'}
        </button>
      </div>
    </div>
  )
}
