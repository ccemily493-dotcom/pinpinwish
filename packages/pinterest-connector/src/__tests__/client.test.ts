import { describe, expect, it, vi } from 'vitest'
import {
  OfficialPinterestClient,
  PinterestApiError,
  normalizeBoard,
  normalizePin,
} from '../client'
import { decryptSecret, encryptSecret } from '../encryption'

const oauth = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3000/api/pinterest/callback',
  scopes: ['boards:read', 'pins:read', 'user_accounts:read'],
}

describe('OfficialPinterestClient', () => {
  it('builds an official OAuth URL with state and requested scopes', () => {
    const client = new OfficialPinterestClient({ oauth })
    const url = new URL(client.getAuthorizationUrl('csrf-state'))

    expect(url.origin).toBe('https://www.pinterest.com')
    expect(url.pathname).toBe('/oauth/')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('state')).toBe('csrf-state')
    expect(url.searchParams.get('scope')).toContain('boards:read')
  })

  it('exchanges an authorization code using HTTP Basic authentication', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      scope: 'boards:read,pins:read',
      token_type: 'bearer',
    }))
    const client = new OfficialPinterestClient({ oauth, fetch: fetchMock as typeof fetch })

    const token = await client.exchangeCode('authorization-code')

    expect(token).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 3600,
      scopes: ['boards:read', 'pins:read'],
      tokenType: 'bearer',
    })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.pinterest.com/v5/oauth/token')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ Authorization: `Basic ${btoa('client-id:client-secret')}` })
    expect(String(init?.body)).toContain('grant_type=authorization_code')
  })

  it('normalizes paginated boards and pins without inventing absent values', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        items: [{ id: 'board-1', name: 'Wishlist', pin_count: 2 }],
        bookmark: 'next-board-page',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [{
          id: 'pin-1',
          title: 'Pink shoes',
          link: 'https://shop.example/shoes',
          media: { images: { '600x': { url: 'https://img.example/shoes.jpg' } } },
        }],
      }))
    const client = new OfficialPinterestClient({ oauth, fetch: fetchMock as typeof fetch })

    const boards = await client.listBoards('token')
    const pins = await client.listBoardPins('token', 'board-1')

    expect(boards.bookmark).toBe('next-board-page')
    expect(boards.items[0]).toMatchObject({ id: 'board-1', name: 'Wishlist', pinCount: 2 })
    expect(boards.items[0]?.url).toBeUndefined()
    expect(pins.items[0]).toMatchObject({
      id: 'pin-1',
      boardId: 'board-1',
      imageUrl: 'https://img.example/shoes.jpg',
    })
    expect(pins.items[0]?.description).toBeUndefined()
  })

  it('surfaces official API failures without leaking tokens', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(
      { code: 29, message: 'Board not found' },
      { status: 404 },
    ))
    const client = new OfficialPinterestClient({ oauth, fetch: fetchMock as typeof fetch })

    await expect(client.listBoards('super-secret-token')).rejects.toEqual(
      expect.objectContaining<PinterestApiError>({
        name: 'PinterestApiError',
        message: 'Board not found',
        status: 404,
        code: 29,
      }),
    )
  })
})

describe('Pinterest response normalization', () => {
  it('rejects malformed records', () => {
    expect(() => normalizeBoard({ id: 'missing-name' })).toThrow(PinterestApiError)
    expect(() => normalizePin({}, 'board-1')).toThrow(PinterestApiError)
  })
})

describe('OAuth token encryption', () => {
  const key = 'ab'.repeat(32)

  it('round-trips AES-256-GCM secrets with unique IVs', () => {
    const first = encryptSecret('secret-token', key)
    const second = encryptSecret('secret-token', key)

    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe('secret-token')
    expect(decryptSecret(first, key)).toBe('secret-token')
  })

  it('rejects invalid keys and tampered authentication tags', () => {
    expect(() => encryptSecret('secret', 'short-key')).toThrow(/64 hexadecimal/)
    const encrypted = encryptSecret('secret', key)
    expect(() => decryptSecret({ ...encrypted, authTag: Buffer.alloc(16).toString('base64') }, key)).toThrow()
  })
})
