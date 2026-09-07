'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import type { Category, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { MOCK_WISHLIST_ITEMS } from '@/data/mock-items'

const STORAGE_KEY = 'pinpinwish.local-wishlist.v1'

export type ManualWishlistItem = {
  name: string
  brand?: string
  category: Category
  imageUrl?: string
  productUrl?: string
  store?: string
  price?: number
  currency: 'EUR'
  priority: Priority
  desiredSize?: string
  desiredColor?: string
  notes?: string
}

export function useWishlistData() {
  const [items, setItems] = useState<WishlistItem[]>(MOCK_WISHLIST_ITEMS)
  const [mode, setMode] = useState<'loading' | 'local' | 'cloud'>('loading')
  const [error, setError] = useState<string>()
  const initialized = useRef(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/wishlist', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json() as { items: WishlistItem[] }
        setItems(reviveItems(data.items))
        setMode('cloud')
        initialized.current = true
        return
      }
    } catch {
      // The local-first mode remains usable without a configured backend.
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      setItems(stored ? reviveItems(JSON.parse(stored) as WishlistItem[]) : MOCK_WISHLIST_ITEMS)
    } catch {
      setItems(MOCK_WISHLIST_ITEMS)
    }
    setMode('local')
    initialized.current = true
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (mode === 'local' && initialized.current) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, mode])

  const updateItem = useCallback(async (id: string, updates: { priority?: Priority; status?: WishlistItemStatus; desiredSize?: string; desiredColor?: string; notes?: string }) => {
    setError(undefined)
    if (mode === 'cloud') {
      const response = await fetch(`/api/wishlist/items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const data = await response.json() as { error?: string }
        setError(data.error ?? 'No se pudo guardar el cambio.')
        return
      }
      await load()
      return
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item))
  }, [load, mode])

  const addItem = useCallback(async (input: ManualWishlistItem) => {
    setError(undefined)
    if (mode === 'cloud') {
      const response = await fetch('/api/wishlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      })
      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? 'No se pudo añadir el artículo.')
      }
      await load()
      return
    }

    const id = crypto.randomUUID()
    const now = new Date()
    setItems((current) => [{
      id,
      wishlistId: 'wishlist-local',
      sourceType: 'manual_url',
      priority: input.priority,
      status: 'wanted',
      desiredSize: input.desiredSize,
      desiredColor: input.desiredColor,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      product: {
        id: `product-${id}`,
        slug: `local-${id}`,
        name: input.name,
        brand: input.brand,
        category: input.category,
        imageUrl: input.imageUrl,
        offers: input.productUrl && input.price !== undefined ? [{
          id: `offer-${id}`,
          productId: `product-${id}`,
          store: input.store || safeDomain(input.productUrl),
          storeUrl: input.productUrl,
          currentPrice: input.price,
          currency: input.currency,
          availability: 'unknown',
          priceHistory: [{ id: `observation-${id}`, productOfferId: `offer-${id}`, price: input.price, currency: input.currency, availability: 'unknown', checkedAt: now }],
          lastCheckedAt: now,
        }] : [],
      },
    }, ...current])
  }, [load, mode])

  const resolveItem = useCallback(async (id: string, input: ManualWishlistItem | null) => {
    if (mode === 'cloud') {
      const response = await fetch(`/api/wishlist/items/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input ? { ...input, action: 'resolve' } : { action: 'none' }),
      })
      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? 'No se pudo guardar la selección.')
      }
      await load()
      return
    }

    setItems((current) => current.map((item) => {
      if (item.id !== id) return item
      if (!input) return { ...item, status: 'removed' as const, updatedAt: new Date() }
      const productId = `manual-${crypto.randomUUID()}`
      const now = new Date()
      return {
        ...item,
        productId,
        updatedAt: now,
        product: {
          id: productId,
          slug: `local-${productId}`,
          name: input.name,
          brand: input.brand,
          category: input.category,
          imageUrl: input.imageUrl || item.product.imageUrl,
          offers: input.productUrl && input.price !== undefined ? [{
            id: `offer-${productId}`, productId, store: input.store || safeDomain(input.productUrl), storeUrl: input.productUrl,
            currentPrice: input.price, currency: 'EUR', availability: 'unknown', lastCheckedAt: now,
            priceHistory: [{ id: `observation-${productId}`, productOfferId: `offer-${productId}`, price: input.price, currency: 'EUR', availability: 'unknown', checkedAt: now }],
          }] : [],
        },
      }
    }))
  }, [load, mode])

  function resetLocalDemo() {
    window.localStorage.removeItem(STORAGE_KEY)
    setItems(MOCK_WISHLIST_ITEMS)
  }

  return { items, mode, error, updateItem, addItem, resolveItem, resetLocalDemo, reload: load }
}

function reviveItems(items: WishlistItem[]): WishlistItem[] {
  return items.map((item) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    product: {
      ...item.product,
      offers: item.product.offers.map((offer) => ({
        ...offer,
        lastCheckedAt: offer.lastCheckedAt ? new Date(offer.lastCheckedAt) : undefined,
        priceHistory: offer.priceHistory.map((observation) => ({ ...observation, checkedAt: new Date(observation.checkedAt) })),
      })),
    },
  }))
}

function safeDomain(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return 'Tienda' }
}
