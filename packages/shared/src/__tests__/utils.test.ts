import { describe, it, expect } from 'vitest'
import { formatPrice, formatDate, PRIORITY_LABELS, PRIORITY_ORDER } from '../utils'
import type { Currency, Priority } from '../types'

describe('Shared Utilities', () => {
  describe('formatPrice', () => {
    it('formats EUR prices correctly', () => {
      expect(formatPrice(49.95, 'EUR')).toBe('€49.95')
      expect(formatPrice(100, 'EUR')).toBe('€100.00')
      expect(formatPrice(0, 'EUR')).toBe('€0.00')
    })

    it('formats USD and GBP prices correctly', () => {
      expect(formatPrice(29.99, 'USD')).toBe('$29.99')
      expect(formatPrice(15.5, 'GBP')).toBe('£15.50')
    })
  })

  describe('formatDate', () => {
    it('formats dates consistently', () => {
      const d = new Date('2024-09-01T12:00:00Z')
      const formatted = formatDate(d)
      expect(formatted).toContain('2024')
      expect(formatted).toContain('September')
    })
  })

  describe('Priority Maps', () => {
    it('maintains expected hierarchy in PRIORITY_ORDER', () => {
      expect(PRIORITY_ORDER.dream).toBeGreaterThan(PRIORITY_ORDER.high)
      expect(PRIORITY_ORDER.high).toBeGreaterThan(PRIORITY_ORDER.medium)
      expect(PRIORITY_ORDER.medium).toBeGreaterThan(PRIORITY_ORDER.low)
    })

    it('has labels for all priorities', () => {
      const priorities: Priority[] = ['low', 'medium', 'high', 'dream']
      for (const p of priorities) {
        expect(PRIORITY_LABELS[p]).toBeDefined()
      }
    })
  })
})
