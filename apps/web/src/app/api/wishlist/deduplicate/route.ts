import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api-response'
import { deduplicateWishlist } from '@/lib/db/repository'

export async function POST() {
  try {
    const result = deduplicateWishlist()
    return NextResponse.json({
      ok: true,
      removedCount: result.removedCount,
      mergedCount: result.mergedCount,
      message:
        result.removedCount > 0
          ? `Se han eliminado ${result.removedCount} producto(s) duplicado(s).`
          : 'No se encontraron duplicados en tu wishlist.',
    })
  } catch (error) {
    return serverError(error)
  }
}
