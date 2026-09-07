import * as fs from 'node:fs'
import type { VisualProductSearchInput, VisualProductSearchProvider, ProductSearchResult } from './types'

export interface GoogleLensProviderOptions {
  headless?: boolean
  timeoutMs?: number
}

/**
 * GoogleLensPlaywrightProvider — Experimental visual product search provider using Playwright.
 *
 * Requirements & Constraints:
 * 1. Automatically uploads image or passes image URL.
 * 2. Extracts product candidates and source links.
 * 3. Never requires manual user interaction during background imports.
 * 4. If CAPTCHA, bot detection, or layout changes occur: logs safely and returns [] (fail-soft).
 * 5. NEVER attempts to bypass CAPTCHA.
 * 6. Google Lens is NOT a guaranteed dependency; failures gracefully fall back to unresolved.
 */
export class GoogleLensPlaywrightProvider implements VisualProductSearchProvider {
  readonly providerId = 'google-lens-playwright'
  private readonly headless: boolean
  private readonly timeoutMs: number

  constructor(options: GoogleLensProviderOptions = {}) {
    this.headless = options.headless ?? true
    this.timeoutMs = options.timeoutMs ?? 15000
  }

  async search(input: VisualProductSearchInput): Promise<ProductSearchResult[]> {
    if (input.signal?.aborted) return []

    const hasLocalImage = input.localImagePath && fs.existsSync(input.localImagePath)
    const hasRemoteUrl = Boolean(input.imageUrl && input.imageUrl.startsWith('http'))

    if (!hasLocalImage && !hasRemoteUrl) {
      return []
    }

    let chromium: typeof import('playwright').chromium
    try {
      const pw = await import('playwright')
      chromium = pw.chromium
    } catch {
      console.warn('[GoogleLensProvider] Playwright not available; visual search skipped.')
      return []
    }

    let browser: import('playwright').Browser | null = null
    try {
      browser = await chromium.launch({
        headless: this.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      })

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      })

      const page = await context.newPage()
      page.setDefaultTimeout(this.timeoutMs)

      if (input.signal) {
        input.signal.addEventListener('abort', () => {
          void page.close().catch(() => {})
        })
      }

      if (hasRemoteUrl) {
        const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(input.imageUrl!)}`
        await page.goto(lensUrl, { waitUntil: 'domcontentloaded', timeout: this.timeoutMs })
      } else if (hasLocalImage) {
        await page.goto('https://lens.google.com/', { waitUntil: 'domcontentloaded', timeout: this.timeoutMs })

        const fileInput = await page.$('input[type="file"]')
        if (fileInput) {
          await fileInput.setInputFiles(input.localImagePath!)
          await page.waitForLoadState('networkidle', { timeout: this.timeoutMs }).catch(() => {})
        } else {
          return []
        }
      }

      // Check for CAPTCHA or blocking indicators
      const isCaptcha = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase()
        return (
          text.includes('recaptcha') ||
          text.includes('unusual traffic') ||
          text.includes('verify you are human') ||
          document.querySelector('iframe[src*="recaptcha"]') !== null
        )
      })

      if (isCaptcha) {
        console.warn('[GoogleLensProvider] CAPTCHA detected on Google Lens. Gracefully skipping without bypass.')
        return []
      }

      await page.waitForTimeout(2000)

      const results: ProductSearchResult[] = await page.evaluate((providerId) => {
        const items: ProductSearchResult[] = []
        const visualLinks = Array.from(document.querySelectorAll('a[href^="http"]'))

        for (const rawLink of visualLinks) {
          const link = rawLink as HTMLAnchorElement
          const href = link.getAttribute('href')
          if (!href || href.includes('google.com') || href.includes('gstatic.com')) continue

          const titleEl = link.querySelector('h3, [role="heading"], div, span')
          const titleText = (titleEl?.textContent || link.textContent || '').trim()
          if (!titleText || titleText.length < 4 || titleText.length > 200) continue

          if (items.some((it) => it.productUrl === href)) continue

          let store = 'Store'
          try {
            store = new URL(href).hostname.replace(/^www\./, '')
          } catch {
            // ignore
          }

          const imgEl = link.querySelector('img')
          const imgUrl = imgEl?.getAttribute('src') || undefined

          items.push({
            providerId,
            name: titleText,
            productUrl: href,
            store,
            imageUrl: imgUrl && imgUrl.startsWith('http') ? imgUrl : undefined,
            relevanceScore: 0.7,
          })

          if (items.length >= 5) break
        }

        return items
      }, this.providerId)

      return results
    } catch (error) {
      console.warn('[GoogleLensProvider] Visual search failed or timed out:', error instanceof Error ? error.message : error)
      return []
    } finally {
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }
}
