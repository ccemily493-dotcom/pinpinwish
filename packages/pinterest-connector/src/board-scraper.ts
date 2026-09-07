import type { BrowserContext, Page } from 'playwright'
import { isPinterestUrl, parsePinterestBoardUrl } from '@pinpinwish/shared'
import { createPersistentContext, getDefaultImagesDir, getDefaultUserDataDir } from './browser-session'
import { downloadPinImage } from './image-downloader'
import type { ScrapedPinterestBoard, ScrapedPinterestPin, ScraperOptions } from './types'

export class PinterestBoardScraper {
  private readonly options: ScraperOptions

  constructor(options: ScraperOptions = {}) {
    this.options = {
      userDataDir: options.userDataDir || getDefaultUserDataDir(),
      imagesDir: options.imagesDir || getDefaultImagesDir(),
      headless: options.headless ?? true,
      maxPins: options.maxPins,
      timeoutMs: options.timeoutMs ?? 30000,
      scrollIntervalMs: options.scrollIntervalMs ?? 800,
      maxConsecutiveEmptyScrolls: options.maxConsecutiveEmptyScrolls ?? 8,
      signal: options.signal,
      onProgress: options.onProgress,
    }
  }

  async scrape(boardUrl: string): Promise<ScrapedPinterestBoard> {
    if (!isPinterestUrl(boardUrl)) {
      throw new Error(`Invalid Pinterest URL: ${boardUrl}. Must be a valid pinterest.com board URL.`)
    }

    const parsedBoard = parsePinterestBoardUrl(boardUrl)
    if (!parsedBoard) {
      throw new Error('The URL must point to a Pinterest board, not a Pin, search, profile, or short link.')
    }
    const canonicalUrl = parsedBoard.canonicalUrl
    const boardSlug = parsedBoard.boardSlug
    const boardId = `${parsedBoard.username}/${parsedBoard.boardSlug}`

    let context: BrowserContext | null = null
    try {
      context = await createPersistentContext({
        userDataDir: this.options.userDataDir,
        headless: this.options.headless,
      })

      const page = await context.newPage()
      page.setDefaultTimeout(this.options.timeoutMs!)

      if (this.options.signal) {
        this.options.signal.addEventListener('abort', () => {
          void page.close().catch(() => {})
        })
      }

      this.options.onProgress?.({
        step: 'scraping',
        message: 'Opening Pinterest board…',
        processedPins: 0,
      })

      await page.goto(canonicalUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeoutMs,
      })

      // Wait a moment for the pin grid to initialize
      await page.waitForTimeout(2000)

      const landedUrl = new URL(page.url())
      const expectedPath = `/${parsedBoard.username}/${parsedBoard.boardSlug}`.toLowerCase()
      if (!landedUrl.pathname.toLowerCase().startsWith(expectedPath)) {
        throw new Error(
          'PINTEREST_LOGIN_REQUIRED: Pinterest redirected away from the board. Open the local Pinterest login window once and retry.'
        )
      }

      // Extract board metadata (Title, pin count)
      const boardMetadata = await page.evaluate((fallbackTitle) => {
        const h1 = document.querySelector('h1, [data-test-id="board-header-title"]')
        const title = (h1?.textContent || '').trim() || fallbackTitle
        const summary = `${document.title} ${document.querySelector('meta[name="description"]')?.getAttribute('content') || ''} ${document.body.innerText.slice(0, 5000)}`
        const countMatch = summary.match(/([\d.,]+)\s*(?:pins?|ideas?|saves?)/i)
        const count = countMatch?.[1]
          ? Number.parseInt(countMatch[1].replace(/[^\d]/g, ''), 10)
          : undefined
        return { title, expectedPinCount: Number.isFinite(count) && count! > 0 ? count : undefined }
      }, boardSlug.replace(/-/g, ' '))
      const boardTitle = boardMetadata.title
      const safetyLimit = this.options.maxPins ?? 5000
      const targetPinCount = boardMetadata.expectedPinCount
        ? Math.min(boardMetadata.expectedPinCount, safetyLimit)
        : safetyLimit

      // Progressive scroll loop to collect all pins
      const pinMap = new Map<string, Partial<ScrapedPinterestPin>>()
      let consecutiveEmptyScrolls = 0
      let lastPinCount = 0
      let lastDocumentHeight = 0

      while (pinMap.size < targetPinCount) {
        if (this.options.signal?.aborted) break

        // Extract pins currently in DOM
        const visiblePins = await this.extractVisiblePinsFromPage(page)

        for (const pin of visiblePins) {
          if (!pinMap.has(pin.pinterestPinId)) {
            pin.boardPosition = pinMap.size + 1
            pinMap.set(pin.pinterestPinId, pin)
          }
        }

        this.options.onProgress?.({
          step: 'scraping',
          message: `Found ${pinMap.size} pins…`,
          processedPins: pinMap.size,
          totalPins: pinMap.size,
        })

        const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight)
        if (pinMap.size === lastPinCount && documentHeight === lastDocumentHeight) {
          consecutiveEmptyScrolls++
          if (consecutiveEmptyScrolls >= this.options.maxConsecutiveEmptyScrolls!) {
            // Reached end of board
            break
          }
        } else {
          consecutiveEmptyScrolls = 0
          lastPinCount = pinMap.size
          lastDocumentHeight = documentHeight
        }

        // Scroll down
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.5)
        })

        // Polite jitter wait
        const jitter = Math.floor(Math.random() * 400)
        await page.waitForTimeout(this.options.scrollIntervalMs! + jitter)
      }

      const extractedPins = Array.from(pinMap.values()) as ScrapedPinterestPin[]

      if (extractedPins.length === 0) {
        const pageState = await page.evaluate(() => ({
          hasLoginForm: Boolean(
            document.querySelector('input[type="password"], [data-test-id="simple-login-button"], a[href*="/login/"]')
          ),
          bodyText: document.body.innerText.slice(0, 1000).toLowerCase(),
        }))
        const loginRequired = pageState.hasLoginForm || pageState.bodyText.includes('log in')
        throw new Error(
          loginRequired
            ? 'PINTEREST_LOGIN_REQUIRED: Pinterest requires a local browser session. Open the login window once and retry.'
            : 'PINTEREST_NO_PINS_FOUND: The board loaded but no Pins were found. Check the URL and board access.'
        )
      }

      // Board cards rarely expose their destination URL or full description. Visit
      // each Pin detail page automatically so product resolution has useful input.
      await this.hydratePinDetails(context, extractedPins)

      // Download images locally & compute hashes
      let downloadedCount = 0
      for (let i = 0; i < extractedPins.length; i++) {
        if (this.options.signal?.aborted) break

        const pin = extractedPins[i]
        if (!pin) continue

        if (pin.imageUrl) {
          try {
            const downloadResult = await downloadPinImage(pin.imageUrl, pin.pinterestPinId, {
              outputDir: this.options.imagesDir,
              signal: this.options.signal,
            })

            if (downloadResult) {
              pin.localImagePath = downloadResult.localImagePath
              pin.imageHash = downloadResult.imageHash
              downloadedCount++
            }
          } catch {
            // Soft failure on image download
          }
        }

        this.options.onProgress?.({
          step: 'downloading',
          message: `Downloaded image ${i + 1} of ${extractedPins.length}`,
          downloadedImages: downloadedCount,
          processedPins: i + 1,
          totalPins: extractedPins.length,
        })
      }

      return {
        id: boardId,
        name: boardTitle,
        url: canonicalUrl,
        pinCount: extractedPins.length,
        pins: extractedPins,
      }
    } finally {
      if (context) {
        await context.close().catch(() => {})
      }
    }
  }

  private async extractVisiblePinsFromPage(page: Page): Promise<ScrapedPinterestPin[]> {
    return page.evaluate(() => {
      const pins: ScrapedPinterestPin[] = []
      const seenIds = new Set<string>()

      // 1. Match links pointing to /pin/<pinId>/
      const pinLinks = Array.from(document.querySelectorAll('a[href*="/pin/"]'))

      for (const link of pinLinks) {
        const href = (link as HTMLAnchorElement).getAttribute('href') || ''
        const match = href.match(/\/pin\/(\d+)/)
        if (!match || !match[1]) continue

        const pinId = match[1]
        if (seenIds.has(pinId)) continue
        seenIds.add(pinId)

        // Find container card
        const card = link.closest('[data-test-id="pin"], [role="listitem"], div') || link

        // Extract title
        let title: string | undefined
        const heading = card.querySelector('h2, h3, [role="heading"]')
        if (heading?.textContent) {
          title = heading.textContent.trim()
        }

        const descriptionEl = card.querySelector(
          '[data-test-id="pin-description"], [data-test-id="closeup-description"], [aria-label*="description" i]'
        )
        const description = descriptionEl?.textContent?.trim() || undefined

        // Image extraction
        let imageUrl: string | undefined
        const img = card.querySelector('img')
        if (img) {
          const src = img.getAttribute('src') || ''
          const alt = img.getAttribute('alt') || ''
          if (!title && alt && alt.length > 2) {
            title = alt.trim()
          }

          if (src && src.startsWith('http')) {
            // Upgrade image resolution: convert 236x / 474x / 564x / 736x to originals or 736x
            imageUrl = src.replace(/\/(236x|474x|564x)\//, '/736x/')
          }
        }

        // Outgoing link extraction (if present in card)
        let outgoingLink: string | undefined
        const outLinkEl = card.querySelector('a[href^="http"]:not([href*="pinterest."]):not([href*="pin.it"])')
        if (outLinkEl) {
          outgoingLink = outLinkEl.getAttribute('href') || undefined
        }

        pins.push({
          pinterestPinId: pinId,
          title: title || undefined,
          description,
          link: outgoingLink,
          imageUrl,
        })
      }

      return pins
    })
  }

  private async hydratePinDetails(
    context: BrowserContext,
    pins: ScrapedPinterestPin[]
  ): Promise<void> {
    if (pins.length === 0) return

    const detailPage = await context.newPage()
    detailPage.setDefaultTimeout(Math.min(this.options.timeoutMs ?? 30000, 15000))

    try {
      for (let index = 0; index < pins.length; index++) {
        if (this.options.signal?.aborted) return
        const pin = pins[index]
        if (!pin) continue

        this.options.onProgress?.({
          step: 'analyzing',
          message: `Reading Pin details ${index + 1} of ${pins.length}`,
          processedPins: index,
          totalPins: pins.length,
        })

        try {
          await detailPage.goto(`https://www.pinterest.com/pin/${pin.pinterestPinId}/`, {
            waitUntil: 'domcontentloaded',
            timeout: Math.min(this.options.timeoutMs ?? 30000, 15000),
          })
          await detailPage.waitForTimeout(500)

          const details = await detailPage.evaluate(() => {
            const text = (selector: string) =>
              document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() || undefined
            const meta = (property: string) =>
              document.querySelector(`meta[property="${property}"]`)?.getAttribute('content') || undefined

            const visitLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')).find(
              (anchor) => {
                const href = anchor.href.toLowerCase()
                const label = `${anchor.getAttribute('aria-label') || ''} ${anchor.textContent || ''}`.toLowerCase()
                const isPinterest = href.includes('pinterest.') || href.includes('pin.it')
                return !isPinterest && (
                  anchor.dataset.testId === 'visit-site-button' ||
                  label.includes('visit site') ||
                  label.includes('visitar sitio') ||
                  label.includes('comprar')
                )
              }
            )

            return {
              title:
                text('[data-test-id="closeup-title"]') ||
                text('h1') ||
                meta('og:title'),
              description:
                text('[data-test-id="closeup-description"]') ||
                meta('og:description'),
              imageUrl: meta('og:image'),
              link: visitLink?.href,
            }
          })

          pin.title = details.title || pin.title
          pin.description = details.description || pin.description
          pin.imageUrl = details.imageUrl || pin.imageUrl
          pin.link = details.link || pin.link
        } catch {
          // A single unavailable Pin must not stop the board import.
        }
      }
    } finally {
      await detailPage.close().catch(() => {})
    }
  }
}
