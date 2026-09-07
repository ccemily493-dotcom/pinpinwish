import { isPinterestUrl, parsePinterestBoardUrl } from '@pinpinwish/shared'
import { PinterestBoardScraper } from '@pinpinwish/pinterest-connector'
import { StandardProductResolver } from '@pinpinwish/product-resolver'
import { GoogleLensPlaywrightProvider } from '@pinpinwish/product-search'
import {
  createImportJob,
  getActiveImportJobForBoard,
  getDefaultWishlist,
  getImportJob,
  saveResolvedProductAndItem,
  updateImportJob,
  upsertImportJobItem,
  upsertPinterestBoard,
  upsertPinterestPin,
} from './db/repository'

const activeJobControllers = new Map<string, AbortController>()

export async function startImportJobAsync(
  boardUrl: string,
  options: {
    wishlistId?: string
    userId?: string
    enableVisualSearch?: boolean
  } = {}
) {
  if (!isPinterestUrl(boardUrl)) {
    throw new Error('Please provide a valid Pinterest board URL (e.g. https://www.pinterest.com/username/board-name/)')
  }

  const userId = options.userId || 'local-user'
  const wishlist = options.wishlistId ? { id: options.wishlistId } : getDefaultWishlist()
  const sourceId = 'source-pinterest-default'

  // Check if there is already a running job for this board
  const parsedBoard = parsePinterestBoardUrl(boardUrl)
  if (!parsedBoard) throw new Error('Please provide a complete Pinterest board URL.')
  const canonicalUrl = parsedBoard.canonicalUrl

  const existingJob = getActiveImportJobForBoard(wishlist.id, canonicalUrl)
  if (existingJob) {
    launchImportJob(
      existingJob.id,
      existingJob.boardUrl,
      existingJob.wishlistId,
      existingJob.userId,
      existingJob.sourceId,
      options.enableVisualSearch
    )
    return existingJob
  }

  const job = createImportJob({
    userId,
    wishlistId: wishlist.id,
    sourceId,
    boardUrl: canonicalUrl,
  })

  launchImportJob(job.id, canonicalUrl, wishlist.id, userId, sourceId, options.enableVisualSearch)

  return job
}

function launchImportJob(
  jobId: string,
  boardUrl: string,
  wishlistId: string,
  userId: string,
  sourceId: string,
  enableVisualSearch?: boolean
) {
  if (activeJobControllers.has(jobId)) return
  const controller = new AbortController()
  activeJobControllers.set(jobId, controller)

  void runBackgroundImport(jobId, boardUrl, wishlistId, userId, sourceId, controller.signal, enableVisualSearch)
}

export function ensureImportJobActive(jobId: string): boolean {
  if (activeJobControllers.has(jobId)) return true
  const job = getImportJob(jobId)
  if (!job || (job.status !== 'pending' && job.status !== 'running')) return false

  launchImportJob(job.id, job.boardUrl, job.wishlistId, job.userId, job.sourceId)
  return true
}

export function cancelImportJob(jobId: string): boolean {
  const controller = activeJobControllers.get(jobId)
  if (controller) {
    controller.abort()
    activeJobControllers.delete(jobId)
    updateImportJob(jobId, {
      status: 'cancelled',
      errorMessage: 'Import was cancelled by user',
    })
    return true
  }

  const current = getImportJob(jobId)
  if (current && (current.status === 'pending' || current.status === 'running')) {
    updateImportJob(jobId, {
      status: 'cancelled',
      errorMessage: 'Import was cancelled by user',
    })
    return true
  }

  return false
}

