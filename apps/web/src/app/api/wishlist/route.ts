import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { getDefaultWishlist, getWishlistItems, saveResolvedProductAndItem } from '@/lib/db/repository'

type ManualItemInput = {
  name?: string
  brand?: string
  category?: 'clothes' | 'shoes' | 'beauty' | 'home' | 'other'
  imageUrl?: string
  productUrl?: string
  store?: string
  price?: number
  currency?: 'EUR' | 'USD' | 'GBP'
  priority?: 'low' | 'medium' | 'high' | 'dream'
  desiredSize?: string
  desiredColor?: string
  notes?: string
}

export async function GET() {
  try {
    const wishlist = getDefaultWishlist()
    const items = getWishlistItems(wishlist.id)

    return NextResponse.json({
      ok: true,
      wishlist: { id: wishlist.id, name: wishlist.name, currency: wishlist.currency },
      items,
    })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as ManualItemInput
    if (!input.name?.trim()) return apiError('El nombre es obligatorio.', 422, 'NAME_REQUIRED')
    if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
      return apiError('El precio no es válido.', 422, 'PRICE_INVALID')
    }

    const wishlist = getDefaultWishlist()

    saveResolvedProductAndItem({
      wishlistId: wishlist.id,
      priority: input.priority || 'medium',
      status: 'wanted',
      resolutionStatus: 'resolved',
      matchType: 'exact',
      confidence: 1,
      product: {
        name: input.name.trim(),
        brand: input.brand?.trim() || undefined,
        category: input.category || 'other',
        imageUrl: input.imageUrl?.trim() || undefined,
        offers:
          input.productUrl && input.price !== undefined
            ? [
                {
                  store: input.store?.trim() || safeDomain(input.productUrl),
                  storeUrl: input.productUrl.trim(),
                  currentPrice: input.price,
                  currency: input.currency || 'EUR',
                  availability: 'unknown',
                  variant: {
                    size: input.desiredSize?.trim() || undefined,
                    color: input.desiredColor?.trim() || undefined,
                  },
                },
              ]
            : [],
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}

function safeDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return 'Tienda'
  }
}
