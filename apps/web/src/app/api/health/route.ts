import { NextResponse } from 'next/server'
import { getDatabasePath } from '@/lib/db/connection'

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: 'local',
    services: {
      sqlite: true,
      pinterestAutomation: true,
      visualSearch: {
        provider: 'serpapi-google-lens',
        configured: Boolean(process.env.SERPAPI_API_KEY?.trim()),
      },
    },
    database: getDatabasePath().split(/[\\/]/).pop(),
  })
}
