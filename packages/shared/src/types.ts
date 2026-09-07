/**
 * @pinpinwish/shared - Shared types and utilities
 * No dependencies on other @pinpinwish packages.
 */

export type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CAD' | 'AUD'

export type Priority = 'low' | 'medium' | 'high' | 'dream'

export type WishlistItemStatus = 'wanted' | 'purchased' | 'removed'

export type Category =
  | 'clothes'
  | 'shoes'
  | 'beauty'
  | 'home'
  | 'other'

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown'

export type SourceType =
  | 'pinterest'
  | 'instagram'
  | 'tiktok'
  | 'manual_url'
  | 'image'
  | 'browser_extension'

export type ResolutionStatus = 'pending' | 'resolved' | 'needs_review'

export type ProductMatchType = 'exact' | 'probable' | 'similar' | 'unresolved'

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type ImportJobItemStatus = 'pending' | 'downloaded' | 'analyzing' | 'identified' | 'unresolved' | 'failed'

export interface PriceAmount {
  value: number
  currency: Currency
}

export interface TimestampedRecord {
  createdAt: Date
  updatedAt: Date
}

/**
 * Extensible variant information for product offers (e.g. size, color, attributes).
 */
export interface OfferVariantInfo {
  size?: string
  color?: string
  sku?: string
  attributes?: Record<string, string>
}

/**
 * Product image metadata.
 */
export interface ProductImage {
  id: string
  productId: string
  imageUrl: string
  localImagePath?: string
  altText?: string
  displayOrder: number
  isPrimary: boolean
  createdAt?: Date
}

/**
 * Progress event emitted during source sync operations.
 */
export interface SourceSyncProgress {
  step: 'scraping' | 'downloading' | 'analyzing' | 'saving' | 'complete'
  message?: string
  totalPins?: number
  processedPins?: number
  downloadedImages?: number
  identifiedCount?: number
  needsReviewCount?: number
  errorCount?: number
}

/**
 * Source sync input options.
 */
export interface SourceSyncInput {
  boardUrl?: string
  cursor?: string
  maxPins?: number
  signal?: AbortSignal
  onProgress?: (progress: SourceSyncProgress) => void
}

/**
 * Real-time import job status representation.
 */
export interface ImportJobStats {
  id: string
  userId: string
  wishlistId: string
  sourceId: string
  boardId?: string
  boardUrl?: string
  status: ImportJobStatus
  totalCount: number | null
  processedCount: number
  downloadedCount: number
  analyzingCount: number
  identifiedCount: number
  needsReviewCount: number
  errorCount: number
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
  completedAt?: Date | null
}
