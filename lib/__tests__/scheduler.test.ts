import { describe, it, expect } from 'vitest'
import { CronParser } from '../scheduler'

describe('CronParser', () => {
  describe('parseField', () => {
    it('parses asterisk as all values', () => {
      const values = CronParser.parseField('*', 0, 59)
      expect(values.size).toBe(60)
      expect(values.has(0)).toBe(true)
      expect(values.has(59)).toBe(true)
    })

    it('parses single value', () => {
      const values = CronParser.parseField('30', 0, 59)
      expect(values.size).toBe(1)
      expect(values.has(30)).toBe(true)
    })

    it('parses range', () => {
      const values = CronParser.parseField('1-5', 0, 6)
      expect(values.size).toBe(5)
      expect(values.has(1)).toBe(true)
      expect(values.has(5)).toBe(true)
      expect(values.has(0)).toBe(false)
    })

    it('parses step values', () => {
      const values = CronParser.parseField('*/15', 0, 59)
      expect(values.has(0)).toBe(true)
      expect(values.has(15)).toBe(true)
      expect(values.has(30)).toBe(true)
      expect(values.has(45)).toBe(true)
      expect(values.has(10)).toBe(false)
    })

    it('parses comma-separated values', () => {
      const values = CronParser.parseField('1,15,30', 0, 59)
      expect(values.size).toBe(3)
      expect(values.has(1)).toBe(true)
      expect(values.has(15)).toBe(true)
      expect(values.has(30)).toBe(true)
    })

    it('parses range with step', () => {
      const values = CronParser.parseField('0-10/2', 0, 59)
      expect(values.has(0)).toBe(true)
      expect(values.has(2)).toBe(true)
      expect(values.has(4)).toBe(true)
      expect(values.has(1)).toBe(false)
      expect(values.has(3)).toBe(false)
    })
  })

  describe('matches', () => {
    it('matches every minute expression', () => {
      const date = new Date('2024-12-28T10:30:00')
      expect(CronParser.matches('* * * * *', date)).toBe(true)
    })

    it('matches specific minute', () => {
      const date = new Date('2024-12-28T10:30:00')
      expect(CronParser.matches('30 * * * *', date)).toBe(true)
      expect(CronParser.matches('31 * * * *', date)).toBe(false)
    })

    it('matches specific hour and minute', () => {
      const date = new Date('2024-12-28T09:00:00')
      expect(CronParser.matches('0 9 * * *', date)).toBe(true)
      expect(CronParser.matches('0 10 * * *', date)).toBe(false)
    })

    it('matches weekday expression', () => {
      // December 28, 2024 is a Saturday (day 6)
      const saturday = new Date('2024-12-28T09:00:00')
      expect(CronParser.matches('0 9 * * 6', saturday)).toBe(true)
      expect(CronParser.matches('0 9 * * 1-5', saturday)).toBe(false)

      // December 27, 2024 is a Friday (day 5)
      const friday = new Date('2024-12-27T09:00:00')
      expect(CronParser.matches('0 9 * * 1-5', friday)).toBe(true)
    })

    it('matches step expression', () => {
      const date0 = new Date('2024-12-28T10:00:00')
      const date5 = new Date('2024-12-28T10:05:00')
      const date7 = new Date('2024-12-28T10:07:00')

      expect(CronParser.matches('*/5 * * * *', date0)).toBe(true)
      expect(CronParser.matches('*/5 * * * *', date5)).toBe(true)
      expect(CronParser.matches('*/5 * * * *', date7)).toBe(false)
    })

    it('returns false for invalid expression', () => {
      const date = new Date()
      expect(CronParser.matches('invalid', date)).toBe(false)
      expect(CronParser.matches('* * *', date)).toBe(false)
    })
  })

  describe('validate', () => {
    it('validates correct expressions', () => {
      expect(CronParser.validate('* * * * *').valid).toBe(true)
      expect(CronParser.validate('0 9 * * 1-5').valid).toBe(true)
      expect(CronParser.validate('*/15 * * * *').valid).toBe(true)
      expect(CronParser.validate('0 0 1 * *').valid).toBe(true)
    })

    it('rejects expressions with wrong field count', () => {
      const result = CronParser.validate('* * *')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Expected 5 fields')
    })

    it('rejects out of range values', () => {
      const result = CronParser.validate('60 * * * *')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('out of range')
    })
  })

  describe('describe', () => {
    it('describes every minute', () => {
      expect(CronParser.describe('* * * * *')).toBe('Every minute')
    })

    it('describes every hour', () => {
      expect(CronParser.describe('0 * * * *')).toBe('Every hour')
    })

    it('describes daily at midnight', () => {
      expect(CronParser.describe('0 0 * * *')).toBe('Every day at midnight')
    })

    it('describes interval patterns', () => {
      expect(CronParser.describe('*/5 * * * *')).toBe('Every 5 minutes')
      expect(CronParser.describe('*/15 * * * *')).toBe('Every 15 minutes')
    })

    it('describes daily at specific time', () => {
      expect(CronParser.describe('0 9 * * *')).toBe('Every day at 9:00')
    })

    it('describes weekday pattern', () => {
      expect(CronParser.describe('0 9 * * 1-5')).toBe('Weekdays at 9:00')
    })

    it('returns expression for complex patterns', () => {
      const complex = '30 14 1,15 * *'
      expect(CronParser.describe(complex)).toBe(complex)
    })
  })

  describe('getNextRun', () => {
    it('gets next minute for every-minute expression', () => {
      const from = new Date('2024-12-28T10:30:00')
      const next = CronParser.getNextRun('* * * * *', from)
      expect(next.getMinutes()).toBe(31)
    })

    it('gets next occurrence for hourly expression', () => {
      const from = new Date('2024-12-28T10:30:00')
      const next = CronParser.getNextRun('0 * * * *', from)
      expect(next.getHours()).toBe(11)
      expect(next.getMinutes()).toBe(0)
    })

    it('gets next occurrence for daily expression', () => {
      const from = new Date('2024-12-28T10:00:00')
      const next = CronParser.getNextRun('0 9 * * *', from)
      // Next 9 AM is the following day
      expect(next.getDate()).toBe(29)
      expect(next.getHours()).toBe(9)
    })

    it('handles step patterns correctly', () => {
      const from = new Date('2024-12-28T10:03:00')
      const next = CronParser.getNextRun('*/5 * * * *', from)
      expect(next.getMinutes()).toBe(5)
    })
  })
})
