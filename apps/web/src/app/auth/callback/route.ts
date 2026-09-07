import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/env/public'

export async function GET(request: NextRequest) {
  const destination = new URL('/wishlist', request.url)
  const code = request.nextUrl.searchParams.get('code')
  if (!isSupabaseConfigured() || !code) {
    destination.searchParams.set('auth_error', 'invalid_callback')
    return NextResponse.redirect(destination)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) destination.searchParams.set('auth_error', 'session_exchange_failed')
  return NextResponse.redirect(destination)
}
