import { isSupabaseConfigured } from './public'

export interface PinterestServerEnv {
  clientId: string
  clientSecret: string
  redirectUri: string
  encryptionKey: string
}

export function isPinterestConfigured(): boolean {
  return Boolean(
    process.env.PINTEREST_CLIENT_ID &&
    process.env.PINTEREST_CLIENT_SECRET &&
    process.env.PINTEREST_REDIRECT_URI &&
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
  )
}

export function isServerSupabaseConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getPinterestServerEnv(): PinterestServerEnv {
  const clientId = process.env.PINTEREST_CLIENT_ID
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET
  const redirectUri = process.env.PINTEREST_REDIRECT_URI
  const encryptionKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY

  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    throw new Error('Pinterest OAuth is not fully configured on the server.')
  }
  return { clientId, clientSecret, redirectUri, encryptionKey }
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  return key
}
