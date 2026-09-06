import { describe, it, expect } from 'vitest'
import {
  recordObservation,
  updateOfferFromObservation,
  sortHistoryChronologically,
  sortHistoryNewestFirst,
} from '../tracker'
import type { ProductOffer, PriceObservation } from '../types'

const makeOffer = (overrides: Partial<ProductOffer> = {}): ProductOffer => ({
  id: 'offer-1',
  productId: 'product-1',
  store: 'Test Store',
  storeUrl: 'https://example.com/product',
  currentPrice: 100,
  currency: 'EUR',
  availability: 'in_stock',
  variant: {
    size: 'M',
    color: 'Navy',
    sku: 'SKU-001',
  },
  lastCheckedAt: new Date('2024-01-01T00:00:00Z'),
  priceHistory: [],
  ...overrides,
})

describe('price-tracker', () => {
  describe('recordObservation', () => {
    it('appends observation to price history', () => {
      const offer = makeOffer()
      const result = recordObservation(offer, {
        id: 'obs-1',
        price: 95,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date('2024-01-02T00:00:00Z'),
      })
      expect(result.priceHistory).toHaveLength(1)
      expect(result.priceHistory[0]?.price).toBe(95)
    })

    it('updates currentPrice from observation', () => {
      const offer = makeOffer({ currentPrice: 100 })
      const result = recordObservation(offer, {
        id: 'obs-1',
        price: 80,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date('2024-01-02T00:00:00Z'),
      })
      expect(result.currentPrice).toBe(80)
    })

    it('marks offer as out_of_stock when observation says so', () => {
      const offer = makeOffer({ availability: 'in_stock' })
      const result = recordObservation(offer, {
        id: 'obs-1',
        price: 100,
        currency: 'EUR',
        availability: 'out_of_stock',
        checkedAt: new Date('2024-01-02T00:00:00Z'),
      })
      expect(result.availability).toBe('out_of_stock')
    })

    it('records unknown availability correctly', () => {
      const offer = makeOffer({ availability: 'in_stock' })
      const result = recordObservation(offer, {
        id: 'obs-unk',
        price: 85,
        currency: 'EUR',
        availability: 'unknown',
        checkedAt: new Date('2024-01-03T00:00:00Z'),
      })
      expect(result.availability).toBe('unknown')
      expect(result.priceHistory[0]?.availability).toBe('unknown')
    })

    it('maintains independent price histories for different offers', () => {
      const offerA = makeOffer({ id: 'offer-A', store: 'Store A', currentPrice: 100 })
      const offerB = makeOffer({ id: 'offer-B', store: 'Store B', currentPrice: 90 })

      const updatedA = recordObservation(offerA, {
        id: 'obs-A1',
        price: 95,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date('2024-01-02T00:00:00Z'),
      })

      const updatedB = recordObservation(offerB, {
        id: 'obs-B1',
        price: 85,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date('2024-01-02T00:00:00Z'),
      })

      expect(updatedA.priceHistory).toHaveLength(1)
      expect(updatedA.priceHistory[0]?.productOfferId).toBe('offer-A')
      expect(updatedA.priceHistory[0]?.price).toBe(95)

      expect(updatedB.priceHistory).toHaveLength(1)
      expect(updatedB.priceHistory[0]?.productOfferId).toBe('offer-B')
      expect(updatedB.priceHistory[0]?.price).toBe(85)
    })

    it('does not mutate the original offer', () => {
      const offer = makeOffer()
      const originalHistory = offer.priceHistory
      recordObservation(offer, {
        id: 'obs-1',
        price: 90,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date(),
      })
      expect(offer.priceHistory).toBe(originalHistory)
      expect(offer.priceHistory).toHaveLength(0)
    })
  })

  describe('updateOfferFromObservation', () => {
    it('throws if productOfferId does not match', () => {
      const offer = makeOffer({ id: 'offer-1' })
      const observation: PriceObservation = {
        id: 'obs-1',
        productOfferId: 'offer-999',
        price: 90,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date(),
      }
      expect(() => updateOfferFromObservation(offer, observation)).toThrow()
    })

    it('updates offer from matching observation', () => {
      const offer = makeOffer({ id: 'offer-1', currentPrice: 100 })
      const observation: PriceObservation = {
        id: 'obs-1',
        productOfferId: 'offer-1',
        price: 75,
        currency: 'EUR',
        availability: 'in_stock',
        checkedAt: new Date(),
      }
      const result = updateOfferFromObservation(offer, observation)
      expect(result.currentPrice).toBe(75)
    })
  })

  describe('sortHistoryChronologically', () => {
    it('sorts oldest first', () => {
      const history: PriceObservation[] = [
        { id: 'obs-3', productOfferId: 'o1', price: 70, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-03-01') },
        { id: 'obs-1', productOfferId: 'o1', price: 100, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-01-01') },
        { id: 'obs-2', productOfferId: 'o1', price: 90, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-02-01') },
      ]
      const sorted = sortHistoryChronologically(history)
      expect(sorted[0]?.price).toBe(100)
      expect(sorted[1]?.price).toBe(90)
      expect(sorted[2]?.price).toBe(70)
    })

    it('returns a new array (does not mutate)', () => {
      const history: PriceObservation[] = [
        { id: 'obs-2', productOfferId: 'o1', price: 90, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-02-01') },
        { id: 'obs-1', productOfferId: 'o1', price: 100, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-01-01') },
      ]
      const sorted = sortHistoryChronologically(history)
      expect(sorted).not.toBe(history)
    })
  })

  describe('sortHistoryNewestFirst', () => {
    it('sorts newest first', () => {
      const history: PriceObservation[] = [
        { id: 'obs-1', productOfferId: 'o1', price: 100, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-01-01') },
        { id: 'obs-3', productOfferId: 'o1', price: 70, currency: 'EUR', availability: 'in_stock', checkedAt: new Date('2024-03-01') },
      ]
      const sorted = sortHistoryNewestFirst(history)
      expect(sorted[0]?.price).toBe(70)
      expect(sorted[1]?.price).toBe(100)
    })
  })
})
