import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Availability, Category, Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { slugify } from '@pinpinwish/shared'
import type { WishlistItemView, Product } from '@pinpinwish/wishlist-core'
import type { ProductOffer, PriceObservation } from '@pinpinwish/price-tracker'
import { getDb } from './connection'

export function getDefaultWishlist(db = getDb()) {
  const row = db
    .prepare('SELECT id, user_id, name, currency, created_at, updated_at FROM wishlists ORDER BY created_at LIMIT 1')
    .get() as Record<string, any> | undefined

  if (!row) {
    throw new Error('No default wishlist found in local database')
  }

  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    currency: row.currency as Currency,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export function upsertPinterestBoard(
  board: {
    userId: string
    boardUrl: string
    pinterestBoardId: string
    name: string
    description?: string
    imageUrl?: string
    pinCount: number
  },
  db = getDb()
) {
  const existing = db
    .prepare('SELECT id FROM pinterest_boards WHERE user_id = ? AND pinterest_board_id = ?')
    .get(board.userId, board.pinterestBoardId) as { id: string } | undefined

  const now = new Date().toISOString()
  if (existing) {
    db.prepare(`
      UPDATE pinterest_boards
      SET board_url = ?, name = ?, description = ?, image_url = ?, pin_count = ?, last_synced_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      board.boardUrl,
      board.name,
      board.description || null,
      board.imageUrl || null,
      board.pinCount,
      now,
      now,
      existing.id
    )
    return existing.id
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO pinterest_boards (id, user_id, board_url, pinterest_board_id, name, description, image_url, pin_count, last_synced_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    board.userId,
    board.boardUrl,
    board.pinterestBoardId,
    board.name,
    board.description || null,
    board.imageUrl || null,
    board.pinCount,
    now,
    now,
    now
  )
  return id
}

export function upsertPinterestPin(
  pin: {
    boardId: string
    userId: string
    pinterestPinId: string
    title?: string
    description?: string
    link?: string
    imageUrl?: string
    localImagePath?: string
    imageHash?: string
    pinUrl?: string
    lastSeenJobId?: string
  },
  db = getDb()
) {
  const existing = db
    .prepare('SELECT id FROM pinterest_pins WHERE board_id = ? AND pinterest_pin_id = ?')
    .get(pin.boardId, pin.pinterestPinId) as { id: string } | undefined

  const now = new Date().toISOString()
  if (existing) {
    db.prepare(`
      UPDATE pinterest_pins
      SET title = ?, description = ?, link = ?, image_url = ?, local_image_path = ?,
          image_hash = COALESCE(NULLIF(?, ''), image_hash),
          pin_url = ?, last_seen_import_job_id = ?, is_deleted = 0, updated_at = ?
      WHERE id = ?
    `).run(
      pin.title || null,
      pin.description || null,
      pin.link || null,
      pin.imageUrl || null,
      pin.localImagePath || null,
      pin.imageHash || '',
      pin.pinUrl || `https://www.pinterest.com/pin/${pin.pinterestPinId}/`,
      pin.lastSeenJobId || null,
      now,
      existing.id
    )
    return existing.id
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO pinterest_pins (
      id, board_id, user_id, pinterest_pin_id, title, description, link,
      image_url, local_image_path, image_hash, pin_url, last_seen_import_job_id, is_deleted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id,
    pin.boardId,
    pin.userId,
    pin.pinterestPinId,
    pin.title || null,
    pin.description || null,
    pin.link || null,
    pin.imageUrl || null,
    pin.localImagePath || null,
    pin.imageHash || '',
    pin.pinUrl || `https://www.pinterest.com/pin/${pin.pinterestPinId}/`,
    pin.lastSeenJobId || null,
    now,
    now
  )
  return id
}

export function createImportJob(
  params: {
    userId: string
    wishlistId: string
    sourceId: string
    boardId?: string
    boardUrl: string
    totalCount?: number
  },
  db = getDb()
) {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO import_jobs (
      id, user_id, wishlist_id, source_id, board_id, board_url,
      status, total_count, processed_count, downloaded_count, analyzing_count, identified_count, needs_review_count, error_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 0, 0, 0, 0, 0, ?, ?)
  `).run(
    id,
    params.userId,
    params.wishlistId,
    params.sourceId,
    params.boardId || null,
    params.boardUrl,
    params.totalCount ?? null,
    now,
    now
  )

  return getImportJob(id, db)!
}

export function updateImportJob(
  jobId: string,
  updates: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    boardId?: string
    totalCount?: number
    processedCount?: number
    downloadedCount?: number
    analyzingCount?: number
    identifiedCount?: number
    needsReviewCount?: number
    errorCount?: number
    errorMessage?: string | null
    completedAt?: string | null
  },
  db = getDb()
) {
  const current = getImportJob(jobId, db)
  if (!current) return null

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE import_jobs
    SET status = COALESCE(?, status),
        board_id = COALESCE(?, board_id),
        total_count = COALESCE(?, total_count),
        processed_count = COALESCE(?, processed_count),
        downloaded_count = COALESCE(?, downloaded_count),
        analyzing_count = COALESCE(?, analyzing_count),
        identified_count = COALESCE(?, identified_count),
        needs_review_count = COALESCE(?, needs_review_count),
        error_count = COALESCE(?, error_count),
        error_message = ?,
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
    WHERE id = ?
  `).run(
    updates.status || null,
    updates.boardId || null,
    updates.totalCount !== undefined ? updates.totalCount : null,
    updates.processedCount !== undefined ? updates.processedCount : null,
    updates.downloadedCount !== undefined ? updates.downloadedCount : null,
    updates.analyzingCount !== undefined ? updates.analyzingCount : null,
    updates.identifiedCount !== undefined ? updates.identifiedCount : null,
    updates.needsReviewCount !== undefined ? updates.needsReviewCount : null,
    updates.errorCount !== undefined ? updates.errorCount : null,
    updates.errorMessage !== undefined ? updates.errorMessage : current.errorMessage,
    updates.completedAt || null,
    now,
    jobId
  )

  return getImportJob(jobId, db)
}

export function getImportJob(jobId: string, db = getDb()) {
  const row = db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(jobId) as Record<string, any> | undefined
  if (!row) return null

  return {
    id: row.id as string,
    userId: row.user_id as string,
    wishlistId: row.wishlist_id as string,
    sourceId: row.source_id as string,
    boardId: (row.board_id as string) || undefined,
    boardUrl: row.board_url as string,
    status: row.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
    totalCount: row.total_count !== null ? Number(row.total_count) : null,
    processedCount: Number(row.processed_count || 0),
    downloadedCount: Number(row.downloaded_count || 0),
    analyzingCount: Number(row.analyzing_count || 0),
    identifiedCount: Number(row.identified_count || 0),
    needsReviewCount: Number(row.needs_review_count || 0),
    errorCount: Number(row.error_count || 0),
    errorMessage: row.error_message as string | null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  }
}

export function getLatestActiveImportJob(db = getDb()) {
  const row = db
    .prepare(`
      SELECT id
      FROM import_jobs
      WHERE status IN ('pending', 'running')
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    .get() as { id: string } | undefined

  return row ? getImportJob(row.id, db) : null
}

export function getActiveImportJobForBoard(
  wishlistId: string,
  boardUrl: string,
  db = getDb()
) {
  const row = db
    .prepare(`
      SELECT id
      FROM import_jobs
      WHERE wishlist_id = ? AND board_url = ? AND status IN ('pending', 'running')
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(wishlistId, boardUrl) as { id: string } | undefined

  return row ? getImportJob(row.id, db) : null
}

export function upsertImportJobItem(
  item: {
    jobId: string
    pinId: string
    status: string
    errorMessage?: string
    confidence?: number
    matchType?: string
  },
  db = getDb()
) {
  const existing = db
    .prepare('SELECT id FROM import_job_items WHERE job_id = ? AND pin_id = ?')
    .get(item.jobId, item.pinId) as { id: string } | undefined

  const now = new Date().toISOString()
  if (existing) {
    db.prepare(`
      UPDATE import_job_items
      SET status = ?, error_message = ?, confidence = ?, match_type = ?, updated_at = ?
      WHERE id = ?
    `).run(
      item.status,
      item.errorMessage || null,
      item.confidence ?? 0,
      item.matchType ?? 'unresolved',
      now,
      existing.id
    )
    return existing.id
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO import_job_items (id, job_id, pin_id, status, error_message, confidence, match_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    item.jobId,
    item.pinId,
    item.status,
    item.errorMessage || null,
    item.confidence ?? 0,
    item.matchType ?? 'unresolved',
    now,
    now
  )
  return id
}

export function saveResolvedProductAndItem(
  params: {
    wishlistId: string
    sourceId?: string
    sourceItemId?: string
    pinterestPinId?: string
    pinRowId?: string
    pinUrl?: string
    imageHash?: string
    priority?: Priority
    status?: WishlistItemStatus
    resolutionStatus?: 'pending' | 'resolved' | 'needs_review'
    matchType?: 'exact' | 'probable' | 'similar' | 'unresolved'
    confidence?: number
    product?: {
      name: string
      brand?: string
      category?: Category
      imageUrl?: string
      localImagePath?: string
      description?: string
      images?: string[]
      offers?: Array<{
        store: string
        storeUrl: string
        currentPrice?: number
        currency?: Currency
        availability?: Availability
        variant?: {
          size?: string
          color?: string
          sku?: string
          attributes?: Record<string, string>
        }
      }>
    }
  },
  db = getDb()
) {
  const now = new Date().toISOString()

  // 1. Check if WishlistItem already exists (Idempotency by wishlist_id + source_id + source_item_id)
  let existingItem: Record<string, any> | undefined
  if (params.sourceId && params.sourceItemId) {
    existingItem = db
      .prepare('SELECT * FROM wishlist_items WHERE wishlist_id = ? AND source_id = ? AND source_item_id = ?')
      .get(params.wishlistId, params.sourceId, params.sourceItemId) as Record<string, any> | undefined
  }

  // If user previously manually edited this item, do not overwrite manual values!
  if (existingItem && Boolean(existingItem.manual_override)) {
    return existingItem.id as string
  }

  // 2. Check for duplicate image hashes across items in this wishlist
  let possibleDuplicateOf: string | null = null
  if (params.imageHash) {
    const duplicatePin = db
      .prepare(`
        SELECT wi.id
        FROM wishlist_items wi
        JOIN pinterest_pins pp ON pp.id = wi.pinterest_pin_id
        WHERE wi.wishlist_id = ? AND pp.image_hash = ? AND pp.id != ?
        LIMIT 1
      `)
      .get(params.wishlistId, params.imageHash, params.pinRowId || '') as { id: string } | undefined

    if (duplicatePin) {
      possibleDuplicateOf = duplicatePin.id
    }
  }

  db.exec('SAVEPOINT save_resolved_product_item')
  try {
    let productId: string | null = existingItem?.product_id || null

  // 3. Create or update Product if resolved
  if (params.product && params.resolutionStatus === 'resolved') {
    const baseSlug = slugify(params.product.name) || 'product'
    if (!productId) {
      productId = randomUUID()
      const slug = `${baseSlug}-${productId.slice(0, 8)}`
      db.prepare(`
        INSERT INTO products (id, slug, name, brand, category, image_url, local_image_path, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        slug,
        params.product.name,
        params.product.brand || null,
        params.product.category || 'other',
        params.product.imageUrl || null,
        params.product.localImagePath || null,
        params.product.description || null,
        now,
        now
      )
    } else {
      db.prepare(`
        UPDATE products
        SET name = ?, brand = ?, category = ?, image_url = ?, local_image_path = ?, description = ?, updated_at = ?
        WHERE id = ?
      `).run(
        params.product.name,
        params.product.brand || null,
        params.product.category || 'other',
        params.product.imageUrl || null,
        params.product.localImagePath || null,
        params.product.description || null,
        now,
        productId
      )
    }

    // Save product images
    if (params.product.imageUrl) {
      const existingImg = db
        .prepare('SELECT id FROM product_images WHERE product_id = ? AND image_url = ?')
        .get(productId, params.product.imageUrl)
      if (!existingImg) {
        db.prepare(`
          INSERT INTO product_images (id, product_id, image_url, local_image_path, is_primary, created_at)
          VALUES (?, ?, ?, ?, 1, ?)
        `).run(randomUUID(), productId, params.product.imageUrl, params.product.localImagePath || null, now)
      }
    }

    // Save offers & price observations
    if (params.product.offers && params.product.offers.length > 0) {
      for (const offer of params.product.offers) {
        if (offer.currentPrice !== undefined && Number.isFinite(offer.currentPrice)) {
          let offerId: string
          const existingOffer = db
            .prepare('SELECT id FROM product_offers WHERE product_id = ? AND store_url = ?')
            .get(productId, offer.storeUrl) as { id: string } | undefined

          if (existingOffer) {
            offerId = existingOffer.id
            db.prepare(`
              UPDATE product_offers
              SET current_price = ?, currency = ?, availability = ?, variant_size = ?, variant_color = ?, sku = ?, last_checked_at = ?, updated_at = ?
              WHERE id = ?
            `).run(
              offer.currentPrice,
              offer.currency || 'EUR',
              offer.availability || 'unknown',
              offer.variant?.size || null,
              offer.variant?.color || null,
              offer.variant?.sku || null,
              now,
              now,
              offerId
            )
          } else {
            offerId = randomUUID()
            db.prepare(`
              INSERT INTO product_offers (
                id, product_id, store, store_url, current_price, currency, availability,
                variant_size, variant_color, sku, variant_attributes, last_checked_at, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              offerId,
              productId,
              offer.store,
              offer.storeUrl,
              offer.currentPrice,
              offer.currency || 'EUR',
              offer.availability || 'unknown',
              offer.variant?.size || null,
              offer.variant?.color || null,
              offer.variant?.sku || null,
              JSON.stringify(offer.variant?.attributes || {}),
              now,
              now,
              now
            )
          }

          // Insert price observation
          db.prepare(`
            INSERT INTO price_observations (id, product_offer_id, price, currency, availability, checked_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(randomUUID(), offerId, offer.currentPrice, offer.currency || 'EUR', offer.availability || 'unknown', now)
        }
      }
    }
  }

  // 4. Upsert WishlistItem
  const itemId = existingItem ? (existingItem.id as string) : randomUUID()
  const resolutionStatus = params.resolutionStatus || (productId ? 'resolved' : 'needs_review')
  const matchType = params.matchType || (resolutionStatus === 'resolved' ? 'exact' : 'unresolved')
  const confidence = params.confidence ?? (resolutionStatus === 'resolved' ? 1 : 0)

  if (existingItem) {
    db.prepare(`
      UPDATE wishlist_items
      SET product_id = ?,
          pinterest_pin_id = COALESCE(?, pinterest_pin_id),
          resolution_status = ?,
          match_type = ?,
          confidence = ?,
          possible_duplicate_of = COALESCE(?, possible_duplicate_of),
          updated_at = ?
      WHERE id = ?
    `).run(
      productId,
      params.pinRowId || null,
      resolutionStatus,
      matchType,
      confidence,
      possibleDuplicateOf,
      now,
      itemId
    )
  } else {
    db.prepare(`
      INSERT INTO wishlist_items (
        id, wishlist_id, product_id, pinterest_pin_id, source_id, source_type, source_item_id,
        priority, status, possible_duplicate_of, resolution_status, match_type, confidence, manual_override,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pinterest', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      itemId,
      params.wishlistId,
      productId,
      params.pinRowId || null,
      params.sourceId || null,
      params.sourceItemId || null,
      params.priority || 'medium',
      params.status || 'wanted',
      possibleDuplicateOf,
      resolutionStatus,
      matchType,
      confidence,
      now,
      now
    )
  }

    db.exec('RELEASE SAVEPOINT save_resolved_product_item')
    return itemId
  } catch (error) {
    db.exec('ROLLBACK TO SAVEPOINT save_resolved_product_item')
    db.exec('RELEASE SAVEPOINT save_resolved_product_item')
    throw error
  }
}

export function getWishlistItems(wishlistId?: string, db = getDb()): WishlistItemView[] {
  let targetWishlistId = wishlistId
  if (!targetWishlistId) {
    const defaultWl = getDefaultWishlist(db)
    targetWishlistId = defaultWl.id
  }

  const rows = db
    .prepare(`
      SELECT
        wi.id, wi.wishlist_id, wi.product_id, wi.pinterest_pin_id, wi.source_id, wi.source_type, wi.source_item_id,
        wi.priority, wi.status, wi.desired_size, wi.desired_color, wi.notes, wi.possible_duplicate_of,
        wi.resolution_status, wi.match_type, wi.confidence, wi.manual_override, wi.created_at, wi.updated_at,
        pp.title AS pin_title, pp.description AS pin_description, pp.link AS pin_link, pp.image_url AS pin_image_url,
        pp.local_image_path AS pin_local_image_path, pp.pin_url, pp.pinned_at,
        p.id AS p_id, p.slug AS p_slug, p.name AS p_name, p.brand AS p_brand, p.category AS p_category,
        p.image_url AS p_image_url, p.local_image_path AS p_local_image_path, p.description AS p_description
      FROM wishlist_items wi
      LEFT JOIN pinterest_pins pp ON pp.id = wi.pinterest_pin_id
      LEFT JOIN products p ON p.id = wi.product_id
      WHERE wi.wishlist_id = ?
      ORDER BY wi.created_at DESC
    `)
    .all(targetWishlistId) as Record<string, any>[]

  return rows.map((row) => rowToWishlistItemView(row, db))
}

export function getWishlistItemById(id: string, db = getDb()): WishlistItemView | null {
  const row = db
    .prepare(`
      SELECT
        wi.id, wi.wishlist_id, wi.product_id, wi.pinterest_pin_id, wi.source_id, wi.source_type, wi.source_item_id,
        wi.priority, wi.status, wi.desired_size, wi.desired_color, wi.notes, wi.possible_duplicate_of,
        wi.resolution_status, wi.match_type, wi.confidence, wi.manual_override, wi.created_at, wi.updated_at,
        pp.title AS pin_title, pp.description AS pin_description, pp.link AS pin_link, pp.image_url AS pin_image_url,
        pp.local_image_path AS pin_local_image_path, pp.pin_url, pp.pinned_at,
        p.id AS p_id, p.slug AS p_slug, p.name AS p_name, p.brand AS p_brand, p.category AS p_category,
        p.image_url AS p_image_url, p.local_image_path AS p_local_image_path, p.description AS p_description
      FROM wishlist_items wi
      LEFT JOIN pinterest_pins pp ON pp.id = wi.pinterest_pin_id
      LEFT JOIN products p ON p.id = wi.product_id
      WHERE wi.id = ?
    `)
    .get(id) as Record<string, any> | undefined

  if (!row) return null
  return rowToWishlistItemView(row, db)
}

export function updateWishlistItem(
  id: string,
  updates: {
    priority?: Priority
    status?: WishlistItemStatus
    desiredSize?: string
    desiredColor?: string
    notes?: string
  },
  db = getDb()
) {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE wishlist_items
    SET priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        desired_size = CASE WHEN ? = 1 THEN ? ELSE desired_size END,
        desired_color = CASE WHEN ? = 1 THEN ? ELSE desired_color END,
        notes = CASE WHEN ? = 1 THEN ? ELSE notes END,
        updated_at = ?
    WHERE id = ?
  `).run(
    updates.priority || null,
    updates.status || null,
    updates.desiredSize !== undefined ? 1 : 0,
    updates.desiredSize !== undefined ? updates.desiredSize.trim() || null : null,
    updates.desiredColor !== undefined ? 1 : 0,
    updates.desiredColor !== undefined ? updates.desiredColor.trim() || null : null,
    updates.notes !== undefined ? 1 : 0,
    updates.notes !== undefined ? updates.notes.trim() || null : null,
    now,
    id
  )

  return getWishlistItemById(id, db)
}

export function resolveWishlistItemManually(
  itemId: string,
  input: {
    name?: string
    brand?: string
    category?: Category
    imageUrl?: string
    productUrl?: string
    store?: string
    price?: number
    currency?: Currency
    action?: 'resolve' | 'none'
  },
  db = getDb()
) {
  const item = getWishlistItemById(itemId, db)
  if (!item) throw new Error('Item not found')

  const now = new Date().toISOString()

  if (input.action === 'none') {
    db.prepare(`
      UPDATE wishlist_items
      SET status = 'removed', manual_override = 1, updated_at = ?
      WHERE id = ?
    `).run(now, itemId)
    return getWishlistItemById(itemId, db)
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Product name is required for manual identification')
  }

  const productId = item.productId || randomUUID()
  const slug = `${slugify(input.name)}-${productId.slice(0, 8)}`

  const existingProduct = db.prepare('SELECT id FROM products WHERE id = ?').get(productId)
  if (existingProduct) {
    db.prepare(`
      UPDATE products
      SET name = ?, brand = ?, category = ?, image_url = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.name.trim(),
      input.brand?.trim() || null,
      input.category || 'other',
      input.imageUrl || item.product.imageUrl || null,
      now,
      productId
    )
  } else {
    db.prepare(`
      INSERT INTO products (id, slug, name, brand, category, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId,
      slug,
      input.name.trim(),
      input.brand?.trim() || null,
      input.category || 'other',
      input.imageUrl || item.product.imageUrl || null,
      now,
      now
    )
  }

  if (input.productUrl && input.price !== undefined) {
    const offerId = randomUUID()
    const store = input.store || safeDomain(input.productUrl)
    db.prepare(`
      INSERT INTO product_offers (
        id, product_id, store, store_url, current_price, currency, availability,
        variant_size, variant_color, last_checked_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'unknown', ?, ?, ?, ?, ?)
    `).run(
      offerId,
      productId,
      store,
      input.productUrl,
      input.price,
      input.currency || 'EUR',
      item.desiredSize || null,
      item.desiredColor || null,
      now,
      now,
      now
    )

    db.prepare(`
      INSERT INTO price_observations (id, product_offer_id, price, currency, availability, checked_at)
      VALUES (?, ?, ?, ?, 'unknown', ?)
    `).run(randomUUID(), offerId, input.price, input.currency || 'EUR', now)
  }

  db.prepare(`
    UPDATE wishlist_items
    SET product_id = ?, resolution_status = 'resolved', match_type = 'exact', confidence = 1, manual_override = 1, updated_at = ?
    WHERE id = ?
  `).run(productId, now, itemId)

  return getWishlistItemById(itemId, db)
}

export function getProductBySlug(slug: string, db = getDb()): Product | null {
  const row = db.prepare('SELECT * FROM products WHERE slug = ?').get(slug) as Record<string, any> | undefined
  if (!row) return null

  const offers = getProductOffers(row.id as string, db)
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    brand: (row.brand as string) || undefined,
    category: row.category as Category,
    imageUrl: (row.image_url as string) || undefined,
    localImagePath: (row.local_image_path as string) || undefined,
    description: (row.description as string) || undefined,
    offers,
  }
}

function getProductOffers(productId: string, db = getDb()): ProductOffer[] {
  const offerRows = db
    .prepare('SELECT * FROM product_offers WHERE product_id = ? ORDER BY current_price ASC')
    .all(productId) as Record<string, any>[]

  return offerRows.map((o) => {
    const obsRows = db
      .prepare('SELECT * FROM price_observations WHERE product_offer_id = ? ORDER BY checked_at ASC')
      .all(o.id) as Record<string, any>[]

    const priceHistory: PriceObservation[] = obsRows.map((obs) => ({
      id: obs.id as string,
      productOfferId: o.id as string,
      price: Number(obs.price),
      currency: obs.currency as Currency,
      availability: obs.availability as Availability,
      checkedAt: new Date(obs.checked_at),
    }))

    let variant = undefined
    if (o.variant_size || o.variant_color || o.sku) {
      variant = {
        size: (o.variant_size as string) || undefined,
        color: (o.variant_color as string) || undefined,
        sku: (o.sku as string) || undefined,
      }
    }

    return {
      id: o.id as string,
      productId: o.product_id as string,
      store: o.store as string,
      storeUrl: o.store_url as string,
      currentPrice: Number(o.current_price),
      currency: o.currency as Currency,
      availability: o.availability as Availability,
      variant,
      lastCheckedAt: o.last_checked_at ? new Date(o.last_checked_at) : undefined,
      priceHistory,
    }
  })
}

function rowToWishlistItemView(row: Record<string, any>, db: DatabaseSync): WishlistItemView {
  const productId = row.product_id as string | undefined
  let product: Product

  if (productId && row.p_id) {
    const offers = getProductOffers(productId, db)
    product = {
      id: row.p_id as string,
      slug: row.p_slug as string,
      name: row.p_name as string,
      brand: (row.p_brand as string) || undefined,
      category: (row.p_category as Category) || 'other',
      imageUrl: (row.p_image_url as string) || (row.pin_image_url as string) || undefined,
      localImagePath: (row.p_local_image_path as string) || (row.pin_local_image_path as string) || undefined,
      description: (row.p_description as string) || (row.pin_description as string) || undefined,
      offers,
    }
  } else {
    // Unresolved placeholder product
    product = {
      id: `unresolved-${row.id}`,
      slug: `unresolved-${row.id}`,
      name: (row.pin_title as string) || 'Pin pendiente de identificar',
      brand: undefined,
      category: 'other',
      imageUrl: (row.pin_image_url as string) || undefined,
      localImagePath: (row.pin_local_image_path as string) || undefined,
      description: (row.pin_description as string) || undefined,
      offers: [],
    }
  }

  return {
    id: row.id as string,
    wishlistId: row.wishlist_id as string,
    productId: productId || undefined,
    product,
    pinterestPinId: (row.source_item_id as string) || undefined,
    sourceId: (row.source_id as string) || undefined,
    sourceType: (row.source_type as any) || 'pinterest',
    sourceItemId: (row.source_item_id as string) || undefined,
    pinUrl: (row.pin_url as string) || undefined,
    resolutionStatus: row.resolution_status as any,
    matchType: row.match_type as any,
    confidence: Number(row.confidence || 0),
    manualOverride: Boolean(row.manual_override),
    priority: row.priority as Priority,
    status: row.status as WishlistItemStatus,
    desiredSize: (row.desired_size as string) || undefined,
    desiredColor: (row.desired_color as string) || undefined,
    notes: (row.notes as string) || undefined,
    possibleDuplicateOf: (row.possible_duplicate_of as string) || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function safeDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return 'Tienda'
  }
}
