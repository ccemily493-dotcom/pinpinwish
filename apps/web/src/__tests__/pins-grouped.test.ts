import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { initDatabase } from '../lib/db/connection'
import {
  getDefaultWishlist,
  upsertPinterestBoard,
  upsertPinterestPin,
  getWishlistPinsWithProducts,
  addProductToPin,
  deleteWishlistItem,
} from '../lib/db/repository'

describe('Pins and Multiple Products per Pin (Outfit / Look View)', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = new DatabaseSync(':memory:')
    initDatabase(db)
  })

  it('aggregates multiple products in one Pin and computes the total look price correctly', () => {
    const wishlist = getDefaultWishlist(db)

    // 1. Create a Pinterest Board and Pin
    const boardId = upsertPinterestBoard(
      {
        userId: wishlist.userId,
        boardUrl: 'https://pinterest.com/user/outfits/',
        pinterestBoardId: 'user/outfits',
        name: 'Summer Outfits',
        pinCount: 1,
      },
      db
    )

    const pinRowId = upsertPinterestPin(
      {
        boardId,
        userId: wishlist.userId,
        pinterestPinId: 'outfit-pin-001',
        title: 'Chic Paris Look',
        imageUrl: 'https://pinterest.com/pins/outfit.jpg',
      },
      db
    )

    // 2. Add 1st Product: Silk Top (45€)
    const item1 = addProductToPin(
      pinRowId,
      {
        name: 'Top de Seda Blanco',
        brand: 'Zara',
        category: 'clothes',
        imageUrl: 'https://zara.com/top.jpg',
        offers: [
          {
            store: 'Zara',
            storeUrl: 'https://zara.com/top-123',
            currentPrice: 45.0,
            currency: 'EUR',
            availability: 'in_stock',
          },
        ],
      },
      db
    )

    expect(item1).not.toBeNull()

    // 3. Add 2nd Product: Linen Trousers (59.95€) to the same Pin
    const item2 = addProductToPin(
      pinRowId,
      {
        name: 'Pantalón Lino Beige',
        brand: 'Mango',
        category: 'clothes',
        imageUrl: 'https://mango.com/trousers.jpg',
        offers: [
          {
            store: 'Mango',
            storeUrl: 'https://mango.com/trousers-456',
            currentPrice: 59.95,
            currency: 'EUR',
            availability: 'in_stock',
          },
        ],
      },
      db
    )

    expect(item2).not.toBeNull()

    // 4. Add 3rd Product: Leather Loafers (89.0€) to the same Pin
    const item3 = addProductToPin(
      pinRowId,
      {
        name: 'Mocasines de Piel',
        brand: 'Massimo Dutti',
        category: 'shoes',
        imageUrl: 'https://massimodutti.com/loafers.jpg',
        offers: [
          {
            store: 'Massimo Dutti',
            storeUrl: 'https://massimodutti.com/loafers-789',
            currentPrice: 89.0,
            currency: 'EUR',
            availability: 'in_stock',
          },
        ],
      },
      db
    )

    expect(item3).not.toBeNull()

    // 5. Query Pins with Products
    const pins = getWishlistPinsWithProducts(wishlist.id, db)
    expect(pins.length).toBe(1)

    const outfitPin = pins[0]
    expect(outfitPin.title).toBe('Chic Paris Look')
    expect(outfitPin.productsCount).toBe(3)
    expect(outfitPin.items.length).toBe(3)
    // Total price: 45 + 59.95 + 89.0 = 193.95€
    expect(outfitPin.totalPrice).toBe(193.95)

    // 6. Remove 1 product (Top: 45€) and verify Pin total price updates
    const deleted = deleteWishlistItem(item1!.id, db)
    expect(deleted).toBe(true)

    const updatedPins = getWishlistPinsWithProducts(wishlist.id, db)
    expect(updatedPins.length).toBe(1)
    expect(updatedPins[0].productsCount).toBe(2)
    // New total price: 59.95 + 89.0 = 148.95€
    expect(updatedPins[0].totalPrice).toBe(148.95)
  })
})
