import type { Availability, Category, Currency, OfferVariantInfo, ProductMatchType } from '@pinpinwish/shared'

export interface PinterestPinInput {
  pinterestPinId: string
  title?: string
  description?: string
  link?: string
  imageUrl?: string
  localImagePath?: string
  boardPosition?: number
}

export type MatchType = ProductMatchType

export interface ParsedProductOffer {
  store: string
  storeUrl: string
  price?: number
  currency?: Currency
  availability?: Availability
  variant?: OfferVariantInfo
}

export interface ParsedProductMetadata {
  name?: string
  brand?: string
  category?: Category
  description?: string
  imageUrl?: string
  images?: string[]
  sku?: string
  offers: ParsedProductOffer[]
  sourceType: 'json-ld' | 'opengraph' | 'microdata' | 'visual' | 'none'
  rawQualityScore: number
}

export interface ProductMatch {
  name: string
  brand?: string
  category?: Category
  imageUrl?: string
  localImagePath?: string
  images?: string[]
  productUrl?: string
  store?: string
  price?: number
  currency?: Currency
  availability?: Availability
  sku?: string
  variant?: OfferVariantInfo
  offers?: ParsedProductOffer[]
  confidence: number
  matchType: MatchType
  evidence?: {
    strategyUsed: string
    nameSimilarity?: number
    brandMatch?: boolean
    domainMatch?: boolean
    jsonLdFound?: boolean
    visualMatchFound?: boolean
    skuMatched?: boolean
    details?: string
  }
}

export interface ProductResolverOptions {
  visualSearchProvider?: import('@pinpinwish/product-search').VisualProductSearchProvider
  fetchTimeoutMs?: number
}

export interface ProductResolver {
  /**
   * Attempt to resolve a Pinterest pin into a product match.
   */
  resolve(pin: PinterestPinInput, signal?: AbortSignal): Promise<ProductMatch>
  /** Resolve every distinct product that can be supported by evidence in one Pin. */
  resolveAll?(pin: PinterestPinInput, signal?: AbortSignal): Promise<ProductMatch[]>
}
