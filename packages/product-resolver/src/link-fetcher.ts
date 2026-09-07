import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isPrivateOrInternalHost, isSafeExternalUrl } from '@pinpinwish/shared'

export interface FetchHtmlResult {
  html: string
  finalUrl: string
  status: number
}

const MAX_HTML_BYTES = 3 * 1024 * 1024

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

/**
 * Safely fetches an external webpage's HTML with SSRF checks, redirect validation, and timeouts.
 */
export async function fetchExternalHtml(
  urlStr: string,
  options: {
    timeoutMs?: number
    maxRedirects?: number
    signal?: AbortSignal
  } = {}
): Promise<FetchHtmlResult | null> {
  const timeoutMs = options.timeoutMs ?? 8000
  const maxRedirects = options.maxRedirects ?? 5

  let currentUrl = urlStr
  let redirectCount = 0

  while (redirectCount <= maxRedirects) {
    if (!(await isSafeResolvedUrl(currentUrl))) {
      console.warn(`[link-fetcher] SSRF check blocked URL: ${currentUrl}`)
      return null
    }

    const signals = [AbortSignal.timeout(timeoutMs)]
    if (options.signal) signals.push(options.signal)

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // handle redirects manually to check SSRF on every location header
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        },
        signal: AbortSignal.any(signals),
      })

      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location) return null

        currentUrl = new URL(location, currentUrl).toString()
        redirectCount++
        continue
      }

      if (!response.ok) {
        return null
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        // Not an HTML document
        return null
      }

      const declaredLength = Number(response.headers.get('content-length') || 0)
      if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) return null

      if (!response.body) return null
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let receivedBytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        receivedBytes += value.byteLength
        if (receivedBytes > MAX_HTML_BYTES) {
          await reader.cancel()
          return null
        }
        chunks.push(value)
      }
      const html = new TextDecoder().decode(Buffer.concat(chunks))
      return {
        html,
        finalUrl: currentUrl,
        status: response.status,
      }
    } catch {
      return null
    }
  }

  return null
}
