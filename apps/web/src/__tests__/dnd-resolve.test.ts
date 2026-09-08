import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { initDatabase } from '../lib/db/connection'
import {
  getDefaultWishlist,
  resolveWishlistItemWithProductData,
  createManualWishlistItem,
  getWishlistItemById,
  saveResolvedProductAndItem,
} from '../lib/db/repository'
import { extractDroppedProductPayload } from '../lib/dnd-parser'

describe('Drag and Drop Payload Parser', () => {
  it('extracts URL and title from text/html with anchor tag', () => {
    const mockDataTransfer = {
      getData: (format: string) => {
        if (format === 'text/html') {
          return '<a href="https://www.zara.com/es/es/vestido-largo-p02157050.html"><span>Vestido Largo Satinado</span></a>'
        }
        return ''
      },
      files: [],
    } as unknown as DataTransfer

    const payload = extractDroppedProductPayload(mockDataTransfer)
    expect(payload.url).toBe('https://www.zara.com/es/es/vestido-largo-p02157050.html')
    expect(payload.title).toBe('Vestido Largo Satinado')
  })

  it('extracts image URL and alt title from text/html with img tag', () => {
    const mockDataTransfer = {
      getData: (format: string) => {
        if (format === 'text/html') {
          return '<img src="https://static.zara.net/photos/sample.jpg" alt="Bolso Piel Mini" />'
        }
        return ''
      },
      files: [],
    } as unknown as DataTransfer

    const payload = extractDroppedProductPayload(mockDataTransfer)
    expect(payload.imageUrl).toBe('https://static.zara.net/photos/sample.jpg')
    expect(payload.title).toBe('Bolso Piel Mini')
  })

  it('extracts URL from text/uri-list', () => {
    const mockDataTransfer = {
      getData: (format: string) => {
        if (format === 'text/uri-list') {
          return '# Comment\r\nhttps://shop.mango.com/es/mujer/vestidos_c123\r\n'
        }
        return ''
      },
      files: [],
    } as unknown as DataTransfer

    const payload = extractDroppedProductPayload(mockDataTransfer)
    expect(payload.url).toBe('https://shop.mango.com/es/mujer/vestidos_c123')
  })

  it('extracts plain URL from text/plain', () => {
    const mockDataTransfer = {
      getData: (format: string) => {
        if (format === 'text/plain') {
          return 'Check out this product: https://www.amazon.es/dp/B08N5WRWNW'
        }
        return ''
      },
      files: [],
    } as unknown as DataTransfer

    const payload = extractDroppedProductPayload(mockDataTransfer)
    expect(payload.url).toBe('https://www.amazon.es/dp/B08N5WRWNW')
  })
})

describe('Repository Drag and Drop Resolution & Quick Add', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = new DatabaseSync(':memory:')
    initDatabase(db)
  })

  it('resolves an unidentified wishlist item with dropped product data and creates offers', () => {
    const wishlist = getDefaultWishlist(db)

    // Create an initial unresolved item
    const itemId = saveResolvedProductAndItem(
      {
        wishlistId: wishlist.id,
        sourceId: 'source-pinterest-default',
        sourceItemId: 'pin-123',
        resolutionStatus: 'needs_review',
        confidence: 0,
        matchType: 'unresolved',
      },
      db
    )

    const initialItem = getWishlistItemById(itemId, db)!
    expect(initialItem.resolutionStatus).toBe('needs_review')
    expect(initialItem.product.offers.length).toBe(0)

    // Resolve with dropped product data
    const updated = resolveWishlistItemWithProductData(
      itemId,
      {
        name: 'Vestido Satinado Burdeos',
        brand: 'Zara',
        category: 'clothes',
        imageUrl: 'https://static.zara.net/img/vestido.jpg',
        description: 'Vestido fluido cuello halter.',
        offers: [
          {
            store: 'zara.com',
            storeUrl: 'https://www.zara.com/es/es/vestido-p123.html',
            currentPrice: 49.95,
            currency: 'EUR',
            availability: 'in_stock',
          },
        ],
      },
      db
    )

    expect(updated).not.toBeNull()
    expect(updated?.product.name).toBe('Vestido Satinado Burdeos')
    expect(updated?.product.brand).toBe('Zara')
    expect(updated?.product.category).toBe('clothes')
    expect(updated?.resolutionStatus).toBe('resolved')
    expect(updated?.confidence).toBe(1)
    expect(updated?.product.offers.length).toBe(1)
    expect(updated?.product.offers[0].currentPrice).toBe(49.95)
    expect(updated?.product.offers[0].store).toBe('zara.com')
    expect(updated?.product.offers[0].priceHistory.length).toBe(1)
  })

  it('creates a new manual wishlist item via quickAdd with offers and price history', () => {
    const wishlist = getDefaultWishlist(db)

    const newItem = createManualWishlistItem(
      {
        wishlistId: wishlist.id,
        name: 'Zapatillas Retro Running',
        brand: 'Nike',
        category: 'shoes',
        imageUrl: 'https://nike.com/shoes.jpg',
        priority: 'high',
        offers: [
          {
            store: 'nike.com',
            storeUrl: 'https://www.nike.com/es/shoes-123',
            currentPrice: 119.99,
            currency: 'EUR',
            availability: 'in_stock',
          },
        ],
      },
      db
    )

    expect(newItem).not.toBeNull()
    expect(newItem.product.name).toBe('Zapatillas Retro Running')
    expect(newItem.product.brand).toBe('Nike')
    expect(newItem.priority).toBe('high')
    expect(newItem.resolutionStatus).toBe('resolved')
    expect(newItem.product.offers.length).toBe(1)
    expect(newItem.product.offers[0].currentPrice).toBe(119.99)
  })

  it('keeps an automatic dropped URL for review when evidence is insufficient', () => {
    const wishlist = getDefaultWishlist(db)
    const item = createManualWishlistItem(
      {
        wishlistId: wishlist.id,
        name: 'Possible product from dropped link',
        category: 'other',
        offers: [
          {
            store: 'example.com',
            storeUrl: 'https://example.com/product',
            currency: 'EUR',
            availability: 'unknown',
          },
        ],
        resolution: {
          status: 'needs_review',
          matchType: 'unresolved',
          confidence: 0.25,
          manualOverride: false,
          sourceType: 'manual_url',
        },
      },
      db
    )

    expect(item.resolutionStatus).toBe('needs_review')
    expect(item.matchType).toBe('unresolved')
    expect(item.confidence).toBe(0.25)
    expect(item.manualOverride).toBe(false)
    expect(item.sourceType).toBe('manual_url')
    expect(item.product.offers).toHaveLength(1)
    expect(item.product.offers[0]?.currentPrice).toBe(0)
    expect(item.product.offers[0]?.priceHistory).toHaveLength(0)
  })
})
