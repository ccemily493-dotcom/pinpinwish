import type { WishlistItem } from '@pinpinwish/wishlist-core'
import type { PinGroupView } from '@/hooks/useWishlistData'

export interface OriginLinkInfo {
  url: string
  storeName: string
  actionLabel: string
  isDirectStore: boolean
  isSearchFallback: boolean
  isPinterest: boolean
}

/**
 * Normalizes and sanitizes a URL string.
 * Ensures https:// protocol and prevents javascript/data schemes.
 */
export function sanitizeWebUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  // Reject unsafe schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null
  }

  // Prepend https:// if no protocol is given (e.g. "zara.com/es/es/...")
  let url = trimmed
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

/**
 * Extracts a human-friendly store brand name from a URL or provided store name.
 */
export function extractStoreName(url: string, rawStore?: string | null): string {
  if (rawStore && rawStore.trim().length > 0) {
    const trimmed = rawStore.trim()
    // Capitalize first letter if lowercase
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^shop\./, '').replace(/^m\./, '')

    if (host.includes('pinterest.')) return 'Pinterest'
    if (host.includes('zara.')) return 'Zara'
    if (host.includes('mango.')) return 'Mango'
    if (host.includes('amazon.')) return 'Amazon'
    if (host.includes('hm.') || host.includes('h&m')) return 'H&M'
    if (host.includes('bershka.')) return 'Bershka'
    if (host.includes('stradivarius.')) return 'Stradivarius'
    if (host.includes('pullandbear.') || host.includes('pullbear.')) return 'Pull&Bear'
    if (host.includes('massimodutti.')) return 'Massimo Dutti'
    if (host.includes('shein.')) return 'Shein'
    if (host.includes('asos.')) return 'ASOS'
    if (host.includes('elcorteingles.')) return 'El Corte Inglés'
    if (host.includes('nike.')) return 'Nike'
    if (host.includes('adidas.')) return 'Adidas'
    if (host.includes('zalando.')) return 'Zalando'
    if (host.includes('etsy.')) return 'Etsy'
    if (host.includes('aliexpress.')) return 'AliExpress'

    // Generic fallback: first part of domain capitalized
    const domainPart = host.split('.')[0]
    if (domainPart && domainPart.length > 1) {
      return domainPart.charAt(0).toUpperCase() + domainPart.slice(1)
    }
  } catch {
    // Ignore URL parse error
  }

  return 'Tienda'
}

/**
 * Resolves the best direct store/origin link for a WishlistItem in 1 click.
 * Order of priority:
 * 1. Best offer storeUrl / url
 * 2. Any offer storeUrl / url
 * 3. Item pinUrl
 * 4. Parent pin pinUrl
 * 5. Smart Google Search / Shopping query
 */
export function resolveOriginLink(
  item: WishlistItem,
  pin?: PinGroupView | null
): OriginLinkInfo {
  const offers = item.product?.offers || []
  const firstOffer = offers[0]

  // 1. Direct offer store URLs
  const candidateUrls: Array<{ url: string | null; store?: string }> = [
    { url: sanitizeWebUrl(firstOffer?.storeUrl), store: firstOffer?.store },
    ...offers.slice(1).map((o) => ({ url: sanitizeWebUrl(o.storeUrl), store: o.store })),
    { url: sanitizeWebUrl(item.pinUrl), store: 'Pinterest' },
    { url: sanitizeWebUrl(pin?.pinUrl), store: 'Pinterest' },
  ]

  for (const candidate of candidateUrls) {
    if (candidate.url) {
      const isPinterest = candidate.url.includes('pinterest.') || candidate.url.includes('pinimg.')
      const storeName = extractStoreName(candidate.url, candidate.store)
      const actionLabel = isPinterest ? 'Ver en Pinterest' : `Comprar en ${storeName}`

      return {
        url: candidate.url,
        storeName,
        actionLabel,
        isDirectStore: !isPinterest,
        isSearchFallback: false,
        isPinterest,
      }
    }
  }

  // 2. Fallback: Google Search link for the product & brand
  const productName = (item.product?.name || '').trim()
  const brand = (item.product?.brand || '').trim()
  const searchQuery = [brand, productName].filter(Boolean).join(' ') || 'ropa moda'
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`

  return {
    url: searchUrl,
    storeName: brand || 'Google',
    actionLabel: brand ? `Buscar en ${brand}` : 'Buscar en Google',
    isDirectStore: false,
    isSearchFallback: true,
    isPinterest: false,
  }
}
