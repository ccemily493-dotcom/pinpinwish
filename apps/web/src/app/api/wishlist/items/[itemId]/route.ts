import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { updateWishlistItem } from '@/lib/db/repository'
import type { Availability, Category, Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params
    const body = (await request.json()) as {
      priority?: Priority
      status?: WishlistItemStatus
      desiredSize?: string
      desiredColor?: string
      notes?: string
      name?: string
      brand?: string
      category?: Category
      imageUrl?: string
      localImagePath?: string
      description?: string
      price?: number
      currency?: Currency
      store?: string
      storeUrl?: string
      availability?: Availability
    }

    const updated = updateWishlistItem(itemId, body)
    if (!updated) {
      return apiError('No se encontró el artículo.', 404, 'ITEM_NOT_FOUND')
    }

    return NextResponse.json({ ok: true, item: updated })
  } catch (error) {
    return serverError(error)
  }
}
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params
    const success = (await import('@/lib/db/repository')).deleteWishlistItem(itemId)
    if (!success) {
      return apiError('No se encontró el artículo a eliminar.', 404, 'ITEM_NOT_FOUND')
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(error)
  }
}
