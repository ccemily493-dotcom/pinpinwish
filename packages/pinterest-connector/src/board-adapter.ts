import type { SourceSyncInput, SourceSyncResult, WishlistSourceAdapter } from '@pinpinwish/wishlist-core'
import { PinterestBoardScraper } from './board-scraper'
import type { ScrapedPinterestPin, ScraperOptions } from './types'

export class PinterestBoardScrapingAdapter implements WishlistSourceAdapter {
  readonly sourceType = 'pinterest'
  private readonly scraperOptions: ScraperOptions

  constructor(options: ScraperOptions = {}) {
    this.scraperOptions = options
  }

  async sync(input?: SourceSyncInput | string): Promise<SourceSyncResult<ScrapedPinterestPin>> {
    let boardUrl: string | undefined
    let signal: AbortSignal | undefined
    let onProgress: ScraperOptions['onProgress']

    if (typeof input === 'string') {
      boardUrl = input
    } else if (input) {
      boardUrl = input.boardUrl
      signal = input.signal
      onProgress = input.onProgress
    }

    if (!boardUrl) {
      throw new Error('PinterestBoardScrapingAdapter requires a boardUrl in sync input.')
    }

    const scraper = new PinterestBoardScraper({
      ...this.scraperOptions,
      signal: signal || this.scraperOptions.signal,
      onProgress: onProgress || this.scraperOptions.onProgress,
    })

    const board = await scraper.scrape(boardUrl)

    return {
      sourceType: this.sourceType,
      sourceId: board.id,
      newItems: board.pins,
      removedItemIds: [],
      modifiedItems: [],
      syncedAt: new Date(),
    }
  }
}
