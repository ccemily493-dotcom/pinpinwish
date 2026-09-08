import { NextResponse } from 'next/server'
import { clearAllProducts } from '@/lib/db/repository'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = clearAllProducts()
    return NextResponse.json({
      ok: true,
      ...result,
      message: `Se han limpiado ${result.clearedProductsCount} productos. Todos los Pines se conservan para que añadas tus productos desde cero.`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Error al limpiar los productos.',
      },
      { status: 500 }
    )
  }
}
