import type { Currency } from '@pinpinwish/shared'
import type { WishlistItem } from './types'
import type { ProductOffer } from '@pinpinwish/price-tracker'

/**
 * Get the best (lowest price) available offer for a product in one currency.
 * Offers in other currencies are deliberately ignored: this module never
 * performs implicit foreign-exchange conversion.
 * Hierarchy:
 * 1. in_stock (lowest price)
 * 2. unknown (lowest price if no in_stock exists)
 * 3. out_of_stock (lowest price fallback only if all are out_of_stock)
 */
export function getBestOffer(
  offers: ProductOffer[],
  currency: Currency
): ProductOffer | undefined {
  const sameCurrencyOffers = offers.filter((offer) => offer.currency === currency)
  if (sameCurrencyOffers.length === 0) return undefined

  const inStock = sameCurrencyOffers.filter((o) => o.availability === 'in_stock')
  if (inStock.length > 0) {
    return inStock.reduce((best, cur) => cur.currentPrice < best.currentPrice ? cur : best)
  }

  const unknownStock = sameCurrencyOffers.filter((o) => o.availability === 'unknown')
  if (unknownStock.length > 0) {
    return unknownStock.reduce((best, cur) => cur.currentPrice < best.currentPrice ? cur : best)
  }

  return sameCurrencyOffers.reduce((best, cur) => cur.currentPrice < best.currentPrice ? cur : best)
}

/**
 * Calculate the total value of wanted items in a wishlist.
 * Uses the best available offer in the requested currency for each item.
 * Offers in other currencies are excluded rather than converted implicitly.
 * Items with status 'purchased' or 'removed' are excluded.
 */
export function calculateTotal(
  items: WishlistItem[],
  currency: Currency
): number {
  return items
    .filter((item) => item.status === 'wanted')
    .reduce((sum, item) => {
      const best = getBestOffer(item.product.offers, currency)
      return sum + (best?.currentPrice ?? 0)
    }, 0)
}
