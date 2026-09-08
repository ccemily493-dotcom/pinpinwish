import { describe, expect, it } from 'vitest'
import { parseSerpApiLensResponse, SerpApiGoogleLensProvider } from '../serpapi-google-lens-provider'

describe('SerpApiGoogleLensProvider', () => {
  it('does not make requests without a configured key', async () => {
    const provider = new SerpApiGoogleLensProvider({ apiKey: '' })
    await expect(provider.search({ imageUrl: 'https://example.com/product.jpg' })).resolves.toEqual([])
  })

  it('maps structured product matches including price and stock', () => {
    const results = parseSerpApiLensResponse({
      visual_matches: [
        {
          position: 1,
          title: 'Victoria’s Secret Vanilla Mousse Fragrance Lotion',
          link: 'https://shop.example/vanilla-mousse',
          source: 'Example Shop',
          price: { extracted_value: 24.99, currency: '€' },
          in_stock: true,
          image: 'https://shop.example/vanilla.jpg',
          exact_matches: true,
        },
      ],
    })

    expect(results).toEqual([
      expect.objectContaining({
        name: 'Victoria’s Secret Vanilla Mousse Fragrance Lotion',
        store: 'Example Shop',
        price: 24.99,
        currency: 'EUR',
        availability: 'in_stock',
        exactMatch: true,
        relevanceScore: 0.96,
      }),
    ])
  })

  it('filters social and malformed results', () => {
    const results = parseSerpApiLensResponse({
      visual_matches: [
        { title: 'A Pin', link: 'https://www.pinterest.com/pin/1/' },
        { title: 'A product', link: 'https://store.example/product' },
        { title: '', link: 'https://store.example/empty' },
      ],
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.productUrl).toBe('https://store.example/product')
  })
})
