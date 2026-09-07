import type { WishlistItemRecord, WishlistItemView, Product } from './types'

/**
 * Hydrates a persistent WishlistItemRecord with its resolved Product into a WishlistItemView.
 */
export function hydrateWishlistItem(
  record: WishlistItemRecord,
  product: Product
): WishlistItemView {
  if (record.productId && record.productId !== product.id) {
    throw new Error(
      `Cannot hydrate wishlist item ${record.id}: productId ${record.productId} does not match product ${product.id}`
    )
  }

  return {
    id: record.id,
    wishlistId: record.wishlistId,
    productId: record.productId ?? product.id,
    product,
    pinterestPinId: record.pinterestPinId,
    sourceId: record.sourceId,
    sourceType: record.sourceType,
    sourceItemId: record.sourceItemId,
    pinUrl: record.pinUrl,
    resolutionStatus: record.resolutionStatus,
    confidence: record.confidence,
    manualOverride: record.manualOverride,
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
    pinUrl: view.pinUrl,
    resolutionStatus: view.resolutionStatus,
    confidence: view.confidence,
    manualOverride: view.manualOverride,
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
