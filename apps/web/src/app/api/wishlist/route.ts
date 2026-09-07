import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'
import { isServerSupabaseConfigured } from '@/lib/env/server'

type ManualItemInput = {
  name?: string
  brand?: string
  category?: 'clothes' | 'shoes' | 'beauty' | 'home' | 'other'
  imageUrl?: string
  productUrl?: string
  store?: string
  price?: number
  currency?: string
  priority?: 'low' | 'medium' | 'high' | 'dream'
  desiredSize?: string
  desiredColor?: string
  notes?: string
}

export async function GET() {
  if (!isServerSupabaseConfigured()) return apiError('La nube no está configurada; usando modo local.', 503, 'SUPABASE_NOT_CONFIGURED')
  try {
    const user = await requireUser()
    const admin = createSupabaseAdminClient()
    const { data: wishlist, error: wishlistError } = await admin
      .from('wishlists')
      .select('id, name, currency')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(1)
      .single()
    if (wishlistError || !wishlist) throw wishlistError ?? new Error('WISHLIST_NOT_FOUND')

    const { data: items, error } = await admin
      .from('wishlist_items')
      .select(`
        *,
        pinterest_pins ( pinterest_pin_id, title, description, link, image_url, pin_url, pinned_at ),
        products (
          id, slug, name, brand, category, image_url, description,
          product_images ( id, image_url, alt_text, display_order, is_primary ),
          product_offers (
            id, store, store_url, current_price, currency, availability,
            variant_size, variant_color, sku, variant_attributes, last_checked_at,
            price_observations ( id, price, currency, availability, checked_at )
          )
        )
      `)
      .eq('wishlist_id', wishlist.id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({
      ok: true,
      wishlist: { id: wishlist.id, name: wishlist.name, currency: wishlist.currency },
      items: (items ?? []).map(toWishlistItem),
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(request: NextRequest) {
  let productId: string | undefined
  try {
    const user = await requireUser()
    const input = (await request.json()) as ManualItemInput
    if (!input.name?.trim()) return apiError('El nombre es obligatorio.', 422, 'NAME_REQUIRED')
    if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
      return apiError('El precio no es válido.', 422, 'PRICE_INVALID')
    }

    const admin = createSupabaseAdminClient()
    const { data: wishlist, error: wishlistError } = await admin
      .from('wishlists').select('id').eq('user_id', user.id).order('created_at').limit(1).single()
    if (wishlistError || !wishlist) throw wishlistError ?? new Error('WISHLIST_NOT_FOUND')

    const slugBase = slugify(input.name) || 'item'
    const { data: product, error: productError } = await admin
      .from('products')
      .insert({
        slug: `${slugBase}-${randomUUID().slice(0, 8)}`,
        name: input.name.trim(),
        brand: clean(input.brand),
        category: input.category ?? 'other',
        image_url: clean(input.imageUrl),
      })
      .select('id')
      .single()
    if (productError) throw productError
    productId = product.id as string

    if (input.imageUrl?.trim()) {
      const { error } = await admin.from('product_images').insert({
        product_id: productId,
        image_url: input.imageUrl.trim(),
        is_primary: true,
      })
      if (error) throw error
    }

    if (input.productUrl?.trim() && input.price !== undefined) {
      const { data: offer, error: offerError } = await admin
        .from('product_offers')
        .insert({
          product_id: productId,
          store: clean(input.store) ?? domainLabel(input.productUrl),
          store_url: input.productUrl.trim(),
          current_price: input.price,
          currency: input.currency ?? 'EUR',
          availability: 'unknown',
          variant_size: clean(input.desiredSize),
          variant_color: clean(input.desiredColor),
          last_checked_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (offerError) throw offerError
      const { error: observationError } = await admin.from('price_observations').insert({
        product_offer_id: offer.id,
        price: input.price,
        currency: input.currency ?? 'EUR',
        availability: 'unknown',
      })
      if (observationError) throw observationError
    }

    const { error: itemError } = await admin.from('wishlist_items').insert({
      wishlist_id: wishlist.id,
      product_id: productId,
      source_type: 'manual_url',
      priority: input.priority ?? 'medium',
      status: 'wanted',
      desired_size: clean(input.desiredSize),
      desired_color: clean(input.desiredColor),
      notes: clean(input.notes),
      resolution_status: 'resolved',
      match_type: 'exact',
      confidence: 1,
      manual_override: true,
    })
    if (itemError) throw itemError

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (productId) await createSupabaseAdminClient().from('products').delete().eq('id', productId)
    return serverError(error)
  }
}

function toWishlistItem(row: Record<string, any>) {
  const pin = row.pinterest_pins as Record<string, any> | null
  const persistedProduct = row.products as Record<string, any> | null
  const product = persistedProduct ?? {
    id: `unresolved-${row.id}`,
    slug: `unresolved-${row.id}`,
    name: pin?.title || 'Pin pendiente de identificar',
    brand: null,
    category: 'other',
    image_url: pin?.image_url,
    description: pin?.description,
    product_images: [],
    product_offers: [],
  }
  return {
    id: row.id,
    wishlistId: row.wishlist_id,
    productId: row.product_id,
    pinterestPinId: pin?.pinterest_pin_id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    sourceItemId: row.source_item_id,
    priority: row.priority,
    status: row.status,
    desiredSize: row.desired_size,
    desiredColor: row.desired_color,
    notes: row.notes,
    possibleDuplicateOf: row.possible_duplicate_of,
    resolutionStatus: row.resolution_status,
    confidence: Number(row.confidence ?? 0),
    manualOverride: Boolean(row.manual_override),
    pinUrl: pin?.pin_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand ?? undefined,
      category: product.category,
      imageUrl: product.image_url ?? undefined,
      description: product.description ?? undefined,
      images: (product.product_images ?? []).map((image: Record<string, any>) => ({
        id: image.id, url: image.image_url, alt: image.alt_text ?? undefined,
        order: image.display_order, isPrimary: image.is_primary,
      })),
      offers: (product.product_offers ?? []).map((offer: Record<string, any>) => ({
        id: offer.id,
        productId: product.id,
        store: offer.store,
        storeUrl: offer.store_url,
        currentPrice: Number(offer.current_price),
        currency: offer.currency,
        availability: offer.availability,
        variant: { size: offer.variant_size ?? undefined, color: offer.variant_color ?? undefined, sku: offer.sku ?? undefined, attributes: offer.variant_attributes },
        lastCheckedAt: offer.last_checked_at,
        priceHistory: (offer.price_observations ?? []).map((observation: Record<string, any>) => ({
          id: observation.id, productOfferId: offer.id, price: Number(observation.price),
          currency: observation.currency, availability: observation.availability, checkedAt: observation.checked_at,
        })),
      })),
    },
  }
}

function clean(value?: string) { return value?.trim() || null }
function slugify(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function domainLabel(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return 'Tienda' }
}
