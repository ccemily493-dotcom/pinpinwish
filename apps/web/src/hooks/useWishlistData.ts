'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import type { Category, Priority, WishlistItemStatus } from '@pinpinwish/shared'

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
  const [items, setItems] = useState<WishlistItem[]>([])
  const [mode, setMode] = useState<'loading' | 'local'>('loading')
  const [error, setError] = useState<string>()

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/wishlist', { cache: 'no-store' })
      const data = (await response.json()) as { items?: WishlistItem[]; error?: string }
      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || 'No se pudo abrir la base de datos local.')
      }
      setItems(reviveItems(data.items))
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la wishlist local.')
    } finally {
      setMode('local')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateItem = useCallback(
    async (
      id: string,
      updates: {
        priority?: Priority
        status?: WishlistItemStatus
        desiredSize?: string
        desiredColor?: string
        notes?: string
      }
    ) => {
      setError(undefined)
      try {
        const response = await fetch(`/api/wishlist/items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el artículo.')
        await load()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el artículo.')
      }
    },
    [load]
  )

  const addItem = useCallback(
    async (input: ManualWishlistItem) => {
      setError(undefined)
      try {
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo guardar el artículo.')
        await load()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo guardar el artículo.')
      }
    },
    [load]
  )

  const resolveItem = useCallback(
    async (id: string, input: ManualWishlistItem | null) => {
      setError(undefined)
      try {
        const response = await fetch(`/api/wishlist/items/${id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input ? { ...input, action: 'resolve' } : { action: 'none' }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo resolver el artículo.')
        await load()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo resolver el artículo.')
      }
    },
    [load]
  )

  return { items, mode, error, updateItem, addItem, resolveItem, reload: load }
}

function reviveItems(items: WishlistItem[]): WishlistItem[] {
  return items.map((item) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    product: {
      ...item.product,
      offers: (item.product.offers || []).map((offer) => ({
        ...offer,
        lastCheckedAt: offer.lastCheckedAt ? new Date(offer.lastCheckedAt) : undefined,
        priceHistory: (offer.priceHistory || []).map((observation) => ({
          ...observation,
          checkedAt: new Date(observation.checkedAt),
        })),
      })),
    },
  }))
}
