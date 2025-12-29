/**
 * Bot Workflow Template Types
 *
 * Type definitions for pre-built workflow templates.
 */

import type { ActionType } from '../execution/types'

// ============================================
// TEMPLATE CATEGORIES
// ============================================

export type TemplateCategory =
  | 'notifications'
  | 'monitoring'
  | 'data-sync'
  | 'social-media'
  | 'devops'
  | 'productivity'
  | 'marketing'
  | 'customer-support'

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, {
  label: string
  description: string
  icon: string
}> = {
  notifications: {
    label: 'Notifications',
    description: 'Alert and notification workflows',
    icon: 'bell',
  },
  monitoring: {
    label: 'Monitoring',
    description: 'System and service monitoring',
    icon: 'activity',
  },
  'data-sync': {
    label: 'Data Sync',
    description: 'Synchronize data between services',
    icon: 'refresh-cw',
  },
  'social-media': {
    label: 'Social Media',
    description: 'Social media automation',
    icon: 'share-2',
  },
  devops: {
    label: 'DevOps',
    description: 'CI/CD and deployment automation',
    icon: 'terminal',
  },
  productivity: {
    label: 'Productivity',
    description: 'Task and workflow automation',
    icon: 'zap',
  },
  marketing: {
    label: 'Marketing',
    description: 'Marketing automation workflows',
    icon: 'mail',
  },
  'customer-support': {
    label: 'Customer Support',
    description: 'Support ticket automation',
    icon: 'headphones',
  },
}

// ============================================
// TEMPLATE ACTION CONFIGURATION
// ============================================

export interface TemplateActionConfig {
  id: string
  type: ActionType
  name: string
  description?: string
  config: Record<string, unknown>
  // Fields that need user input
  userInputFields?: TemplateInputField[]
}

export interface TemplateInputField {
  key: string
  label: string
  type: 'text' | 'url' | 'email' | 'select' | 'number' | 'textarea' | 'secret'
  placeholder?: string
  required: boolean
  defaultValue?: string | number
  options?: Array<{ value: string; label: string }>
  validation?: {
    pattern?: string
    min?: number
    max?: number
    message?: string
  }
}

// ============================================
// TEMPLATE DEFINITION
// ============================================

export interface BotTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  tags: string[]
  icon: string
  color: string

  // Template metadata
  author: string
  version: string
  createdAt: string
  updatedAt: string

  // Popularity metrics
  usageCount: number
  rating: number

  // Trigger configuration
  trigger: {
    type: 'schedule' | 'webhook' | 'manual'
    config: {
      cron?: string
      cronDescription?: string
      webhookPath?: string
    }
  }

  // Actions in the workflow
  actions: TemplateActionConfig[]

  // User input fields collected at deploy time
  requiredInputs: TemplateInputField[]

  // Example output preview
  exampleOutput?: string

  // Prerequisites
  prerequisites?: string[]

  // Estimated setup time
  setupTime?: string
}

// ============================================
// TEMPLATE DEPLOYMENT
// ============================================

export interface TemplateDeploymentInput {
  templateId: string
  name: string
  description?: string
  inputs: Record<string, string | number>
  schedule?: {
    enabled: boolean
    cron?: string
  }
}

export interface TemplateDeploymentResult {
  success: boolean
  botId?: string
  error?: string
  warnings?: string[]
}

// ============================================
// TEMPLATE SEARCH & FILTER
// ============================================

export interface TemplateSearchParams {
  query?: string
  category?: TemplateCategory
  tags?: string[]
  sortBy?: 'popular' | 'recent' | 'name'
  limit?: number
  offset?: number
}

export interface TemplateSearchResult {
  templates: BotTemplate[]
  total: number
  hasMore: boolean
}
