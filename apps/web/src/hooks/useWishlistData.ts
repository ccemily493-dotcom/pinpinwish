'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import type { Category, Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'

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

export type UpdateWishlistItemPayload = {
  priority?: Priority
  status?: WishlistItemStatus
  desiredSize?: string
  desiredColor?: string
  notes?: string
  name?: string
  brand?: string
  category?: Category
  imageUrl?: string
  localImagePath?: string
  description?: string
  price?: number
  currency?: Currency
  store?: string
  storeUrl?: string
}

export interface PinGroupView {
  id: string
  pinterestPinId?: string
  title: string
  description?: string
  imageUrl?: string
  localImagePath?: string
  pinUrl?: string
  productsCount: number
  totalPrice: number
  currency: Currency
  items: WishlistItem[]
  isArchived?: boolean
}

export function useWishlistData() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [pins, setPins] = useState<PinGroupView[]>([])
  const [mode, setMode] = useState<'loading' | 'local'>('loading')
  const [error, setError] = useState<string>()

  const load = useCallback(async () => {
    try {
      const [itemsRes, pinsRes] = await Promise.all([
        fetch('/api/wishlist', { cache: 'no-store' }),
        fetch('/api/wishlist/pins', { cache: 'no-store' }),
      ])

      const itemsData = (await itemsRes.json()) as { items?: WishlistItem[]; error?: string }
      if (!itemsRes.ok || !Array.isArray(itemsData.items)) {
        throw new Error(itemsData.error || 'No se pudo abrir la base de datos local.')
      }

      const pinsData = (await pinsRes.json()) as { pins?: PinGroupView[]; error?: string }

      const revived = reviveItems(itemsData.items)
      setItems(revived)

      if (pinsRes.ok && Array.isArray(pinsData.pins)) {
        setPins(
          pinsData.pins.map((p) => ({
            ...p,
            items: reviveItems(p.items),
          }))
        )
      }

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
    async (id: string, updates: UpdateWishlistItemPayload) => {
      setError(undefined)
      // Optimistic update in items state and pins state
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item
          const updatedStatus = updates.status ?? item.status
          const updatedPriority = updates.priority ?? item.priority
          return {
            ...item,
            status: updatedStatus,
            priority: updatedPriority,
            desiredSize: updates.desiredSize !== undefined ? updates.desiredSize : item.desiredSize,
            desiredColor: updates.desiredColor !== undefined ? updates.desiredColor : item.desiredColor,
            notes: updates.notes !== undefined ? updates.notes : item.notes,
            product: {
              ...item.product,
              name: updates.name ?? item.product.name,
              brand: updates.brand !== undefined ? updates.brand : item.product.brand,
              category: updates.category ?? item.product.category,
              description: updates.description !== undefined ? updates.description : item.product.description,
              imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : item.product.imageUrl,
            },
            updatedAt: new Date(),
          }
        })
      )

      setPins((prev) =>
        prev.map((pin) => {
          const hasItem = pin.items.some((i) => i.id === id)
          if (!hasItem) return pin
          const newItems = pin.items.map((item) => {
            if (item.id !== id) return item
            return {
              ...item,
              status: updates.status ?? item.status,
              priority: updates.priority ?? item.priority,
              product: {
                ...item.product,
                name: updates.name ?? item.product.name,
                brand: updates.brand !== undefined ? updates.brand : item.product.brand,
                category: updates.category ?? item.product.category,
              },
            }
          })
          return {
            ...pin,
            items: newItems,
          }
        })
      )

      try {
        const response = await fetch(`/api/wishlist/items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el artículo.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el artículo.')
        await load()
        throw cause
      }
    },
    [load]
  )

  const archiveItem = useCallback(
    async (id: string) => {
      return updateItem(id, { status: 'archived' })
    },
    [updateItem]
  )

  const restoreItem = useCallback(
    async (id: string) => {
      return updateItem(id, { status: 'wanted' })
    },
    [updateItem]
  )

  const deleteItem = useCallback(
    async (id: string) => {
      setError(undefined)
      // Optimistic delete: immediately remove item from local items and pins state
      setItems((prev) => prev.filter((i) => i.id !== id))
      setPins((prev) =>
        prev.map((p) => {
          const remainingItems = p.items.filter((i) => i.id !== id)
          const newTotal = remainingItems.reduce((sum, itm) => {
            const price = itm.product?.offers?.[0]?.currentPrice ?? 0
            return sum + price
          }, 0)
          return {
            ...p,
            items: remainingItems,
            productsCount: remainingItems.length,
            totalPrice: newTotal,
          }
        })
      )

      try {
        const response = await fetch(`/api/wishlist/items/${id}`, {
          method: 'DELETE',
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el artículo.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el artículo.')
        await load()
        throw cause
      }
    },
    [load]
  )

  const archivePin = useCallback(
    async (pinId: string) => {
      setError(undefined)
      // Optimistic archive: mark pin as isArchived and all its items as archived
      setPins((prev) =>
        prev.map((p) =>
          p.id === pinId
            ? {
                ...p,
                isArchived: true,
                items: p.items.map((i) => ({ ...i, status: 'archived' as WishlistItemStatus })),
              }
            : p
        )
      )
      setItems((prev) =>
        prev.map((i) => (i.pinterestPinId === pinId ? { ...i, status: 'archived' as WishlistItemStatus } : i))
      )

      try {
        const response = await fetch(`/api/wishlist/pins/${encodeURIComponent(pinId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive' }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo mandar el Pin al baúl.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo mandar el Pin al baúl.')
        await load()
        throw cause
      }
    },
    [load]
  )

  const restorePin = useCallback(
    async (pinId: string) => {
      setError(undefined)
      // Optimistic restore: mark pin as not archived and all its items as wanted
      setPins((prev) =>
        prev.map((p) =>
          p.id === pinId
            ? {
                ...p,
                isArchived: false,
                items: p.items.map((i) => ({ ...i, status: 'wanted' as WishlistItemStatus })),
              }
            : p
        )
      )
      setItems((prev) =>
        prev.map((i) => (i.pinterestPinId === pinId ? { ...i, status: 'wanted' as WishlistItemStatus } : i))
      )

      try {
        const response = await fetch(`/api/wishlist/pins/${encodeURIComponent(pinId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo restaurar el Pin.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo restaurar el Pin.')
        await load()
        throw cause
      }
    },
    [load]
  )

  const deletePin = useCallback(
    async (pinId: string) => {
      setError(undefined)
      // Optimistic delete: remove pin from pins and all its items from items
      setPins((prev) => prev.filter((p) => p.id !== pinId))
      setItems((prev) => prev.filter((i) => i.pinterestPinId !== pinId))

      try {
        const response = await fetch(`/api/wishlist/pins/${encodeURIComponent(pinId)}`, {
          method: 'DELETE',
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(data.error || 'No se pudo eliminar el Pin.')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el Pin.')
        await load()
        throw cause
      }
    },
    [load]
  )

  const deduplicate = useCallback(async () => {
    setError(undefined)
    try {
      const response = await fetch('/api/wishlist/deduplicate', {
        method: 'POST',
      })
      const data = (await response.json()) as { ok?: boolean; removedCount?: number; message?: string; error?: string }
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error al eliminar duplicados.')
      }
      await load()
      return {
        ok: true,
        removedCount: data.removedCount || 0,
        message: data.message || 'Duplicados eliminados correctamente.',
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Error al eliminar duplicados.'
      setError(msg)
      throw cause
    }
  }, [load])

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

  const dropResolveItem = useCallback(
    async (id: string, payload: { url?: string; imageUrl?: string; title?: string }) => {
      setError(undefined)
      try {
        const response = await fetch(`/api/wishlist/items/${id}/drop-resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await response.json()) as { ok?: boolean; error?: string; item?: WishlistItem }
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'No se pudo identificar el producto arrastrado.')
        }
        await load()
        return data.item
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : 'Error al procesar el producto arrastrado.'
        setError(msg)
        throw cause
      }
    },
    [load]
  )

  const dropProductOnPin = useCallback(
    async (pinId: string, payload: { url?: string; imageUrl?: string; title?: string; priority?: Priority; category?: Category }) => {
      setError(undefined)
      try {
        const response = await fetch(`/api/wishlist/pins/${encodeURIComponent(pinId)}/add-product`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await response.json()) as { ok?: boolean; error?: string; item?: WishlistItem }
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'No se pudo añadir el producto al Pin.')
        }
        await load()
        return data.item
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : 'Error al añadir el producto al Pin.'
        setError(msg)
        throw cause
      }
    },
    [load]
  )

  const quickAddFromUrl = useCallback(
    async (payload: { url?: string; imageUrl?: string; title?: string; priority?: Priority; category?: Category }) => {
      setError(undefined)
      try {
        const response = await fetch('/api/wishlist/quick-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = (await response.json()) as { ok?: boolean; error?: string; item?: WishlistItem }
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'No se pudo añadir el producto arrastrado.')
        }
        await load()
        return data.item
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : 'Error al añadir el producto arrastrado.'
        setError(msg)
        throw cause
      }
    },
    [load]
  )

  return {
    items,
    pins,
    mode,
    error,
    updateItem,
    archiveItem,
    restoreItem,
    deleteItem,
    archivePin,
    restorePin,
    deletePin,
    deduplicate,
    addItem,
    resolveItem,
    dropResolveItem,
    dropProductOnPin,
    quickAddFromUrl,
    reload: load,
  }
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
