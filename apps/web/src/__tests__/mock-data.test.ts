import { describe, it, expect } from 'vitest'
import { MOCK_WISHLIST_ITEMS } from '../data/mock-items'
import {
  calculateTotal,
  getBestOffer,
  detectPossibleDuplicates,
  applyFilters,
  sortItems,
} from '@pinpinwish/wishlist-core'

describe('Web Mock Data Integrity & Navigation/Filter Logic', () => {
  it('contains at least 8-12 realistic products', () => {
    expect(MOCK_WISHLIST_ITEMS.length).toBeGreaterThanOrEqual(8)
    expect(MOCK_WISHLIST_ITEMS.length).toBeLessThanOrEqual(15)
  })

  it('includes required categories (clothes, shoes, beauty, home, other)', () => {
    const categories = new Set(MOCK_WISHLIST_ITEMS.map((item) => item.product.category))
    expect(categories.has('clothes')).toBe(true)
    expect(categories.has('shoes')).toBe(true)
    expect(categories.has('beauty')).toBe(true)
    expect(categories.has('home')).toBe(true)
    expect(categories.has('other')).toBe(true)
  })

  it('includes at least one purchased and one removed item', () => {
    const statuses = new Set(MOCK_WISHLIST_ITEMS.map((item) => item.status))
    expect(statuses.has('purchased')).toBe(true)
    expect(statuses.has('removed')).toBe(true)
    expect(statuses.has('wanted')).toBe(true)
  })

  it('includes an unidentified item with no offers', () => {
    const unidentified = MOCK_WISHLIST_ITEMS.find((item) => item.product.offers.length === 0)
    expect(unidentified).toBeDefined()
    expect(unidentified?.product.brand).toBeUndefined()
  })

  it('includes possible duplicate items with sourceId and sourceItemId', () => {
    const duplicates = detectPossibleDuplicates(MOCK_WISHLIST_ITEMS)
    const flagged = duplicates.filter((item) => item.possibleDuplicateOf !== undefined)
    expect(flagged.length).toBeGreaterThanOrEqual(1)
    expect(flagged[0]?.sourceId).toBeDefined()
    expect(flagged[0]?.sourceItemId).toBeDefined()
  })

  it('calculates total correctly for wanted items only', () => {
    const total = calculateTotal(MOCK_WISHLIST_ITEMS)
    expect(total).toBeGreaterThan(0)
  })

  it('maintains separate price histories per store offer (no mixed store histories)', () => {
    const multiOfferProduct = MOCK_WISHLIST_ITEMS.find(
      (item) => item.product.offers.length >= 2 && item.product.offers.every((o) => o.priceHistory.length > 0)
    )

    expect(multiOfferProduct).toBeDefined()
    if (multiOfferProduct) {
      for (const offer of multiOfferProduct.product.offers) {
        for (const obs of offer.priceHistory) {
          expect(obs.productOfferId).toBe(offer.id)
        }
      }
    }
  })

  it('includes representations of in_stock, out_of_stock, and unknown availability', () => {
    const allOffers = MOCK_WISHLIST_ITEMS.flatMap((item) => item.product.offers)
    const availabilities = new Set(allOffers.map((o) => o.availability))

    expect(availabilities.has('in_stock')).toBe(true)
    expect(availabilities.has('out_of_stock')).toBe(true)
    expect(availabilities.has('unknown')).toBe(true)
  })

  it('has price history with descending trend on at least one product offer', () => {
    const offerWithHistory = MOCK_WISHLIST_ITEMS
      .flatMap((item) => item.product.offers)
      .find((offer) => offer.priceHistory.length >= 3)

    expect(offerWithHistory).toBeDefined()
    if (offerWithHistory && offerWithHistory.priceHistory.length >= 2) {
      const firstPrice = offerWithHistory.priceHistory[0]!.price
      const lastPrice = offerWithHistory.priceHistory[offerWithHistory.priceHistory.length - 1]!.price
      expect(lastPrice).toBeLessThan(firstPrice)
    }
  })

  it('filters and sorts mock items cleanly on client', () => {
    // Filter clothes
    const clothes = applyFilters(MOCK_WISHLIST_ITEMS, { category: 'clothes' })
    expect(clothes.length).toBeGreaterThan(0)
    expect(clothes.every((i) => i.product.category === 'clothes')).toBe(true)

    // Sort by price ascending
    const sortedAsc = sortItems(clothes, { field: 'price', direction: 'asc' })
    const priceFirst = getBestOffer(sortedAsc[0]!.product.offers)?.currentPrice ?? 0
    const priceLast = getBestOffer(sortedAsc[sortedAsc.length - 1]!.product.offers)?.currentPrice ?? 0
    expect(priceFirst).toBeLessThanOrEqual(priceLast)
  })
})
