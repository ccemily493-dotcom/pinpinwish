import * as fs from 'node:fs'
import * as path from 'node:path'
import { chromium, type BrowserContext } from 'playwright'
import type { PinterestSessionStatus } from './types'

export function getDefaultDataDir(): string {
  if (process.env.PINPINWISH_DATA_DIR) {
    return path.resolve(process.env.PINPINWISH_DATA_DIR)
  }

  const cwd = process.cwd()
  const isWebWorkspace = path.basename(cwd) === 'web' && path.basename(path.dirname(cwd)) === 'apps'
  return path.resolve(isWebWorkspace ? path.join(cwd, '..', '..', '.data') : path.join(cwd, '.data'))
}

export function getDefaultUserDataDir(): string {
  const dir = path.join(getDefaultDataDir(), 'pinterest-profile')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getDefaultImagesDir(): string {
  const dir = path.join(getDefaultDataDir(), 'images')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export async function createPersistentContext(options: {
  userDataDir?: string
  headless?: boolean
  viewport?: { width: number; height: number }
}): Promise<BrowserContext> {
  const userDataDir = options.userDataDir || getDefaultUserDataDir()
  const headless = options.headless ?? true

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: options.viewport ?? { width: 1366, height: 860 },
    locale: 'en-US',
  })

  return context
}

/**
 * Checks if the persistent profile has an active Pinterest session.
 */
export async function checkPinterestSession(userDataDir?: string): Promise<PinterestSessionStatus> {
  const resolvedDir = userDataDir || getDefaultUserDataDir()
  const hasSavedProfile = fs.existsSync(path.join(resolvedDir, 'Default', 'Cookies'))

  let context: BrowserContext | null = null
  try {
    context = await createPersistentContext({
      userDataDir: resolvedDir,
      headless: true,
    })

    const page = await context.newPage()
    page.setDefaultTimeout(10000)

    await page.goto('https://www.pinterest.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    })

    // Allow dynamic navbar to render
    await page.waitForTimeout(1500)

    // Check for logged-in indicators
    const check = await page.evaluate(() => {
      const profileButton = document.querySelector(
        '[data-test-id="header-profile"], [data-test-id="user-profile-button"], a[href^="/"][aria-label*="profile"], a[href^="/"][aria-label*="Profile"]'
      )
      const loginButton = document.querySelector(
        '[data-test-id="simple-login-button"], button[aria-label="Log in"], a[href*="/login/"]'
      )

      return {
        hasProfileButton: Boolean(profileButton),
        hasLoginButton: Boolean(loginButton),
        url: window.location.href,
      }
    })

    const isLoggedIn = determinePinterestLoginState(check)

    return {
      isLoggedIn,
      hasSavedProfile,
      message: isLoggedIn
        ? 'Pinterest session active in local profile'
        : 'No active session. Open Pinterest login once before importing.',
    }
  } catch (error) {
    return {
      isLoggedIn: false,
      hasSavedProfile,
      message: error instanceof Error ? error.message : 'Could not check Pinterest session',
    }
  } finally {
    if (context) {
      await context.close().catch(() => {})
    }
  }
}

export function determinePinterestLoginState(check: {
  hasProfileButton: boolean
  hasLoginButton: boolean
  url: string
}): boolean {
  return check.hasProfileButton && !check.hasLoginButton && !check.url.includes('/login')
}

/**
 * Opens a visible headful browser window for the user to log in to Pinterest once.
 * The session cookies are saved to the persistent profile folder.
 */
export async function openPinterestLoginWindow(options: {
  userDataDir?: string
  timeoutMs?: number
} = {}): Promise<{ success: boolean; message: string }> {
  const userDataDir = options.userDataDir || getDefaultUserDataDir()
  const timeoutMs = options.timeoutMs ?? 180000 // 3 minutes for user interaction

  let context: BrowserContext | null = null
  try {
    context = await createPersistentContext({
      userDataDir,
      headless: false,
      viewport: { width: 1200, height: 800 },
    })

    const page = context.pages()[0] || (await context.newPage())
    await page.goto('https://www.pinterest.com/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Wait until user navigates away from login / is logged in, or closes the window
    await Promise.race([
      page.waitForURL((url) => !url.pathname.includes('/login') && url.hostname.includes('pinterest.com'), {
        timeout: timeoutMs,
      }),
      new Promise((resolve) => page.on('close', resolve)),
    ])

    await new Promise((r) => setTimeout(r, 1000))

    return {
      success: true,
      message: 'Pinterest login window completed. Session stored locally.',
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Login window closed or timed out.',
    }
  } finally {
    if (context) {
      await context.close().catch(() => {})
    }
  }
}
