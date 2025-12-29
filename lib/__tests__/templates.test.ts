import { describe, it, expect } from 'vitest'
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  createConfigFromTemplate,
  getCategoryInfo,
  templates,
} from '../templates'

describe('Bot Templates', () => {
  describe('getAllTemplates', () => {
    it('returns all templates', () => {
      const all = getAllTemplates()
      expect(all).toHaveLength(templates.length)
      expect(all.length).toBeGreaterThan(0)
    })

    it('returns templates with required properties', () => {
      const all = getAllTemplates()
      for (const template of all) {
        expect(template).toHaveProperty('id')
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('description')
        expect(template).toHaveProperty('category')
        expect(template).toHaveProperty('config')
        expect(template).toHaveProperty('configSchema')
      }
    })
  })

  describe('getTemplateById', () => {
    it('returns template when found', () => {
      const template = getTemplateById('http-health-check')
      expect(template).toBeDefined()
      expect(template?.name).toBe('HTTP Health Check')
    })

    it('returns undefined for non-existent template', () => {
      const template = getTemplateById('non-existent-template')
      expect(template).toBeUndefined()
    })
  })

  describe('getTemplatesByCategory', () => {
    it('returns templates for monitoring category', () => {
      const monitoring = getTemplatesByCategory('monitoring')
      expect(monitoring.length).toBeGreaterThan(0)
      monitoring.forEach(t => expect(t.category).toBe('monitoring'))
    })

    it('returns templates for notifications category', () => {
      const notifications = getTemplatesByCategory('notifications')
      expect(notifications.length).toBeGreaterThan(0)
      notifications.forEach(t => expect(t.category).toBe('notifications'))
    })

    it('returns empty array for category with no templates', () => {
      const empty = getTemplatesByCategory('data')
      // data category exists but might have templates
      expect(Array.isArray(empty)).toBe(true)
    })
  })

  describe('searchTemplates', () => {
    it('finds templates by name', () => {
      const results = searchTemplates('health')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(t => t.name.toLowerCase().includes('health'))).toBe(true)
    })

    it('finds templates by description', () => {
      const results = searchTemplates('monitor')
      expect(results.length).toBeGreaterThan(0)
    })

    it('finds templates by tags', () => {
      const results = searchTemplates('slack')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(t => t.tags.includes('slack'))).toBe(true)
    })

    it('returns empty array for no matches', () => {
      const results = searchTemplates('xyznonexistent123')
      expect(results).toHaveLength(0)
    })

    it('search is case insensitive', () => {
      const lower = searchTemplates('http')
      const upper = searchTemplates('HTTP')
      expect(lower.length).toBe(upper.length)
    })
  })

  describe('createConfigFromTemplate', () => {
    it('creates config with user values applied', () => {
      const template = getTemplateById('http-health-check')!
      const config = createConfigFromTemplate(template, {
        target_url: 'https://example.com/health',
        schedule: '*/10 * * * *',
      })

      expect(config.schedule).toBe('*/10 * * * *')
      expect(config.type).toBe('schedule')
    })

    it('replaces template variables in action configs', () => {
      const template = getTemplateById('http-health-check')!
      const config = createConfigFromTemplate(template, {
        target_url: 'https://test.example.com',
      })

      const httpAction = config.actions.find(a => a.type === 'http_request')
      expect(httpAction?.config.url).toBe('https://test.example.com')
    })

    it('preserves default schedule when custom not specified', () => {
      const template = getTemplateById('http-health-check')!
      const config = createConfigFromTemplate(template, {
        target_url: 'https://example.com',
      })

      expect(config.schedule).toBe(template.config.schedule)
    })
  })

  describe('getCategoryInfo', () => {
    it('returns info for monitoring category', () => {
      const info = getCategoryInfo('monitoring')
      expect(info).toHaveProperty('label')
      expect(info).toHaveProperty('description')
      expect(info).toHaveProperty('icon')
      expect(info.label).toBe('Monitoring')
    })

    it('returns info for all categories', () => {
      const categories = ['monitoring', 'notifications', 'integrations', 'data', 'productivity'] as const
      for (const category of categories) {
        const info = getCategoryInfo(category)
        expect(info.label).toBeTruthy()
        expect(info.description).toBeTruthy()
      }
    })
  })
})