async function runBackgroundImport(
  jobId: string,
  boardUrl: string,
  wishlistId: string,
  userId: string,
  sourceId: string,
  signal: AbortSignal,
  enableVisualSearch = false
) {
  try {
    updateImportJob(jobId, { status: 'running' })

    const scraper = new PinterestBoardScraper({
      signal,
      onProgress: (progress) => {
        updateImportJob(jobId, {
          totalCount: progress.totalPins,
          processedCount: progress.processedPins,
          downloadedCount: progress.downloadedImages,
        })
      },
    })

    const scrapedBoard = await scraper.scrape(boardUrl)

    if (signal.aborted) {
      updateImportJob(jobId, { status: 'cancelled' })
      return
    }

    const boardRowId = upsertPinterestBoard({
      userId,
      boardUrl: scrapedBoard.url,
      pinterestBoardId: scrapedBoard.id,
      name: scrapedBoard.name,
      pinCount: scrapedBoard.pinCount,
    })

    updateImportJob(jobId, {
      boardId: boardRowId,
      totalCount: scrapedBoard.pins.length,
      downloadedCount: scrapedBoard.pins.filter((p) => p.localImagePath).length,
    })

    const visualProvider = enableVisualSearch ? new GoogleLensPlaywrightProvider() : undefined
    const resolver = new StandardProductResolver({
      visualSearchProvider: visualProvider,
      fetchTimeoutMs: 8000,
    })

    let identifiedCount = 0
    let needsReviewCount = 0
    let errorCount = 0

    for (let i = 0; i < scrapedBoard.pins.length; i++) {
      if (signal.aborted) {
        updateImportJob(jobId, { status: 'cancelled' })
        return
      }

      const pin = scrapedBoard.pins[i]
      if (!pin) continue

      updateImportJob(jobId, {
        analyzingCount: i + 1,
      })

      upsertImportJobItem({
        jobId,
        pinId: pin.pinterestPinId,
        status: 'analyzing',
      })

      try {
        const pinRowId = upsertPinterestPin({
          boardId: boardRowId,
          userId,
          pinterestPinId: pin.pinterestPinId,
          title: pin.title,
          description: pin.description,
          link: pin.link,
          imageUrl: pin.imageUrl,
          localImagePath: pin.localImagePath,
          imageHash: pin.imageHash,
          lastSeenJobId: jobId,
        })

        // Resolve product
        const match = await resolver.resolve(
          {
            pinterestPinId: pin.pinterestPinId,
            title: pin.title,
            description: pin.description,
            link: pin.link,
            imageUrl: pin.imageUrl,
            localImagePath: pin.localImagePath,
            boardPosition: pin.boardPosition,
          },
          signal
        )

        const isResolved = match.matchType !== 'unresolved' && match.confidence >= 0.5

        if (isResolved) {
          identifiedCount++
        } else {
          needsReviewCount++
        }

        saveResolvedProductAndItem({
          wishlistId,
          sourceId,
          sourceItemId: pin.pinterestPinId,
          pinterestPinId: pin.pinterestPinId,
          pinRowId,
          pinUrl: `https://www.pinterest.com/pin/${pin.pinterestPinId}/`,
          imageHash: pin.imageHash,
          priority: 'medium',
          status: 'wanted',
          resolutionStatus: isResolved ? 'resolved' : 'needs_review',
          matchType: match.matchType,
          confidence: match.confidence,
          product: isResolved
            ? {
                name: match.name,
                brand: match.brand,
                category: match.category,
                imageUrl: match.imageUrl || pin.imageUrl,
                localImagePath: pin.localImagePath,
                description: match.evidence?.details,
                images: match.images,
                offers: match.productUrl && match.price !== undefined
                  ? [
                      {
                        store: match.store || 'Store',
                        storeUrl: match.productUrl,
                        currentPrice: match.price,
                        currency: match.currency || 'EUR',
                        availability: match.availability || 'unknown',
                        variant: match.variant,
                      },
                    ]
                  : [],
              }
            : undefined,
        })

        upsertImportJobItem({
          jobId,
          pinId: pin.pinterestPinId,
          status: isResolved ? 'identified' : 'unresolved',
          confidence: match.confidence,
          matchType: match.matchType,
        })
      } catch (pinErr) {
        console.warn(`[import-worker] Error processing pin ${pin.pinterestPinId}:`, pinErr)
        errorCount++
        upsertImportJobItem({
          jobId,
          pinId: pin.pinterestPinId,
          status: 'failed',
          errorMessage: pinErr instanceof Error ? pinErr.message : 'Processing error',
        })
      }

      updateImportJob(jobId, {
        processedCount: i + 1,
        identifiedCount,
        needsReviewCount,
        errorCount,
      })
    }

    updateImportJob(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      processedCount: scrapedBoard.pins.length,
      identifiedCount,
      needsReviewCount,
      errorCount,
    })
  } catch (error) {
    console.error(`[import-worker] Fatal error in job ${jobId}:`, error)
    updateImportJob(jobId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Import failed unexpectedly',
    })
  } finally {
    activeJobControllers.delete(jobId)
  }
}
