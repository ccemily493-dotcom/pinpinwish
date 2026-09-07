import { URL } from 'node:url'

/**
 * Checks if an IP or hostname is private / loopback / internal.
 * Used to protect against Server-Side Request Forgery (SSRF).
 */
export function isPrivateOrInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '')

  // Loopback and local names
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '::'
  ) {
    return true
  }

  if (host.startsWith('::ffff:')) {
    return isPrivateOrInternalHost(host.slice('::ffff:'.length))
  }

  // IPv4 checks
  // 127.0.0.0/8 (Loopback)
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  // 10.0.0.0/8 (Private)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  // 172.16.0.0/12 (Private)
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  // 192.168.0.0/16 (Private)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  // 169.254.0.0/16 (Link-local / Cloud metadata)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(host)) return true

  // IPv6 link-local / unique local
  if (
    host.startsWith('fe8') ||
    host.startsWith('fe9') ||
    host.startsWith('fea') ||
    host.startsWith('feb') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('ff') ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.')
  ) {
    return true
  }

  return false
}

/**
 * Checks if a URL is safe to fetch externally (HTTP/HTTPS only, non-private host).
 */
export function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    return !isPrivateOrInternalHost(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Validates that a URL is a Pinterest board or pin URL.
 */
export function isPinterestUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname.toLowerCase()
    return (
      hostname === 'pinterest.com' ||
      hostname.endsWith('.pinterest.com') ||
      hostname === 'pinterest.es' ||
      hostname.endsWith('.pinterest.es') ||
      hostname === 'pinterest.fr' ||
      hostname.endsWith('.pinterest.fr') ||
      hostname === 'pinterest.co.uk' ||
      hostname.endsWith('.pinterest.co.uk') ||
      hostname === 'pinterest.de' ||
      hostname.endsWith('.pinterest.de') ||
      hostname === 'pin.it'
    )
  } catch {
    return false
  }
}

export interface ParsedPinterestBoard {
  username: string
  boardSlug: string
  canonicalUrl: string
}

/**
 * Parses a Pinterest board URL into username and board slug.
 * Supported patterns:
 * - https://www.pinterest.com/username/board-name/
 * - https://pinterest.com/username/board-name
 * - https://pin.it/... (resolves dynamically or returns generic)
 */
export function parsePinterestBoardUrl(urlStr: string): ParsedPinterestBoard | null {
  if (!isPinterestUrl(urlStr)) return null
  try {
    const parsed = new URL(urlStr)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 2) return null

    const [username, boardSlug] = segments
    if (!username || !boardSlug) return null

    // Filter out reserved paths
    const reserved = ['pin', 'search', 'settings', 'ideas', 'today', 'explore', 'notifications', '_']
    if (reserved.includes(username.toLowerCase()) || reserved.includes(boardSlug.toLowerCase())) {
      return null
    }

    const cleanUsername = username.replace(/^@/, '')
    const cleanSlug = boardSlug.replace(/\/$/, '')
    const canonicalUrl = `https://www.pinterest.com/${cleanUsername}/${cleanSlug}/`

    return {
      username: cleanUsername,
      boardSlug: cleanSlug,
      canonicalUrl,
    }
  } catch {
    return null
  }
}

/**
 * Sanitizes a filename to prevent directory traversal or invalid characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .slice(0, 100)
}
