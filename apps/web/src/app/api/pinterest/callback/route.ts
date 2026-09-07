import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { encryptSecret } from '@pinpinwish/pinterest-connector'
import { serverError } from '@/lib/api-response'
import { getPinterestServerEnv } from '@/lib/env/server'
import { createPinterestClient } from '@/lib/pinterest/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/supabase/auth'

export async function GET(request: NextRequest) {
  const destination = new URL('/onboarding', request.url)
  try {
    const user = await requireUser()
    const code = request.nextUrl.searchParams.get('code')
    const returnedState = request.nextUrl.searchParams.get('state')
    const cookieStore = await cookies()
    const expectedState = cookieStore.get('pinpinwish_pinterest_oauth_state')?.value
    cookieStore.delete('pinpinwish_pinterest_oauth_state')

    if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
      destination.searchParams.set('error', 'oauth_state_invalid')
      return NextResponse.redirect(destination)
    }

    const client = createPinterestClient()
    const token = await client.exchangeCode(code)
    const account = await client.getUserAccount(token.accessToken)
    const env = getPinterestServerEnv()
    const access = encryptSecret(token.accessToken, env.encryptionKey)
    const refresh = token.refreshToken ? encryptSecret(token.refreshToken, env.encryptionKey) : null
    const admin = createSupabaseAdminClient()

    const { data: existing, error: existingError } = await admin
      .from('pinterest_connections')
      .select('id, source_id')
      .eq('user_id', user.id)
      .eq('pinterest_user_id', account.username)
      .maybeSingle()
    if (existingError) throw existingError

    let sourceId = existing?.source_id as string | undefined
    let createdSource = false
    if (!sourceId) {
      const { data: source, error: sourceError } = await admin
        .from('wishlist_sources')
        .insert({ user_id: user.id, source_type: 'pinterest', label: `Pinterest · @${account.username}` })
        .select('id')
        .single()
      if (sourceError) throw sourceError
      sourceId = source.id as string
      createdSource = true
    }

    const payload = {
      user_id: user.id,
      source_id: sourceId,
      pinterest_user_id: account.username,
      access_token_ciphertext: access.ciphertext,
      access_token_iv: access.iv,
      access_token_auth_tag: access.authTag,
      access_token_key_version: access.keyVersion,
      refresh_token_ciphertext: refresh?.ciphertext ?? null,
      refresh_token_iv: refresh?.iv ?? null,
      refresh_token_auth_tag: refresh?.authTag ?? null,
      refresh_token_key_version: refresh?.keyVersion ?? null,
      token_expires_at: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
      scopes: token.scopes,
    }
    const query = existing?.id
      ? admin.from('pinterest_connections').update(payload).eq('id', existing.id)
      : admin.from('pinterest_connections').insert(payload)
    const { error } = await query
    if (error) {
      if (createdSource) await admin.from('wishlist_sources').delete().eq('id', sourceId)
      throw error
    }

    destination.searchParams.set('connected', '1')
    return NextResponse.redirect(destination)
  } catch (error) {
    const response = serverError(error)
    if (response.status === 401) return NextResponse.redirect(new URL('/login', request.url))
    destination.searchParams.set('error', 'pinterest_connection_failed')
    return NextResponse.redirect(destination)
  }
}
