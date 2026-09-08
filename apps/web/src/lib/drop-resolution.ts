import type { ProductMatchType, ResolutionStatus, SourceType } from '@pinpinwish/shared'

export type DroppedProductResolution = {
  status: ResolutionStatus
  matchType: ProductMatchType
  confidence: number
  manualOverride: false
  sourceType: SourceType
}

export function assessDroppedProductResolution(input: {
  sourceType: Extract<SourceType, 'manual_url' | 'image' | 'pinterest'>
  safeProductUrl: boolean
  metadataName: boolean
  metadataBrand: boolean
  metadataImage: boolean
  metadataPrice: boolean
}): DroppedProductResolution {
  const metadataSignals = [input.metadataBrand, input.metadataImage, input.metadataPrice].filter(Boolean).length

  if (input.safeProductUrl && input.metadataName && input.metadataPrice) {
    return {
      status: 'resolved',
      matchType: 'probable',
      confidence: 0.88,
      manualOverride: false,
      sourceType: input.sourceType,
    }
  }

  if (input.safeProductUrl && input.metadataName && metadataSignals >= 1) {
    return {
      status: 'resolved',
      matchType: 'probable',
      confidence: 0.76,
      manualOverride: false,
      sourceType: input.sourceType,
    }
  }

  if (input.safeProductUrl && input.metadataName) {
    return {
      status: 'needs_review',
      matchType: 'similar',
      confidence: 0.58,
      manualOverride: false,
      sourceType: input.sourceType,
    }
  }

  return {
    status: 'needs_review',
    matchType: 'unresolved',
    confidence: 0.25,
    manualOverride: false,
    sourceType: input.sourceType,
  }
}
