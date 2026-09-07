import * as cheerio from 'cheerio'
import type { Availability, Category, Currency } from '@pinpinwish/shared'
import type { ParsedProductMetadata, ParsedProductOffer } from './types'

export function parseHtmlMetadata(html: string, pageUrl: string): ParsedProductMetadata {
  const $ = cheerio.load(html)
  const domain = extractDomain(pageUrl)

  // 1. Try JSON-LD Product Extraction
  const jsonLdResult = extractJsonLd($, pageUrl, domain)
  if (jsonLdResult && jsonLdResult.name) {
    return jsonLdResult
  }

  // 2. Try Open Graph & Meta Tags Extraction
  const ogResult = extractOpenGraph($, pageUrl, domain)
  if (ogResult && ogResult.name) {
    return ogResult
  }

  // 3. Try Microdata Schema.org
  const microdataResult = extractMicrodata($, pageUrl, domain)
  if (microdataResult && microdataResult.name) {
    return microdataResult
  }

  return {
    name: undefined,
    brand: undefined,
    category: 'other',
    description: undefined,
    imageUrl: undefined,
    images: [],
    sku: undefined,
    offers: [],
    sourceType: 'none',
    rawQualityScore: 0,
  }
}

function extractJsonLd($: cheerio.CheerioAPI, pageUrl: string, domain: string): ParsedProductMetadata | null {
  const scripts = $('script[type="application/ld+json"]').toArray()

  for (const script of scripts) {
    try {
      const content = $(script).html()?.trim()
      if (!content) continue

      const json = JSON.parse(content)
      const products = findProductEntities(json)

      for (const p of products) {
        const name = cleanString(p.name)
        if (!name) continue

        const brand = cleanString(typeof p.brand === 'string' ? p.brand : p.brand?.name)
        const description = cleanString(p.description)
        const sku = cleanString(p.sku || p.productID || p.gtin || p.gtin13)

        // Images
        const images: string[] = []
        if (typeof p.image === 'string') images.push(p.image)
        else if (Array.isArray(p.image)) {
          for (const img of p.image) {
            if (typeof img === 'string') images.push(img)
            else if (img?.url) images.push(img.url)
          }
        } else if (p.image?.url) {
          images.push(p.image.url)
        }

        // Offers
        const offers: ParsedProductOffer[] = []
        const rawOffers = Array.isArray(p.offers) ? p.offers : p.offers ? [p.offers] : []

        for (const raw of rawOffers) {
          const price = parsePrice(raw.price || raw.lowPrice || raw.highPrice)
          const currency = parseCurrency(raw.priceCurrency)
          const availability = parseAvailability(raw.availability)
          const storeUrl = raw.url ? resolveUrl(pageUrl, raw.url) : pageUrl
          const store = raw.seller?.name ? cleanString(raw.seller.name) || domain : domain

          offers.push({
            store,
            storeUrl,
            price,
            currency,
            availability,
            variant: {
              sku: cleanString(raw.sku) || sku,
              size: cleanString(raw.size || p.size),
              color: cleanString(raw.color || p.color),
            },
          })
        }

        if (offers.length === 0 && (name || brand)) {
          offers.push({
            store: domain,
            storeUrl: pageUrl,
            availability: 'unknown',
          })
        }

        return {
          name,
          brand,
          category: inferCategory(name, description, p.category),
          description,
          imageUrl: images[0],
          images,
          sku,
          offers,
          sourceType: 'json-ld',
          rawQualityScore: offers.length > 0 && offers[0]?.price !== undefined ? 0.95 : 0.8,
        }
      }
    } catch {
      // ignore JSON parse error in malformed ld+json
    }
  }

  return null
}

