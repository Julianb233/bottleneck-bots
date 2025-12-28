'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NewBotPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bot_type: 'custom',
    status: 'active' as 'active' | 'paused' | 'stopped',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('bots')
        .insert({
          user_id: user.id,
          name: formData.name,
          description: formData.description || null,
          bot_type: formData.bot_type,
          status: formData.status,
          config: {},
        })
        .select()
        .single()

      if (error) throw error

      router.push(`/dashboard/bots/${data.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create bot')
    } finally {
      setLoading(false)
    }
  }

  const botTypes = [
    { value: 'custom', label: 'Custom Bot', description: 'Build your own automation from scratch' },
    { value: 'webhook', label: 'Webhook Bot', description: 'Trigger actions via webhooks' },
    { value: 'scheduler', label: 'Scheduled Bot', description: 'Run tasks on a schedule' },
    { value: 'monitor', label: 'Monitor Bot', description: 'Monitor websites or APIs' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
        <h1 className="text-3xl font-bold text-white">Create New Bot</h1>
        <p className="mt-1 text-sm text-zinc-400">Set up a new automation bot</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Bot Name */}
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
              Bot Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="My Awesome Bot"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="What does this bot do?"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Bot Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Bot Type <span className="text-red-400">*</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {botTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, bot_type: type.value })}
                  className={`text-left rounded-lg border p-4 transition-all ${
                    formData.bot_type === type.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium text-white mb-1">{type.label}</div>
                  <div className="text-xs text-zinc-400">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Initial Status <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              {['active', 'paused', 'stopped'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: status as any })}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    formData.status === status
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/bots"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Bot'}
          </button>
        </div>
      </form>
    </div>
  )
}
