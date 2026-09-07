import { NextResponse, type NextRequest } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as { boardId?: string; wishlistId?: string }
    if (!body.boardId) return apiError('Selecciona un tablero.', 422, 'BOARD_REQUIRED')

    const admin = createSupabaseAdminClient()
    const { data: board, error: boardError } = await admin
      .from('pinterest_boards')
      .select('id, connection_id, pin_count')
      .eq('id', body.boardId)
      .eq('user_id', user.id)
      .single()
    if (boardError || !board) return apiError('No se encontró ese tablero.', 404, 'BOARD_NOT_FOUND')

    const { data: connection, error: connectionError } = await admin
      .from('pinterest_connections')
      .select('source_id')
      .eq('id', board.connection_id)
      .eq('user_id', user.id)
      .single()
    if (connectionError || !connection) return apiError('Conecta Pinterest de nuevo.', 409, 'CONNECTION_NOT_FOUND')

    let wishlistId = body.wishlistId
    if (wishlistId) {
      const { data: wishlist } = await admin.from('wishlists').select('id').eq('id', wishlistId).eq('user_id', user.id).maybeSingle()
      if (!wishlist) return apiError('La wishlist indicada no existe.', 404, 'WISHLIST_NOT_FOUND')
    } else {
      const { data: wishlist, error: wishlistError } = await admin
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at')
        .limit(1)
        .single()
      if (wishlistError || !wishlist) throw wishlistError ?? new Error('WISHLIST_NOT_FOUND')
      wishlistId = wishlist.id as string
    }

    const { data: running } = await admin
      .from('import_jobs')
      .select('*')
      .eq('user_id', user.id)
      .eq('board_id', board.id)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (running) return NextResponse.json({ ok: true, job: running, resumed: true })

    const { data: job, error: jobError } = await admin
      .from('import_jobs')
      .insert({
        user_id: user.id,
        wishlist_id: wishlistId,
        source_id: connection.source_id,
        board_id: board.id,
        status: 'pending',
        total_count: board.pin_count,
      })
      .select('*')
      .single()
    if (jobError) throw jobError

    const { error: boardUpdateError } = await admin
      .from('pinterest_boards')
      .update({ selected_for_wishlist_id: wishlistId, is_syncing: true })
      .eq('id', board.id)
    if (boardUpdateError) throw boardUpdateError

    return NextResponse.json({ ok: true, job, resumed: false }, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
