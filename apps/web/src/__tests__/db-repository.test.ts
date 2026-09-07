import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { initDatabase } from '../lib/db/connection'
import {
  getDefaultWishlist,
  upsertPinterestBoard,
  upsertPinterestPin,
  createImportJob,
  updateImportJob,
  getImportJob,
  getActiveImportJobForBoard,
  upsertImportJobItem,
  saveResolvedProductAndItem,
  getWishlistItems,
  getWishlistItemById,
  updateWishlistItem,
  resolveWishlistItemManually,
} from '../lib/db/repository'

describe('SQLite Database & Repository Layer', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = new DatabaseSync(':memory:')
    initDatabase(db)
  })

  describe('Bootstrap & Default Wishlist', () => {
    it('creates default profile and wishlist on initialization', () => {
      const wishlist = getDefaultWishlist(db)
      expect(wishlist.id).toBe('wishlist-local')
      expect(wishlist.userId).toBe('local-user')
      expect(wishlist.name).toBe('My Wishlist')
      expect(wishlist.currency).toBe('EUR')
    })
  })

  describe('Board & Pin Upserts (Idempotent)', () => {
    it('upserts Pinterest boards idempotently without duplicates', () => {
      const board1 = upsertPinterestBoard(
        {
          userId: 'local-user',
          boardUrl: 'https://pinterest.com/user/fashion/',
          pinterestBoardId: 'user/fashion',
          name: 'Fashion Board',
          pinCount: 10,
        },
        db
      )

      const board2 = upsertPinterestBoard(
        {
          userId: 'local-user',
          boardUrl: 'https://pinterest.com/user/fashion/',
          pinterestBoardId: 'user/fashion',
          name: 'Fashion Board Renamed',
          pinCount: 15,
        },
        db
      )

      expect(board1).toBe(board2)
      const count = db.prepare('SELECT COUNT(*) as count FROM pinterest_boards').get() as { count: number }
      expect(Number(count.count)).toBe(1)
    })

    it('upserts Pins idempotently by board_id + pinterest_pin_id', () => {
      const boardId = upsertPinterestBoard(
        {
          userId: 'local-user',
          boardUrl: 'https://pinterest.com/user/board/',
          pinterestBoardId: 'user/board',
          name: 'Board',
          pinCount: 1,
        },
        db
      )

      const pinId1 = upsertPinterestPin(
        {
          boardId,
          userId: 'local-user',
          pinterestPinId: '123456789',
          title: 'Initial Title',
          imageUrl: 'https://example.com/img1.jpg',
        },
        db
      )

      const pinId2 = upsertPinterestPin(
        {
          boardId,
          userId: 'local-user',
          pinterestPinId: '123456789',
          title: 'Updated Title',
          imageUrl: 'https://example.com/img2.jpg',
        },
        db
      )

      expect(pinId1).toBe(pinId2)
      const pinCount = db.prepare('SELECT COUNT(*) as count FROM pinterest_pins').get() as { count: number }
      expect(Number(pinCount.count)).toBe(1)
    })
  })

  describe('Idempotent Product & WishlistItem Resolution', () => {
    it('saves resolved product, offer, and wishlist item idempotently', () => {
      const wishlist = getDefaultWishlist(db)

      const itemId1 = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-999',
          pinterestPinId: 'pin-999',
          resolutionStatus: 'resolved',
          matchType: 'exact',
          confidence: 0.95,
          product: {
            name: 'Silk Shirt',
            brand: 'Massimo Dutti',
            category: 'clothes',
            imageUrl: 'https://example.com/shirt.jpg',
            offers: [
              {
                store: 'Massimo Dutti',
                storeUrl: 'https://massimodutti.com/shirt',
                currentPrice: 79.95,
                currency: 'EUR',
                availability: 'in_stock',
              },
            ],
          },
        },
        db
      )

      // Second identical import pass
      const itemId2 = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-999',
          pinterestPinId: 'pin-999',
          resolutionStatus: 'resolved',
          matchType: 'exact',
          confidence: 0.95,
          product: {
            name: 'Silk Shirt',
            brand: 'Massimo Dutti',
            category: 'clothes',
            imageUrl: 'https://example.com/shirt.jpg',
            offers: [
              {
                store: 'Massimo Dutti',
                storeUrl: 'https://massimodutti.com/shirt',
                currentPrice: 79.95,
                currency: 'EUR',
                availability: 'in_stock',
              },
            ],
          },
        },
        db
      )

      expect(itemId1).toBe(itemId2)

      const items = getWishlistItems(wishlist.id, db)
      expect(items).toHaveLength(1)
      expect(items[0]?.product.name).toBe('Silk Shirt')
      expect(items[0]?.product.offers).toHaveLength(1)
      expect(items[0]?.product.offers[0]?.currentPrice).toBe(79.95)
      expect(items[0]?.product.offers[0]?.priceHistory).toHaveLength(2) // 2 observations recorded
    })

    it('preserves wishlist preferences while allowing automatic product resolution', () => {
      const wishlist = getDefaultWishlist(db)

      const itemId = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-custom',
          resolutionStatus: 'needs_review',
        },
        db
      )

      // User manually edits the item
      updateWishlistItem(
        itemId,
        {
          priority: 'dream',
          desiredSize: '39',
          notes: 'User custom note',
        },
        db
      )

      // Automatic re-import attempts to overwrite
      saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-custom',
          priority: 'low',
          resolutionStatus: 'resolved',
          matchType: 'probable',
          confidence: 0.82,
          product: {
            name: 'Resolved shoe',
            category: 'shoes',
          },
        },
        db
      )

      const item = getWishlistItemById(itemId, db)
      expect(item?.priority).toBe('dream')
      expect(item?.desiredSize).toBe('39')
      expect(item?.notes).toBe('User custom note')
      expect(item?.product.name).toBe('Resolved shoe')
      expect(item?.manualOverride).toBe(false)
    })

    it('does not clear omitted size, color, or notes during a partial update', () => {
      const wishlist = getDefaultWishlist(db)
      const itemId = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-preferences',
          resolutionStatus: 'needs_review',
        },
        db
      )

      updateWishlistItem(itemId, { desiredSize: 'M', desiredColor: 'Burgundy', notes: 'Gift' }, db)
      updateWishlistItem(itemId, { priority: 'high' }, db)

      const item = getWishlistItemById(itemId, db)
      expect(item?.desiredSize).toBe('M')
      expect(item?.desiredColor).toBe('Burgundy')
      expect(item?.notes).toBe('Gift')
      expect(item?.priority).toBe('high')
    })

    it('detects duplicate pins by image hash', () => {
      const wishlist = getDefaultWishlist(db)
      const boardId = upsertPinterestBoard(
        {
          userId: 'local-user',
          boardUrl: 'https://pinterest.com/user/board/',
          pinterestBoardId: 'user/board',
          name: 'Board',
          pinCount: 2,
        },
        db
      )

      const pinRow1 = upsertPinterestPin(
        {
          boardId,
          userId: 'local-user',
          pinterestPinId: 'pin-hash-1',
          imageHash: 'hash-abc-123',
        },
        db
      )

      const item1Id = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-hash-1',
          pinRowId: pinRow1,
          imageHash: 'hash-abc-123',
        },
        db
      )

      const pinRow2 = upsertPinterestPin(
        {
          boardId,
          userId: 'local-user',
          pinterestPinId: 'pin-hash-2',
          imageHash: 'hash-abc-123',
        },
        db
      )

      const item2Id = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-hash-2',
          pinRowId: pinRow2,
          imageHash: 'hash-abc-123',
        },
        db
      )

      const item2 = getWishlistItemById(item2Id, db)
      expect(item2?.possibleDuplicateOf).toBe(item1Id)
    })
  })

  describe('ImportJob Lifecycle & Item Counters', () => {
    it('creates, tracks, and completes import jobs with live statistics', () => {
      const wishlist = getDefaultWishlist(db)
      const job = createImportJob(
        {
          userId: 'local-user',
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          boardUrl: 'https://pinterest.com/user/board/',
          totalCount: 5,
        },
        db
      )

      expect(job.status).toBe('pending')
      expect(job.processedCount).toBe(0)
      expect(getActiveImportJobForBoard(wishlist.id, job.boardUrl, db)?.id).toBe(job.id)

      upsertImportJobItem({ jobId: job.id, pinId: 'p1', status: 'analyzing' }, db)
      upsertImportJobItem({ jobId: job.id, pinId: 'p2', status: 'failed', errorMessage: 'Timeout' }, db)

      const updated = updateImportJob(
        job.id,
        {
          status: 'running',
          processedCount: 2,
          downloadedCount: 2,
          identifiedCount: 1,
          errorCount: 1,
        },
        db
      )

      expect(updated?.status).toBe('running')
      expect(updated?.processedCount).toBe(2)
      expect(updated?.identifiedCount).toBe(1)
      expect(updated?.errorCount).toBe(1)

      const completed = updateImportJob(job.id, { status: 'completed' }, db)
      expect(completed?.status).toBe('completed')
    })
  })

  describe('Manual Item Resolution', () => {
    it('allows manually identifying an unresolved pin', () => {
      const wishlist = getDefaultWishlist(db)
      const itemId = saveResolvedProductAndItem(
        {
          wishlistId: wishlist.id,
          sourceId: 'source-pinterest-default',
          sourceItemId: 'pin-review-1',
          resolutionStatus: 'needs_review',
        },
        db
      )

      const resolved = resolveWishlistItemManually(
        itemId,
        {
          name: 'Classic Loafers',
          brand: 'Gucci',
          category: 'shoes',
          price: 650,
          store: 'Gucci',
          productUrl: 'https://gucci.com/loafers',
        },
        db
      )

      expect(resolved?.resolutionStatus).toBe('resolved')
      expect(resolved?.product.name).toBe('Classic Loafers')
      expect(resolved?.product.brand).toBe('Gucci')
      expect(resolved?.product.category).toBe('shoes')
      expect(resolved?.product.offers[0]?.currentPrice).toBe(650)
      expect(resolved?.manualOverride).toBe(true)
    })
  })
})
