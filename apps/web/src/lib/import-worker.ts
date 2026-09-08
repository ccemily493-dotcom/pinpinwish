import { isPinterestUrl, parsePinterestBoardUrl } from '@pinpinwish/shared'
import { PinterestBoardScraper } from '@pinpinwish/pinterest-connector'
import { StandardProductResolver } from '@pinpinwish/product-resolver'
import { SerpApiGoogleLensProvider } from '@pinpinwish/product-search'
import { createHash } from 'node:crypto'
import {
  createImportJob,
  getActiveImportJobForBoard,
  getDefaultWishlist,
  getImportJob,
  reconcileAutomaticItemsForPin,
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
  enableVisualSearch = true
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
  enableVisualSearch = true
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

    const visualProvider = enableVisualSearch ? new SerpApiGoogleLensProvider() : undefined
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
        const matches = await resolver.resolveAll(
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

        const sourceItemIds = matches.map((match) => productSourceItemId(pin.pinterestPinId, match))
        reconcileAutomaticItemsForPin({ wishlistId, pinRowId, keepSourceItemIds: sourceItemIds })

        let resolvedProductsForPin = 0
        let unresolvedProductsForPin = 0

        for (const match of matches) {
          const isResolved = match.matchType !== 'unresolved' && match.confidence >= 0.72
          if (isResolved) resolvedProductsForPin++
          else unresolvedProductsForPin++

          const matchOffers = match.offers?.length
            ? match.offers
            : match.productUrl
              ? [
                  {
                    store: match.store || 'Store',
                    storeUrl: match.productUrl,
                    price: match.price,
                    currency: match.currency,
                    availability: match.availability,
                    variant: match.variant,
                  },
                ]
              : []

          saveResolvedProductAndItem({
            wishlistId,
            sourceId,
            sourceItemId: productSourceItemId(pin.pinterestPinId, match),
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
                  offers: matchOffers.map((offer) => ({
                    store: offer.store,
                    storeUrl: offer.storeUrl,
                    currentPrice: offer.price,
                    currency: offer.currency || 'EUR',
                    availability: offer.availability || 'unknown',
                    variant: offer.variant,
                  })),
                }
              : undefined,
          })
        }

        identifiedCount += resolvedProductsForPin
        needsReviewCount += unresolvedProductsForPin
        const isResolved = resolvedProductsForPin > 0 && unresolvedProductsForPin === 0
        const bestMatch = matches[0]!

        upsertImportJobItem({
          jobId,
          pinId: pin.pinterestPinId,
          status: isResolved ? 'identified' : 'unresolved',
          confidence: bestMatch.confidence,
          matchType: bestMatch.matchType,
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

export function productSourceItemId(
  pinterestPinId: string,
  match: { name: string; brand?: string; matchType: string }
): string {
  if (match.matchType === 'unresolved') return pinterestPinId
  const identity = `${match.brand || ''}|${match.name}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 16)
  return `${pinterestPinId}:product:${hash}`
}
