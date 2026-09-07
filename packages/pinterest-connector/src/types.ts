import type { SourceSyncProgress } from '@pinpinwish/shared'

// ─── Scraped Pinterest Types (Phase 2 Local Automation) ─────────────────────

export interface ScrapedPinterestPin {
  pinterestPinId: string
  title?: string
  description?: string
  link?: string
  imageUrl?: string
  localImagePath?: string
  imageHash?: string
  boardPosition?: number
  pinnedAt?: Date
}

export interface ScrapedPinterestBoard {
  id: string
  name: string
  description?: string
  url: string
  pinCount: number
  pins: ScrapedPinterestPin[]
}

export interface ScraperOptions {
  userDataDir?: string
  imagesDir?: string
  headless?: boolean
  maxPins?: number
  timeoutMs?: number
  scrollIntervalMs?: number
  maxConsecutiveEmptyScrolls?: number
  signal?: AbortSignal
  onProgress?: (progress: SourceSyncProgress) => void
}

export interface PinterestSessionStatus {
  isLoggedIn: boolean
  username?: string
  profileName?: string
  hasSavedProfile: boolean
  message: string
}
