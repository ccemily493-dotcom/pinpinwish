import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { sanitizeFilename } from '@pinpinwish/shared'
import { getDefaultImagesDir } from '@pinpinwish/pinterest-connector'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params
    const safeName = sanitizeFilename(filename)
    const imagesDir = getDefaultImagesDir()
    const filePath = path.join(imagesDir, safeName)

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Image not found', { status: 404 })
    }

    const ext = path.extname(safeName).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'image/jpeg'
    const fileBuffer = fs.readFileSync(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Internal error', { status: 500 })
  }
}
