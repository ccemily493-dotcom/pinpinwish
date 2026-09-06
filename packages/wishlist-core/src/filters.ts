import type { WishlistItem, WishlistFilters } from './types'
import { getBestOffer } from './totals'

/**
 * Apply all wishlist filters to a list of items.
 * All filters are AND-combined.
 */
export function applyFilters(
  items: WishlistItem[],
  filters: WishlistFilters
): WishlistItem[] {
  let result = [...items]

  if (filters.status !== undefined) {
    result = result.filter((item) => item.status === filters.status)
  } else {
    // Default: show only 'wanted' items unless a specific status is requested
    // Note: the UI controls this explicitly, so here we pass all through
  }

  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (item) =>
        item.product.name.toLowerCase().includes(q) ||
        (item.product.brand?.toLowerCase().includes(q) ?? false)
    )
  }

  if (filters.category) {
    result = result.filter(
      (item) => item.product.category === filters.category
    )
  }

  if (filters.priority) {
    result = result.filter((item) => item.priority === filters.priority)
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    result = result.filter((item) => {
      const best = getBestOffer(item.product.offers, filters.currency)
      const price = best?.currentPrice
      if (price === undefined) return false
      if (filters.minPrice !== undefined && price < filters.minPrice) return false
      if (filters.maxPrice !== undefined && price > filters.maxPrice) return false
      return true
    })
  }

  if (filters.onlyUnresolved) {
    result = result.filter((item) => item.product.offers.length === 0)
  }

  if (filters.onlyPossibleDuplicates) {
    result = result.filter((item) => item.possibleDuplicateOf !== undefined)
  }

  return result
}
