import type { WishlistItemRecord, WishlistItemView, Product } from './types'

/**
 * Hydrates a persistent WishlistItemRecord with its resolved Product into a WishlistItemView.
 */
export function hydrateWishlistItem(
  record: WishlistItemRecord,
  product: Product
): WishlistItemView {
  return {
    id: record.id,
    wishlistId: record.wishlistId,
    productId: record.productId ?? product.id,
    product,
    pinterestPinId: record.pinterestPinId,
    sourceId: record.sourceId,
    sourceType: record.sourceType,
    sourceItemId: record.sourceItemId,
    priority: record.priority,
    status: record.status,
    desiredSize: record.desiredSize,
    desiredColor: record.desiredColor,
    notes: record.notes,
    possibleDuplicateOf: record.possibleDuplicateOf,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

/**
 * Dehydrates a WishlistItemView into a persistent WishlistItemRecord.
 */
export function dehydrateWishlistItem(
  view: WishlistItemView
): WishlistItemRecord {
  return {
    id: view.id,
    wishlistId: view.wishlistId,
    productId: view.productId ?? view.product.id,
    pinterestPinId: view.pinterestPinId,
    sourceId: view.sourceId,
    sourceType: view.sourceType,
    sourceItemId: view.sourceItemId,
    priority: view.priority,
    status: view.status,
    desiredSize: view.desiredSize,
    desiredColor: view.desiredColor,
    notes: view.notes,
    possibleDuplicateOf: view.possibleDuplicateOf,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  }
}

/**
 * Computes an idempotency key based on (wishlistId, sourceId, sourceItemId).
 * Used to ensure external imports are idempotent and avoid duplicate records.
 */
export function computeSourceIdempotencyKey(
  wishlistId: string,
  sourceId?: string,
  sourceItemId?: string
): string | undefined {
  if (!sourceId || !sourceItemId) return undefined
  return `${wishlistId}:${sourceId}:${sourceItemId}`
}
