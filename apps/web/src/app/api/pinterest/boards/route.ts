import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api-response'
import {
  createPinterestClient,
  getPinterestConnection,
  getValidPinterestAccessToken,
} from '@/lib/pinterest/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const user = await requireUser()
    const connection = await getPinterestConnection(user.id)
    if (!connection) return NextResponse.json({ ok: true, connected: false, boards: [] })

    const accessToken = await getValidPinterestAccessToken(connection)
    const client = createPinterestClient()
    const boards = []
    let bookmark: string | undefined
    do {
      const page = await client.listBoards(accessToken, bookmark)
      boards.push(...page.items)
      bookmark = page.bookmark
    } while (bookmark)

    const admin = createSupabaseAdminClient()
    if (boards.length) {
      const { error } = await admin.from('pinterest_boards').upsert(
        boards.map((board) => ({
          connection_id: connection.id,
          user_id: user.id,
          pinterest_board_id: board.id,
          name: board.name,
          description: board.description ?? null,
          url: board.url ?? null,
          image_url: board.imageUrl ?? null,
          pin_count: board.pinCount,
        })),
        { onConflict: 'connection_id,pinterest_board_id' },
      )
      if (error) throw error
    }

    const { data, error } = await admin
      .from('pinterest_boards')
      .select('id, pinterest_board_id, name, description, url, image_url, pin_count, last_synced_at')
      .eq('connection_id', connection.id)
      .order('name')
    if (error) throw error

    return NextResponse.json({ ok: true, connected: true, boards: data ?? [] })
  } catch (error) {
    return serverError(error)
  }
}
