import type { WishlistItem } from './types'
import type { ProductOffer } from '@pinpinwish/price-tracker'

/**
 * Get the best (lowest price) available offer for a product.
 * Hierarchy:
 * 1. in_stock (lowest price)
 * 2. unknown (lowest price if no in_stock exists)
 * 3. out_of_stock (lowest price fallback only if all are out_of_stock)
 */
export function getBestOffer(
  offers: ProductOffer[]
): ProductOffer | undefined {
  if (offers.length === 0) return undefined

  const inStock = offers.filter((o) => o.availability === 'in_stock')
  if (inStock.length > 0) {
    return inStock.reduce((best, cur) => cur.currentPrice < best.currentPrice ? cur : best)
  }

  const unknownStock = offers.filter((o) => o.availability === 'unknown')
  if (unknownStock.length > 0) {
    return unknownStock.reduce((best, cur) => cur.currentPrice < best.currentPrice ? cur : best)
  }

  return offers.reduce((best, cur) => cur.currentPrice < best.currentPrice ? cur : best)
}

/**
 * Calculate the total value of wanted items in a wishlist.
 * Uses the best available offer price for each item.
 * Items with status 'purchased' or 'removed' are excluded.
 */
export function calculateTotal(
  items: WishlistItem[]
): number {
  return items
    .filter((item) => item.status === 'wanted')
    .reduce((sum, item) => {
      const best = getBestOffer(item.product.offers)
      return sum + (best?.currentPrice ?? 0)
    }, 0)
}
