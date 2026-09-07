import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { resolveWishlistItemManually } from '@/lib/db/repository'
import type { Category, Currency } from '@pinpinwish/shared'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params
    const body = (await request.json()) as {
      name?: string
      brand?: string
      category?: Category
      imageUrl?: string
      productUrl?: string
      store?: string
      price?: number
      currency?: Currency
      action?: 'resolve' | 'none'
    }

    const updated = resolveWishlistItemManually(itemId, body)
    if (!updated) {
      return apiError('No se encontró el artículo.', 404, 'ITEM_NOT_FOUND')
    }

    return NextResponse.json({ ok: true, item: updated })
  } catch (error) {
    return serverError(error)
  }
}
