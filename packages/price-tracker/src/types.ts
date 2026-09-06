import type { Availability, Currency, OfferVariantInfo } from '@pinpinwish/shared'

export interface PriceObservation {
  id: string
  productOfferId: string
  price: number
  currency: Currency
  availability: Availability
  checkedAt: Date
}

/**
 * Persistent record of a ProductOffer in the database.
 */
export interface ProductOfferRecord {
  id: string
  productId: string
  store: string
  storeUrl: string
  currentPrice: number
  currency: Currency
  availability: Availability
  variant?: OfferVariantInfo
  lastCheckedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Hydrated ProductOffer entity with full price history.
 */
export interface ProductOffer {
  id: string
  productId: string
  store: string
  storeUrl: string
  currentPrice: number
  currency: Currency
  availability: Availability
  variant?: OfferVariantInfo
  lastCheckedAt?: Date
  priceHistory: PriceObservation[]
}
