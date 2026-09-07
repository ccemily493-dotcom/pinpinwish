import type {
  OfficialPinterestClientOptions,
  PinterestBoard,
  PinterestPage,
  PinterestPin,
  PinterestTokenResponse,
  PinterestUserAccount,
} from './types'

const DEFAULT_API_BASE_URL = 'https://api.pinterest.com/v5'
const DEFAULT_AUTHORIZATION_URL = 'https://www.pinterest.com/oauth/'

type JsonRecord = Record<string, unknown>

export class PinterestApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message)
    this.name = 'PinterestApiError'
  }
}

/**
 * Low-level client for Pinterest API v5. It never persists tokens and never
 * performs product identification or Pinterest scraping.
 */
export class OfficialPinterestClient {
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly apiBaseUrl: string
  private readonly authorizationUrl: string

  constructor(private readonly options: OfficialPinterestClientOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL
    this.authorizationUrl = options.authorizationUrl ?? DEFAULT_AUTHORIZATION_URL
  }

  getAuthorizationUrl(state: string): string {
    if (!state) throw new Error('OAuth state is required')

    const url = new URL(this.authorizationUrl)
    url.searchParams.set('client_id', this.options.oauth.clientId)
    url.searchParams.set('redirect_uri', this.options.oauth.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', this.options.oauth.scopes.join(','))
    url.searchParams.set('state', state)
    return url.toString()
  }

  exchangeCode(code: string): Promise<PinterestTokenResponse> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.options.oauth.redirectUri,
    })
  }

  refreshAccessToken(refreshToken: string): Promise<PinterestTokenResponse> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: this.options.oauth.scopes.join(','),
    })
  }

  async getUserAccount(accessToken: string): Promise<PinterestUserAccount> {
    const data = await this.apiRequest<JsonRecord>('/user_account', accessToken)
    const username = asString(data.username)
    if (!username) throw new PinterestApiError('Pinterest response did not include a username', 502)

    return {
      username,
      accountType: asString(data.account_type),
      profileImage: asString(data.profile_image),
    }
  }

  async listBoards(accessToken: string, bookmark?: string): Promise<PinterestPage<PinterestBoard>> {
    const data = await this.apiRequest<JsonRecord>(
      withQuery('/boards', { page_size: '100', bookmark }),
      accessToken,
    )

    return {
      items: asArray(data.items).map(normalizeBoard),
      bookmark: nonEmptyBookmark(data.bookmark),
    }
  }

  async listBoardPins(
    accessToken: string,
    boardId: string,
    bookmark?: string,
  ): Promise<PinterestPage<PinterestPin>> {
    if (!boardId) throw new Error('boardId is required')
    const data = await this.apiRequest<JsonRecord>(
      withQuery(`/boards/${encodeURIComponent(boardId)}/pins`, {
        page_size: '100',
        bookmark,
      }),
      accessToken,
    )

    return {
      items: asArray(data.items).map((item) => normalizePin(item, boardId)),
      bookmark: nonEmptyBookmark(data.bookmark),
    }
  }

  private async requestToken(form: Record<string, string>): Promise<PinterestTokenResponse> {
    const credentials = btoa(`${this.options.oauth.clientId}:${this.options.oauth.clientSecret}`)
    const response = await this.fetchImpl(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
      cache: 'no-store',
    })
    const data = await parseJson(response)
    if (!response.ok) throwPinterestError(response.status, data)

    const accessToken = asString(data.access_token)
    const expiresIn = asNumber(data.expires_in)
    if (!accessToken || expiresIn === undefined) {
      throw new PinterestApiError('Pinterest returned an invalid OAuth token response', 502)
    }

    return {
      accessToken,
      refreshToken: asString(data.refresh_token),
      expiresIn,
      scopes: normalizeScopes(data.scope),
      tokenType: asString(data.token_type) ?? 'bearer',
    }
  }

  private async apiRequest<T>(path: string, accessToken: string): Promise<T> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const data = await parseJson(response)
    if (!response.ok) throwPinterestError(response.status, data)
    return data as T
  }
}

export function normalizeBoard(value: JsonRecord): PinterestBoard {
  const id = asString(value.id)
  const name = asString(value.name)
  if (!id || !name) throw new PinterestApiError('Pinterest returned an invalid board', 502)

  return {
    id,
    name,
    description: asString(value.description),
    url: asString(value.url),
    pinCount: asNumber(value.pin_count) ?? 0,
    imageUrl: findImageUrl(value.media),
    createdAt: parseDate(value.created_at),
  }
}

export function normalizePin(value: JsonRecord, boardId: string): PinterestPin {
  const id = asString(value.id)
  if (!id) throw new PinterestApiError('Pinterest returned an invalid pin', 502)

  return {
    id,
    boardId,
    title: asString(value.title),
    description: asString(value.description),
    link: asString(value.link),
    imageUrl: findImageUrl(value.media),
    dominantColor: asString(value.dominant_color),
    createdAt: parseDate(value.created_at),
  }
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  return `${path}?${params.toString()}`
}

function findImageUrl(media: unknown): string | undefined {
  if (!isRecord(media)) return undefined
  const images = media.images
  if (!isRecord(images)) return undefined

  for (const key of ['1200x', '600x', '400x300', '150x150']) {
    const candidate = images[key]
    if (isRecord(candidate)) {
      const url = asString(candidate.url)
      if (url) return url
    }
  }

  for (const candidate of Object.values(images)) {
    if (isRecord(candidate)) {
      const url = asString(candidate.url)
      if (url) return url
    }
  }
  return undefined
}

function normalizeScopes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  return value.split(/[\s,]+/).filter(Boolean)
}

function parseDate(value: unknown): Date | undefined {
  const raw = asString(value)
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function nonEmptyBookmark(value: unknown): string | undefined {
  const bookmark = asString(value)
  return bookmark || undefined
}

async function parseJson(response: Response): Promise<JsonRecord> {
  try {
    const data: unknown = await response.json()
    return isRecord(data) ? data : {}
  } catch {
    return {}
  }
}

function throwPinterestError(status: number, data: JsonRecord): never {
  const message = asString(data.message) ?? asString(data.error) ?? `Pinterest API request failed (${status})`
  throw new PinterestApiError(message, status, asNumber(data.code))
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
