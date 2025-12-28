"use client"

import { useState } from "react"

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  category: "communication" | "data" | "automation" | "monitoring"
  status: "connected" | "available" | "coming_soon"
  configFields?: { name: string; label: string; type: string; required: boolean }[]
}

const integrations: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Send notifications and receive triggers from Slack channels",
    icon: "🔔",
    category: "communication",
    status: "available",
    configFields: [
      { name: "webhook_url", label: "Webhook URL", type: "url", required: true },
      { name: "channel", label: "Default Channel", type: "text", required: false },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    description: "Post messages and receive commands from Discord servers",
    icon: "💬",
    category: "communication",
    status: "available",
    configFields: [
      { name: "bot_token", label: "Bot Token", type: "password", required: true },
      { name: "guild_id", label: "Server ID", type: "text", required: true },
    ],
  },
  {
    id: "email",
    name: "Email (SMTP)",
    description: "Send email notifications and reports",
    icon: "📧",
    category: "communication",
    status: "available",
    configFields: [
      { name: "smtp_host", label: "SMTP Host", type: "text", required: true },
      { name: "smtp_port", label: "SMTP Port", type: "number", required: true },
      { name: "smtp_user", label: "Username", type: "text", required: true },
      { name: "smtp_pass", label: "Password", type: "password", required: true },
    ],
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Send data to any HTTP endpoint",
    icon: "🔗",
    category: "data",
    status: "connected",
    configFields: [
      { name: "url", label: "Webhook URL", type: "url", required: true },
      { name: "method", label: "HTTP Method", type: "select", required: true },
      { name: "headers", label: "Custom Headers (JSON)", type: "textarea", required: false },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Use GPT models for intelligent bot actions",
    icon: "🤖",
    category: "automation",
    status: "connected",
    configFields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
      { name: "model", label: "Default Model", type: "text", required: false },
    ],
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Connect to PostgreSQL databases",
    icon: "🗄️",
    category: "data",
    status: "available",
    configFields: [
      { name: "connection_string", label: "Connection String", type: "password", required: true },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Connect to Supabase for database and auth",
    icon: "⚡",
    category: "data",
    status: "connected",
  },
  {
    id: "datadog",
    name: "Datadog",
    description: "Send metrics and logs to Datadog",
    icon: "📊",
    category: "monitoring",
    status: "available",
    configFields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
      { name: "site", label: "Datadog Site", type: "text", required: false },
    ],
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Track errors and performance issues",
    icon: "🐛",
    category: "monitoring",
    status: "coming_soon",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Trigger bots on GitHub events",
    icon: "🐙",
    category: "automation",
    status: "coming_soon",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect with 5000+ apps via Zapier",
    icon: "⚡",
    category: "automation",
    status: "coming_soon",
  },
  {
    id: "make",
    name: "Make (Integromat)",
    description: "Build complex automation workflows",
    icon: "🔧",
    category: "automation",
    status: "coming_soon",
  },
]

const categoryLabels = {
  communication: "Communication",
  data: "Data & Storage",
  automation: "Automation",
  monitoring: "Monitoring",
}

export default function IntegrationsPage() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [filter, setFilter] = useState<string>("all")

  const filteredIntegrations =
    filter === "all"
      ? integrations
      : filter === "connected"
      ? integrations.filter((i) => i.status === "connected")
      : integrations.filter((i) => i.category === filter)

  const connectedCount = integrations.filter((i) => i.status === "connected").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">
            Connect your bots to external services • {connectedCount} connected
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "All" },
          { value: "connected", label: "Connected" },
          { value: "communication", label: "Communication" },
          { value: "data", label: "Data" },
          { value: "automation", label: "Automation" },
          { value: "monitoring", label: "Monitoring" },
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

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map((integration) => (
          <div
            key={integration.id}
            className={`bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors ${
              integration.status === "coming_soon" ? "opacity-60" : "cursor-pointer"
            }`}
            onClick={() => {
              if (integration.status !== "coming_soon") {
                setSelectedIntegration(integration)
              }
            }}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{integration.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                  {integration.status === "connected" && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      Connected
                    </span>
                  )}
                  {integration.status === "coming_soon" && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{integration.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {categoryLabels[integration.category]}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Modal */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedIntegration.icon}</span>
                  <h2 className="text-xl font-semibold">{selectedIntegration.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 text-sm mt-2">{selectedIntegration.description}</p>
            </div>

            <div className="p-6 space-y-4">
              {selectedIntegration.status === "connected" ? (
                <>
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Connected</span>
                  </div>
                  <button className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                    Disconnect
                  </button>
                </>
              ) : selectedIntegration.configFields ? (
                <>
                  {selectedIntegration.configFields.map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                        />
                      ) : (
                        <input
                          type={field.type}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Connect
                  </button>
                </>
              ) : (
                <p className="text-gray-600 text-center py-4">
                  This integration is pre-configured.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
