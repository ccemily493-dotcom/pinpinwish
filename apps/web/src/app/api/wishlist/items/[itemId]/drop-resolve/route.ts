import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { resolveWishlistItemWithProductData, getWishlistItemById } from '@/lib/db/repository'
import { fetchExternalHtml, parseHtmlMetadata } from '@pinpinwish/product-resolver'
import { downloadPinImage } from '@pinpinwish/pinterest-connector'
import { isSafeExternalUrl } from '@pinpinwish/shared'
import type { Category, Currency } from '@pinpinwish/shared'
import { assessDroppedProductResolution } from '@/lib/drop-resolution'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params
    const body = (await request.json()) as {
      url?: string
      imageUrl?: string
      title?: string
    }

    const existing = getWishlistItemById(itemId)
    if (!existing) {
      return apiError('No se encontró el artículo en la wishlist.', 404, 'ITEM_NOT_FOUND')
    }

    const url = body.url?.trim()
    const fallbackImageUrl = body.imageUrl?.trim()
    const fallbackTitle = body.title?.trim()

    if (!url && !fallbackImageUrl) {
      return apiError('Debes proporcionar una URL de producto o una imagen para resolver.', 400, 'INVALID_INPUT')
    }

    if (url && !isSafeExternalUrl(url)) {
      return apiError('La URL del producto no es una dirección web pública y segura.', 400, 'UNSAFE_URL')
    }
    if (fallbackImageUrl && !isSafeExternalUrl(fallbackImageUrl)) {
      return apiError('La URL de la imagen no es una dirección web pública y segura.', 400, 'UNSAFE_IMAGE_URL')
    }

    let parsedName = fallbackTitle
    let parsedBrand: string | undefined
    let parsedCategory: Category = 'other'
    let parsedImageUrl: string | undefined = fallbackImageUrl
    let parsedStore: string | undefined
    let parsedPrice: number | undefined
    let parsedCurrency: Currency = 'EUR'
    let parsedAvailability: 'in_stock' | 'out_of_stock' | 'unknown' = 'unknown'
    let parsedDescription: string | undefined
    let metadataName = false
    let metadataBrand = false
    let metadataImage = false
    let metadataPrice = false
    const targetStoreUrl: string = url && isSafeExternalUrl(url) ? url : ''

    if (url && isSafeExternalUrl(url)) {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, '')
        parsedStore = hostname

        const fetchRes = await fetchExternalHtml(url, { timeoutMs: 12000 })
        if (fetchRes?.html) {
          const meta = parseHtmlMetadata(fetchRes.html, fetchRes.finalUrl || url)
          if (meta.name) {
            parsedName = meta.name
            metadataName = true
          }
          if (meta.brand) {
            parsedBrand = meta.brand
            metadataBrand = true
          }
          if (meta.category) parsedCategory = meta.category
          if (meta.imageUrl && isSafeExternalUrl(meta.imageUrl)) {
            parsedImageUrl = meta.imageUrl
            metadataImage = true
          }
          if (meta.description) parsedDescription = meta.description
          if (meta.offers && meta.offers.length > 0) {
            const firstOffer = meta.offers[0]
            if (firstOffer.store) parsedStore = firstOffer.store
            if (firstOffer.price !== undefined && firstOffer.price > 0) {
              parsedPrice = firstOffer.price
              metadataPrice = true
            }
            if (firstOffer.currency) parsedCurrency = firstOffer.currency
            if (firstOffer.availability) parsedAvailability = firstOffer.availability
          }
        }
      } catch (fetchErr) {
        console.warn(`[drop-resolve] Error parsing external URL ${url}:`, fetchErr)
      }
    }

    // Default name if still empty
    const finalName = parsedName || existing.product.name.replace(' (unidentified)', '').replace('Pin pendiente de identificar', '').trim() || 'Producto identificado'

    // Try downloading image locally if we have a remote image URL
    let localImagePath: string | undefined
    if (parsedImageUrl && parsedImageUrl.startsWith('http')) {
      try {
        const downloadRes = await downloadPinImage(parsedImageUrl, itemId, { timeoutMs: 8000 })
        if (downloadRes) {
          localImagePath = downloadRes.localImagePath
        }
      } catch {
        // Non-fatal, image URL will still work
      }
    }

    const offers = targetStoreUrl
      ? [
          {
            store: parsedStore || 'Tienda web',
            storeUrl: targetStoreUrl,
            currentPrice: parsedPrice,
            currency: parsedCurrency,
            availability: parsedAvailability,
          },
        ]
      : []

    const updated = resolveWishlistItemWithProductData(itemId, {
      name: finalName,
      brand: parsedBrand,
      category: parsedCategory,
      imageUrl: parsedImageUrl,
      localImagePath,
      description: parsedDescription,
      offers: offers.length > 0 ? offers : undefined,
      resolution: assessDroppedProductResolution({
        sourceType: existing.sourceType === 'pinterest' ? 'pinterest' : url ? 'manual_url' : 'image',
        safeProductUrl: Boolean(targetStoreUrl),
        metadataName,
        metadataBrand,
        metadataImage,
        metadataPrice,
      }),
    })

    return NextResponse.json({ ok: true, item: updated })
  } catch (error) {
    return serverError(error)
  }
}
