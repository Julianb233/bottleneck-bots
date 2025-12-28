import { BotConfig, BotAction } from "./bot-engine"

/**
 * Bot Template Definition
 */
export interface BotTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  icon: string
  tags: string[]
  config: BotConfig
  configSchema: ConfigSchema
  setupInstructions?: string
}

export type TemplateCategory =
  | "monitoring"
  | "notifications"
  | "integrations"
  | "data"
  | "productivity"

export interface ConfigSchema {
  fields: ConfigField[]
}

export interface ConfigField {
  key: string
  label: string
  type: "text" | "url" | "email" | "select" | "cron" | "textarea" | "number"
  placeholder?: string
  required: boolean
  default?: string | number
  options?: Array<{ label: string; value: string }>
  helpText?: string
}

/**
 * HTTP Health Check Bot Template
 * Monitors website availability and response times
 */
const httpHealthCheckTemplate: BotTemplate = {
  id: "http-health-check",
  name: "HTTP Health Check",
  description:
    "Monitor website availability by checking HTTP endpoints at regular intervals. Get alerts when your services go down.",
  category: "monitoring",
  icon: "heartbeat",
  tags: ["monitoring", "uptime", "health", "http"],
  config: {
    type: "schedule",
    schedule: "*/5 * * * *", // Every 5 minutes
    actions: [
      {
        type: "http_request",
        order: 1,
        config: {
          url: "{{target_url}}",
          method: "GET",
          headers: {},
          timeout: 30000,
          expectedStatus: 200,
        },
      },
    ],
    settings: {
      alertOnFailure: true,
      retryCount: 2,
      retryDelay: 5000,
    },
  },
  configSchema: {
    fields: [
      {
        key: "target_url",
        label: "Target URL",
        type: "url",
        placeholder: "https://example.com/health",
        required: true,
        helpText: "The URL to check for availability",
      },
      {
        key: "schedule",
        label: "Check Frequency",
        type: "select",
        required: true,
        default: "*/5 * * * *",
        options: [
          { label: "Every minute", value: "* * * * *" },
          { label: "Every 5 minutes", value: "*/5 * * * *" },
          { label: "Every 15 minutes", value: "*/15 * * * *" },
          { label: "Every 30 minutes", value: "*/30 * * * *" },
          { label: "Every hour", value: "0 * * * *" },
        ],
      },
      {
        key: "expected_status",
        label: "Expected Status Code",
        type: "number",
        placeholder: "200",
        required: false,
        default: 200,
        helpText: "The HTTP status code that indicates success",
      },
    ],
  },
  setupInstructions:
    "Enter the URL you want to monitor. The bot will make HTTP GET requests at the scheduled interval and report if the endpoint is unavailable or returns an unexpected status code.",
}

/**
 * Slack Notification Bot Template
 * Send notifications to Slack channels
 */
