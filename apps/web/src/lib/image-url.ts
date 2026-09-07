/**
 * Resolves an image URL or local filesystem image path into a browser-renderable URL.
 */
export function resolveDisplayImageUrl(imageUrl?: string, localImagePath?: string): string | undefined {
  if (localImagePath) {
    const filename = localImagePath.replace(/\\/g, '/').split('/').pop()
    if (filename) {
      return `/api/images/${encodeURIComponent(filename)}`
    }
  }

  if (imageUrl) {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/')) {
      return imageUrl
    }
    const filename = imageUrl.replace(/\\/g, '/').split('/').pop()
    if (filename) {
      return `/api/images/${encodeURIComponent(filename)}`
    }
  }

  return undefined
}
