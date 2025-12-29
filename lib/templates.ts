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
 * Discord Notification Bot Template
 * Send notifications to Discord channels
 */
const discordNotificationTemplate: BotTemplate = {
  id: "discord-notification",
  name: "Discord Notification",
  description:
    "Send automated notifications to Discord channels with rich embeds. Great for team updates and alerts.",
  category: "notifications",
  icon: "message-circle",
  tags: ["discord", "notifications", "alerts", "messaging", "gaming"],
  config: {
    type: "schedule",
    schedule: "0 9 * * 1-5",
    actions: [
      {
        type: "discord",
        order: 1,
        config: {
          webhookUrl: "{{discord_webhook_url}}",
          content: "{{message}}",
          username: "{{bot_name}}",
          embeds: [
            {
              title: "{{embed_title}}",
              description: "{{embed_description}}",
              color: 5814783,
            },
          ],
        },
      },
    ],
    settings: {},
  },
  configSchema: {
    fields: [
      {
        key: "discord_webhook_url",
        label: "Discord Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        required: true,
        helpText: "Create a webhook in your Discord server settings",
      },
      {
        key: "bot_name",
        label: "Bot Display Name",
        type: "text",
        placeholder: "Bottleneck Bot",
        required: false,
        default: "Bottleneck Bot",
      },
      {
        key: "message",
        label: "Message",
        type: "textarea",
        placeholder: "Hey team! Here's your daily update.",
        required: false,
      },
      {
        key: "embed_title",
        label: "Embed Title",
        type: "text",
        placeholder: "Daily Update",
        required: false,
      },
      {
        key: "embed_description",
        label: "Embed Description",
        type: "textarea",
        placeholder: "Your detailed message here...",
        required: true,
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
          { label: "Every hour", value: "0 * * * *" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "1. Go to your Discord server settings\n2. Navigate to Integrations > Webhooks\n3. Create a new webhook and copy the URL\n4. Paste it here and customize your message",
}

/**
 * Multi-Channel Alert Bot Template
 * Send alerts to multiple channels simultaneously
 */
const multiChannelAlertTemplate: BotTemplate = {
  id: "multi-channel-alert",
  name: "Multi-Channel Alert",
  description:
    "Send critical alerts to multiple channels at once - Slack, Discord, and Email. Never miss an important notification.",
  category: "notifications",
  icon: "megaphone",
  tags: ["alert", "multi-channel", "slack", "discord", "email", "critical"],
  config: {
    type: "webhook",
    webhookUrl: "",
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message: "🚨 ALERT: {{alert_title}}\n\n{{alert_message}}",
          username: "Alert Bot",
          iconEmoji: ":rotating_light:",
        },
      },
      {
        type: "discord",
        order: 2,
        config: {
          webhookUrl: "{{discord_webhook_url}}",
          content: "🚨 **ALERT**",
          embeds: [
            {
              title: "{{alert_title}}",
              description: "{{alert_message}}",
              color: 15158332,
            },
          ],
        },
      },
      {
        type: "email",
        order: 3,
        config: {
          to: "{{alert_email}}",
          subject: "🚨 Alert: {{alert_title}}",
          body: "{{alert_message}}",
          from: "alerts@bottleneckbots.com",
        },
      },
    ],
    settings: {
      continueOnError: true,
    },
  },
  configSchema: {
    fields: [
      {
        key: "alert_title",
        label: "Alert Title Template",
        type: "text",
        placeholder: "System Down",
        required: true,
        helpText: "Can include {{variables}} from trigger data",
      },
      {
        key: "alert_message",
        label: "Alert Message Template",
        type: "textarea",
        placeholder: "{{trigger.body.message}}",
        required: true,
      },
      {
        key: "slack_webhook_url",
        label: "Slack Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: false,
      },
      {
        key: "discord_webhook_url",
        label: "Discord Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        required: false,
      },
      {
        key: "alert_email",
        label: "Alert Email",
        type: "email",
        placeholder: "alerts@yourcompany.com",
        required: false,
      },
    ],
  },
  setupInstructions:
    "Configure at least one channel (Slack, Discord, or Email). When triggered via webhook, the bot will send alerts to all configured channels.",
}

/**
 * Daily Standup Reminder Bot Template
 */
const dailyStandupTemplate: BotTemplate = {
  id: "daily-standup",
  name: "Daily Standup Reminder",
  description:
    "Remind your team to post their daily standup updates. Includes prompts for what to share.",
  category: "productivity",
  icon: "users",
  tags: ["standup", "daily", "team", "agile", "scrum", "productivity"],
  config: {
    type: "schedule",
    schedule: "0 9 * * 1-5",
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message:
            "☀️ Good morning team! Time for standup.\n\nPlease share:\n• What did you accomplish yesterday?\n• What are you working on today?\n• Any blockers?\n\n<{{standup_link}}|Post your update here>",
          username: "Standup Bot",
          iconEmoji: ":sunrise:",
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
      },
      {
        key: "standup_link",
        label: "Standup Form/Channel Link",
        type: "url",
        placeholder: "https://app.example.com/standup",
        required: false,
        helpText: "Optional link to your standup form or channel",
      },
      {
        key: "schedule",
        label: "Reminder Time",
        type: "select",
        required: true,
        default: "0 9 * * 1-5",
        options: [
          { label: "9:00 AM Weekdays", value: "0 9 * * 1-5" },
          { label: "9:30 AM Weekdays", value: "30 9 * * 1-5" },
          { label: "10:00 AM Weekdays", value: "0 10 * * 1-5" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "Set up a Slack webhook for your team channel. The bot will send a friendly reminder every weekday morning.",
}

/**
 * Weekly Report Digest Bot Template
 */
const weeklyReportTemplate: BotTemplate = {
  id: "weekly-report",
  name: "Weekly Report Digest",
  description:
    "Automatically fetch data from an API and send a weekly summary report to your team via email and Slack.",
  category: "productivity",
  icon: "bar-chart",
  tags: ["report", "weekly", "digest", "summary", "analytics"],
  config: {
    type: "schedule",
    schedule: "0 9 * * 1",
    actions: [
      {
        type: "http_request",
        order: 1,
        config: {
          url: "{{report_api_url}}",
          method: "GET",
          headers: {
            Authorization: "Bearer {{api_key}}",
          },
        },
      },
      {
        type: "email",
        order: 2,
        config: {
          to: "{{report_email}}",
          subject: "📊 Weekly Report - Week of {{date}}",
          body: "Here's your weekly report:\n\n{{previous.data}}",
          from: "reports@bottleneckbots.com",
        },
      },
      {
        type: "slack",
        order: 3,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message: "📊 *Weekly Report*\n\nCheck your email for the full report, or view the highlights:\n\n{{previous.data.summary}}",
          username: "Report Bot",
          iconEmoji: ":chart_with_upwards_trend:",
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
        key: "report_api_url",
        label: "Report API URL",
        type: "url",
        placeholder: "https://api.example.com/reports/weekly",
        required: true,
        helpText: "API endpoint that returns your report data",
      },
      {
        key: "api_key",
        label: "API Key",
        type: "text",
        placeholder: "your-api-key",
        required: false,
      },
      {
        key: "report_email",
        label: "Report Email",
        type: "email",
        placeholder: "team@yourcompany.com",
        required: true,
      },
      {
        key: "slack_webhook_url",
        label: "Slack Webhook (Optional)",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: false,
      },
      {
        key: "schedule",
        label: "Report Day & Time",
        type: "select",
        required: true,
        default: "0 9 * * 1",
        options: [
          { label: "Monday 9 AM", value: "0 9 * * 1" },
          { label: "Friday 5 PM", value: "0 17 * * 5" },
          { label: "Sunday 6 PM", value: "0 18 * * 0" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "Configure your report API endpoint that returns JSON data. The bot will fetch the data and send it as a formatted email and Slack message.",
}

/**
 * New Lead Notification Bot Template
 */
const leadNotificationTemplate: BotTemplate = {
  id: "lead-notification",
  name: "New Lead Notification",
  description:
    "Get instant notifications when a new lead comes in. Perfect for sales teams who need quick response times.",
  category: "notifications",
  icon: "user-plus",
  tags: ["leads", "sales", "crm", "notifications", "webhook"],
  config: {
    type: "webhook",
    webhookUrl: "",
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message:
            "🎉 *New Lead!*\n\n*Name:* {{trigger.body.name}}\n*Email:* {{trigger.body.email}}\n*Company:* {{trigger.body.company}}\n*Source:* {{trigger.body.source}}\n\n<{{crm_link}}|View in CRM>",
          username: "Lead Bot",
          iconEmoji: ":tada:",
        },
      },
      {
        type: "email",
        order: 2,
        config: {
          to: "{{sales_email}}",
          subject: "🎉 New Lead: {{trigger.body.name}} from {{trigger.body.company}}",
          body: "A new lead has come in!\n\nName: {{trigger.body.name}}\nEmail: {{trigger.body.email}}\nCompany: {{trigger.body.company}}\nSource: {{trigger.body.source}}\n\nRespond quickly for the best conversion rates!",
          from: "leads@bottleneckbots.com",
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
      },
      {
        key: "sales_email",
        label: "Sales Team Email",
        type: "email",
        placeholder: "sales@yourcompany.com",
        required: true,
      },
      {
        key: "crm_link",
        label: "CRM Link",
        type: "url",
        placeholder: "https://crm.example.com/leads",
        required: false,
      },
    ],
  },
  setupInstructions:
    "1. Create this bot to get your webhook URL\n2. Configure your form or CRM to send lead data to this webhook\n3. Expected payload: { name, email, company, source }",
}

/**
 * E-commerce Order Notification Bot Template
 */
const orderNotificationTemplate: BotTemplate = {
  id: "order-notification",
  name: "Order Notification",
  description:
    "Get notified instantly when a new order is placed. Track revenue and celebrate wins with your team!",
  category: "notifications",
  icon: "shopping-cart",
  tags: ["ecommerce", "orders", "sales", "revenue", "shopify", "stripe"],
  config: {
    type: "webhook",
    webhookUrl: "",
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message:
            "💰 *New Order!*\n\n*Order ID:* #{{trigger.body.order_id}}\n*Customer:* {{trigger.body.customer_name}}\n*Amount:* ${{trigger.body.total}}\n*Items:* {{trigger.body.item_count}} items\n\n<{{order_link}}|View Order>",
          username: "Sales Bot",
          iconEmoji: ":moneybag:",
        },
      },
      {
        type: "discord",
        order: 2,
        config: {
          webhookUrl: "{{discord_webhook_url}}",
          content: "💰 New order just came in!",
          embeds: [
            {
              title: "Order #{{trigger.body.order_id}}",
              description: "**Customer:** {{trigger.body.customer_name}}\n**Amount:** ${{trigger.body.total}}",
              color: 3066993,
            },
          ],
        },
      },
    ],
    settings: {
      continueOnError: true,
    },
  },
  configSchema: {
    fields: [
      {
        key: "slack_webhook_url",
        label: "Slack Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: false,
      },
      {
        key: "discord_webhook_url",
        label: "Discord Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        required: false,
      },
      {
        key: "order_link",
        label: "Order Dashboard Link",
        type: "url",
        placeholder: "https://shop.example.com/admin/orders",
        required: false,
      },
    ],
  },
  setupInstructions:
    "Connect this webhook to your Shopify, Stripe, or WooCommerce store. The bot expects: { order_id, customer_name, total, item_count }",
}

/**
 * Content Change Monitor Bot Template
 */
const contentMonitorTemplate: BotTemplate = {
  id: "content-monitor",
  name: "Website Change Monitor",
  description:
    "Monitor a webpage for changes and get notified when content updates. Great for tracking competitors or waiting for updates.",
  category: "monitoring",
  icon: "eye",
  tags: ["monitor", "website", "changes", "scraping", "competitor"],
  config: {
    type: "schedule",
    schedule: "0 */4 * * *",
    actions: [
      {
        type: "http_request",
        order: 1,
        config: {
          url: "{{target_url}}",
          method: "GET",
          headers: {},
        },
      },
      {
        type: "transform",
        order: 2,
        config: {
          expression: "hash(previous.body)",
          outputKey: "content_hash",
        },
      },
      {
        type: "filter",
        order: 3,
        config: {
          condition: "{{content_hash}} != {{stored_hash}}",
          continueIf: true,
        },
      },
      {
        type: "slack",
        order: 4,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message: "🔔 *Website Updated!*\n\nThe page at <{{target_url}}|{{page_name}}> has changed.\n\nCheck it out to see what's new!",
          username: "Monitor Bot",
          iconEmoji: ":eyes:",
        },
      },
    ],
    settings: {},
  },
  configSchema: {
    fields: [
      {
        key: "target_url",
        label: "Page URL to Monitor",
        type: "url",
        placeholder: "https://example.com/pricing",
        required: true,
      },
      {
        key: "page_name",
        label: "Page Name",
        type: "text",
        placeholder: "Competitor Pricing Page",
        required: true,
      },
      {
        key: "slack_webhook_url",
        label: "Slack Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: true,
      },
      {
        key: "schedule",
        label: "Check Frequency",
        type: "select",
        required: true,
        default: "0 */4 * * *",
        options: [
          { label: "Every hour", value: "0 * * * *" },
          { label: "Every 4 hours", value: "0 */4 * * *" },
          { label: "Every 12 hours", value: "0 */12 * * *" },
          { label: "Daily", value: "0 9 * * *" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "Enter the URL you want to monitor. The bot will check periodically and notify you when the page content changes.",
}

/**
 * Scheduled Database Backup Reminder
 */
const backupReminderTemplate: BotTemplate = {
  id: "backup-reminder",
  name: "Backup Reminder",
  description:
    "Remind yourself or your team to run database backups. Safety first!",
  category: "productivity",
  icon: "database",
  tags: ["backup", "database", "reminder", "devops", "safety"],
  config: {
    type: "schedule",
    schedule: "0 18 * * 5",
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message: "💾 *Backup Reminder*\n\nIt's Friday! Time to ensure all database backups are running correctly.\n\n• Check backup status\n• Verify backup integrity\n• Test restore procedure (monthly)\n\n<{{runbook_link}}|View Backup Runbook>",
          username: "Backup Bot",
          iconEmoji: ":floppy_disk:",
        },
      },
      {
        type: "email",
        order: 2,
        config: {
          to: "{{devops_email}}",
          subject: "💾 Weekly Backup Check Reminder",
          body: "Weekly reminder to verify database backups are running correctly.\n\nChecklist:\n- Check backup status in all environments\n- Verify backup file integrity\n- Review backup retention policies\n\nStay safe!",
          from: "reminders@bottleneckbots.com",
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
        required: false,
      },
      {
        key: "devops_email",
        label: "DevOps Team Email",
        type: "email",
        placeholder: "devops@yourcompany.com",
        required: false,
      },
      {
        key: "runbook_link",
        label: "Backup Runbook Link",
        type: "url",
        placeholder: "https://docs.example.com/backup-runbook",
        required: false,
      },
      {
        key: "schedule",
        label: "Reminder Schedule",
        type: "select",
        required: true,
        default: "0 18 * * 5",
        options: [
          { label: "Friday 6 PM", value: "0 18 * * 5" },
          { label: "Daily 5 PM", value: "0 17 * * *" },
          { label: "Sunday 8 PM", value: "0 20 * * 0" },
          { label: "Custom", value: "custom" },
        ],
      },
    ],
  },
  setupInstructions:
    "Set up reminders to ensure your backup procedures are followed. Configure at least one notification channel.",
}

/**
 * GitHub/GitLab Deployment Notification
 */
const deploymentNotificationTemplate: BotTemplate = {
  id: "deployment-notification",
  name: "Deployment Notification",
  description:
    "Notify your team when a deployment starts or completes. Keep everyone in the loop about production changes.",
  category: "integrations",
  icon: "rocket",
  tags: ["deployment", "devops", "github", "gitlab", "ci-cd", "release"],
  config: {
    type: "webhook",
    webhookUrl: "",
    actions: [
      {
        type: "slack",
        order: 1,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message: "🚀 *Deployment {{trigger.body.status}}*\n\n*Environment:* {{trigger.body.environment}}\n*Branch:* `{{trigger.body.branch}}`\n*Commit:* `{{trigger.body.commit_sha}}`\n*Author:* {{trigger.body.author}}\n\n<{{trigger.body.url}}|View Deployment>",
          username: "Deploy Bot",
          iconEmoji: ":rocket:",
        },
      },
      {
        type: "discord",
        order: 2,
        config: {
          webhookUrl: "{{discord_webhook_url}}",
          content: "🚀 Deployment Update",
          embeds: [
            {
              title: "Deployment {{trigger.body.status}}",
              description: "**Environment:** {{trigger.body.environment}}\n**Branch:** {{trigger.body.branch}}\n**Author:** {{trigger.body.author}}",
              color: 3447003,
            },
          ],
        },
      },
    ],
    settings: {
      continueOnError: true,
    },
  },
  configSchema: {
    fields: [
      {
        key: "slack_webhook_url",
        label: "Slack Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: false,
      },
      {
        key: "discord_webhook_url",
        label: "Discord Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/...",
        required: false,
      },
    ],
  },
  setupInstructions:
    "Connect this to your CI/CD pipeline. Expected payload: { status, environment, branch, commit_sha, author, url }",
}

/**
 * Form Submission Handler
 */
const formSubmissionTemplate: BotTemplate = {
  id: "form-submission",
  name: "Form Submission Handler",
  description:
    "Handle form submissions from your website. Send confirmations, notify your team, and store data.",
  category: "integrations",
  icon: "file-text",
  tags: ["form", "submission", "contact", "website", "webhook"],
  config: {
    type: "webhook",
    webhookUrl: "",
    actions: [
      {
        type: "email",
        order: 1,
        config: {
          to: "{{trigger.body.email}}",
          subject: "Thanks for reaching out!",
          body: "Hi {{trigger.body.name}},\n\nThank you for contacting us! We've received your message and will get back to you within 24 hours.\n\nBest regards,\nThe Team",
          from: "hello@bottleneckbots.com",
        },
      },
      {
        type: "slack",
        order: 2,
        config: {
          webhookUrl: "{{slack_webhook_url}}",
          message: "📬 *New Form Submission*\n\n*Name:* {{trigger.body.name}}\n*Email:* {{trigger.body.email}}\n*Message:*\n> {{trigger.body.message}}",
          username: "Form Bot",
          iconEmoji: ":incoming_envelope:",
        },
      },
      {
        type: "http_request",
        order: 3,
        config: {
          url: "{{storage_api_url}}",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer {{storage_api_key}}",
          },
          body: {
            name: "{{trigger.body.name}}",
            email: "{{trigger.body.email}}",
            message: "{{trigger.body.message}}",
            timestamp: "{{timestamp}}",
          },
        },
      },
    ],
    settings: {
      continueOnError: true,
    },
  },
  configSchema: {
    fields: [
      {
        key: "slack_webhook_url",
        label: "Slack Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: true,
      },
      {
        key: "storage_api_url",
        label: "Data Storage API URL (Optional)",
        type: "url",
        placeholder: "https://api.example.com/submissions",
        required: false,
        helpText: "API endpoint to store form submissions",
      },
      {
        key: "storage_api_key",
        label: "Storage API Key",
        type: "text",
        placeholder: "your-api-key",
        required: false,
      },
    ],
  },
  setupInstructions:
    "Point your website form to this webhook URL. Expected fields: { name, email, message }",
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
  discordNotificationTemplate,
  multiChannelAlertTemplate,
  dailyStandupTemplate,
  weeklyReportTemplate,
  leadNotificationTemplate,
  orderNotificationTemplate,
  contentMonitorTemplate,
  backupReminderTemplate,
  deploymentNotificationTemplate,
  formSubmissionTemplate,
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
