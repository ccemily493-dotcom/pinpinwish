import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { deleteWishlistPin, archiveWishlistPin, restoreWishlistPin } from '@/lib/db/repository'

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ pinId: string }> }
) {
  try {
    const { pinId } = await context.params
    const decodedPinId = decodeURIComponent(pinId)
    const success = deleteWishlistPin(decodedPinId)
    if (!success) {
      return apiError('No se encontró el Pin a eliminar.', 404, 'PIN_NOT_FOUND')
    }
    return NextResponse.json({ ok: true, message: 'Pin y prendas eliminados permanentemente.' })
  } catch (error) {
    return serverError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pinId: string }> }
) {
  try {
    const { pinId } = await context.params
    const decodedPinId = decodeURIComponent(pinId)
    const body = (await request.json()) as { action?: 'archive' | 'restore'; status?: 'archived' | 'wanted' }

    if (body.action === 'archive' || body.status === 'archived') {
      if (!archiveWishlistPin(decodedPinId)) {
        return apiError('No se encontró el Pin a archivar.', 404, 'PIN_NOT_FOUND')
      }
      return NextResponse.json({ ok: true, message: 'Pin mandado al baúl.' })
    }

    if (body.action === 'restore' || body.status === 'wanted') {
      if (!restoreWishlistPin(decodedPinId)) {
        return apiError('No se encontró el Pin a restaurar.', 404, 'PIN_NOT_FOUND')
      }
      return NextResponse.json({ ok: true, message: 'Pin restaurado a la wishlist.' })
    }

    return apiError('Acción no válida. Usa archive o restore.', 400, 'INVALID_ACTION')
  } catch (error) {
    return serverError(error)
  }
}
