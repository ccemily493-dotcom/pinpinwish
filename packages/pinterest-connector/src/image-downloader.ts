import * as fs from 'node:fs'
import * as path from 'node:path'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import {
  computeImageHash,
  isSafeExternalUrl,
  isPrivateOrInternalHost,
  sanitizeFilename,
} from '@pinpinwish/shared'
import { getDefaultImagesDir } from './browser-session'

export interface DownloadImageResult {
  localImagePath: string
  imageHash: string
  fileSize: number
  mimeType: string
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // 15MB

async function isSafeResolvedUrl(url: string): Promise<boolean> {
  if (!isSafeExternalUrl(url)) return false
  try {
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '')
    if (isIP(hostname)) return !isPrivateOrInternalHost(hostname)
    const addresses = await lookup(hostname, { all: true, verbatim: true })
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateOrInternalHost(address))
  } catch {
    return false
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
}

/**
 * Downloads a Pin image to a local directory with SSRF protection, size validation, and hash computation.
 */
export async function downloadPinImage(
  imageUrl: string,
  pinId: string,
  options: {
    outputDir?: string
    timeoutMs?: number
    signal?: AbortSignal
  } = {}
): Promise<DownloadImageResult | null> {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    return null
  }

  if (!isSafeExternalUrl(imageUrl)) {
    console.warn(`[image-downloader] Blocked SSRF URL for image download: ${imageUrl}`)
    return null
  }

  const outputDir = options.outputDir || getDefaultImagesDir()
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timeoutMs = options.timeoutMs ?? 10000

  try {
    let currentUrl = imageUrl
    let response: Response | undefined

    for (let redirects = 0; redirects <= 5; redirects++) {
      if (!(await isSafeResolvedUrl(currentUrl))) return null

      const signals = [AbortSignal.timeout(timeoutMs)]
      if (options.signal) signals.push(options.signal)

      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.any(signals),
      })

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location) return null
        currentUrl = new URL(location, currentUrl).toString()
        response = undefined
        continue
      }
      break
    }

    if (!response?.ok || !response.body) {
      return null
    }

    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) return null

    const contentType = (response.headers.get('content-type') || '').split(';')[0]?.toLowerCase().trim() || ''
    const ext = MIME_EXTENSIONS[contentType]
    if (!ext) return null

    const chunks: Uint8Array[] = []
    let receivedBytes = 0
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_IMAGE_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }

    const buffer = Buffer.concat(chunks)

    const imageHash = computeImageHash(buffer)
    const safePinId = sanitizeFilename(pinId)
    const filename = `pin_${safePinId}_${imageHash.slice(0, 8)}${ext}`
    const localImagePath = path.join(outputDir, filename)

    // Save locally
    fs.writeFileSync(localImagePath, buffer)

    return {
      localImagePath,
      imageHash,
      fileSize: buffer.length,
      mimeType: contentType,
    }
  } catch {
    return null
  }
}
