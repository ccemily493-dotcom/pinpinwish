import type { Currency, Category, Availability } from '@pinpinwish/shared'

/**
 * ProductSearchProvider — decoupled search interface.
 *
 * Phase 1: No providers are connected.
 * Phase 3+: Concrete implementations (e.g. Google Shopping, Algolia)
 * will implement this interface.
 */
export interface ProductSearchQuery {
  query: string
  category?: Category
  minPrice?: number
  maxPrice?: number
  currency?: Currency
  limit?: number
}

export interface ProductSearchResult {
  providerId: string
  name: string
  brand?: string
  imageUrl?: string
  productUrl: string
  store: string
  price: number
  currency: Currency
  availability: Availability
  relevanceScore: number
}

export interface ProductSearchProvider {
  readonly providerId: string
  search(query: ProductSearchQuery): Promise<ProductSearchResult[]>
}
