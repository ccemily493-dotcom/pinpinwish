import { describe, expect, it } from 'vitest'
import { assessDroppedProductResolution } from '../lib/drop-resolution'

describe('dropped product confidence', () => {
  it('never marks automatic metadata as an exact match', () => {
    expect(
      assessDroppedProductResolution({
        sourceType: 'manual_url',
        safeProductUrl: true,
        metadataName: true,
        metadataBrand: true,
        metadataImage: true,
        metadataPrice: true,
      })
    ).toEqual({
      status: 'resolved',
      matchType: 'probable',
      confidence: 0.88,
      manualOverride: false,
      sourceType: 'manual_url',
    })
  })

  it('sends image-only or insufficient drops to Needs Review', () => {
    const result = assessDroppedProductResolution({
      sourceType: 'image',
      safeProductUrl: false,
      metadataName: false,
      metadataBrand: false,
      metadataImage: false,
      metadataPrice: false,
    })

    expect(result.status).toBe('needs_review')
    expect(result.matchType).toBe('unresolved')
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.manualOverride).toBe(false)
  })
})
