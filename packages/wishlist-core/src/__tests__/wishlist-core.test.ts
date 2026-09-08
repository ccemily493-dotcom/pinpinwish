import { describe, it, expect } from 'vitest'
import { applyFilters } from '../filters'
import { sortItems } from '../sort'
import { calculateTotal, getBestOffer } from '../totals'
import { detectPossibleDuplicates } from '../duplicates'
import { markAsPurchased, removeItem, restoreItem } from '../transitions'
import {
  hydrateWishlistItem,
  dehydrateWishlistItem,
  computeSourceIdempotencyKey,
} from '../hydration'
import type { WishlistItem, WishlistItemRecord, Product } from '../types'
import type { ProductOffer } from '@pinpinwish/price-tracker'

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const makeOffer = (overrides: Partial<ProductOffer> = {}): ProductOffer => ({
  id: 'offer-1',
  productId: 'product-1',
  store: 'Test Store',
  storeUrl: 'https://example.com',
  currentPrice: 100,
  currency: 'EUR',
  availability: 'in_stock',
  lastCheckedAt: new Date('2024-01-01'),
  priceHistory: [],
  ...overrides,
})

const makeItem = (overrides: Partial<WishlistItem> = {}): WishlistItem => ({
  id: 'item-1',
  wishlistId: 'wishlist-1',
  sourceId: 'source-1',
  sourceType: 'pinterest',
  sourceItemId: 'pin-123',
  product: {
    id: 'product-1',
    slug: 'test-product',
    name: 'Test Product',
    brand: 'Test Brand',
    category: 'clothes',
    offers: [makeOffer()],
  },
  priority: 'medium',
  status: 'wanted',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

// ─── Filter Tests ──────────────────────────────────────────────────────────────

describe('applyFilters', () => {
  it('filters by search (name)', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'dress', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'sneaker', name: 'White Sneakers', brand: 'Nike', category: 'shoes', offers: [] } }),
    ]
    const result = applyFilters(items, { search: 'dress', currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a')
  })

  it('filters by search (brand)', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'dress', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'sneaker', name: 'White Sneakers', brand: 'Nike', category: 'shoes', offers: [] } }),
    ]
    const result = applyFilters(items, { search: 'nike', currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('b')
  })

  it('filters by category', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'dress', name: 'Dress', brand: 'A', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'cream', name: 'Face Cream', brand: 'B', category: 'beauty', offers: [] } }),
    ]
    const result = applyFilters(items, { category: 'beauty', currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('b')
  })

  it('filters by priority', () => {
    const items = [
      makeItem({ id: 'a', priority: 'dream' }),
      makeItem({ id: 'b', priority: 'low' }),
    ]
    const result = applyFilters(items, { priority: 'dream', currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a')
  })

  it('filters by status', () => {
    const items = [
      makeItem({ id: 'a', status: 'wanted' }),
      makeItem({ id: 'b', status: 'purchased' }),
    ]
    const result = applyFilters(items, { status: 'purchased', currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('b')
  })

  it('filters by price range', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer({ currentPrice: 50 })] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [makeOffer({ currentPrice: 200 })] } }),
    ]
    const result = applyFilters(items, { minPrice: 40, maxPrice: 100, currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a')
  })

  it('does not use another currency for price filtering', () => {
    const items = [
      makeItem({ id: 'eur', product: { id: 'p1', slug: 'eur', name: 'EUR', category: 'clothes', offers: [makeOffer({ currentPrice: 80, currency: 'EUR' })] } }),
      makeItem({ id: 'usd', product: { id: 'p2', slug: 'usd', name: 'USD', category: 'clothes', offers: [makeOffer({ currentPrice: 80, currency: 'USD' })] } }),
    ]

    const result = applyFilters(items, { minPrice: 50, maxPrice: 100, currency: 'EUR' })
    expect(result.map((item) => item.id)).toEqual(['eur'])
  })

  it('filters by onlyUnresolved', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer()] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [] } }),
    ]
    const result = applyFilters(items, { onlyUnresolved: true, currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('b')
  })

  it('filters by onlyPossibleDuplicates', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b', possibleDuplicateOf: 'a' }),
    ]
    const result = applyFilters(items, { onlyPossibleDuplicates: true, currency: 'EUR' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('b')
  })

  it('returns empty array when no items match', () => {
    const items = [makeItem({ id: 'a', priority: 'low' })]
    const result = applyFilters(items, { priority: 'dream', currency: 'EUR' })
    expect(result).toHaveLength(0)
  })
})

// ─── Sort Tests ────────────────────────────────────────────────────────────────

