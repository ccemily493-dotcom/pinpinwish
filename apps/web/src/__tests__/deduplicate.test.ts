import { describe, it, expect, beforeEach } from 'vitest'
import { getDb } from '../lib/db/connection'
import {
  getDefaultWishlist,
  createManualWishlistItem,
  getWishlistItems,
  getWishlistPinsWithProducts,
  archiveWishlistItem,
  restoreWishlistItem,
  deleteWishlistItem,
  archiveWishlistPin,
  restoreWishlistPin,
  deleteWishlistPin,
  deduplicateWishlist,
  upsertPinterestBoard,
  upsertPinterestPin,
} from '../lib/db/repository'

describe('Wishlist Deduplication, Archiving & Deletion', () => {
  let db: ReturnType<typeof getDb>

  beforeEach(() => {
    db = getDb(':memory:')
  })

  it('deduplicates identical products in the wishlist', () => {
    const wishlist = getDefaultWishlist(db)

    // 1. Create duplicate items with identical name and brand
    createManualWishlistItem(
      {
        wishlistId: wishlist.id,
        name: 'Too Faced Most Loved Set',
        brand: 'Too Faced',
        category: 'beauty',
        offers: [{ store: 'Sephora', storeUrl: 'https://sephora.com/item1', currentPrice: 35.0, currency: 'EUR' }],
      },
      db
    )

    createManualWishlistItem(
      {
        wishlistId: wishlist.id,
        name: 'Too Faced Most Loved Set',
        brand: 'Too Faced',
        category: 'beauty',
        offers: [{ store: 'Cult Beauty', storeUrl: 'https://cultbeauty.com/item1', currentPrice: 32.0, currency: 'EUR' }],
      },
      db
    )

    // And one distinct item
    createManualWishlistItem(
      {
        wishlistId: wishlist.id,
        name: 'Different Lipstick',
        brand: 'MAC',
        category: 'beauty',
        offers: [{ store: 'MAC', storeUrl: 'https://mac.com/item2', currentPrice: 22.0, currency: 'EUR' }],
      },
      db
    )

    expect(getWishlistItems(wishlist.id, db).length).toBe(3)

    // 2. Run deduplication
    const result = deduplicateWishlist(wishlist.id, db)
    expect(result.removedCount).toBe(1)
    expect(result.mergedCount).toBe(1)

    // 3. Verify final list has 2 items and merged offers
    const remaining = getWishlistItems(wishlist.id, db)
    expect(remaining.length).toBe(2)

    const tooFaced = remaining.find((i) => i.product.name.includes('Too Faced'))
    expect(tooFaced).toBeDefined()
    expect(tooFaced!.product.offers.length).toBe(2)
  })

  it('archives and restores individual wishlist items (Baúl)', () => {
    const wishlist = getDefaultWishlist(db)
    const item = createManualWishlistItem(
      {
        wishlistId: wishlist.id,
        name: 'Vintage Trench Coat',
        category: 'clothes',
        offers: [{ store: 'Zara', storeUrl: 'https://zara.com/coat', currentPrice: 89.95, currency: 'EUR' }],
      },
      db
    )

    expect(item.status).toBe('wanted')

    // Archive (mandar al baúl)
    const archived = archiveWishlistItem(item.id, db)
    expect(archived).toBe(true)

    const itemsAfterArchive = getWishlistItems(wishlist.id, db)
    expect(itemsAfterArchive[0]!.status).toBe('archived')

    // Restore back to wishlist
    const restored = restoreWishlistItem(item.id, db)
    expect(restored).toBe(true)

    const itemsAfterRestore = getWishlistItems(wishlist.id, db)
    expect(itemsAfterRestore[0]!.status).toBe('wanted')
  })

  it('archives, restores, and permanently deletes an entire Pin / Look', () => {
    const wishlist = getDefaultWishlist(db)

    const boardId = upsertPinterestBoard(
      {
        userId: wishlist.userId,
        boardUrl: 'https://pinterest.com/user/board',
        pinterestBoardId: 'board-test',
        name: 'Autumn Inspo',
        pinCount: 1,
      },
      db
    )

    const pinId = upsertPinterestPin(
      {
        boardId,
        userId: wishlist.userId,
        pinterestPinId: 'pin-999',
        title: 'Autumn Paris Look',
        imageUrl: 'https://i.pinimg.com/image999.jpg',
      },
      db
    )

    // Add item linked to pin
    db.prepare(`
      INSERT INTO wishlist_items (
        id, wishlist_id, pinterest_pin_id, source_type, priority, status,
        resolution_status, match_type, confidence, manual_override, created_at, updated_at
      ) VALUES ('item-pin-1', ?, ?, 'pinterest', 'high', 'wanted', 'resolved', 'exact', 1, 1, datetime('now'), datetime('now'))
    `).run(wishlist.id, pinId)

    const pins = getWishlistPinsWithProducts(wishlist.id, db)
    expect(pins.length).toBe(1)
    expect(pins[0]!.isArchived).toBe(false)

    // 1. Archive whole pin
    archiveWishlistPin(pinId, db)
    const pinsArchived = getWishlistPinsWithProducts(wishlist.id, db)
    expect(pinsArchived[0]!.isArchived).toBe(true)

    // 2. Restore whole pin
    restoreWishlistPin(pinId, db)
    const pinsRestored = getWishlistPinsWithProducts(wishlist.id, db)
    expect(pinsRestored[0]!.isArchived).toBe(false)

    // 3. Delete whole pin permanently
    const deleted = deleteWishlistPin(pinId, db)
    expect(deleted).toBe(true)

    const pinsFinal = getWishlistPinsWithProducts(wishlist.id, db)
    expect(pinsFinal.length).toBe(0)
    expect(getWishlistItems(wishlist.id, db).length).toBe(0)
  })

  it('persists archive state for a Pin that has no products yet', () => {
    const wishlist = getDefaultWishlist(db)
    const boardId = upsertPinterestBoard(
      {
        userId: wishlist.userId,
        boardUrl: 'https://pinterest.com/user/empty-looks',
        pinterestBoardId: 'empty-looks',
        name: 'Empty looks',
        pinCount: 1,
      },
      db
    )
    const pinId = upsertPinterestPin(
      {
        boardId,
        userId: wishlist.userId,
        pinterestPinId: 'empty-pin-1',
        title: 'Look without identified products',
        imageUrl: 'https://i.pinimg.com/empty.jpg',
      },
      db
    )

    expect(archiveWishlistPin(pinId, db)).toBe(true)
    expect(getWishlistPinsWithProducts(wishlist.id, db)[0]?.isArchived).toBe(true)

    expect(restoreWishlistPin(pinId, db)).toBe(true)
    expect(getWishlistPinsWithProducts(wishlist.id, db)[0]?.isArchived).toBe(false)
  })
})
