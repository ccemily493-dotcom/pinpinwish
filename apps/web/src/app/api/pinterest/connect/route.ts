import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { apiError, serverError } from '@/lib/api-response'
import { isPinterestConfigured, isServerSupabaseConfigured } from '@/lib/env/server'
import { createPinterestClient } from '@/lib/pinterest/server'
import { requireUser } from '@/lib/supabase/auth'

export async function GET() {
  if (!isServerSupabaseConfigured()) return apiError('Configura Supabase antes de conectar Pinterest.', 503, 'SUPABASE_NOT_CONFIGURED')
  if (!isPinterestConfigured()) return apiError('Configura la aplicación oficial de Pinterest antes de conectarla.', 503, 'PINTEREST_NOT_CONFIGURED')

  try {
    await requireUser()
    const state = randomBytes(24).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('pinpinwish_pinterest_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    })
    return NextResponse.redirect(createPinterestClient().getAuthorizationUrl(state))
  } catch (error) {
    return serverError(error)
  }
}
