import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'

type ResolutionInput = {
  action?: 'resolve' | 'none'
  name?: string
  brand?: string
  category?: string
  imageUrl?: string
  productUrl?: string
  store?: string
  price?: number
  currency?: string
}

export async function POST(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  let productId: string | undefined
  try {
    const user = await requireUser()
    const { itemId } = await context.params
    const input = (await request.json()) as ResolutionInput
    const admin = createSupabaseAdminClient()
    const { data: item, error: itemError } = await admin.from('wishlist_items').select('wishlist_id, pinterest_pin_id').eq('id', itemId).single()
    if (itemError || !item) return apiError('No se encontró el Pin.', 404, 'ITEM_NOT_FOUND')
    const { data: wishlist } = await admin.from('wishlists').select('id').eq('id', item.wishlist_id).eq('user_id', user.id).maybeSingle()
    if (!wishlist) return apiError('No puedes editar este Pin.', 403, 'FORBIDDEN')

    if (input.action === 'none') {
      const { error } = await admin.from('wishlist_items').update({
        status: 'removed', manual_override: true, resolution_status: 'needs_review', match_type: 'unresolved', confidence: 0,
      }).eq('id', itemId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (!input.name?.trim()) return apiError('Añade el nombre del producto.', 422, 'NAME_REQUIRED')
    const slug = `${slugify(input.name) || 'product'}-${randomUUID().slice(0, 8)}`
    const { data: product, error: productError } = await admin.from('products').insert({
      slug,
      name: input.name.trim(),
      brand: clean(input.brand),
      category: allowedCategory(input.category),
      image_url: clean(input.imageUrl),
    }).select('id').single()
    if (productError) throw productError
    productId = product.id as string

    if (input.imageUrl?.trim()) {
      const { error } = await admin.from('product_images').insert({ product_id: productId, image_url: input.imageUrl.trim(), is_primary: true })
      if (error) throw error
    }
    if (input.productUrl?.trim() && input.price !== undefined && Number.isFinite(input.price) && input.price >= 0) {
      const { data: offer, error } = await admin.from('product_offers').insert({
        product_id: productId,
        store: clean(input.store) ?? domainLabel(input.productUrl),
        store_url: input.productUrl.trim(),
        current_price: input.price,
        currency: input.currency ?? 'EUR',
        availability: 'unknown',
        last_checked_at: new Date().toISOString(),
      }).select('id').single()
      if (error) throw error
      const { error: observationError } = await admin.from('price_observations').insert({
        product_offer_id: offer.id, price: input.price, currency: input.currency ?? 'EUR', availability: 'unknown',
      })
      if (observationError) throw observationError
    }

    const { error } = await admin.from('wishlist_items').update({
      product_id: productId,
      resolution_status: 'resolved',
      match_type: 'exact',
      confidence: 1,
      manual_override: true,
    }).eq('id', itemId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (productId) await createSupabaseAdminClient().from('products').delete().eq('id', productId)
    return serverError(error)
  }
}

function clean(value?: string) { return value?.trim() || null }
function slugify(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function allowedCategory(value?: string) { return ['clothes', 'shoes', 'beauty', 'home', 'other'].includes(value ?? '') ? value : 'other' }
function domainLabel(value: string) { try { return new URL(value).hostname.replace(/^www\./, '') } catch { return 'Tienda' } }