const slackNotificationTemplate: BotTemplate = {
  id: "slack-notification",
  name: "Slack Notification",
  description:
    "Send automated notifications to Slack channels. Perfect for alerts, daily summaries, and team updates.",
  category: "notifications",
  icon: "slack",
  tags: ["slack", "notifications", "alerts", "messaging"],
  config: {
    type: "schedule",
    schedule: "0 9 * * 1-5", // 9 AM on weekdays
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          channel: "{{slack_channel}}",
          message: "{{message}}",
          username: "Bottleneck Bot",
          iconEmoji: ":robot_face:",
        },
      },
    ],
    settings: {},
  },
  configSchema: {
    fields: [
      {
        key: "slack_webhook_url",
        label: "Slack Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: true,
        helpText:
          "Create a webhook at https://api.slack.com/messaging/webhooks",
      },
      {
        key: "slack_channel",
        label: "Channel",
        type: "text",
        placeholder: "#general",
        required: false,
        helpText: "Override the default channel (optional)",
      },
      {
        key: "message",
        label: "Message",
        type: "textarea",
        placeholder: "Hello team! This is your daily reminder.",
        required: true,
        helpText: "The message to send to Slack",
      },
      {
        key: "schedule",
        label: "Send Schedule",
        type: "select",
        required: true,
        default: "0 9 * * 1-5",
        options: [
          { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
          { label: "Daily at 9 AM", value: "0 9 * * *" },
          { label: "Every Monday at 9 AM", value: "0 9 * * 1" },
          { label: "First of month at 9 AM", value: "0 9 1 * *" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "1. Go to api.slack.com and create a new app\n2. Enable Incoming Webhooks\n3. Add a webhook to your workspace\n4. Copy the webhook URL and paste it here",
}

/**
 * Email Reminder Bot Template
 * Send scheduled email reminders
 */
const emailReminderTemplate: BotTemplate = {
  id: "email-reminder",
  name: "Email Reminder",
  description:
    "Schedule automated email reminders for yourself or your team. Great for recurring tasks and deadlines.",
  category: "productivity",
  icon: "mail",
  tags: ["email", "reminder", "productivity", "notifications"],
  config: {
    type: "schedule",
    schedule: "0 9 * * *", // Daily at 9 AM
    actions: [
      {
        type: "email",
        order: 1,
        config: {
          to: "{{recipient_email}}",
          subject: "{{email_subject}}",
          body: "{{email_body}}",
          from: "reminders@bottleneckbots.com",
        },
      },
    ],
    settings: {},
  },
  configSchema: {
    fields: [
      {
        key: "recipient_email",
        label: "Recipient Email",
        type: "email",
        placeholder: "you@example.com",
        required: true,
        helpText: "The email address to send reminders to",
      },
      {
        key: "email_subject",
        label: "Subject",
        type: "text",
        placeholder: "Daily Reminder: Check your tasks",
        required: true,
      },
      {
        key: "email_body",
        label: "Email Body",
        type: "textarea",
        placeholder: "Don't forget to review your tasks for today!",
        required: true,
      },
      {
        key: "schedule",
        label: "Reminder Schedule",
        type: "select",
        required: true,
        default: "0 9 * * *",
        options: [
          { label: "Daily at 9 AM", value: "0 9 * * *" },
          { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
          { label: "Weekly on Monday", value: "0 9 * * 1" },
          { label: "Monthly on 1st", value: "0 9 1 * *" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "Enter the email address, subject, and body for your reminder. Choose when you want to receive the reminder.",
}

/**
 * Data Sync Bot Template
 * Synchronize data between services via webhooks
 */
const dataSyncTemplate: BotTemplate = {
  id: "data-sync",
  name: "Data Sync",
  description:
    "Synchronize data between services by calling APIs on a schedule. Ideal for keeping systems in sync.",
  category: "data",
  icon: "sync",
  tags: ["sync", "data", "api", "integration"],
  config: {
    type: "schedule",
    schedule: "0 */6 * * *", // Every 6 hours
    actions: [
      {
        type: "http_request",
        order: 1,
        config: {
          url: "{{source_url}}",
          method: "GET",
          headers: {
            Authorization: "Bearer {{source_api_key}}",
          },
        },
      },
      {
        type: "http_request",
        order: 2,
        config: {
          url: "{{destination_url}}",
          method: "POST",
          headers: {
            Authorization: "Bearer {{destination_api_key}}",
            "Content-Type": "application/json",
          },
          body: "{{sync_payload}}",
        },
      },
    ],
    settings: {
      continueOnError: false,
    },
  },
  configSchema: {
    fields: [
      {
        key: "source_url",
        label: "Source API URL",
        type: "url",
        placeholder: "https://api.source.com/data",
        required: true,
        helpText: "The API endpoint to fetch data from",
      },
      {
        key: "source_api_key",
        label: "Source API Key",
        type: "text",
        placeholder: "your-source-api-key",
        required: false,
        helpText: "API key for the source service (if required)",
      },
      {
        key: "destination_url",
        label: "Destination API URL",
        type: "url",
        placeholder: "https://api.destination.com/sync",
        required: true,
        helpText: "The API endpoint to send data to",
      },
      {
        key: "destination_api_key",
        label: "Destination API Key",
        type: "text",
        placeholder: "your-destination-api-key",
        required: false,
        helpText: "API key for the destination service (if required)",
      },
      {
        key: "schedule",
        label: "Sync Frequency",
        type: "select",
        required: true,
        default: "0 */6 * * *",
        options: [
          { label: "Every hour", value: "0 * * * *" },
          { label: "Every 6 hours", value: "0 */6 * * *" },
          { label: "Every 12 hours", value: "0 */12 * * *" },
          { label: "Daily at midnight", value: "0 0 * * *" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "Configure the source and destination APIs. The bot will fetch data from the source and push it to the destination on the scheduled interval.",
}

/**
 * Webhook Relay Bot Template
 * Receive webhooks and forward them to other services
 */
const webhookRelayTemplate: BotTemplate = {
  id: "webhook-relay",
  name: "Webhook Relay",
  description:
    "Receive webhooks from one service and forward them to another. Perfect for connecting services that don't integrate directly.",
  category: "integrations",
  icon: "arrow-right",
  tags: ["webhook", "relay", "integration", "proxy"],
  config: {
    type: "webhook",
    webhookUrl: "", // Generated on bot creation
    actions: [
      {
        type: "http_request",
        order: 1,
        config: {
          url: "{{destination_url}}",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer {{destination_api_key}}",
          },
          body: "{{webhook_payload}}", // Forward the incoming payload
        },
      },
    ],
    settings: {
      validatePayload: true,
      logPayloads: true,
    },
  },
  configSchema: {
    fields: [
      {
        key: "destination_url",
        label: "Destination URL",
        type: "url",
        placeholder: "https://api.destination.com/webhook",
        required: true,
        helpText: "Where to forward the incoming webhooks",
      },
      {
        key: "destination_api_key",
        label: "Destination API Key",
        type: "text",
        placeholder: "your-api-key",
        required: false,
        helpText: "API key for the destination service (if required)",
      },
      {
        key: "transform_payload",
        label: "Transform Payload",
        type: "textarea",
        placeholder: '{"key": "{{incoming.field}}"}',
        required: false,
        helpText: "Optional JSON template to transform the incoming payload",
      },
    ],
  },
  setupInstructions:
    "1. Create this bot to get your webhook URL\n2. Configure your source service to send webhooks to this URL\n3. The bot will forward all incoming webhooks to the destination",
}

/**
 * API Monitor Bot Template
 * Monitor API response times and availability
 */
const apiMonitorTemplate: BotTemplate = {
  id: "api-monitor",
  name: "API Monitor",
  description:
    "Monitor your API endpoints for response times, errors, and availability. Track performance over time.",
  category: "monitoring",
  icon: "activity",
  tags: ["api", "monitoring", "performance", "latency"],
  config: {
    type: "schedule",
    schedule: "*/10 * * * *", // Every 10 minutes
    actions: [
      {
        type: "http_request",
        order: 1,
        config: {
          url: "{{api_endpoint}}",
          method: "{{http_method}}",
          headers: {
            Authorization: "Bearer {{api_key}}",
            "Content-Type": "application/json",
          },
          body: "{{request_body}}",
          timeout: 30000,
          trackTiming: true,
        },
      },
    ],
    settings: {
      alertOnSlowResponse: true,
      slowResponseThreshold: 5000, // 5 seconds
      alertOnError: true,
    },
  },
  configSchema: {
    fields: [
      {
        key: "api_endpoint",
        label: "API Endpoint",
        type: "url",
        placeholder: "https://api.example.com/v1/status",
        required: true,
      },
      {
        key: "http_method",
        label: "HTTP Method",
        type: "select",
        required: true,
        default: "GET",
        options: [
          { label: "GET", value: "GET" },
          { label: "POST", value: "POST" },
          { label: "PUT", value: "PUT" },
          { label: "DELETE", value: "DELETE" },
        ],
      },
      {
        key: "api_key",
        label: "API Key",
        type: "text",
        placeholder: "your-api-key",
        required: false,
      },
      {
        key: "request_body",
        label: "Request Body (JSON)",
        type: "textarea",
        placeholder: '{"key": "value"}',
        required: false,
        helpText: "For POST/PUT requests",
      },
      {
        key: "schedule",
        label: "Check Frequency",
        type: "select",
        required: true,
        default: "*/10 * * * *",
        options: [
          { label: "Every 5 minutes", value: "*/5 * * * *" },
          { label: "Every 10 minutes", value: "*/10 * * * *" },
          { label: "Every 30 minutes", value: "*/30 * * * *" },
          { label: "Every hour", value: "0 * * * *" },
        ],
      },
    ],
  },
  setupInstructions:
    "Enter your API endpoint details. The bot will call your API on schedule and track response times and errors.",
}

/**
 * All available templates
 */
export const templates: BotTemplate[] = [
  httpHealthCheckTemplate,
  slackNotificationTemplate,
  emailReminderTemplate,
  dataSyncTemplate,
  webhookRelayTemplate,
  apiMonitorTemplate,
]

/**
 * Get all templates
 */
export function getAllTemplates(): BotTemplate[] {
  return templates
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): BotTemplate | undefined {
  return templates.find((t) => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): BotTemplate[] {
  return templates.filter((t) => t.category === category)
}

/**
 * Search templates by name or tags
 */
export function searchTemplates(query: string): BotTemplate[] {
  const lowerQuery = query.toLowerCase()
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Create bot config from template with user values
 */
export function createConfigFromTemplate(
  template: BotTemplate,
  values: Record<string, string | number>
): BotConfig {
  // Deep clone the template config
  const config = JSON.parse(JSON.stringify(template.config)) as BotConfig

  // Apply schedule if provided
  if (values.schedule && values.schedule !== "custom") {
    config.schedule = values.schedule as string
  }

  // Apply values to action configs
  for (const action of config.actions) {
    for (const [key, value] of Object.entries(action.config)) {
      if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
        const varName = value.slice(2, -2)
        if (varName in values) {
          action.config[key] = values[varName]
        }
      }
    }
  }

  return config
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: TemplateCategory): {
  label: string
  description: string
  icon: string
} {
  const categories: Record<TemplateCategory, { label: string; description: string; icon: string }> = {
    monitoring: {
      label: "Monitoring",
      description: "Track uptime, performance, and health",
      icon: "activity",
    },
    notifications: {
      label: "Notifications",
      description: "Send alerts and messages",
      icon: "bell",
    },
    integrations: {
      label: "Integrations",
      description: "Connect services together",
      icon: "link",
    },
    data: {
      label: "Data",
      description: "Sync and process data",
      icon: "database",
    },
    productivity: {
      label: "Productivity",
      description: "Automate recurring tasks",
      icon: "zap",
    },
  }

  return categories[category]
}
