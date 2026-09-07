import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api-response'
import { checkPinterestSession, openPinterestLoginWindow } from '@pinpinwish/pinterest-connector'

export async function GET() {
  try {
    const status = await checkPinterestSession()
    return NextResponse.json({ ok: true, session: status })
  } catch (error) {
    return serverError(error)
  }
}

export async function POST() {
  try {
    const result = await openPinterestLoginWindow()
    const session = await checkPinterestSession()
    return NextResponse.json({ ok: true, result, session })
  } catch (error) {
    return serverError(error)
  }
}
