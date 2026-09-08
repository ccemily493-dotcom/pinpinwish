import type { ProductSearchResult } from '@pinpinwish/product-search'

export interface VisualProductCluster {
  name: string
  imageUrl?: string
  results: ProductSearchResult[]
  confidence: number
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'buy', 'de', 'del', 'el', 'en', 'for', 'from', 'in', 'la', 'las', 'los',
  'of', 'official', 'online', 'para', 'shop', 'store', 'the', 'tienda', 'with', 'women', 'womens', 'men',
  'mens', 'amazon', 'ebay', 'etsy', 'walmart', 'com', 'es', 'uk', 'new',
])

const PRODUCT_TYPES = new Set([
  'bag', 'blush', 'bodywash', 'boot', 'bottle', 'bracelet', 'cream', 'concealer', 'conditioner',
  'dress', 'earring', 'earrings', 'foundation', 'gloss', 'jacket', 'lotion', 'mascara', 'mist',
  'necklace', 'perfume', 'primer', 'serum', 'shampoo', 'shoe', 'shoes', 'skirt', 'spray', 'top',
])

export function clusterVisualSearchResults(results: ProductSearchResult[], limit = 6): VisualProductCluster[] {
  const clusters: Array<{ name: string; tokens: Set<string>; results: ProductSearchResult[] }> = []

  for (const result of results.slice(0, 40)) {
    const name = cleanProductName(result.name, result.store)
    const tokens = productTokens(name)
    if (!name || tokens.size === 0) continue

    const existing = clusters.find(
      (cluster) =>
        !hasConflictingProductTypes(tokens, cluster.tokens) &&
        productNameSimilarity(tokens, cluster.tokens) >= 0.58
    )
    if (existing) {
      existing.results.push(result)
      if (name.length < existing.name.length && name.length >= 8) existing.name = name
    } else {
      clusters.push({ name, tokens, results: [result] })
    }
  }

  const ranked = clusters
    .map((cluster) => {
      const sorted = [...cluster.results].sort(
        (a, b) => (b.exactMatch ? 1 : 0) - (a.exactMatch ? 1 : 0) || b.relevanceScore - a.relevanceScore
      )
      const best = sorted[0]
      const support = sorted.length
      const hasExact = sorted.some((result) => result.exactMatch)
      const hasPrice = sorted.some((result) => result.price !== undefined)
      const confidence = hasExact
        ? 0.96
        : support >= 3
          ? 0.9
          : support >= 2
            ? 0.84
            : hasPrice && (best?.sourcePosition ?? 99) <= 3
              ? 0.78
              : 0.62

      return {
        name: cluster.name,
        imageUrl: best?.imageUrl,
        results: sorted,
        confidence,
        bestPosition: best?.sourcePosition ?? 99,
        hasExact,
        hasPrice,
        support,
      }
    })
    .sort((a, b) => b.confidence - a.confidence || a.bestPosition - b.bestPosition)

  const primaryTokens = productTokens(ranked[0]?.name ?? '')

  return ranked
    .filter((cluster, index) => {
      if (index === 0) return true
      if (cluster.hasExact || cluster.support >= 2) return true

      // Multi-product beauty/fashion photos often contain several products from
      // the same visible brand. Keep a priced top result sharing that identity.
      return (
        cluster.hasPrice &&
        cluster.bestPosition <= 10 &&
        productNameSimilarity(productTokens(cluster.name), primaryTokens) >= 0.2
      )
    })
    .slice(0, limit)
    .map(({ name, imageUrl, results: clusterResults, confidence }) => ({
      name,
      imageUrl,
      results: clusterResults,
      confidence,
    }))
}

export function cleanProductName(value: string, store?: string): string {
  let name = value.replace(/\s+/g, ' ').trim()
  for (const separator of [' | ', ' — ', ' – ']) {
    const index = name.indexOf(separator)
    if (index >= 8) name = name.slice(0, index).trim()
  }

  const dashIndex = name.lastIndexOf(' - ')
  if (dashIndex >= 8) {
    const suffix = normalizeText(name.slice(dashIndex + 3))
    const normalizedStore = normalizeText(store ?? '')
    if (normalizedStore && (suffix.includes(normalizedStore) || normalizedStore.includes(suffix))) {
      name = name.slice(0, dashIndex).trim()
    }
  }

  return name.slice(0, 180)
}

function productTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token) && !/^\d+(ml|oz|g|kg)?$/.test(token))
  )
}

function productNameSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / Math.min(left.size, right.size)
}

function hasConflictingProductTypes(left: Set<string>, right: Set<string>): boolean {
  const leftTypes = [...left].filter((token) => PRODUCT_TYPES.has(token))
  const rightTypes = [...right].filter((token) => PRODUCT_TYPES.has(token))
  return leftTypes.length > 0 && rightTypes.length > 0 && !leftTypes.some((token) => rightTypes.includes(token))
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
