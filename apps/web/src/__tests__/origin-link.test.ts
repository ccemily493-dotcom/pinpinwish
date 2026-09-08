import { describe, it, expect } from 'vitest'
import { sanitizeWebUrl, extractStoreName, resolveOriginLink } from '../lib/origin-link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'

describe('Origin Link and Store Resolver', () => {
  describe('sanitizeWebUrl', () => {
    it('prepends https:// when missing', () => {
      expect(sanitizeWebUrl('www.zara.com/es/es/vestido-p123.html')).toBe(
        'https://www.zara.com/es/es/vestido-p123.html'
      )
    })

    it('preserves existing https:// and http:// URLs', () => {
      expect(sanitizeWebUrl('https://shop.mango.com/es/p/123')).toBe(
        'https://shop.mango.com/es/p/123'
      )
      expect(sanitizeWebUrl('http://example.com/item')).toBe(
        'http://example.com/item'
      )
    })

    it('rejects malicious or javascript: links', () => {
      expect(sanitizeWebUrl('javascript:alert(1)')).toBeNull()
      expect(sanitizeWebUrl('data:text/html,<div>hack</div>')).toBeNull()
      expect(sanitizeWebUrl('')).toBeNull()
      expect(sanitizeWebUrl(null)).toBeNull()
    })
  })

  describe('extractStoreName', () => {
    it('uses provided store name when given', () => {
      expect(extractStoreName('https://randomstore.com/item', 'Zara')).toBe('Zara')
      expect(extractStoreName('https://randomstore.com/item', 'mango')).toBe('Mango')
    })

    it('detects famous fashion stores from URL domain', () => {
      expect(extractStoreName('https://www.zara.com/es/es/vestido.html')).toBe('Zara')
      expect(extractStoreName('https://shop.mango.com/es/women/dress')).toBe('Mango')
      expect(extractStoreName('https://www.amazon.es/dp/B0012345')).toBe('Amazon')
      expect(extractStoreName('https://www2.hm.com/es_es/productpage.html')).toBe('H&M')
      expect(extractStoreName('https://www.bershka.com/es/c0p123.html')).toBe('Bershka')
      expect(extractStoreName('https://www.stradivarius.com/es/')).toBe('Stradivarius')
      expect(extractStoreName('https://www.pullandbear.com/es/')).toBe('Pull&Bear')
      expect(extractStoreName('https://www.massimodutti.com/es/')).toBe('Massimo Dutti')
      expect(extractStoreName('https://es.shein.com/dress-p-123.html')).toBe('Shein')
      expect(extractStoreName('https://www.asos.com/es/prd/123')).toBe('ASOS')
      expect(extractStoreName('https://www.pinterest.com/pin/12345/')).toBe('Pinterest')
    })
  })

  describe('resolveOriginLink', () => {
    it('resolves direct store URL from offer in 1 click', () => {
      const item: WishlistItem = {
        id: 'item-1',
        wishlistId: 'wl-1',
        productId: 'prod-1',
        product: {
          id: 'prod-1',
          name: 'Vestido lencero satinado',
          brand: 'Zara',
          category: 'clothes',
          slug: 'vestido-lencero-satinado',
          imageUrl: 'https://static.zara.net/img.jpg',
          offers: [
            {
              id: 'off-1',
              productId: 'prod-1',
              store: 'Zara',
              storeUrl: 'https://www.zara.com/es/es/vestido-p123.html',
              currentPrice: 29.95,
              currency: 'EUR',
              availability: 'in_stock',
              priceHistory: [],
            },
          ],
        },
        priority: 'high',
        status: 'wanted',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const linkInfo = resolveOriginLink(item)
      expect(linkInfo.url).toBe('https://www.zara.com/es/es/vestido-p123.html')
      expect(linkInfo.storeName).toBe('Zara')
      expect(linkInfo.actionLabel).toBe('Comprar en Zara')
      expect(linkInfo.isDirectStore).toBe(true)
      expect(linkInfo.isSearchFallback).toBe(false)
    })

    it('falls back to Google Search when no store link or pin link is present', () => {
      const item: WishlistItem = {
        id: 'item-2',
        wishlistId: 'wl-1',
        productId: 'prod-2',
        product: {
          id: 'prod-2',
          name: 'Bolso de piel trenzado',
          brand: 'Bottega Veneta',
          category: 'clothes',
          slug: 'bolso-de-piel-trenzado',
          offers: [],
        },
        priority: 'medium',
        status: 'wanted',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const linkInfo = resolveOriginLink(item)
      expect(linkInfo.url).toContain('https://www.google.com/search?q=')
      expect(linkInfo.url).toContain('Bottega%20Veneta%20Bolso%20de%20piel%20trenzado')
      expect(linkInfo.isSearchFallback).toBe(true)
      expect(linkInfo.actionLabel).toBe('Buscar en Bottega Veneta')
    })

    it('uses Pinterest pinUrl if available when no store offer exists', () => {
      const item: WishlistItem = {
        id: 'item-3',
        wishlistId: 'wl-1',
        pinUrl: 'https://www.pinterest.com/pin/987654321/',
        productId: 'prod-3',
        product: {
          id: 'prod-3',
          name: 'Look Aesthetic Outfit',
          category: 'clothes',
          slug: 'look-aesthetic-outfit',
          offers: [],
        },
        priority: 'low',
        status: 'wanted',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const linkInfo = resolveOriginLink(item)
      expect(linkInfo.url).toBe('https://www.pinterest.com/pin/987654321/')
      expect(linkInfo.isPinterest).toBe(true)
      expect(linkInfo.actionLabel).toBe('Ver en Pinterest')
    })
  })
})
