import { NextResponse } from 'next/server'

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status })
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected server error'
  if (message === 'AUTH_REQUIRED') return apiError('Inicia sesión para continuar.', 401, message)
  if (message === 'PINTEREST_RECONNECT_REQUIRED') {
    return apiError('La conexión con Pinterest ha caducado. Vuelve a conectarla.', 401, message)
  }
  console.error('[PinPinWish API]', error)
  return apiError('No se pudo completar la operación.', 500, 'INTERNAL_ERROR')
}