function findProductEntities(obj: unknown): any[] {
  if (!obj || typeof obj !== 'object') return []
  const list: any[] = []

  if (Array.isArray(obj)) {
    for (const item of obj) list.push(...findProductEntities(item))
    return list
  }

  const record = obj as Record<string, any>
  const type = record['@type']

  if (
    type === 'Product' ||
    type === 'IndividualProduct' ||
    type === 'ProductGroup' ||
    (Array.isArray(type) && type.includes('Product'))
  ) {
    list.push(record)
  }

  if (record['@graph'] && Array.isArray(record['@graph'])) {
    list.push(...findProductEntities(record['@graph']))
  }

  return list
}

function extractOpenGraph($: cheerio.CheerioAPI, pageUrl: string, domain: string): ParsedProductMetadata | null {
  const ogTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').text()
  const cleanTitle = cleanString(ogTitle)
  if (!cleanTitle) return null

  const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content')
  const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content')
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || domain
  const ogBrand = $('meta[property="product:brand"]').attr('content') || $('meta[name="brand"]').attr('content')

  const priceAmount =
    $('meta[property="product:price:amount"]').attr('content') ||
    $('meta[property="og:price:amount"]').attr('content') ||
    $('meta[name="twitter:data1"]').attr('content')

  const priceCurrency =
    $('meta[property="product:price:currency"]').attr('content') ||
    $('meta[property="og:price:currency"]').attr('content') ||
    $('meta[name="twitter:label1"]').attr('content')

  const availabilityStr =
    $('meta[property="product:availability"]').attr('content') ||
    $('meta[property="og:availability"]').attr('content')

  const price = parsePrice(priceAmount)
  const currency = parseCurrency(priceCurrency)
  const availability = parseAvailability(availabilityStr)

  const offers: ParsedProductOffer[] = [
    {
      store: cleanString(ogSiteName) || domain,
      storeUrl: pageUrl,
      price,
      currency,
      availability,
    },
  ]

  return {
    name: cleanTitle,
    brand: cleanString(ogBrand),
    category: inferCategory(cleanTitle, ogDesc),
    description: cleanString(ogDesc),
    imageUrl: ogImage ? resolveUrl(pageUrl, ogImage) : undefined,
    images: ogImage ? [resolveUrl(pageUrl, ogImage)] : [],
    offers,
    sourceType: 'opengraph',
    rawQualityScore: price !== undefined ? 0.75 : 0.6,
  }
}

function extractMicrodata($: cheerio.CheerioAPI, pageUrl: string, domain: string): ParsedProductMetadata | null {
  const productEl = $('[itemtype*="schema.org/Product"]').first()
  if (!productEl.length) return null

  const name = cleanString(productEl.find('[itemprop="name"]').first().text() || productEl.find('[itemprop="name"]').attr('content'))
  if (!name) return null

  const brand = cleanString(productEl.find('[itemprop="brand"]').text() || productEl.find('[itemprop="brand"]').attr('content'))
  const description = cleanString(productEl.find('[itemprop="description"]').text() || productEl.find('[itemprop="description"]').attr('content'))
  const image = productEl.find('[itemprop="image"]').attr('src') || productEl.find('[itemprop="image"]').attr('content')
  const priceStr = productEl.find('[itemprop="price"]').attr('content') || productEl.find('[itemprop="price"]').text()
  const currencyStr = productEl.find('[itemprop="priceCurrency"]').attr('content') || productEl.find('[itemprop="priceCurrency"]').text()
  const availabilityStr = productEl.find('[itemprop="availability"]').attr('href') || productEl.find('[itemprop="availability"]').attr('content')
  const sku = cleanString(productEl.find('[itemprop="sku"]').attr('content') || productEl.find('[itemprop="sku"]').text())

  const price = parsePrice(priceStr)
  const currency = parseCurrency(currencyStr)
  const availability = parseAvailability(availabilityStr)

  return {
    name,
    brand,
    category: inferCategory(name, description),
    description,
    imageUrl: image ? resolveUrl(pageUrl, image) : undefined,
    images: image ? [resolveUrl(pageUrl, image)] : [],
    sku,
    offers: [
      {
        store: domain,
        storeUrl: pageUrl,
        price,
        currency,
        availability,
        variant: { sku },
      },
    ],
    sourceType: 'microdata',
    rawQualityScore: price !== undefined ? 0.8 : 0.65,
  }
}

