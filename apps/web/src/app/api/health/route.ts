import { NextResponse } from 'next/server'
import { getDatabasePath } from '@/lib/db/connection'

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: 'local',
    services: {
      sqlite: true,
      pinterestAutomation: true,
      visualSearch: 'automatic',
    },
    database: getDatabasePath().split(/[\\/]/).pop(),
  })
}
