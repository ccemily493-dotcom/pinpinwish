import type {
  Priority,
  WishlistItemStatus,
  Category,
  SourceType,
  Currency,
  ProductImage,
  ResolutionStatus,
  ProductMatchType,
  SourceSyncInput,
} from '@pinpinwish/shared'
import type { ProductOffer } from '@pinpinwish/price-tracker'

export type { SourceSyncInput, SourceSyncProgress } from '@pinpinwish/shared'

// ─── Source Adapter Contract ─────────────────────────────────────────────────

/**
 * Result of a source sync operation.
 */
export interface SourceSyncResult<TItem = unknown> {
  sourceType: string
  sourceId?: string
  newItems: TItem[]
  removedItemIds: string[]
  modifiedItems: TItem[]
  nextCursor?: string
  syncedAt: Date
}

/**
 * WishlistSourceAdapter — the core abstraction that keeps the wishlist
 * decoupled from any specific source (Pinterest, Instagram, etc.).
 */
export interface WishlistSourceAdapter {
  readonly sourceType: string
  sync(input?: SourceSyncInput | string): Promise<SourceSyncResult>
}

// ─── Persistent Records (Database / Storage Entities) ────────────────────────

export interface ProductRecord {
  id: string
  slug: string
  name: string
  brand?: string
  category: Category
  imageUrl?: string
  localImagePath?: string
  description?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface WishlistRecord {
  id: string
  userId: string
  name: string
  currency: Currency
  createdAt: Date
  updatedAt: Date
}

export interface WishlistItemRecord {
  id: string
  wishlistId: string
  /** Foreign key to resolved product (optional if unresolved) */
  productId?: string
  /** Optional Pinterest pin reference */
  pinterestPinId?: string
  /** Foreign key to generic wishlist_sources entry */
  sourceId?: string
  /** The type of source this item came from */
  sourceType?: SourceType
  /** The source's own identifier for this item */
  sourceItemId?: string
  /** Original source URL when it is safe to expose to the UI. */
  pinUrl?: string
  resolutionStatus?: ResolutionStatus
  matchType?: ProductMatchType
  confidence?: number
  manualOverride?: boolean
  priority: Priority
  status: WishlistItemStatus
  desiredSize?: string
  desiredColor?: string
  notes?: string
  /** Conservative duplicate detection flag */
  possibleDuplicateOf?: string
  createdAt: Date
  updatedAt: Date
}

// ─── Hydrated Entities / View Models (UI & Domain Logic) ─────────────────────

export interface Product {
  id: string
  slug: string
  name: string
  brand?: string
  category: Category
  imageUrl?: string
  localImagePath?: string
  images?: ProductImage[]
  description?: string
  offers: ProductOffer[]
}

/**
 * Hydrated Wishlist Item view model combining item preferences and resolved product.
 */
export interface WishlistItemView {
  id: string
  wishlistId: string
  product: Product
  productId?: string
  pinterestPinId?: string
  sourceId?: string
  sourceType?: SourceType
  sourceItemId?: string
  pinUrl?: string
  resolutionStatus?: ResolutionStatus
  matchType?: ProductMatchType
  confidence?: number
  manualOverride?: boolean
  priority: Priority
  status: WishlistItemStatus
  desiredSize?: string
  desiredColor?: string
  notes?: string
  possibleDuplicateOf?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Type alias for backward compatibility across UI components.
 */
export type WishlistItem = WishlistItemView
export type WishlistItemWithProduct = WishlistItemView

export interface WishlistView {
  id: string
  userId: string
  name: string
  items: WishlistItemView[]
  currency: Currency
  createdAt: Date
  updatedAt: Date
}

export type Wishlist = WishlistView

// ─── Filter & Sort Types ─────────────────────────────────────────────────────

export interface WishlistFilters {
  search?: string
  category?: Category
  priority?: Priority
  status?: WishlistItemStatus
  minPrice?: number
  maxPrice?: number
  /** Currency used for price comparison. No implicit FX conversion is performed. */
  currency: Currency
  onlyUnresolved?: boolean
  onlyPossibleDuplicates?: boolean
}

export type SortField = 'price' | 'date' | 'priority'
export type SortDirection = 'asc' | 'desc'

export interface WishlistSort {
  field: SortField
  direction: SortDirection
}
