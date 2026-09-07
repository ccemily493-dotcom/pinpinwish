import {
  OfficialPinterestClient,
  decryptSecret,
  encryptSecret,
  type PinterestTokenResponse,
} from '@pinpinwish/pinterest-connector'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getPinterestServerEnv } from '@/lib/env/server'

export const PINTEREST_SCOPES = ['boards:read', 'pins:read', 'user_accounts:read']

export type PinterestConnectionRow = {
  id: string
  user_id: string
  source_id: string
  pinterest_user_id: string
  access_token_ciphertext: string
  access_token_iv: string
  access_token_auth_tag: string
  access_token_key_version: number
  refresh_token_ciphertext: string | null
  refresh_token_iv: string | null
  refresh_token_auth_tag: string | null
  refresh_token_key_version: number | null
  token_expires_at: string | null
  scopes: string[]
}

export function createPinterestClient() {
  const env = getPinterestServerEnv()
  return new OfficialPinterestClient({
    oauth: {
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      redirectUri: env.redirectUri,
      scopes: PINTEREST_SCOPES,
    },
  })
}

export async function getPinterestConnection(userId: string): Promise<PinterestConnectionRow | null> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('pinterest_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as PinterestConnectionRow | null
}

export async function getValidPinterestAccessToken(connection: PinterestConnectionRow): Promise<string> {
  const env = getPinterestServerEnv()
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  const stillValid = expiresAt > Date.now() + 60_000

  if (stillValid) {
    return decryptSecret(
      {
        ciphertext: connection.access_token_ciphertext,
        iv: connection.access_token_iv,
        authTag: connection.access_token_auth_tag,
        keyVersion: connection.access_token_key_version,
      },
      env.encryptionKey,
    )
  }

  if (
    !connection.refresh_token_ciphertext ||
    !connection.refresh_token_iv ||
    !connection.refresh_token_auth_tag ||
    !connection.refresh_token_key_version
  ) {
    throw new Error('PINTEREST_RECONNECT_REQUIRED')
  }

  const refreshToken = decryptSecret(
    {
      ciphertext: connection.refresh_token_ciphertext,
      iv: connection.refresh_token_iv,
      authTag: connection.refresh_token_auth_tag,
      keyVersion: connection.refresh_token_key_version,
    },
    env.encryptionKey,
  )
  const token = await createPinterestClient().refreshAccessToken(refreshToken)
  await persistRefreshedToken(connection.id, token)
  return token.accessToken
}

async function persistRefreshedToken(connectionId: string, token: PinterestTokenResponse) {
  const env = getPinterestServerEnv()
  const access = encryptSecret(token.accessToken, env.encryptionKey)
  const refresh = token.refreshToken ? encryptSecret(token.refreshToken, env.encryptionKey) : null
  const admin = createSupabaseAdminClient()
  const updates: Record<string, unknown> = {
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    access_token_auth_tag: access.authTag,
    access_token_key_version: access.keyVersion,
    token_expires_at: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
    scopes: token.scopes,
  }
  if (refresh) {
    updates.refresh_token_ciphertext = refresh.ciphertext
    updates.refresh_token_iv = refresh.iv
    updates.refresh_token_auth_tag = refresh.authTag
    updates.refresh_token_key_version = refresh.keyVersion
  }

  const { error } = await admin.from('pinterest_connections').update(updates).eq('id', connectionId)
  if (error) throw error
}
