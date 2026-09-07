import type { MatchType, PinterestPinInput, ParsedProductMetadata } from './types'

export interface ScoringEvidence {
  nameSimilarity: number
  brandMatch: boolean
  domainMatch: boolean
  jsonLdFound: boolean
  visualMatchFound: boolean
  skuMatched: boolean
  strategyUsed: string
  details?: string
}

export interface ConfidenceScoreResult {
  confidence: number
  matchType: MatchType
  evidence: ScoringEvidence
}

export const CONFIDENCE_THRESHOLDS = {
  EXACT: 0.9,
  PROBABLE: 0.72,
  SIMILAR: 0.5,
} as const

/**
 * Calculates a multi-factor confidence score between 0.0 and 1.0.
 */
export function calculateConfidence(
  pin: PinterestPinInput,
  metadata: ParsedProductMetadata,
  options: {
    isVisualMatch?: boolean
    visualRelevance?: number
  } = {}
): ConfidenceScoreResult {
  if (!metadata.name || metadata.name.trim().length === 0) {
    return {
      confidence: 0,
      matchType: 'unresolved',
      evidence: {
        nameSimilarity: 0,
        brandMatch: false,
        domainMatch: false,
        jsonLdFound: false,
        visualMatchFound: false,
        skuMatched: false,
        strategyUsed: 'none',
        details: 'No product name found',
      },
    }
  }

  const pinTitle = (pin.title || '').trim().toLowerCase()
  const pinDesc = (pin.description || '').trim().toLowerCase()
  const prodName = metadata.name.trim().toLowerCase()
  const prodBrand = (metadata.brand || '').trim().toLowerCase()

  // 1. Text Similarity Score (0.0 to 1.0)
  const nameSim = computeTokenSimilarity(pinTitle || pinDesc, prodName)

  // 2. Brand Match Score
  let brandMatch = false
  if (prodBrand.length >= 2) {
    if (pinTitle.includes(prodBrand) || pinDesc.includes(prodBrand)) {
      brandMatch = true
    }
  }

  // 3. Domain match
  let domainMatch = false
  if (pin.link) {
    try {
      const pinHost = new URL(pin.link).hostname.replace(/^www\./, '')
      if (metadata.offers.some((o) => o.storeUrl && o.storeUrl.includes(pinHost))) {
        domainMatch = true
      }
    } catch {
      // ignore
    }
  }

  // 4. Source structure quality & SKU match
  const jsonLdFound = metadata.sourceType === 'json-ld'
  const visualMatchFound = Boolean(options.isVisualMatch)
  const skuLower = (metadata.sku || '').trim().toLowerCase()
  const skuMatched = Boolean(
    skuLower.length >= 3 && (pinDesc.includes(skuLower) || pinTitle.includes(skuLower))
  )

  const hasPrice = metadata.offers.some((o) => o.price !== undefined && o.price > 0)
  let baseScore = 0

  if (jsonLdFound) {
    // Highly reliable structured data
    baseScore = hasPrice ? 0.72 : 0.6
    if (nameSim >= 0.3) baseScore += 0.15
    if (brandMatch) baseScore += 0.08
    if (domainMatch) baseScore += 0.05
    if (skuMatched) baseScore += 0.1
  } else if (metadata.sourceType === 'microdata' || metadata.sourceType === 'opengraph') {
    // Standard metadata from linked page
    if (hasPrice || brandMatch) {
      baseScore = 0.55
      if (nameSim >= 0.4) baseScore += 0.18
      if (brandMatch) baseScore += 0.12
      if (domainMatch) baseScore += 0.05
    } else {
      // Generic article or unpriced webpage
      baseScore = nameSim * 0.4
    }
  } else if (visualMatchFound) {
    // Visual search candidate
    const visualRel = options.visualRelevance ?? 0.6
    baseScore = visualRel * 0.6
    if (nameSim >= 0.5) baseScore += 0.2
    if (brandMatch) baseScore += 0.15
  } else {
    // Weak match
    baseScore = nameSim * 0.5
    if (brandMatch) baseScore += 0.15
  }

  // Cap confidence at 1.0
  let confidence = Math.min(1, Math.max(0, baseScore))
  confidence = Math.round(confidence * 1000) / 1000

  // Apply conservative classification
  let matchType: MatchType
  if (confidence >= CONFIDENCE_THRESHOLDS.EXACT) {
    matchType = 'exact'
  } else if (confidence >= CONFIDENCE_THRESHOLDS.PROBABLE) {
    matchType = 'probable'
  } else if (confidence >= CONFIDENCE_THRESHOLDS.SIMILAR) {
    matchType = 'similar'
  } else {
    matchType = 'unresolved'
    confidence = 0
  }

  return {
    confidence,
    matchType,
    evidence: {
      nameSimilarity: Math.round(nameSim * 100) / 100,
      brandMatch,
      domainMatch,
      jsonLdFound,
      visualMatchFound,
      skuMatched,
      strategyUsed: metadata.sourceType,
      details: `Calculated from ${metadata.sourceType} with similarity ${Math.round(nameSim * 100)}%`,
    },
  }
}

/**
 * Computes Jaccard word-level token overlap similarity.
 */
export function computeTokenSimilarity(textA: string, textB: string): number {
  const tokenize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 2)

  const tokensA = new Set(tokenize(textA))
  const tokensB = new Set(tokenize(textB))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++
  }

  const union = new Set([...tokensA, ...tokensB]).size
  return union > 0 ? intersection / union : 0
}
