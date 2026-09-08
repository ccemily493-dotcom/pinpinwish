import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { addProductToPin, getWishlistPinsWithProducts } from '@/lib/db/repository'
import { fetchExternalHtml, parseHtmlMetadata } from '@pinpinwish/product-resolver'
import { downloadPinImage } from '@pinpinwish/pinterest-connector'
import { isSafeExternalUrl } from '@pinpinwish/shared'
import type { Category, Currency, Priority } from '@pinpinwish/shared'
import { assessDroppedProductResolution } from '@/lib/drop-resolution'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pinId: string }> }
) {
  try {
    const { pinId } = await context.params
    const body = (await request.json()) as {
      url?: string
      imageUrl?: string
      title?: string
      priority?: Priority
      category?: Category
    }

    const url = body.url?.trim()
    const fallbackImageUrl = body.imageUrl?.trim()
    const fallbackTitle = body.title?.trim()

    if (!url && !fallbackImageUrl && !fallbackTitle) {
      return apiError('Debes proporcionar una URL de producto o imagen.', 400, 'INVALID_INPUT')
    }

    if (url && !isSafeExternalUrl(url)) {
      return apiError('La URL del producto no es una dirección web pública y segura.', 400, 'UNSAFE_URL')
    }
    if (fallbackImageUrl && !isSafeExternalUrl(fallbackImageUrl)) {
      return apiError('La URL de la imagen no es una dirección web pública y segura.', 400, 'UNSAFE_IMAGE_URL')
    }

    let parsedName = fallbackTitle
    let parsedBrand: string | undefined
    let parsedCategory: Category = body.category || 'other'
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
          if (meta.category && !body.category) parsedCategory = meta.category
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
        console.warn(`[add-product-to-pin] Error parsing external URL ${url}:`, fetchErr)
      }
    }

    const finalName = parsedName || 'Producto del Pin'

    // Try downloading image locally
    let localImagePath: string | undefined
    if (parsedImageUrl && parsedImageUrl.startsWith('http')) {
      try {
        const downloadRes = await downloadPinImage(parsedImageUrl, `pin_${pinId}_${Date.now()}`, { timeoutMs: 8000 })
        if (downloadRes) {
          localImagePath = downloadRes.localImagePath
        }
      } catch {
        // Non-fatal
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

    const item = addProductToPin(pinId, {
      name: finalName,
      brand: parsedBrand,
      category: parsedCategory,
      imageUrl: parsedImageUrl,
      localImagePath,
      description: parsedDescription,
      priority: body.priority || 'medium',
      offers: offers.length > 0 ? offers : undefined,
      resolution: assessDroppedProductResolution({
        sourceType: 'pinterest',
        safeProductUrl: Boolean(targetStoreUrl),
        metadataName,
        metadataBrand,
        metadataImage,
        metadataPrice,
      }),
    })

    const updatedPins = getWishlistPinsWithProducts()

    return NextResponse.json({ ok: true, item, pins: updatedPins })
  } catch (error) {
    return serverError(error)
  }
}
