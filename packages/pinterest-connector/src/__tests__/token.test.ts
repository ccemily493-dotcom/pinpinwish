import { describe, it, expect } from 'vitest'
import type { PinterestOAuthToken, PinterestConnection } from '../types'

describe('Pinterest Token Security Structure', () => {
  it('requires independent IV, authTag, and ciphertext for access tokens', () => {
    const token: PinterestOAuthToken = {
      accessToken: {
        ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
        iv: '123456789012',
        authTag: 'abcdef1234567890',
        keyVersion: 1,
      },
      refreshToken: {
        ciphertext: 'cmVmcmVzaC1jaXBoZXJ0ZXh0',
        iv: '987654321098',
        authTag: '0987654321fedcba',
        keyVersion: 1,
      },
      expiresAt: new Date(Date.now() + 3600 * 1000),
      scopes: ['boards:read', 'pins:read'],
    }

    expect(token.accessToken.ciphertext).toBeDefined()
    expect(token.accessToken.iv).not.toBe(token.refreshToken?.iv)
    expect(token.accessToken.authTag).not.toBe(token.refreshToken?.authTag)
    expect(token.accessToken.keyVersion).toBe(1)
  })

  it('links PinterestConnection to wishlist_sources via sourceId', () => {
    const connection: PinterestConnection = {
      id: 'conn-1',
      userId: 'user-1',
      sourceId: 'src-pinterest-1',
      pinterestUserId: 'pin-user-99',
      token: {
        accessToken: {
          ciphertext: 'enc-acc',
          iv: 'iv-acc',
          authTag: 'tag-acc',
          keyVersion: 1,
        },
        expiresAt: new Date(),
        scopes: ['pins:read'],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(connection.sourceId).toBe('src-pinterest-1')
    expect(connection.pinterestUserId).toBe('pin-user-99')
  })
})
