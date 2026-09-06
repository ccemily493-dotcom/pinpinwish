import type { WishlistItem } from './types'

/**
 * Transition a wishlist item to a new status.
 * Returns a new item — does not mutate input.
 */
export function transitionStatus(
  item: WishlistItem,
  newStatus: WishlistItem['status']
): WishlistItem {
  return {
    ...item,
    status: newStatus,
    updatedAt: new Date(),
  }
}

/**
 * Mark an item as purchased.
 */
export function markAsPurchased(item: WishlistItem): WishlistItem {
  return transitionStatus(item, 'purchased')
}

/**
 * Remove an item (soft delete — status = 'removed').
 */
export function removeItem(item: WishlistItem): WishlistItem {
  return transitionStatus(item, 'removed')
}

/**
 * Restore a removed or purchased item back to wanted.
 */
export function restoreItem(item: WishlistItem): WishlistItem {
  return transitionStatus(item, 'wanted')
}
