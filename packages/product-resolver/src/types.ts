/**
 * product-resolver types
 * These types define the contract for product resolution.
 * Phase 3 will add real resolution algorithms.
 */

export interface PinterestPinInput {
  pinterestPinId: string
  title?: string
  description?: string
  link?: string
  imageUrl?: string
}

export type MatchType = 'exact' | 'probable' | 'similar' | 'unresolved'

export interface ProductMatch {
  name: string
  brand?: string
  imageUrl?: string
  productUrl?: string
  store?: string
  price?: number
  currency?: string
  availability?: string
  confidence: number
  matchType: MatchType
}

export interface ProductResolver {
  /**
   * Attempt to resolve a Pinterest pin into a product match.
   * Phase 1: Always returns unresolved with confidence 0.
   * Phase 3: Will use real resolution strategies.
   */
  resolve(pin: PinterestPinInput): Promise<ProductMatch>
}