function cleanString(str?: string | null): string | undefined {
  if (!str) return undefined
  const cleaned = str.replace(/\s+/g, ' ').trim()
  return cleaned.length > 0 ? cleaned : undefined
}

function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '')
  } catch {
    return 'Store'
  }
}

function resolveUrl(baseUrl: string, targetUrl: string): string {
  try {
    return new URL(targetUrl, baseUrl).toString()
  } catch {
    return targetUrl
  }
}

export function parsePrice(val?: unknown): number | undefined {
  if (val === undefined || val === null) return undefined
  if (typeof val === 'number') return Number.isFinite(val) && val >= 0 ? val : undefined
  if (typeof val !== 'string') return undefined

  const numeric = val.replace(/[^0-9.,]/g, '')
  if (!numeric) return undefined

  const lastComma = numeric.lastIndexOf(',')
  const lastDot = numeric.lastIndexOf('.')
  const separatorIndex = Math.max(lastComma, lastDot)
  const decimalDigits = separatorIndex >= 0 ? numeric.length - separatorIndex - 1 : 0
  const hasDecimalPart = separatorIndex >= 0 && decimalDigits > 0 && decimalDigits <= 2
  const integerPart = hasDecimalPart ? numeric.slice(0, separatorIndex) : numeric
  const fractionPart = hasDecimalPart ? numeric.slice(separatorIndex + 1) : ''
  const normalized = `${integerPart.replace(/[.,]/g, '')}${fractionPart ? `.${fractionPart.replace(/[.,]/g, '')}` : ''}`
  const num = parseFloat(normalized)
  return Number.isFinite(num) && num >= 0 ? num : undefined
}

export function parseCurrency(val?: unknown): Currency | undefined {
  if (!val || typeof val !== 'string') return undefined
  const upper = val.toUpperCase().trim()
  if (upper === 'EUR' || upper === '€') return 'EUR'
  if (upper === 'USD' || upper === '$') return 'USD'
  if (upper === 'GBP' || upper === '£') return 'GBP'
  if (upper === 'JPY' || upper === '¥') return 'JPY'
  if (upper === 'CAD') return 'CAD'
  if (upper === 'AUD') return 'AUD'
  return undefined
}

export function parseAvailability(val?: unknown): Availability {
  if (!val || typeof val !== 'string') return 'unknown'
  const lower = val.toLowerCase()
  if (
    lower.includes('instock') ||
    lower.includes('in_stock') ||
    lower.includes('in stock') ||
    lower.includes('available')
  ) {
    return 'in_stock'
  }
  if (
    lower.includes('outofstock') ||
    lower.includes('out_of_stock') ||
    lower.includes('out of stock') ||
    lower.includes('soldout') ||
    lower.includes('sold out') ||
    lower.includes('discontinued')
  ) {
    return 'out_of_stock'
  }
  return 'unknown'
}

export function inferCategory(name?: string, description?: string, categoryHint?: string): Category {
  const combined = `${name || ''} ${description || ''} ${categoryHint || ''}`.toLowerCase()

  if (/\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|loafer|loafers|sandal|sandals|mule|mules)\b/.test(combined)) {
    return 'shoes'
  }
  if (/\b(dress|jacket|coat|sweater|shirt|blouse|pants|jeans|skirt|top|cardigan|blazer|trousers|hoodie|t-shirt|knit|silk|cashmere)\b/.test(combined)) {
    return 'clothes'
  }
  if (/\b(perfume|fragrance|lipstick|cream|serum|mascara|makeup|eyeshadow|blush|foundation|skincare|moisturizer|lotion|gloss)\b/.test(combined)) {
    return 'beauty'
  }
  if (/\b(lamp|chair|sofa|vase|cushion|blanket|table|mirror|rug|decor|candle|home|kitchen|ceramic)\b/.test(combined)) {
    return 'home'
  }

  return 'other'
}