describe('sortItems', () => {
  it('sorts by price ascending', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer({ currentPrice: 200 })] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [makeOffer({ currentPrice: 50 })] } }),
    ]
    const result = sortItems(items, { field: 'price', direction: 'asc' }, 'EUR')
    expect(result[0]?.id).toBe('b')
    expect(result[1]?.id).toBe('a')
  })

  it('sorts by price descending', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer({ currentPrice: 50 })] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [makeOffer({ currentPrice: 200 })] } }),
    ]
    const result = sortItems(items, { field: 'price', direction: 'desc' }, 'EUR')
    expect(result[0]?.id).toBe('b')
    expect(result[1]?.id).toBe('a')
  })

  it('sorts by date ascending', () => {
    const items = [
      makeItem({ id: 'a', createdAt: new Date('2024-03-01') }),
      makeItem({ id: 'b', createdAt: new Date('2024-01-01') }),
    ]
    const result = sortItems(items, { field: 'date', direction: 'asc' }, 'EUR')
    expect(result[0]?.id).toBe('b')
    expect(result[1]?.id).toBe('a')
  })

  it('sorts by date descending', () => {
    const items = [
      makeItem({ id: 'a', createdAt: new Date('2024-01-01') }),
      makeItem({ id: 'b', createdAt: new Date('2024-03-01') }),
    ]
    const result = sortItems(items, { field: 'date', direction: 'desc' }, 'EUR')
    expect(result[0]?.id).toBe('b')
    expect(result[1]?.id).toBe('a')
  })

  it('does not mutate input', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
    ]
    const original = [...items]
    sortItems(items, { field: 'price', direction: 'asc' }, 'EUR')
    expect(items[0]?.id).toBe(original[0]?.id)
  })

  it('keeps items without an offer in the requested currency last in either direction', () => {
    const eur = makeItem({ id: 'eur', product: { id: 'p1', slug: 'eur', name: 'EUR', category: 'clothes', offers: [makeOffer({ currentPrice: 80, currency: 'EUR' })] } })
    const usd = makeItem({ id: 'usd', product: { id: 'p2', slug: 'usd', name: 'USD', category: 'clothes', offers: [makeOffer({ currentPrice: 1, currency: 'USD' })] } })

    expect(sortItems([usd, eur], { field: 'price', direction: 'asc' }, 'EUR').map((item) => item.id)).toEqual(['eur', 'usd'])
    expect(sortItems([usd, eur], { field: 'price', direction: 'desc' }, 'EUR').map((item) => item.id)).toEqual(['eur', 'usd'])
  })
})

// ─── Total & Best Offer Tests ──────────────────────────────────────────────────

describe('calculateTotal', () => {
  it('sums best prices of wanted items', () => {
    const items = [
      makeItem({ id: 'a', status: 'wanted', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer({ currentPrice: 100 })] } }),
      makeItem({ id: 'b', status: 'wanted', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [makeOffer({ currentPrice: 50 })] } }),
    ]
    expect(calculateTotal(items, 'EUR')).toBe(150)
  })

  it('excludes purchased items from total', () => {
    const items = [
      makeItem({ id: 'a', status: 'wanted', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer({ currentPrice: 100 })] } }),
      makeItem({ id: 'b', status: 'purchased', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [makeOffer({ currentPrice: 50 })] } }),
    ]
    expect(calculateTotal(items, 'EUR')).toBe(100)
  })

  it('excludes removed items from total', () => {
    const items = [
      makeItem({ id: 'a', status: 'wanted', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [makeOffer({ currentPrice: 100 })] } }),
      makeItem({ id: 'b', status: 'removed', product: { id: 'p2', slug: 'b', name: 'B', category: 'clothes', offers: [makeOffer({ currentPrice: 50 })] } }),
    ]
    expect(calculateTotal(items, 'EUR')).toBe(100)
  })

  it('returns 0 for empty list', () => {
    expect(calculateTotal([], 'EUR')).toBe(0)
  })

  it('handles items with no offers', () => {
    const items = [
      makeItem({ id: 'a', status: 'wanted', product: { id: 'p1', slug: 'a', name: 'A', category: 'clothes', offers: [] } }),
    ]
    expect(calculateTotal(items, 'EUR')).toBe(0)
  })

  it('never adds an offer denominated in another currency', () => {
    const items = [
      makeItem({
        id: 'eur-item',
        product: {
          id: 'eur-product',
          slug: 'eur-product',
          name: 'EUR Product',
          category: 'clothes',
          offers: [makeOffer({ currentPrice: 100, currency: 'EUR' })],
        },
      }),
      makeItem({
        id: 'usd-item',
        product: {
          id: 'usd-product',
          slug: 'usd-product',
          name: 'USD Product',
          category: 'clothes',
          offers: [makeOffer({ currentPrice: 1, currency: 'USD' })],
        },
      }),
    ]

    expect(calculateTotal(items, 'EUR')).toBe(100)
    expect(calculateTotal(items, 'USD')).toBe(1)
  })
})

