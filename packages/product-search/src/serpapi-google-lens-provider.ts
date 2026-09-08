import type { Availability, Currency } from '@pinpinwish/shared'
import type { ProductSearchResult, VisualProductSearchInput, VisualProductSearchProvider } from './types'

export interface SerpApiGoogleLensProviderOptions {
  apiKey?: string
  timeoutMs?: number
  language?: string
  country?: string
  endpoint?: string
}

interface SerpApiLensMatch {
  position?: number
  title?: string
  link?: string
  source?: string
  thumbnail?: string
  image?: string
  exact_matches?: boolean
  in_stock?: boolean
  price?: {
    extracted_value?: number
    currency?: string
  }
}

interface SerpApiLensResponse {
  error?: string
  visual_matches?: SerpApiLensMatch[]
}

const CURRENCY_CODES: Record<string, Currency> = {
  '€': 'EUR',
  EUR: 'EUR',
  '$': 'USD',
  USD: 'USD',
  '£': 'GBP',
  GBP: 'GBP',
  '¥': 'JPY',
  JPY: 'JPY',
  CAD: 'CAD',
  'CA$': 'CAD',
  AUD: 'AUD',
  'A$': 'AUD',
}

/**
 * Stable Google Lens integration backed by SerpApi's structured endpoint.
 * One successful call consumes one SerpApi search, regardless of result count.
 */
export class SerpApiGoogleLensProvider implements VisualProductSearchProvider {
  readonly providerId = 'serpapi-google-lens'
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly language: string
  private readonly country: string
  private readonly endpoint: string

  constructor(options: SerpApiGoogleLensProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim() || process.env.SERPAPI_API_KEY?.trim() || ''
    this.timeoutMs = options.timeoutMs ?? 30000
    this.language = options.language ?? 'es'
    this.country = options.country ?? 'es'
    this.endpoint = options.endpoint ?? 'https://serpapi.com/search.json'
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  async search(input: VisualProductSearchInput): Promise<ProductSearchResult[]> {
    if (input.signal?.aborted || !this.isConfigured || !input.imageUrl?.startsWith('http')) {
      return []
    }

    const requestUrl = new URL(this.endpoint)
    requestUrl.searchParams.set('engine', 'google_lens')
    requestUrl.searchParams.set('type', 'products')
    requestUrl.searchParams.set('url', input.imageUrl)
    requestUrl.searchParams.set('hl', this.language)
    requestUrl.searchParams.set('country', this.country)
    requestUrl.searchParams.set('auto_crop', 'false')
    requestUrl.searchParams.set('api_key', this.apiKey)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const abort = () => controller.abort()
    input.signal?.addEventListener('abort', abort, { once: true })

    try {
      const response = await fetch(requestUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      const payload = (await response.json()) as SerpApiLensResponse

      if (!response.ok || payload.error) {
        throw new Error(payload.error || `SerpApi returned HTTP ${response.status}`)
      }

      return parseSerpApiLensResponse(payload, this.providerId)
    } finally {
      clearTimeout(timeout)
      input.signal?.removeEventListener('abort', abort)
    }
  }
}

export function parseSerpApiLensResponse(
  payload: SerpApiLensResponse,
  providerId = 'serpapi-google-lens'
): ProductSearchResult[] {
  const results: ProductSearchResult[] = []

  for (const match of payload.visual_matches ?? []) {
    const name = match.title?.trim()
    const productUrl = match.link?.trim()
    if (!name || !productUrl || !isShoppingResultUrl(productUrl)) continue

    const position = Math.max(1, match.position ?? results.length + 1)
    const price = match.price?.extracted_value
    const currency = normalizeCurrency(match.price?.currency)
    const availability: Availability | undefined =
      match.in_stock === true ? 'in_stock' : match.in_stock === false ? 'out_of_stock' : undefined

    results.push({
      providerId,
      name,
      productUrl,
      store: match.source?.trim() || hostnameLabel(productUrl),
      imageUrl: match.image || match.thumbnail,
      price: Number.isFinite(price) ? price : undefined,
      currency,
      availability,
      relevanceScore: match.exact_matches
        ? 0.96
        : position <= 3
          ? price !== undefined
            ? 0.88
            : 0.82
          : position <= 8
            ? 0.76
            : 0.62,
      exactMatch: Boolean(match.exact_matches),
      sourcePosition: position,
    })
  }

  return results
}

function normalizeCurrency(value?: string): Currency | undefined {
  if (!value) return undefined
  return CURRENCY_CODES[value.trim().toUpperCase()] || CURRENCY_CODES[value.trim()]
}

function hostnameLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return 'Store'
  }
}

function isShoppingResultUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return ![
      'google.com',
      'pinterest.com',
      'instagram.com',
      'facebook.com',
      'tiktok.com',
      'youtube.com',
      'x.com',
      'twitter.com',
    ].some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
  } catch {
    return false
  }
}
