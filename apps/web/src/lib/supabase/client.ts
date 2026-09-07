'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseEnv } from '@/lib/env/public'

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getPublicSupabaseEnv()
  return createBrowserClient(url, anonKey)
}
