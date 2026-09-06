import type { PriceObservation, ProductOffer } from './types'

/**
 * Record a new price observation.
 * Pure function — does not make network requests.
 */
export function recordObservation(
  offer: ProductOffer,
  observation: Omit<PriceObservation, 'id' | 'productOfferId'> & { id: string }
): ProductOffer {
  const fullObservation: PriceObservation = {
    ...observation,
    productOfferId: offer.id,
  }
  return {
    ...offer,
    currentPrice: observation.price,
    currency: observation.currency,
    availability: observation.availability,
    lastCheckedAt: observation.checkedAt,
    priceHistory: [...offer.priceHistory, fullObservation],
  }
}

/**
 * Update a ProductOffer's current state from a PriceObservation.
 * Pure function — does not make network requests.
 */
export function updateOfferFromObservation(
  offer: ProductOffer,
  observation: PriceObservation
): ProductOffer {
  if (observation.productOfferId !== offer.id) {
    throw new Error(
      `Observation productOfferId ${observation.productOfferId} does not match offer id ${offer.id}`
    )
  }
  return {
    ...offer,
    currentPrice: observation.price,
    currency: observation.currency,
    availability: observation.availability,
    lastCheckedAt: observation.checkedAt,
    priceHistory: [...offer.priceHistory, observation],
  }
}

/**
 * Sort price history chronologically (oldest first).
 * Pure function.
 */
export function sortHistoryChronologically(
  history: PriceObservation[]
): PriceObservation[] {
  return [...history].sort(
    (a, b) => a.checkedAt.getTime() - b.checkedAt.getTime()
  )
}

/**
 * Sort price history reverse-chronologically (newest first).
 * Pure function.
 */
export function sortHistoryNewestFirst(
  history: PriceObservation[]
): PriceObservation[] {
  return [...history].sort(
    (a, b) => b.checkedAt.getTime() - a.checkedAt.getTime()
  )
}
