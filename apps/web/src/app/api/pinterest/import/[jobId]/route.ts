import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import {
  createPinterestClient,
  getValidPinterestAccessToken,
  type PinterestConnectionRow,
} from '@/lib/pinterest/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'

type JobRow = {
  id: string
  user_id: string
  wishlist_id: string
  source_id: string
  board_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  processed_count: number
  identified_count: number
  needs_review_count: number
  total_count: number | null
  bookmark: string | null
}

type BoardRow = {
  id: string
  connection_id: string
  pinterest_board_id: string
}

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params
  let boardId: string | undefined
  try {
    const user = await requireUser()
    const admin = createSupabaseAdminClient()
    const { data: rawJob, error: jobError } = await admin
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()
    if (jobError || !rawJob) return apiError('No se encontró la importación.', 404, 'JOB_NOT_FOUND')
    const job = rawJob as JobRow
    boardId = job.board_id
    if (job.status === 'completed') return NextResponse.json({ ok: true, job, done: true })
    if (job.status === 'failed') return apiError('Esta importación falló. Inicia una nueva sincronización.', 409, 'JOB_FAILED')

    const { data: rawBoard, error: boardError } = await admin
      .from('pinterest_boards')
      .select('id, connection_id, pinterest_board_id')
      .eq('id', job.board_id)
      .eq('user_id', user.id)
      .single()
    if (boardError || !rawBoard) throw boardError ?? new Error('BOARD_NOT_FOUND')
    const board = rawBoard as BoardRow

    const { data: rawConnection, error: connectionError } = await admin
      .from('pinterest_connections')
      .select('*')
      .eq('id', board.connection_id)
      .eq('user_id', user.id)
      .single()
    if (connectionError || !rawConnection) throw connectionError ?? new Error('CONNECTION_NOT_FOUND')

    await admin.from('import_jobs').update({ status: 'running', error_message: null }).eq('id', job.id)
    const accessToken = await getValidPinterestAccessToken(rawConnection as PinterestConnectionRow)
    const page = await createPinterestClient().listBoardPins(
      accessToken,
      board.pinterest_board_id,
      job.bookmark ?? undefined,
    )

    const pinRows = page.items.map((pin) => ({
      board_id: board.id,
      user_id: user.id,
      pinterest_pin_id: pin.id,
      title: pin.title ?? null,
      description: pin.description ?? null,
      link: pin.link ?? null,
      image_url: pin.imageUrl ?? null,
      dominant_color: pin.dominantColor ?? null,
      pin_url: `https://www.pinterest.com/pin/${pin.id}/`,
      pinned_at: pin.createdAt?.toISOString() ?? null,
      content_hash: createHash('sha256').update(JSON.stringify({
        title: pin.title ?? '', description: pin.description ?? '', link: pin.link ?? '', imageUrl: pin.imageUrl ?? '',
      })).digest('hex'),
      is_deleted: false,
      last_seen_import_job_id: job.id,
    }))

    let insertedCount = 0
    if (pinRows.length) {
      const { data: persistedPins, error: pinError } = await admin
        .from('pinterest_pins')
        .upsert(pinRows, { onConflict: 'board_id,pinterest_pin_id' })
        .select('id, pinterest_pin_id')
      if (pinError) throw pinError

      const sourceItemIds = page.items.map((pin) => pin.id)
      const { data: existingItems, error: existingError } = await admin
        .from('wishlist_items')
        .select('source_item_id')
        .eq('wishlist_id', job.wishlist_id)
        .eq('source_id', job.source_id)
        .in('source_item_id', sourceItemIds)
      if (existingError) throw existingError
      const existingIds = new Set((existingItems ?? []).map((item) => item.source_item_id as string))
      const pinIdByPinterestId = new Map((persistedPins ?? []).map((pin) => [pin.pinterest_pin_id as string, pin.id as string]))
      const newItems = page.items
        .filter((pin) => !existingIds.has(pin.id))
        .map((pin) => ({
          wishlist_id: job.wishlist_id,
          pinterest_pin_id: pinIdByPinterestId.get(pin.id),
          source_id: job.source_id,
          source_type: 'pinterest',
          source_item_id: pin.id,
          priority: 'medium',
          status: 'wanted',
          resolution_status: 'needs_review',
          match_type: 'unresolved',
          confidence: 0,
        }))
      if (newItems.length) {
        const { error: itemError } = await admin
          .from('wishlist_items')
          .upsert(newItems, { onConflict: 'wishlist_id,source_id,source_item_id', ignoreDuplicates: true })
        if (itemError) throw itemError
      }
      insertedCount = newItems.length
    }

    const done = !page.bookmark
    const processedCount = job.processed_count + page.items.length
    const needsReviewCount = job.needs_review_count + insertedCount
    const completedAt = done ? new Date().toISOString() : null
    const { data: updatedJob, error: updateError } = await admin
      .from('import_jobs')
      .update({
        status: done ? 'completed' : 'running',
        processed_count: processedCount,
        needs_review_count: needsReviewCount,
        bookmark: page.bookmark ?? null,
        completed_at: completedAt,
      })
      .eq('id', job.id)
      .select('*')
      .single()
    if (updateError) throw updateError

    if (done) {
      await admin
        .from('pinterest_pins')
        .update({ is_deleted: true })
        .eq('board_id', board.id)
        .or(`last_seen_import_job_id.is.null,last_seen_import_job_id.neq.${job.id}`)
      await admin
        .from('pinterest_boards')
        .update({ is_syncing: false, last_synced_at: completedAt, sync_bookmark: null })
        .eq('id', board.id)
      await admin
        .from('pinterest_connections')
        .update({ last_synced_at: completedAt })
        .eq('id', board.connection_id)
    }

    return NextResponse.json({ ok: true, job: updatedJob, done, imported: insertedCount })
  } catch (error) {
    if (boardId) {
      const admin = createSupabaseAdminClient()
      await admin.from('import_jobs').update({ status: 'failed', error_message: 'Import failed' }).eq('id', jobId)
      await admin.from('pinterest_boards').update({ is_syncing: false }).eq('id', boardId)
    }
    return serverError(error)
  }
}
