'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface TemplateSummary {
  id: string
  name: string
  description: string
  category: string
  icon: string
  tags: string[]
}

type Category = 'all' | 'monitoring' | 'notifications' | 'integrations' | 'data' | 'productivity'

const categoryInfo: Record<Category, { label: string; icon: string; color: string }> = {
  all: { label: 'All Templates', icon: 'grid', color: 'blue' },
  monitoring: { label: 'Monitoring', icon: 'activity', color: 'green' },
  notifications: { label: 'Notifications', icon: 'bell', color: 'purple' },
  integrations: { label: 'Integrations', icon: 'link', color: 'orange' },
  data: { label: 'Data', icon: 'database', color: 'cyan' },
  productivity: { label: 'Productivity', icon: 'zap', color: 'yellow' },
}

const iconMap: Record<string, string> = {
  heartbeat: '💓',
  slack: '💬',
  mail: '📧',
  sync: '🔄',
  'arrow-right': '➡️',
  activity: '📊',
  bell: '🔔',
  link: '🔗',
  database: '🗄️',
  zap: '⚡',
  grid: '📦',
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [selectedCategory])

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory)
      }

      const res = await fetch(`/api/templates?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await res.json()
      setTemplates(data.templates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleUseTemplate = (templateId: string) => {
    router.push(`/dashboard/bots/new?template=${templateId}`)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      monitoring: 'bg-green-500/10 text-green-400 border-green-500/30',
      notifications: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      integrations: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      data: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      productivity: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    }
    return colors[category] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Templates</h3>
          <p className="text-sm text-zinc-400 mb-6">{error}</p>
          <button
            onClick={fetchTemplates}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Bot Templates</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Start with a pre-built template and customize it to your needs
          </p>
        </div>
        <Link
          href="/dashboard/bots/new"
          className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Create from Scratch
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 pl-10 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(Object.keys(categoryInfo) as Category[]).map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <span>{iconMap[categoryInfo[category].icon]}</span>
            {categoryInfo[category].label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500 mx-auto"></div>
            <p className="mt-4 text-zinc-400">Loading templates...</p>
          </div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-white mb-2">No templates found</h3>
          <p className="text-sm text-zinc-400">
            {searchQuery
              ? `No templates match "${searchQuery}"`
              : `No templates in the ${categoryInfo[selectedCategory].label} category`}
          </p>
        </div>
      ) : (
        /* Templates Grid */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group rounded-xl bg-zinc-800 border border-zinc-700 p-6 hover:border-blue-500 transition-all"
            >
              {/* Icon and Category */}
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-2xl">{iconMap[template.icon] || '🤖'}</span>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${getCategoryColor(
                    template.category
                  )}`}
                >
                  {template.category}
                </span>
              </div>

              {/* Name and Description */}
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{template.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {template.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
                {template.tags.length > 3 && (
                  <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                    +{template.tags.length - 3}
                  </span>
                )}
              </div>

              {/* Use Template Button */}
              <button
                onClick={() => handleUseTemplate(template.id)}
                className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">How Templates Work</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">1.</span>
            <span>Choose a template that matches your use case</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">2.</span>
            <span>Customize the configuration with your specific settings</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">3.</span>
            <span>Deploy your bot and start automating</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
