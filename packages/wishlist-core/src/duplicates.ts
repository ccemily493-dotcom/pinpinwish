import type { WishlistItem } from './types'

/**
 * Conservative duplicate detection.
 *
 * Only flags items as possible duplicates when there is high confidence
 * based on observable data (same product name + brand).
 *
 * IMPORTANT: This function NEVER automatically merges items.
 * Merging is a user action. The flag is advisory only.
 *
 * Phase 3 may add image-similarity-based detection.
 */
export function detectPossibleDuplicates(
  items: WishlistItem[]
): WishlistItem[] {
  const result = items.map((item) => ({ ...item }))

  for (let i = 0; i < result.length; i++) {
    const a = result[i]
    if (!a) continue

    for (let j = i + 1; j < result.length; j++) {
      const b = result[j]
      if (!b) continue

      if (isPossibleDuplicate(a, b)) {
        // Mark b as possible duplicate of a (first occurrence)
        // Only set if not already flagged to avoid overwriting existing info
        if (!b.possibleDuplicateOf) {
          b.possibleDuplicateOf = a.id
        }
      }
    }
  }

  return result
}

function normalizeString(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

function isPossibleDuplicate(a: WishlistItem, b: WishlistItem): boolean {
  // Skip removed or archived items
  if (a.status === 'removed' || b.status === 'removed' || a.status === 'archived' || b.status === 'archived') return false
  // Unresolved Pins without offers/brand do not carry enough product evidence.
  if ((!a.product.brand && a.product.offers.length === 0) || (!b.product.brand && b.product.offers.length === 0)) return false
  // Skip already-identified as different (different categories)
  if (a.product.category !== b.product.category) return false

  const nameA = normalizeString(a.product.name)
  const nameB = normalizeString(b.product.name)

  // Exact name match
  if (nameA === nameB) {
    // If both have brands, they must also match
    if (a.product.brand && b.product.brand) {
      return normalizeString(a.product.brand) === normalizeString(b.product.brand)
    }
    return true
  }

  return false
}
