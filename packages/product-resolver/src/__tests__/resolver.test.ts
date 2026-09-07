import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import { NullProductResolver, StandardProductResolver } from '../resolver'
import { parseHtmlMetadata, parsePrice, parseCurrency, inferCategory } from '../html-parser'
import { calculateConfidence, computeTokenSimilarity, CONFIDENCE_THRESHOLDS } from '../confidence-scorer'
import type { PinterestPinInput } from '../types'

describe('Product Resolver Suite', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures')
  const jsonLdHtml = fs.readFileSync(path.join(fixturesDir, 'jsonld-product.html'), 'utf-8')
  const ogHtml = fs.readFileSync(path.join(fixturesDir, 'opengraph-product.html'), 'utf-8')
  const articleHtml = fs.readFileSync(path.join(fixturesDir, 'generic-article.html'), 'utf-8')

  describe('HTML & JSON-LD Parser', () => {
    it('extracts complete structured product from JSON-LD fixture', () => {
      const parsed = parseHtmlMetadata(jsonLdHtml, 'https://example.com/products/silk-satin-slip-dress')

      expect(parsed.name).toBe('Silk Satin Slip Dress')
      expect(parsed.brand).toBe('ZARA')
      expect(parsed.category).toBe('clothes')
      expect(parsed.sku).toBe('ZR-SILK-9920')
      expect(parsed.sourceType).toBe('json-ld')
      expect(parsed.offers).toHaveLength(1)
      expect(parsed.offers[0]?.price).toBe(89.95)
      expect(parsed.offers[0]?.currency).toBe('EUR')
      expect(parsed.offers[0]?.availability).toBe('in_stock')
    })

    it('extracts OpenGraph metadata when JSON-LD is absent', () => {
      const parsed = parseHtmlMetadata(ogHtml, 'https://example.com/boots')

      expect(parsed.name).toBe('Leather Knee-High Boots')
      expect(parsed.brand).toBe('Mango')
      expect(parsed.category).toBe('shoes')
      expect(parsed.sourceType).toBe('opengraph')
      expect(parsed.offers[0]?.price).toBe(149.99)
      expect(parsed.offers[0]?.currency).toBe('EUR')
      expect(parsed.offers[0]?.availability).toBe('in_stock')
    })

    it('returns empty/unresolved metadata for non-product article', () => {
      const parsed = parseHtmlMetadata(articleHtml, 'https://example.com/blog/trends')

      expect(parsed.sourceType).toBe('opengraph')
      expect(parsed.offers[0]?.price).toBeUndefined()
    })

    it('parses different price and currency formats', () => {
      expect(parsePrice('49.99')).toBe(49.99)
      expect(parsePrice('€ 120,50')).toBe(120.5)
      expect(parsePrice('1.299,99 €')).toBe(1299.99)
      expect(parsePrice('$1,299.99')).toBe(1299.99)
      expect(parsePrice(89)).toBe(89)
      expect(parsePrice('free')).toBeUndefined()

      expect(parseCurrency('EUR')).toBe('EUR')
      expect(parseCurrency('$')).toBe('USD')
      expect(parseCurrency('GBP')).toBe('GBP')
      expect(parseCurrency('unknown')).toBeUndefined()
    })

    it('infers product category correctly', () => {
      expect(inferCategory('Silk Slip Dress', 'Elegant evening dress')).toBe('clothes')
      expect(inferCategory('Leather Ankle Boots', 'Winter chelsea boots')).toBe('shoes')
      expect(inferCategory('Hydrating Face Serum', 'Hyaluronic acid skincare')).toBe('beauty')
      expect(inferCategory('Ceramic Table Lamp', 'Warm bedside lighting')).toBe('home')
      expect(inferCategory('Random object', 'Nothing specific')).toBe('other')
    })
  })

  describe('Confidence Scoring & Thresholds', () => {
    it('scores exact match (>= 0.90) for high-quality JSON-LD with title and brand match', () => {
      const pin: PinterestPinInput = {
        pinterestPinId: 'pin-100',
        title: 'ZARA Silk Satin Slip Dress',
        description: 'Mulberry silk dress ZR-SILK-9920',
        link: 'https://example.com/products/silk-satin-slip-dress',
      }

      const metadata = parseHtmlMetadata(jsonLdHtml, pin.link!)
      const scoring = calculateConfidence(pin, metadata)

      expect(scoring.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.EXACT)
      expect(scoring.matchType).toBe('exact')
      expect(scoring.evidence.brandMatch).toBe(true)
      expect(scoring.evidence.jsonLdFound).toBe(true)
      expect(scoring.evidence.skuMatched).toBe(true)
    })

    it('scores probable match (>= 0.72) for valid OpenGraph product with brand', () => {
      const pin: PinterestPinInput = {
        pinterestPinId: 'pin-200',
        title: 'Mango Knee-High Boots',
        description: 'Pointed leather boots',
        link: 'https://example.com/boots',
      }

      const metadata = parseHtmlMetadata(ogHtml, pin.link!)
      const scoring = calculateConfidence(pin, metadata)

      expect(scoring.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.PROBABLE)
      expect(['exact', 'probable']).toContain(scoring.matchType)
    })

    it('classifies as unresolved (< 0.50) when evidence is insufficient', () => {
      const pin: PinterestPinInput = {
        pinterestPinId: 'pin-300',
        title: 'Inspiration moodboard aesthetic',
        description: 'Vibes and summer travel',
        link: 'https://example.com/blog/trends',
      }

      const metadata = parseHtmlMetadata(articleHtml, pin.link!)
      const scoring = calculateConfidence(pin, metadata)

      expect(scoring.matchType).toBe('unresolved')
      expect(scoring.confidence).toBe(0)
    })

    it('computes word token similarity', () => {
      expect(computeTokenSimilarity('Zara Silk Dress', 'Zara Silk Satin Dress')).toBeGreaterThan(0.5)
      expect(computeTokenSimilarity('Nike Sneakers', 'Adidas Shoes')).toBe(0)
    })
  })

  describe('NullProductResolver', () => {
    const resolver = new NullProductResolver()
    const pin: PinterestPinInput = {
      pinterestPinId: 'pin-123',
      title: 'Beautiful blue dress',
    }

    it('returns matchType unresolved and confidence 0', async () => {
      const result = await resolver.resolve(pin)
      expect(result.matchType).toBe('unresolved')
      expect(result.confidence).toBe(0)
      expect(result.productUrl).toBeUndefined()
    })
  })

  describe('StandardProductResolver Safe Fallbacks', () => {
    const resolver = new StandardProductResolver()

    it('never invents products when given non-product input', async () => {
      const pin: PinterestPinInput = {
        pinterestPinId: 'pin-400',
        title: 'Random aesthetic photo without store',
      }

      const result = await resolver.resolve(pin)
      expect(result.matchType).toBe('unresolved')
      expect(result.confidence).toBe(0)
      expect(result.price).toBeUndefined()
      expect(result.store).toBeUndefined()
    })
  })
})
