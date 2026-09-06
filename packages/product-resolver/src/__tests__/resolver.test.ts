import { describe, it, expect } from 'vitest'
import { NullProductResolver } from '../resolver'
import type { PinterestPinInput } from '../types'

describe('NullProductResolver', () => {
  const resolver = new NullProductResolver()

  const pin: PinterestPinInput = {
    pinterestPinId: 'pin-123',
    title: 'Beautiful blue dress',
    description: 'Elegant summer dress',
    link: 'https://pinterest.com/pin/123',
    imageUrl: 'https://i.pinimg.com/example.jpg',
  }

  it('returns matchType unresolved', async () => {
    const result = await resolver.resolve(pin)
    expect(result.matchType).toBe('unresolved')
  })

  it('returns confidence 0', async () => {
    const result = await resolver.resolve(pin)
    expect(result.confidence).toBe(0)
  })

  it('never invents a productUrl', async () => {
    const result = await resolver.resolve(pin)
    expect(result.productUrl).toBeUndefined()
  })

  it('never invents a store', async () => {
    const result = await resolver.resolve(pin)
    expect(result.store).toBeUndefined()
  })

  it('never invents a brand', async () => {
    const result = await resolver.resolve(pin)
    expect(result.brand).toBeUndefined()
  })

  it('never invents a price', async () => {
    const result = await resolver.resolve(pin)
    expect(result.price).toBeUndefined()
  })

  it('returns unresolved even with a rich pin input', async () => {
    const richPin: PinterestPinInput = {
      pinterestPinId: 'pin-456',
      title: 'Nike Air Max 270',
      description: 'White sneakers size 42',
      link: 'https://nike.com/air-max-270',
      imageUrl: 'https://i.pinimg.com/nike.jpg',
    }
    const result = await resolver.resolve(richPin)
    expect(result.matchType).toBe('unresolved')
    expect(result.confidence).toBe(0)
    expect(result.productUrl).toBeUndefined()
    expect(result.store).toBeUndefined()
  })

  it('resolves with minimal pin input (only pinterestPinId)', async () => {
    const minimalPin: PinterestPinInput = { pinterestPinId: 'pin-789' }
    const result = await resolver.resolve(minimalPin)
    expect(result.matchType).toBe('unresolved')
    expect(result.confidence).toBe(0)
  })

  /**
   * TODO (Phase 3): Add tests for real resolution algorithms:
   * - exact match by URL
   * - probable match by image similarity
   * - similar match by text description
   * - confidence scoring based on evidence quality
   */
})
