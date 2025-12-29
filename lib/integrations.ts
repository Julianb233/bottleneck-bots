/**
 * Real integrations for bot actions
 * Slack, Email (Resend), Discord
 */

export interface SlackConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconEmoji?: string
  message: string
}

export interface EmailConfig {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
}

export interface DiscordConfig {
  webhookUrl: string
  content?: string
  username?: string
  avatarUrl?: string
  embeds?: DiscordEmbed[]
}

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string; icon_url?: string }
  timestamp?: string
}

/**
 * Slack Integration - Uses incoming webhooks
 */
export async function sendSlackMessage(
  config: SlackConfig,
  variables?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = replaceVariables(config.message, variables)
    
    const payload: Record<string, unknown> = { text: message }
    if (config.channel) payload.channel = config.channel
    if (config.username) payload.username = config.username
    if (config.iconEmoji) payload.icon_emoji = config.iconEmoji
    
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `Slack error: ${response.status} - ${text}` }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Slack error" }
  }
}

/**
 * Email Integration via Resend
 */
export async function sendEmail(
  config: EmailConfig,
  variables?: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: "RESEND_API_KEY not configured" }
  
  try {
    const to = Array.isArray(config.to) ? config.to : [config.to]
    const subject = replaceVariables(config.subject, variables)
    const html = config.html ? replaceVariables(config.html, variables) : undefined
    const text = config.text ? replaceVariables(config.text, variables) : undefined
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from || "Bottleneck Bots <bots@bottleneckbots.com>",
        to, subject, html, text,
      }),
    })
    
    const data = await response.json()
    if (!response.ok) return { success: false, error: `Resend error: ${data.message || response.status}` }
    return { success: true, messageId: data.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Email error" }
  }
}

/**
 * Discord Integration - Uses webhooks
 */
export async function sendDiscordMessage(
  config: DiscordConfig,
  variables?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {}
    if (config.content) payload.content = replaceVariables(config.content, variables)
    if (config.username) payload.username = config.username
    if (config.avatarUrl) payload.avatar_url = config.avatarUrl
    
    if (config.embeds?.length) {
      payload.embeds = config.embeds.map(embed => ({
        title: embed.title ? replaceVariables(embed.title, variables) : undefined,
        description: embed.description ? replaceVariables(embed.description, variables) : undefined,
        url: embed.url, color: embed.color,
        fields: embed.fields?.map(f => ({
          name: replaceVariables(f.name, variables),
          value: replaceVariables(f.value, variables),
          inline: f.inline,
        })),
        footer: embed.footer,
        timestamp: embed.timestamp || new Date().toISOString(),
      }))
    }
    
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `Discord error: ${response.status} - ${text}` }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Discord error" }
  }
}

/**
 * Generic HTTP request with timeout
 */
export async function httpRequest(
  config: { url: string; method?: string; headers?: Record<string, string>; body?: unknown; timeout?: number },
  variables?: Record<string, unknown>
): Promise<{ success: boolean; status?: number; data?: unknown; error?: string }> {
  try {
    const url = replaceVariables(config.url, variables)
    const method = config.method || "GET"
    const headers: Record<string, string> = { "Content-Type": "application/json", ...config.headers }
    
    for (const [key, value] of Object.entries(headers)) {
      headers[key] = replaceVariables(value, variables)
    }
    
    let body: string | undefined
    if (config.body && method !== "GET") {
      body = typeof config.body === "string" 
        ? replaceVariables(config.body, variables)
        : replaceVariables(JSON.stringify(config.body), variables)
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000)
    
    const response = await fetch(url, { method, headers, body, signal: controller.signal })
    clearTimeout(timeoutId)
    
    let data: unknown
    const contentType = response.headers.get("content-type")
    data = contentType?.includes("application/json") ? await response.json() : await response.text()
    
    return { success: response.ok, status: response.status, data, error: response.ok ? undefined : `HTTP ${response.status}` }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { success: false, error: "Request timeout" }
    return { success: false, error: error instanceof Error ? error.message : "HTTP error" }
  }
}

/**
 * Web scraper
 */
export async function scrapeUrl(
  config: { url: string; selector?: string },
  variables?: Record<string, unknown>
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const url = replaceVariables(config.url, variables)
    const response = await fetch(url, { headers: { "User-Agent": "BottleneckBots/1.0" } })
    if (!response.ok) return { success: false, error: `Fetch failed: ${response.status}` }
    const html = await response.text()
    return { success: true, data: config.selector ? html.substring(0, 10000) : html }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Scrape error" }
  }
}

function replaceVariables(text: string, data?: Record<string, unknown>): string {
  if (!data) return text
  return text.replace(/{{([^}]+)}}/g, (match, key) => {
    const value = getNestedValue(data, key.trim())
    return value !== undefined ? String(value) : match
  })
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
