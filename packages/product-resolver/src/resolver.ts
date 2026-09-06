import type { PinterestPinInput, ProductMatch, ProductResolver } from './types'

/**
 * NullProductResolver — Phase 1 conservative implementation.
 *
 * This resolver intentionally returns 'unresolved' for every input.
 * It NEVER invents product names, brands, URLs, stores, or prices.
 *
 * Phase 3 will introduce real resolution strategies using external
 * search providers. Until then, this null implementation ensures
 * the system fails safely rather than presenting invented data.
 */
export class NullProductResolver implements ProductResolver {
  async resolve(pin: PinterestPinInput): Promise<ProductMatch> {
    // Intentionally uses pin parameter to avoid unused variable error.
    // In Phase 3 this will be passed to resolution strategies.
    void pin

    return {
      name: 'Unresolved product',
      brand: undefined,
      imageUrl: undefined,
      productUrl: undefined,
      store: undefined,
      price: undefined,
      currency: undefined,
      availability: undefined,
      confidence: 0,
      matchType: 'unresolved',
    }
  }
}
