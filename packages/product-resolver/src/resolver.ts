import type { PinterestPinInput, ProductMatch, ProductResolver, ProductResolverOptions } from './types'
import { fetchExternalHtml } from './link-fetcher'
import { parseHtmlMetadata } from './html-parser'
import { calculateConfidence } from './confidence-scorer'

/**
 * NullProductResolver — Conservative fallback implementation.
 * Always returns 'unresolved' with confidence 0.
 */
export class NullProductResolver implements ProductResolver {
  async resolve(pin: PinterestPinInput): Promise<ProductMatch> {
    return {
      name: pin.title || 'Unresolved product',
      brand: undefined,
      imageUrl: pin.imageUrl,
      localImagePath: pin.localImagePath,
      productUrl: undefined,
      store: undefined,
      price: undefined,
      currency: undefined,
      availability: undefined,
      confidence: 0,
      matchType: 'unresolved',
      evidence: {
        strategyUsed: 'null-resolver',
        details: 'Null resolver intentionally returns unresolved',
      },
    }
  }
}

/**
 * StandardProductResolver — Automatic multi-stage resolver.
 *
 * Pipeline:
 * 1. If Pin has external link: safe fetch -> parse JSON-LD/OG/microdata -> calculate confidence.
 * 2. If link is insufficient or missing: execute Visual Product Search (e.g. Google Lens).
 * 3. Confidence scoring with thresholds:
 *    - exact >= 0.90
 *    - probable >= 0.72
 *    - similar >= 0.50
 *    - unresolved < 0.50
 * 4. Never invent products. If no evidence: matchType: "unresolved", confidence: 0.
 */
export class StandardProductResolver implements ProductResolver {
  private readonly visualSearchProvider?: import('@pinpinwish/product-search').VisualProductSearchProvider
  private readonly fetchTimeoutMs: number

  constructor(options: ProductResolverOptions = {}) {
    this.visualSearchProvider = options.visualSearchProvider
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 8000
  }

  async resolve(pin: PinterestPinInput, signal?: AbortSignal): Promise<ProductMatch> {
    if (signal?.aborted) {
      return this.unresolvedResult(pin, 'Operation aborted')
    }

    // ── Stage 1: External Link Resolution ──
    if (pin.link && isLikelyProductLink(pin.link)) {
      try {
        const fetchResult = await fetchExternalHtml(pin.link, {
          timeoutMs: this.fetchTimeoutMs,
          signal,
        })

        if (fetchResult && fetchResult.html) {
          const metadata = parseHtmlMetadata(fetchResult.html, fetchResult.finalUrl)
          const scoring = calculateConfidence(pin, metadata)

          if (scoring.matchType !== 'unresolved' && metadata.name) {
            const primaryOffer = metadata.offers[0]
            return {
              name: metadata.name,
              brand: metadata.brand,
              category: metadata.category,
              imageUrl: metadata.imageUrl || pin.imageUrl,
              localImagePath: pin.localImagePath,
              images: metadata.images,
              productUrl: primaryOffer?.storeUrl || fetchResult.finalUrl,
              store: primaryOffer?.store,
              price: primaryOffer?.price,
              currency: primaryOffer?.currency,
              availability: primaryOffer?.availability,
              sku: metadata.sku || primaryOffer?.variant?.sku,
              variant: primaryOffer?.variant,
              confidence: scoring.confidence,
              matchType: scoring.matchType,
              evidence: scoring.evidence,
            }
          }
        }
      } catch (err) {
        console.warn(`[resolver] Link resolution failed for pin ${pin.pinterestPinId}:`, err)
      }
    }

    // ── Stage 2: Visual Search Resolution ──
    if (this.visualSearchProvider && (pin.localImagePath || pin.imageUrl)) {
      try {
        const visualResults = await this.visualSearchProvider.search({
          localImagePath: pin.localImagePath,
          imageUrl: pin.imageUrl,
          title: pin.title,
          description: pin.description,
          signal,
        })

        if (visualResults && visualResults.length > 0) {
          const best = visualResults[0]
          if (best) {
            const scoring = calculateConfidence(
              pin,
              {
                name: best.name,
                brand: best.brand,
                offers: [
                  {
                    store: best.store,
                    storeUrl: best.productUrl,
                    price: best.price,
                    currency: best.currency,
                    availability: best.availability,
                  },
                ],
                sourceType: 'visual',
                rawQualityScore: best.relevanceScore,
              },
              { isVisualMatch: true, visualRelevance: best.relevanceScore }
            )

            if (scoring.matchType !== 'unresolved') {
              return {
                name: best.name,
                brand: best.brand,
                imageUrl: best.imageUrl || pin.imageUrl,
                localImagePath: pin.localImagePath,
                productUrl: best.productUrl,
                store: best.store,
                price: best.price,
                currency: best.currency,
                availability: best.availability,
                confidence: scoring.confidence,
                matchType: scoring.matchType,
                evidence: scoring.evidence,
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[resolver] Visual search failed for pin ${pin.pinterestPinId}:`, err)
      }
    }

    // ── Stage 3: Unresolved Safe Fallback ──
    return this.unresolvedResult(pin, 'Insufficient evidence to resolve product automatically')
  }

  private unresolvedResult(pin: PinterestPinInput, reason: string): ProductMatch {
    return {
      name: pin.title || 'Pin pendiente de identificar',
      brand: undefined,
      imageUrl: pin.imageUrl,
      localImagePath: pin.localImagePath,
      productUrl: pin.link,
      store: undefined,
      price: undefined,
      currency: undefined,
      availability: undefined,
      confidence: 0,
      matchType: 'unresolved',
      evidence: {
        strategyUsed: 'unresolved',
        details: reason,
      },
    }
  }
}

function isLikelyProductLink(link: string): boolean {
  try {
    const parsed = new URL(link)
    const host = parsed.hostname.toLowerCase()
    // Exclude social network links that are not stores
    if (
      host.includes('pinterest.com') ||
      host.includes('pin.it') ||
      host.includes('instagram.com') ||
      host.includes('facebook.com') ||
      host.includes('twitter.com') ||
      host.includes('x.com') ||
      host.includes('youtube.com') ||
      host.includes('tiktok.com')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}
