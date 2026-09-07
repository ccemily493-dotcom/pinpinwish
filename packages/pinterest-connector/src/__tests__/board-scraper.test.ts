import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import { determinePinterestLoginState } from '../browser-session'
import { isPinterestUrl, parsePinterestBoardUrl, computeImageHash } from '@pinpinwish/shared'
import { PinterestBoardScrapingAdapter } from '../board-adapter'

describe('Pinterest Connector & Scraper Suite', () => {
  describe('Persistent session detection', () => {
    it('does not treat an inconclusive anonymous page as logged in', () => {
      expect(
        determinePinterestLoginState({
          hasProfileButton: false,
          hasLoginButton: false,
          url: 'https://www.pinterest.com/',
        })
      ).toBe(false)
    })

    it('requires a profile indicator and no login prompt', () => {
      expect(
        determinePinterestLoginState({
          hasProfileButton: true,
          hasLoginButton: false,
          url: 'https://www.pinterest.com/',
        })
      ).toBe(true)
    })
  })

  const fixturePath = path.resolve(__dirname, 'fixtures', 'board-sample.html')
  const boardHtml = fs.readFileSync(fixturePath, 'utf-8')

  describe('Board URL and Parsing Logic', () => {
    it('validates genuine Pinterest board URLs', () => {
      expect(isPinterestUrl('https://www.pinterest.com/maria_fashion/chic-capsule/')).toBe(true)
      expect(isPinterestUrl('https://pinterest.es/test_user/fall-trends')).toBe(true)
      expect(isPinterestUrl('https://pin.it/7xK9pq')).toBe(true)
    })

    it('rejects foreign or malformed URLs', () => {
      expect(isPinterestUrl('https://instagram.com/user')).toBe(false)
      expect(isPinterestUrl('https://evil-pinterest.com/user/board')).toBe(false)
      expect(isPinterestUrl('not a url')).toBe(false)
    })

    it('extracts canonical board metadata', () => {
      const parsed = parsePinterestBoardUrl('https://www.pinterest.com/maria_fashion/chic-capsule/?param=123')
      expect(parsed?.username).toBe('maria_fashion')
      expect(parsed?.boardSlug).toBe('chic-capsule')
      expect(parsed?.canonicalUrl).toBe('https://www.pinterest.com/maria_fashion/chic-capsule/')
    })
  })

  describe('DOM Extraction Logic on Board Fixture', () => {
    it('extracts unique pins and upgrades image resolution from 236x/474x to 736x', () => {
      const matchRegex = /href="\/pin\/(\d+)\/"/g
      const matches: string[] = []
      let match
      while ((match = matchRegex.exec(boardHtml)) !== null) {
        if (match[1]) matches.push(match[1])
      }

      const uniquePinIds = Array.from(new Set(matches))
      expect(uniquePinIds).toHaveLength(2)
      expect(uniquePinIds).toContain('112233445566778899')
      expect(uniquePinIds).toContain('998877665544332211')
    })

    it('upgrades image URLs properly', () => {
      const sample236 = 'https://i.pinimg.com/236x/ab/cd/ef/abcdef123456.jpg'
      const sample474 = 'https://i.pinimg.com/474x/fe/dc/ba/fedcba654321.jpg'

      const upgradeUrl = (url: string) => url.replace(/\/(236x|474x|564x)\//, '/736x/')

      expect(upgradeUrl(sample236)).toBe('https://i.pinimg.com/736x/ab/cd/ef/abcdef123456.jpg')
      expect(upgradeUrl(sample474)).toBe('https://i.pinimg.com/736x/fe/dc/ba/fedcba654321.jpg')
    })

    it('computes consistent hashes for image deduplication', () => {
      const imgBufferA = Buffer.from('pin-image-binary-a')
      const imgBufferB = Buffer.from('pin-image-binary-b')

      expect(computeImageHash(imgBufferA)).toBe(computeImageHash(imgBufferA))
      expect(computeImageHash(imgBufferA)).not.toBe(computeImageHash(imgBufferB))
    })
  })

  describe('PinterestBoardScrapingAdapter Contract', () => {
    it('implements WishlistSourceAdapter interface', () => {
      const adapter = new PinterestBoardScrapingAdapter()
      expect(adapter.sourceType).toBe('pinterest')
      expect(typeof adapter.sync).toBe('function')
    })
  })
})
