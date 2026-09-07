import type { Currency, Category, Availability } from '@pinpinwish/shared'

/**
 * Text-based product search query.
 */
export interface ProductSearchQuery {
  query: string
  category?: Category
  minPrice?: number
  maxPrice?: number
  currency?: Currency
  limit?: number
}

/**
 * Result returned by a search provider.
 */
export interface ProductSearchResult {
  providerId: string
  name: string
  brand?: string
  imageUrl?: string
  productUrl: string
  store: string
  price?: number
  currency?: Currency
  availability?: Availability
  relevanceScore: number
}

export interface ProductSearchProvider {
  readonly providerId: string
  search(query: ProductSearchQuery): Promise<ProductSearchResult[]>
}

/**
 * Input for visual product search.
 */
export interface VisualProductSearchInput {
  localImagePath?: string
  imageUrl?: string
  title?: string
  description?: string
  signal?: AbortSignal
}

/**
 * VisualProductSearchProvider — decoupled interface for image-based product discovery.
 */
export interface VisualProductSearchProvider {
  readonly providerId: string
  search(input: VisualProductSearchInput): Promise<ProductSearchResult[]>
}
