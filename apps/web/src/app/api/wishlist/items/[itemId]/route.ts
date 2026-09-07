import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'

const PRIORITIES = new Set(['low', 'medium', 'high', 'dream'])
const STATUSES = new Set(['wanted', 'purchased', 'removed'])

export async function PATCH(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  try {
    const user = await requireUser()
    const { itemId } = await context.params
    const input = (await request.json()) as Record<string, unknown>
    const admin = createSupabaseAdminClient()
    const { data: item, error: itemError } = await admin.from('wishlist_items').select('wishlist_id').eq('id', itemId).single()
    if (itemError || !item) return apiError('No se encontró el artículo.', 404, 'ITEM_NOT_FOUND')
    const { data: wishlist } = await admin.from('wishlists').select('id').eq('id', item.wishlist_id).eq('user_id', user.id).maybeSingle()
    if (!wishlist) return apiError('No puedes editar este artículo.', 403, 'FORBIDDEN')

    const updates: Record<string, unknown> = {}
    if (typeof input.priority === 'string' && PRIORITIES.has(input.priority)) updates.priority = input.priority
    if (typeof input.status === 'string' && STATUSES.has(input.status)) updates.status = input.status
    if ('desiredSize' in input) updates.desired_size = clean(input.desiredSize)
    if ('desiredColor' in input) updates.desired_color = clean(input.desiredColor)
    if ('notes' in input) updates.notes = clean(input.notes)
    if (!Object.keys(updates).length) return apiError('No hay cambios válidos.', 422, 'NO_VALID_CHANGES')

    const { error } = await admin.from('wishlist_items').update(updates).eq('id', itemId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(error)
  }
}

function clean(value: unknown) { return typeof value === 'string' ? value.trim() || null : null }
