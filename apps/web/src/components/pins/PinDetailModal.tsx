'use client'

import { useState } from 'react'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { formatPrice } from '@pinpinwish/shared'
import { resolveDisplayImageUrl } from '@/lib/image-url'
import { extractDroppedProductPayload } from '@/lib/dnd-parser'
import { resolveOriginLink } from '@/lib/origin-link'
import type { PinGroupView, UpdateWishlistItemPayload } from '@/hooks/useWishlistData'
import EditWishlistItemModal from '@/components/wishlist/EditWishlistItemModal'

interface Props {
  pin: PinGroupView | null
  isOpen: boolean
  onClose: () => void
  onDropProduct: (pinId: string, payload: { url?: string; imageUrl?: string; title?: string }) => Promise<void>
  onUpdateItem: (id: string, updates: UpdateWishlistItemPayload) => Promise<void>
  onDeleteItem: (id: string) => Promise<void>
  onArchivePin?: (pinId: string) => Promise<void>
  onRestorePin?: (pinId: string) => Promise<void>
  onDeletePin?: (pinId: string) => Promise<boolean>
}

export default function PinDetailModal({
  pin,
  isOpen,
  onClose,
  onDropProduct,
  onUpdateItem,
  onDeleteItem,
  onArchivePin,
  onRestorePin,
  onDeletePin,
}: Props) {
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [isDropZoneOver, setIsDropZoneOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  if (!isOpen || !pin) return null

  const pinImage = resolveDisplayImageUrl(pin.imageUrl, pin.localImagePath)
  const validItems = pin.items

  async function handleDropInModal(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDropZoneOver(false)
    setErrorMessage(undefined)

    const payload = extractDroppedProductPayload(e.dataTransfer)
    if (!payload.url && !payload.imageUrl && !payload.title) {
      setErrorMessage('No se encontró enlace o imagen válida.')
      return
    }

    try {
      setIsLoading(true)
      await onDropProduct(pin!.id, {
        url: payload.url,
        imageUrl: payload.imageUrl,
        title: payload.title,
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al añadir producto al Pin.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
    >
      <div className="relative my-6 w-full max-w-4xl overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-rose-100 bg-[#FAF7F2] px-6 py-4">
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#831843] uppercase">
              Desglose del Look & Prendas
            </span>
            <h2 id="pin-modal-title" className="font-serif text-xl font-bold text-neutral-900">
              {pin.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista de Pin"
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 rounded-2xl bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Content Body: Left Pin photo, Right products */}
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] max-h-[75vh] overflow-y-auto">
          {/* Left Column: Pin Overview */}
          <div className="border-b md:border-b-0 md:border-r border-rose-100 bg-[#FAF7F2]/40 p-6 flex flex-col gap-4">
            <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-rose-100/80 bg-white shadow-sm">
              {pinImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pinImage} alt={pin.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl text-rose-200">
                  ♥
                </div>
              )}
            </div>

            {/* Total Cost Banner */}
            <div className="rounded-2xl border border-rose-200/80 bg-white p-4 shadow-2xs">
              <span className="text-[10px] font-bold tracking-widest text-[#831843] uppercase">
                Precio Total del Look
              </span>
              <p className="mt-1 font-serif text-2xl font-bold text-neutral-900">
                {pin.totalPrice > 0 ? formatPrice(pin.totalPrice, pin.currency) : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Suma de {validItems.length} {validItems.length === 1 ? 'producto' : 'productos'} en esta foto
              </p>
            </div>

            {/* Look archive and confirmed permanent deletion */}
            <div className="flex flex-col gap-2 pt-2 border-t border-rose-100">
              {pin.isArchived ? (
                onRestorePin && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onRestorePin(pin.id)
                      onClose()
                    }}
                    className="w-full rounded-full border border-emerald-300 bg-emerald-50 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs"
                  >
                    ↺ Restaurar Look a la Wishlist
                  </button>
                )
              ) : (
                onArchivePin && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onArchivePin(pin.id)
                      onClose()
                    }}
                    className="w-full rounded-full border border-neutral-200 bg-white py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 shadow-2xs"
                    title="Mandar todas las prendas de esta foto al baúl"
                  >
                    📦 Mandar Look al Baúl
                  </button>
                )
              )}

              {onDeletePin && (
                <button
                  type="button"
                  onClick={async () => {
                    const deleted = await onDeletePin(pin.id)
                    if (deleted) onClose()
                  }}
                  className="w-full rounded-full border border-red-200 bg-white py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:border-red-300 shadow-2xs"
                  title="Eliminar permanentemente este Pin y todos sus productos (requiere confirmación)"
                >
                  🗑️ Eliminar Look por completo
                </button>
              )}
            </div>

            {pin.pinUrl && (
              <a
                href={pin.pinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white py-2 text-xs font-semibold text-neutral-700 hover:border-[#831843] hover:text-[#831843] transition"
              >
                <span>📌 Ver Pin original en Pinterest ↗</span>
              </a>
            )}
          </div>

          {/* Right Column: Individual Products in this Pin */}
          <div className="p-6 flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-neutral-900">
                  Prendas y Productos de la Foto ({validItems.length})
                </h3>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Haz clic en cualquier prenda o botón para ir directamente a la tienda de origen con 1 clic.
              </p>
            </div>

            {/* In-Modal Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!isDropZoneOver) setIsDropZoneOver(true)
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDropZoneOver(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDropZoneOver(false)
              }}
              onDrop={handleDropInModal}
              className={`rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                isDropZoneOver
                  ? 'border-[#831843] bg-[#fbc6e0]/30 shadow-md ring-2 ring-[#831843]/10 scale-[1.01]'
                  : 'border-rose-200/80 bg-[#FAF7F2] hover:border-[#831843]/60'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#831843]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#831843] border-t-transparent" />
                  Extrayendo producto desde la tienda web…
                </div>
              ) : (
                <div>
                  <p className="font-serif text-xs font-bold text-neutral-900">
                    📥 Arrastra aquí otra prenda/producto de la web
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Suelta enlaces o fotos de Zara, Mango, Amazon, etc. para asociar más productos a este look.
                  </p>
                </div>
              )}
            </div>

            {/* List of individual products */}
            {validItems.length === 0 ? (
              <div className="rounded-2xl border border-neutral-100 bg-[#FAF7F2] p-8 text-center text-neutral-400">
                <span className="text-3xl">👗</span>
                <p className="mt-2 text-xs font-medium">Aún no hay productos identificados en este Pin.</p>
                <p className="text-[11px] text-neutral-400">Arrastra un producto desde cualquier tienda web arriba.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validItems.map((item) => {
                  const bestOffer = item.product.offers[0]
                  const prodImg = resolveDisplayImageUrl(item.product.imageUrl, item.product.localImagePath)
                  const isItemArchived = item.status === 'archived' || item.status === 'removed'
                  const originLink = resolveOriginLink(item, pin)

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border bg-white p-3.5 shadow-2xs hover:border-rose-300 hover:shadow-sm transition ${
                        isItemArchived ? 'opacity-60 bg-neutral-50/70 border-neutral-200' : 'border-rose-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* 1-Click Product Image Link to Store */}
                        <a
                          href={originLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/img relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-100 bg-[#FAF7F2] transition hover:scale-105"
                          title={`Ir a ${originLink.storeName} (1 clic)`}
                        >
                          {prodImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={prodImg} alt={item.product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-rose-200 text-sm">♥</div>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 px-1 py-0.2 text-[8px] font-bold text-white opacity-0 group-hover/img:opacity-100 transition">
                            ↗
                          </span>
                        </a>

                        {/* Product Info & 1-Click Title */}
                        <div>
                          <div className="flex items-center gap-2">
                            {item.product.brand && (
                              <span className="text-[10px] font-bold tracking-widest text-[#831843] uppercase">
                                {item.product.brand}
                              </span>
                            )}
                            {isItemArchived && (
                              <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-[9px] font-bold text-white">
                                📦 En el Baúl
                              </span>
                            )}
                          </div>

                          <a
                            href={originLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-serif text-sm font-semibold text-neutral-900 leading-snug line-clamp-1 hover:text-[#831843] transition inline-flex items-center gap-1 group/title"
                            title={`Abrir producto en ${originLink.storeName} (1 clic)`}
                          >
                            <span>{item.product.name}</span>
                            <span className="text-[10px] text-neutral-400 group-hover/title:text-[#831843] transition">↗</span>
                          </a>

                          <div className="mt-1 flex items-center gap-2">
                            {bestOffer && bestOffer.currentPrice > 0 ? (
                              <span className="text-xs font-bold text-neutral-900">
                                {formatPrice(bestOffer.currentPrice, bestOffer.currency)}
                              </span>
                            ) : (
                              <span className="text-[11px] italic text-neutral-400">Precio no disponible</span>
                            )}
                            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                              {originLink.storeName}
                            </span>
                            {item.desiredSize && (
                              <span className="text-[10px] text-neutral-500">Talla: {item.desiredSize}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Store link, edit, archive and confirmed deletion */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {/* 1-Click Primary Store Link Button */}
                        <a
                          href={originLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-[#831843] px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#671028] transition"
                          title={`Ir directamente a ${originLink.storeName} (1 clic)`}
                        >
                          <span>{originLink.actionLabel} ↗</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setEditingItem(item)}
                          className="rounded-full border border-neutral-200 bg-white p-1.5 text-xs text-neutral-700 hover:border-[#831843] hover:text-[#831843] transition"
                          title="Editar detalles del producto"
                        >
                          ✏️
                        </button>

                        {isItemArchived ? (
                          <button
                            type="button"
                            onClick={() => void onUpdateItem(item.id, { status: 'wanted' })}
                            className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-100"
                            title="Restaurar a la wishlist activa"
                          >
                            ↺ Restaurar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void onUpdateItem(item.id, { status: 'archived' })}
                            className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                            title="Mandar prenda al baúl (archivar)"
                          >
                            📦 Baúl
                          </button>
                        )}

                        {/* Confirmed permanent deletion */}
                        <button
                          type="button"
                          onClick={() => void onDeleteItem(item.id)}
                          className="rounded-full border border-neutral-200 bg-white p-1.5 text-xs text-neutral-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition"
                          title="Eliminar producto de este Look (requiere confirmación)"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal for single product */}
      <EditWishlistItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={async (id, updates) => {
          await onUpdateItem(id, updates)
          setEditingItem(null)
        }}
      />
    </div>
  )
}
