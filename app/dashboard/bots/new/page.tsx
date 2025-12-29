'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface TemplateField {
  key: string
  label: string
  type: 'text' | 'url' | 'email' | 'select' | 'cron' | 'textarea' | 'number'
  placeholder?: string
  required: boolean
  default?: string | number
  options?: Array<{ label: string; value: string }>
  helpText?: string
}

interface Template {
  id: string
  name: string
  description: string
  category: string
  icon: string
  config: {
    type: string
    schedule?: string
    actions: unknown[]
  }
  configSchema: {
    fields: TemplateField[]
  }
  setupInstructions?: string
}

export default function NewBotPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  const [loading, setLoading] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [templateValues, setTemplateValues] = useState<Record<string, string | number>>({})

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bot_type: 'custom',
    status: 'active' as 'active' | 'paused' | 'stopped',
  })

  // Fetch template if templateId is provided
  useEffect(() => {
    if (templateId) {
      fetchTemplate(templateId)
    }
  }, [templateId])

  const fetchTemplate = async (id: string) => {
    setLoadingTemplate(true)
    try {
      const res = await fetch(`/api/templates?id=${id}`)
      if (!res.ok) throw new Error('Template not found')
      const data = await res.json()
      setTemplate(data.template)
      // Pre-fill bot name and description
      setFormData(prev => ({
        ...prev,
        name: data.template.name,
        description: data.template.description,
        bot_type: data.template.config.type === 'webhook' ? 'webhook' : 'scheduler',
      }))
      // Initialize template values with defaults
      const defaults: Record<string, string | number> = {}
      data.template.configSchema.fields.forEach((field: TemplateField) => {
        if (field.default !== undefined) {
          defaults[field.key] = field.default
        }
      })
      setTemplateValues(defaults)
    } catch (err) {
      setError('Failed to load template')
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // If using a template, deploy via template API
      if (template) {
        const res = await fetch('/api/templates/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: template.id,
            name: formData.name,
            description: formData.description,
            values: templateValues,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to deploy template')
        }

        if (data.warnings && data.warnings.length > 0) {
          console.warn('Template deployment warnings:', data.warnings)
        }

        router.push(`/dashboard/bots/${data.botId}`)
        return
      }

      // Regular bot creation
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

  const renderTemplateField = (field: TemplateField) => {
    const value = templateValues[field.key] ?? ''

    const inputClasses = "w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

    switch (field.type) {
      case 'select':
        return (
          <select
            id={field.key}
            value={String(value)}
            onChange={(e) => setTemplateValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            required={field.required}
            className={inputClasses}
          >
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      case 'textarea':
        return (
          <textarea
            id={field.key}
            value={String(value)}
            onChange={(e) => setTemplateValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            required={field.required}
            placeholder={field.placeholder}
            rows={3}
            className={inputClasses}
          />
        )
      case 'number':
        return (
          <input
            id={field.key}
            type="number"
            value={value}
            onChange={(e) => setTemplateValues(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
            required={field.required}
            placeholder={field.placeholder}
            className={inputClasses}
          />
        )
      default:
        return (
          <input
            id={field.key}
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={String(value)}
            onChange={(e) => setTemplateValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            required={field.required}
            placeholder={field.placeholder}
            className={inputClasses}
          />
        )
    }
  }

  const botTypes = [
    { value: 'custom', label: 'Custom Bot', description: 'Build your own automation from scratch' },
    { value: 'webhook', label: 'Webhook Bot', description: 'Trigger actions via webhooks' },
    { value: 'scheduler', label: 'Scheduled Bot', description: 'Run tasks on a schedule' },
    { value: 'monitor', label: 'Monitor Bot', description: 'Monitor websites or APIs' },
  ]

  // Loading template
  if (loadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500 mx-auto"></div>
          <p className="mt-4 text-zinc-400">Loading template...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={template ? "/dashboard/templates" : "/dashboard/bots"}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {template ? 'Back to Templates' : 'Back to Bots'}
        </Link>
        <h1 className="text-3xl font-bold text-white">
          {template ? `Deploy: ${template.name}` : 'Create New Bot'}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {template ? template.description : 'Set up a new automation bot'}
        </p>
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

          {/* Template Configuration Fields */}
          {template && template.configSchema.fields.length > 0 && (
            <>
              <div className="border-t border-zinc-700 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Configure Template</h3>
                {template.setupInstructions && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 mb-6">
                    <p className="text-sm text-blue-300 whitespace-pre-wrap">{template.setupInstructions}</p>
                  </div>
                )}
                <div className="space-y-4">
                  {template.configSchema.fields.map((field) => (
                    <div key={field.key}>
                      <label htmlFor={field.key} className="block text-sm font-medium text-zinc-300 mb-2">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>
                      {renderTemplateField(field)}
                      {field.helpText && (
                        <p className="mt-1.5 text-xs text-zinc-500">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Bot Type (only show when not using template) */}
          {!template && (
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
          )}

          {/* Status (only show when not using template) */}
          {!template && (
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
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link
            href={template ? "/dashboard/templates" : "/dashboard/bots"}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (template ? 'Deploying...' : 'Creating...') : (template ? 'Deploy Bot' : 'Create Bot')}
          </button>
        </div>
      </form>
    </div>
  )
}