describe('getBestOffer', () => {
  it('returns undefined for empty offers', () => {
    expect(getBestOffer([], 'EUR')).toBeUndefined()
  })

  it('returns the cheapest in-stock offer', () => {
    const offers = [
      makeOffer({ id: 'o1', currentPrice: 100, availability: 'in_stock' }),
      makeOffer({ id: 'o2', currentPrice: 80, availability: 'in_stock' }),
      makeOffer({ id: 'o3', currentPrice: 60, availability: 'out_of_stock' }),
    ]
    const best = getBestOffer(offers, 'EUR')
    expect(best?.id).toBe('o2')
    expect(best?.currentPrice).toBe(80)
  })

  it('prefers in-stock over unknown availability', () => {
    const offers = [
      makeOffer({ id: 'o-instock', currentPrice: 100, availability: 'in_stock' }),
      makeOffer({ id: 'o-unknown', currentPrice: 70, availability: 'unknown' }),
    ]
    const best = getBestOffer(offers, 'EUR')
    expect(best?.id).toBe('o-instock')
    expect(best?.currentPrice).toBe(100)
  })

  it('prefers unknown availability over cheaper out-of-stock', () => {
    const offers = [
      makeOffer({ id: 'o-unknown', currentPrice: 100, availability: 'unknown' }),
      makeOffer({ id: 'o-outofstock', currentPrice: 50, availability: 'out_of_stock' }),
    ]
    const best = getBestOffer(offers, 'EUR')
    expect(best?.id).toBe('o-unknown')
    expect(best?.currentPrice).toBe(100)
  })

  it('falls back to out-of-stock offers when no in-stock or unknown available', () => {
    const offers = [
      makeOffer({ id: 'o1', currentPrice: 100, availability: 'out_of_stock' }),
      makeOffer({ id: 'o2', currentPrice: 120, availability: 'out_of_stock' }),
    ]
    const best = getBestOffer(offers, 'EUR')
    expect(best?.id).toBe('o1')
    expect(best?.availability).toBe('out_of_stock')
  })

  it('ignores placeholder offers whose price is still unknown', () => {
    const best = getBestOffer(
      [
        makeOffer({ id: 'unknown-price', currentPrice: 0, availability: 'unknown' }),
        makeOffer({ id: 'priced', currentPrice: 75, availability: 'in_stock' }),
      ],
      'EUR'
    )

    expect(best?.id).toBe('priced')
    expect(getBestOffer([makeOffer({ currentPrice: 0 })], 'EUR')).toBeUndefined()
  })

  it('ignores numerically cheaper offers in another currency', () => {
    const offers = [
      makeOffer({ id: 'eur', currentPrice: 100, currency: 'EUR' }),
      makeOffer({ id: 'usd', currentPrice: 1, currency: 'USD' }),
    ]

    expect(getBestOffer(offers, 'EUR')?.id).toBe('eur')
    expect(getBestOffer(offers, 'USD')?.id).toBe('usd')
    expect(getBestOffer(offers, 'GBP')).toBeUndefined()
  })
})

// ─── Duplicate Detection Tests ─────────────────────────────────────────────────

