import type { WishlistItem, WishlistSort } from './types'
import { getBestOffer } from './totals'
import { PRIORITY_ORDER } from '@pinpinwish/shared'

/**
 * Sort wishlist items by the given sort configuration.
 * Returns a new array — does not mutate input.
 */
export function sortItems(
  items: WishlistItem[],
  sort: WishlistSort
): WishlistItem[] {
  const sorted = [...items]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case 'price': {
        const priceA = getBestOffer(a.product.offers)?.currentPrice ?? Infinity
        const priceB = getBestOffer(b.product.offers)?.currentPrice ?? Infinity
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
