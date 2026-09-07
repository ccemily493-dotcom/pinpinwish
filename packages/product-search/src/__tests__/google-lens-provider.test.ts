import { describe, expect, it } from 'vitest'
import { GoogleLensPlaywrightProvider } from '../google-lens-provider'

describe('GoogleLensPlaywrightProvider safe fallbacks', () => {
  it('does not launch a browser without an image', async () => {
    const provider = new GoogleLensPlaywrightProvider()
    await expect(provider.search({ title: 'Red shoes' })).resolves.toEqual([])
  })

  it('stops before doing network work when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const provider = new GoogleLensPlaywrightProvider()

    await expect(
      provider.search({ imageUrl: 'https://example.com/shoe.jpg', signal: controller.signal })
    ).resolves.toEqual([])
  })
})