describe('detectPossibleDuplicates', () => {
  it('flags items with identical name and brand as possible duplicates', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
    ]
    const result = detectPossibleDuplicates(items)
    const b = result.find((i) => i.id === 'b')
    expect(b?.possibleDuplicateOf).toBe('a')
  })

  it('does NOT flag items with different names', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'Red Blouse', brand: 'Zara', category: 'clothes', offers: [] } }),
    ]
    const result = detectPossibleDuplicates(items)
    const b = result.find((i) => i.id === 'b')
    expect(b?.possibleDuplicateOf).toBeUndefined()
  })

  it('does NOT flag items in different categories', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'Classic Item', brand: 'Brand', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'Classic Item', brand: 'Brand', category: 'shoes', offers: [] } }),
    ]
    const result = detectPossibleDuplicates(items)
    const b = result.find((i) => i.id === 'b')
    expect(b?.possibleDuplicateOf).toBeUndefined()
  })

  it('does NOT automatically merge duplicates', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
    ]
    const result = detectPossibleDuplicates(items)
    expect(result).toHaveLength(2)
  })

  it('does not flag removed items as duplicates', () => {
    const items = [
      makeItem({ id: 'a', status: 'removed', product: { id: 'p1', slug: 'a', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', status: 'wanted', product: { id: 'p2', slug: 'b', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
    ]
    const result = detectPossibleDuplicates(items)
    const b = result.find((i) => i.id === 'b')
    expect(b?.possibleDuplicateOf).toBeUndefined()
  })

  it('does not flag unresolved Pins with no brand or offer evidence', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'Pinterest Pin pendiente', category: 'other', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'Pinterest Pin pendiente', category: 'other', offers: [] } }),
    ]
    expect(detectPossibleDuplicates(items)[1]?.possibleDuplicateOf).toBeUndefined()
  })

  it('does not mutate input items', () => {
    const items = [
      makeItem({ id: 'a', product: { id: 'p1', slug: 'a', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
      makeItem({ id: 'b', product: { id: 'p2', slug: 'b', name: 'Blue Dress', brand: 'Zara', category: 'clothes', offers: [] } }),
    ]
    detectPossibleDuplicates(items)
    expect(items[1]?.possibleDuplicateOf).toBeUndefined()
  })
})

// ─── Transition Tests ──────────────────────────────────────────────────────────

describe('item transitions', () => {
  it('markAsPurchased changes status to purchased', () => {
    const item = makeItem({ status: 'wanted' })
    const result = markAsPurchased(item)
    expect(result.status).toBe('purchased')
  })

  it('removeItem changes status to removed', () => {
    const item = makeItem({ status: 'wanted' })
    const result = removeItem(item)
    expect(result.status).toBe('removed')
  })

  it('restoreItem changes status to wanted', () => {
    const removed = makeItem({ status: 'removed' })
    const result = restoreItem(removed)
    expect(result.status).toBe('wanted')
  })

  it('restoreItem works from purchased status', () => {
    const purchased = makeItem({ status: 'purchased' })
    const result = restoreItem(purchased)
    expect(result.status).toBe('wanted')
  })

  it('transitions do not mutate original item', () => {
    const item = makeItem({ status: 'wanted' })
    markAsPurchased(item)
    expect(item.status).toBe('wanted')
  })

  it('transitions update updatedAt timestamp', () => {
    const original = new Date('2024-01-01')
    const item = makeItem({ updatedAt: original })
    const result = markAsPurchased(item)
    expect(result.updatedAt.getTime()).toBeGreaterThan(original.getTime())
  })
})

// ─── Hydration & Idempotency Tests ────────────────────────────────────────────

describe('Hydration and Idempotency Contracts', () => {
  it('hydrates WishlistItemRecord with Product into WishlistItemView', () => {
    const record: WishlistItemRecord = {
      id: 'rec-1',
      wishlistId: 'wl-1',
      productId: 'prod-1',
      sourceId: 'src-1',
      sourceType: 'pinterest',
      sourceItemId: 'pin-100',
      priority: 'high',
      status: 'wanted',
      desiredSize: 'M',
      desiredColor: 'Black',
      notes: 'Gift idea',
      createdAt: new Date('2024-05-01'),
      updatedAt: new Date('2024-05-01'),
    }

    const product: Product = {
      id: 'prod-1',
      slug: 'silk-blouse',
      name: 'Silk Blouse',
      brand: 'Cuyana',
      category: 'clothes',
      offers: [makeOffer({ productId: 'prod-1', currentPrice: 120 })],
    }

    const view = hydrateWishlistItem(record, product)
    expect(view.id).toBe('rec-1')
    expect(view.product.name).toBe('Silk Blouse')
    expect(view.sourceId).toBe('src-1')
    expect(view.sourceItemId).toBe('pin-100')
    expect(view.priority).toBe('high')
  })

  it('dehydrates WishlistItemView back to WishlistItemRecord', () => {
    const view = makeItem({
      id: 'view-1',
      wishlistId: 'wl-1',
      sourceId: 'src-1',
      sourceType: 'pinterest',
      sourceItemId: 'pin-100',
      priority: 'dream',
    })

    const record = dehydrateWishlistItem(view)
    expect(record.id).toBe('view-1')
    expect(record.productId).toBe(view.product.id)
    expect(record.sourceId).toBe('src-1')
    expect(record.sourceItemId).toBe('pin-100')
    expect(record.priority).toBe('dream')
  })

  it('computes consistent source idempotency key', () => {
    const key = computeSourceIdempotencyKey('wl-123', 'src-pin-456', 'item-789')
    expect(key).toBe('wl-123:src-pin-456:item-789')
  })

  it('returns undefined if sourceId or sourceItemId is missing', () => {
    expect(computeSourceIdempotencyKey('wl-123', undefined, 'item-789')).toBeUndefined()
    expect(computeSourceIdempotencyKey('wl-123', 'src-pin-456', undefined)).toBeUndefined()
  })

  it('rejects hydration when record and product identifiers differ', () => {
    const record: WishlistItemRecord = {
      id: 'rec-mismatch',
      wishlistId: 'wl-1',
      productId: 'product-a',
      priority: 'medium',
      status: 'wanted',
      createdAt: new Date('2024-05-01'),
      updatedAt: new Date('2024-05-01'),
    }
    const product: Product = {
      id: 'product-b',
      slug: 'product-b',
      name: 'Different product',
      category: 'other',
      offers: [],
    }

    expect(() => hydrateWishlistItem(record, product)).toThrow(/does not match/)
  })
})
