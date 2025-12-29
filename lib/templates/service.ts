/**
 * Template Service
 *
 * Handles template deployment - converting templates into actual bots
 */

import { createBot, type CreateBotInput, type BotConfig, type BotAction } from '../db/bots'
import {
  templates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  type BotTemplate,
  type TemplateCategory,
} from '../templates'

// ============================================================================
// Types
// ============================================================================

export interface TemplateDeploymentInput {
  templateId: string
  name: string
  description?: string
  values: Record<string, string | number>
  userId: string
}

export interface TemplateDeploymentResult {
  success: boolean
  botId?: string
  webhookUrl?: string
  error?: string
  warnings?: string[]
}

export interface TemplateValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ============================================================================
// Template Deployment Service
// ============================================================================

/**
 * Validate user-provided values against template schema
 */
export function validateTemplateValues(
  template: BotTemplate,
  values: Record<string, string | number>
): TemplateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const field of template.configSchema.fields) {
    const value = values[field.key]

    // Check required fields
    if (field.required && (value === undefined || value === '' || value === null)) {
      errors.push(`${field.label} is required`)
      continue
    }

    // Skip validation for optional empty fields
    if (value === undefined || value === '') {
      continue
    }

    // Type-specific validation
    switch (field.type) {
      case 'url':
        if (typeof value === 'string' && !isValidUrl(value)) {
          errors.push(`${field.label} must be a valid URL`)
        }
        break

      case 'email':
        if (typeof value === 'string' && !isValidEmail(value)) {
          errors.push(`${field.label} must be a valid email address`)
        }
        break

      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`${field.label} must be a number`)
        }
        break

      case 'select':
        if (field.options) {
          const validValues = field.options.map(o => o.value)
          if (!validValues.includes(String(value))) {
            warnings.push(`${field.label} has an unexpected value: ${value}`)
          }
        }
        break
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Replace template variables with user-provided values
 */
function interpolateValue(
  value: unknown,
  values: Record<string, string | number>
): unknown {
  if (typeof value === 'string') {
    // Match {{variable}} pattern
    return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      if (varName in values) {
        return String(values[varName])
      }
      // Keep trigger.body.* and previous.* variables as they are runtime
      if (varName.includes('.')) {
        return `{{${varName}}}`
      }
      return `{{${varName}}}`
    })
  }

  if (Array.isArray(value)) {
    return value.map(item => interpolateValue(item, values))
  }

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = interpolateValue(val, values)
    }
    return result
  }

  return value
}

/**
 * Convert template config to bot config with user values
 */
function createBotConfigFromTemplate(
  template: BotTemplate,
  values: Record<string, string | number>
): BotConfig {
  // Deep clone the template config
  const config = JSON.parse(JSON.stringify(template.config)) as BotConfig

  // Apply schedule if provided and different from default
  if (values.schedule && values.schedule !== 'custom') {
    config.schedule = values.schedule as string
    if (config.scheduleConfig) {
      config.scheduleConfig.cronExpression = values.schedule as string
    }
  }

  // Interpolate values in all action configs
  config.actions = config.actions.map((action, index) => {
    const interpolatedConfig = interpolateValue(action.config, values) as Record<string, unknown>

    return {
      id: `action-${index + 1}`,
      type: action.type,
      order: action.order,
      config: interpolatedConfig,
    } as BotAction
  })

  return config
}

/**
 * Generate a unique webhook URL for webhook-triggered bots
 */
