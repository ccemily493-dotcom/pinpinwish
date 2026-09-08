import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api-response'
import { getWishlistPinsWithProducts } from '@/lib/db/repository'

export async function GET() {
  try {
    const pins = getWishlistPinsWithProducts()
    return NextResponse.json({ ok: true, pins })
  } catch (error) {
    return serverError(error)
  }
}
