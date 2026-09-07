import { createClient } from '@supabase/supabase-js'
import { getPublicSupabaseEnv } from '@/lib/env/public'
import { getSupabaseServiceRoleKey } from '@/lib/env/server'

export function createSupabaseAdminClient() {
  const { url } = getPublicSupabaseEnv()
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
