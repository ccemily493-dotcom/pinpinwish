import type { WishlistItem, WishlistSort } from './types'
import { getBestOffer } from './totals'
import { PRIORITY_ORDER } from '@pinpinwish/shared'
import type { Currency } from '@pinpinwish/shared'

/**
 * Sort wishlist items by the given sort configuration.
 * Returns a new array — does not mutate input.
 */
export function sortItems(
  items: WishlistItem[],
  sort: WishlistSort,
  currency: Currency
): WishlistItem[] {
  const sorted = [...items]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case 'price': {
        const priceA = getBestOffer(a.product.offers, currency)?.currentPrice
        const priceB = getBestOffer(b.product.offers, currency)?.currentPrice
        // Items without a comparable offer in the requested currency stay last
        // in both ascending and descending order.
        if (priceA === undefined && priceB === undefined) return 0
        if (priceA === undefined) return 1
        if (priceB === undefined) return -1
        comparison = priceA - priceB
        break
      }
      case 'date': {
        comparison = a.createdAt.getTime() - b.createdAt.getTime()
        break
      }
      case 'priority': {
        const orderA = PRIORITY_ORDER[a.priority]
        const orderB = PRIORITY_ORDER[b.priority]
        comparison = orderA - orderB
        break
      }
    }

    return sort.direction === 'asc' ? comparison : -comparison
  })

  return sorted
}
