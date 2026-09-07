import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { parsePinterestBoardUrl } from '@pinpinwish/shared'
import { startImportJobAsync } from '@/lib/import-worker'
import { ensureImportJobActive } from '@/lib/import-worker'
import { getLatestActiveImportJob } from '@/lib/db/repository'

export async function GET() {
  try {
    const job = getLatestActiveImportJob()
    if (job) ensureImportJobActive(job.id)
    return NextResponse.json({ ok: true, job })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      boardUrl?: string
      boardId?: string
      enableVisualSearch?: boolean
      wishlistId?: string
    }

    const boardUrl = body.boardUrl?.trim()
    if (!boardUrl) {
      return apiError('Ingresa la URL del tablero de Pinterest.', 422, 'BOARD_URL_REQUIRED')
    }

    if (!parsePinterestBoardUrl(boardUrl)) {
      return apiError(
        'La URL debe ser un enlace válido de un tablero de Pinterest (ej. https://www.pinterest.com/usuario/tablero/).',
        422,
        'INVALID_PINTEREST_URL'
      )
    }

    const job = await startImportJobAsync(boardUrl, {
      wishlistId: body.wishlistId,
      enableVisualSearch: Boolean(body.enableVisualSearch),
    })

    return NextResponse.json({ ok: true, job }, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
