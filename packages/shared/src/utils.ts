import { createHash } from 'node:crypto'
import type { Currency, Priority } from './types'

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
}

export function formatPrice(value: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '€'
  return `${symbol}${value.toFixed(2)}`
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  dream: 'Dream',
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  dream: 4,
  high: 3,
  medium: 2,
  low: 1,
}

/**
 * Computes SHA-256 hash of an image buffer or string content for duplicate detection.
 */
export function computeImageHash(buffer: Buffer | Uint8Array | string): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Computes slug from a name string.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
