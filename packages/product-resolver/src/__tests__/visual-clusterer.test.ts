import { describe, expect, it } from 'vitest'
import { clusterVisualSearchResults } from '../visual-clusterer'

describe('visual product clustering', () => {
  it('combines several stores for the same product into one cluster', () => {
    const clusters = clusterVisualSearchResults([
      result('Too Faced Lip Injection Maximum Plump', 'Sephora', 1, 29),
      result('Too Faced Lip Injection Maximum Plump Lip Gloss', 'Douglas', 2, 27),
      result('Too Faced Hangover Replenishing Face Primer', 'Too Faced', 3, 39),
      result('Too Faced Hangover Primer 40ml', 'Sephora', 5, 38),
    ])

    expect(clusters).toHaveLength(2)
    expect(clusters[0]?.results).toHaveLength(2)
    expect(clusters[1]?.results).toHaveLength(2)
  })

  it('keeps exact distinct products from a multi-product image', () => {
    const clusters = clusterVisualSearchResults([
      { ...result('Victoria Secret Vanilla Mousse Lotion', 'Store A', 1, 24), exactMatch: true },
      { ...result('Victoria Secret Vanilla Mousse Fragrance Mist', 'Store B', 2, 26), exactMatch: true },
    ])

    expect(clusters).toHaveLength(2)
    expect(clusters.every((cluster) => cluster.confidence === 0.96)).toBe(true)
  })

  it('does not promote unrelated weak visual noise', () => {
    const clusters = clusterVisualSearchResults([
      result('Chanel Crystal Logo Earrings', 'Vestiaire', 1, 320),
      { ...result('Generic birthday card printable', 'Blog', 12), relevanceScore: 0.4 },
    ])

    expect(clusters).toHaveLength(1)
  })
})

function result(name: string, store: string, position: number, price?: number) {
  return {
    providerId: 'test-lens',
    name,
    productUrl: `https://${store.toLowerCase().replace(/\s/g, '')}.example/${position}`,
    store,
    price,
    currency: 'EUR' as const,
    availability: 'in_stock' as const,
    relevanceScore: position <= 3 ? 0.88 : 0.76,
    sourcePosition: position,
  }
}
