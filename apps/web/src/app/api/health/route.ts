import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/env/public'
import { isPinterestConfigured, isServerSupabaseConfigured } from '@/lib/env/server'

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: isServerSupabaseConfigured() ? 'cloud' : 'local-demo',
    services: {
      supabasePublic: isSupabaseConfigured(),
      supabaseServer: isServerSupabaseConfigured(),
      pinterest: isPinterestConfigured(),
    },
  })
}
