export interface DroppedProductPayload {
  url?: string
  imageUrl?: string
  title?: string
  rawText?: string
  hasFiles: boolean
}

/**
 * Extracts product links, image URLs, and text from standard browser DragEvent DataTransfer.
 * Handles uri-list, text/html, text/plain, and Files from across browser tabs/windows.
 */
export function extractDroppedProductPayload(
  dataTransfer: DataTransfer | null | undefined
): DroppedProductPayload {
  if (!dataTransfer) {
    return { hasFiles: false }
  }

  let url: string | undefined
  let imageUrl: string | undefined
  let title: string | undefined
  let rawText: string | undefined

  // 1. Try text/uri-list (standard for dragged links and images)
  const uriList = dataTransfer.getData('text/uri-list')
  if (uriList) {
    const lines = uriList.split('\r\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    for (const line of lines) {
      if (/^https?:\/\//i.test(line)) {
        if (isImageUrl(line)) {
          imageUrl = imageUrl || line
        } else if (!url) {
          url = line
        }
      }
    }
  }

  // 2. Try text/html (often contains rich <a> and <img> tags when dragging elements from web pages)
  const html = dataTransfer.getData('text/html')
  if (html) {
    try {
      // Extract <a href="...">
      const linkMatch = html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/i)
      if (linkMatch) {
        const href = linkMatch[1]
        if (/^https?:\/\//i.test(href) && !url) {
          url = href
        }
        const textContent = linkMatch[2]?.replace(/<[^>]+>/g, '').trim()
        if (textContent && !title) {
          title = textContent
        }
      }

      // Extract <img src="..." alt="...">
      const imgMatch = html.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i)
      if (imgMatch) {
        const src = imgMatch[1]
        if (/^https?:\/\//i.test(src) && !imageUrl) {
          imageUrl = src
        }
        const altMatch = html.match(/<img\s+[^>]*alt=["']([^"']+)["'][^>]*>/i)
        if (altMatch && altMatch[1] && !title) {
          title = altMatch[1].trim()
        }
      }
    } catch {
      // Non-fatal if HTML parsing fails
    }
  }

  // 3. Try text/plain (plain URL or dropped text)
  const text = dataTransfer.getData('text/plain')?.trim()
  if (text) {
    rawText = text
    if (!url) {
      const match = text.match(/https?:\/\/[^\s"'>]+/i)
      if (match) {
        const matchedUrl = match[0]
        if (isImageUrl(matchedUrl)) {
          imageUrl = imageUrl || matchedUrl
        } else {
          url = matchedUrl
        }
      }
    }
    if (!title && !url && text.length > 2 && text.length < 150) {
      title = text
    }
  }

  // If we only got an imageUrl but no product page URL, URL can default to imageUrl if needed
  if (!url && imageUrl) {
    url = imageUrl
  }

  const hasFiles = Boolean(dataTransfer.files && dataTransfer.files.length > 0)

  return {
    url,
    imageUrl,
    title,
    rawText,
    hasFiles,
  }
}

function isImageUrl(url: string): boolean {
  return /\.(jpeg|jpg|png|webp|avif|gif)(\?.*)?$/i.test(url)
}
