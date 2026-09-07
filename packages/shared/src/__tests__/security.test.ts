import { describe, it, expect } from 'vitest'
import {
  isSafeExternalUrl,
  isPinterestUrl,
  parsePinterestBoardUrl,
  sanitizeFilename,
  isPrivateOrInternalHost,
} from '../security'
import { computeImageHash, slugify } from '../utils'

describe('Security & URL Validation', () => {
  describe('isPrivateOrInternalHost / isSafeExternalUrl', () => {
    it('blocks localhost and loopback addresses', () => {
      expect(isPrivateOrInternalHost('localhost')).toBe(true)
      expect(isPrivateOrInternalHost('127.0.0.1')).toBe(true)
      expect(isPrivateOrInternalHost('127.0.1.5')).toBe(true)
      expect(isPrivateOrInternalHost('::1')).toBe(true)
      expect(isSafeExternalUrl('http://localhost:3000')).toBe(false)
      expect(isSafeExternalUrl('http://127.0.0.1/admin')).toBe(false)
    })

    it('blocks private IPv4 ranges (10.x, 192.168.x, 172.16-31.x, 169.254.x)', () => {
      expect(isPrivateOrInternalHost('10.0.0.1')).toBe(true)
      expect(isPrivateOrInternalHost('192.168.1.1')).toBe(true)
      expect(isPrivateOrInternalHost('172.20.0.1')).toBe(true)
      expect(isPrivateOrInternalHost('169.254.169.254')).toBe(true)
      expect(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    })

    it('blocks dangerous non-http protocols', () => {
      expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeExternalUrl('data:text/html,test')).toBe(false)
    })

    it('blocks IPv4-mapped private IPv6 addresses', () => {
      expect(isPrivateOrInternalHost('::ffff:127.0.0.1')).toBe(true)
      expect(isPrivateOrInternalHost('::ffff:192.168.1.2')).toBe(true)
    })

    it('allows valid public external URLs', () => {
      expect(isSafeExternalUrl('https://www.zara.com/es/en/dress-p123.html')).toBe(true)
      expect(isSafeExternalUrl('https://i.pinimg.com/originals/ab/cd/ef.jpg')).toBe(true)
      expect(isSafeExternalUrl('http://example.com/item')).toBe(true)
    })
  })

  describe('isPinterestUrl & parsePinterestBoardUrl', () => {
    it('identifies valid Pinterest URLs', () => {
      expect(isPinterestUrl('https://www.pinterest.com/username/autumn-wardrobe/')).toBe(true)
      expect(isPinterestUrl('https://pinterest.es/fashion_lover/shoes')).toBe(true)
      expect(isPinterestUrl('https://pin.it/abc1234')).toBe(true)
    })

    it('rejects non-Pinterest URLs', () => {
      expect(isPinterestUrl('https://www.google.com')).toBe(false)
      expect(isPinterestUrl('https://fake-pinterest.com/user/board')).toBe(false)
      expect(isPinterestUrl('invalid-url')).toBe(false)
    })

    it('parses Pinterest board URLs into canonical structure', () => {
      const parsed = parsePinterestBoardUrl('https://www.pinterest.com/emily_style/autumn-capsule/')
      expect(parsed).not.toBeNull()
      expect(parsed?.username).toBe('emily_style')
      expect(parsed?.boardSlug).toBe('autumn-capsule')
      expect(parsed?.canonicalUrl).toBe('https://www.pinterest.com/emily_style/autumn-capsule/')
    })

    it('returns null for reserved Pinterest paths', () => {
      expect(parsePinterestBoardUrl('https://www.pinterest.com/pin/123456789/')).toBeNull()
      expect(parsePinterestBoardUrl('https://www.pinterest.com/search/pins/')).toBeNull()
      expect(parsePinterestBoardUrl('https://www.pinterest.com/settings/')).toBeNull()
    })
  })

  describe('sanitizeFilename & computeImageHash', () => {
    it('sanitizes directory traversal and special chars', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('______etc_passwd')
      expect(sanitizeFilename('my image (1).jpg')).toBe('my_image__1_.jpg')
    })

    it('computes consistent SHA-256 hash', () => {
      const hash1 = computeImageHash(Buffer.from('image-binary-data'))
      const hash2 = computeImageHash(Buffer.from('image-binary-data'))
      const hash3 = computeImageHash(Buffer.from('different-data'))

      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(hash1).toHaveLength(64)
    })

    it('slugifies titles correctly', () => {
      expect(slugify('Vestido Satinado ZARA & Co.')).toBe('vestido-satinado-zara-co')
      expect(slugify('Café Mágico 100%')).toBe('cafe-magico-100')
    })
  })
})