function generateWebhookUrl(botId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/api/webhooks/bots/${botId}`
}

/**
 * Deploy a template as a new bot
 */
export async function deployTemplate(
  input: TemplateDeploymentInput
): Promise<TemplateDeploymentResult> {
  const warnings: string[] = []

  // 1. Get the template
  const template = getTemplateById(input.templateId)
  if (!template) {
    return {
      success: false,
      error: `Template not found: ${input.templateId}`,
    }
  }

  // 2. Validate user values
  const validation = validateTemplateValues(template, input.values)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(', '),
      warnings: validation.warnings,
    }
  }
  warnings.push(...validation.warnings)

  // 3. Create bot config from template
  const botConfig = createBotConfigFromTemplate(template, input.values)

  // 4. Create the bot
  try {
    const botInput: CreateBotInput = {
      name: input.name,
      description: input.description || template.description,
      config: botConfig,
      status: 'active',
    }

    const bot = await createBot(input.userId, botInput)

    const result: TemplateDeploymentResult = {
      success: true,
      botId: bot.id,
      warnings: warnings.length > 0 ? warnings : undefined,
    }

    // Add webhook URL for webhook-triggered bots
    if (template.config.type === 'webhook') {
      result.webhookUrl = generateWebhookUrl(bot.id)
    }

    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bot',
      warnings,
    }
  }
}

// ============================================================================
// Template Listing Service
// ============================================================================

export interface TemplateListOptions {
  category?: TemplateCategory
  search?: string
  limit?: number
  offset?: number
}

export interface TemplateListResult {
  templates: BotTemplate[]
  total: number
  hasMore: boolean
}

/**
 * List templates with optional filtering
 */
export function listTemplates(options: TemplateListOptions = {}): TemplateListResult {
  let result: BotTemplate[] = templates

  // Filter by category
  if (options.category) {
    result = getTemplatesByCategory(options.category)
  }

  // Filter by search query
  if (options.search) {
    result = searchTemplates(options.search)
  }

  // Apply both filters if both provided
  if (options.category && options.search) {
    const categoryTemplates = getTemplatesByCategory(options.category)
    const searchTemplates_ = searchTemplates(options.search)
    result = categoryTemplates.filter(t =>
      searchTemplates_.some(s => s.id === t.id)
    )
  }

  const total = result.length

  // Apply pagination
  const offset = options.offset || 0
  const limit = options.limit || 50
  result = result.slice(offset, offset + limit)

  return {
    templates: result,
    total,
    hasMore: offset + result.length < total,
  }
}

/**
 * Get all available template categories with counts
 */
export function getTemplateCategories(): Array<{
  id: TemplateCategory
  label: string
  description: string
  icon: string
  count: number
}> {
  const categories: TemplateCategory[] = [
    'monitoring',
    'notifications',
    'integrations',
    'data',
    'productivity',
  ]

  const categoryInfo: Record<TemplateCategory, { label: string; description: string; icon: string }> = {
    monitoring: {
      label: 'Monitoring',
      description: 'Track uptime, performance, and health',
      icon: 'activity',
    },
    notifications: {
      label: 'Notifications',
      description: 'Send alerts and messages',
      icon: 'bell',
    },
    integrations: {
      label: 'Integrations',
      description: 'Connect services together',
      icon: 'link',
    },
    data: {
      label: 'Data',
      description: 'Sync and process data',
      icon: 'database',
    },
    productivity: {
      label: 'Productivity',
      description: 'Automate recurring tasks',
      icon: 'zap',
    },
  }

  return categories.map(id => ({
    id,
    ...categoryInfo[id],
    count: getTemplatesByCategory(id).length,
  }))
}

// ============================================================================
// Utility Functions
// ============================================================================

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Get popular templates (most used)
 */
export function getPopularTemplates(limit = 6): BotTemplate[] {
  // In a real app, this would query usage stats from the database
  // For now, return a curated list of popular templates
  const popularIds = [
    'slack-notification',
    'http-health-check',
    'email-reminder',
    'discord-notification',
    'lead-notification',
    'daily-standup',
  ]

  return popularIds
    .map(id => getTemplateById(id))
    .filter((t): t is BotTemplate => t !== undefined)
    .slice(0, limit)
}

/**
 * Get featured templates for the home page
 */
export function getFeaturedTemplates(): BotTemplate[] {
  // Return one template from each category
  const categories: TemplateCategory[] = ['notifications', 'monitoring', 'productivity', 'integrations']

  return categories
    .map(cat => getTemplatesByCategory(cat)[0])
    .filter((t): t is BotTemplate => t !== undefined)
}
