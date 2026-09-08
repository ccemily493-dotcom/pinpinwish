'use client'

import { useState } from 'react'
import { formatPrice } from '@pinpinwish/shared'
import { resolveDisplayImageUrl } from '@/lib/image-url'
import { extractDroppedProductPayload } from '@/lib/dnd-parser'
import type { PinGroupView } from '@/hooks/useWishlistData'

interface Props {
  pin: PinGroupView
  onSelect: (pin: PinGroupView) => void
  onDropProduct: (pinId: string, payload: { url?: string; imageUrl?: string; title?: string }) => Promise<void>
  onArchive?: (pinId: string) => void
  onRestore?: (pinId: string) => void
  onDelete?: (pinId: string) => void
}

export default function PinCard({ pin, onSelect, onDropProduct, onArchive, onRestore, onDelete }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDropping, setIsDropping] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  const displayImage = resolveDisplayImageUrl(pin.imageUrl, pin.localImagePath)
  const validProducts = pin.items.filter((i) => i.productId && i.resolutionStatus === 'resolved')
  const unresolvedCount = pin.items.filter((i) => !i.productId || i.resolutionStatus === 'needs_review').length

  async function handleDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setErrorMessage(undefined)

    const payload = extractDroppedProductPayload(e.dataTransfer)
    if (!payload.url && !payload.imageUrl && !payload.title) {
      setErrorMessage('No se encontró enlace o imagen.')
      return
    }

    try {
      setIsDropping(true)
      await onDropProduct(pin.id, {
        url: payload.url,
        imageUrl: payload.imageUrl,
        title: payload.title,
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al añadir producto.')
    } finally {
      setIsDropping(false)
    }
  }

  return (
    <article
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isDragOver) setIsDragOver(true)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
      }}
      onDrop={handleDrop}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-white shadow-2xs transition-all duration-300 ${
        isDragOver
          ? 'scale-[1.02] border-[#831843] bg-[#fbc6e0]/20 shadow-xl ring-4 ring-[#831843]/15 z-20'
          : 'border-rose-100/70 hover:-translate-y-0.5 hover:shadow-md'
      } ${pin.isArchived ? 'opacity-60 bg-neutral-50/70' : ''}`}
      role="listitem"
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#831843]/85 p-4 text-center text-white backdrop-blur-xs">
          <span className="text-3xl animate-bounce">👗</span>
          <p className="mt-2 font-serif text-sm font-bold">+ Añadir producto a este Look</p>
          <p className="mt-0.5 text-[10px] text-rose-100">Se agregará a los productos individuales de la foto</p>
        </div>
      )}

      {/* Dropping spinner */}
      {isDropping && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 p-4 text-center text-neutral-900 backdrop-blur-xs">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#831843] border-t-transparent" />
          <p className="mt-2 text-xs font-semibold text-[#831843]">Añadiendo producto al Pin…</p>
          <p className="mt-0.5 text-[10px] text-neutral-400">Extrayendo datos de la tienda</p>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="absolute top-2 left-2 right-2 z-20 rounded-xl bg-red-600 px-2 py-1 text-center text-[10px] font-semibold text-white shadow-sm">
          {errorMessage}
        </div>
      )}

      {/* Top Badges */}
      <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
        {pin.isArchived ? (
          <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs backdrop-blur-xs">
            📦 En el Baúl
          </span>
        ) : (
          <span className="rounded-full bg-neutral-900/80 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs backdrop-blur-xs">
            📍 Pin / Look
          </span>
        )}
        {unresolvedCount > 0 && validProducts.length === 0 && !pin.isArchived && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
            Sin identificar · Arrastra prendas
          </span>
        )}
      </div>

      {/* Products count pill */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <span className="rounded-full border border-rose-200/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-[#831843] shadow-2xs backdrop-blur-xs">
          {validProducts.length} {validProducts.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      {/* Main Image Clickable */}
      <button
        type="button"
        onClick={() => onSelect(pin)}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-neutral-100 text-left focus:outline-hidden"
      >
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt={pin.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#FAF7F2]">
            <span className="text-3xl text-rose-200">♥</span>
          </div>
        )}
      </button>

      {/* Card Info */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <button
            type="button"
            onClick={() => onSelect(pin)}
            className="text-left font-serif text-sm font-semibold leading-tight text-neutral-900 transition hover:text-[#831843] line-clamp-2"
          >
            {pin.title}
          </button>

          {/* Individual product bubbles inside this pin */}
          {validProducts.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden">
              <div className="flex -space-x-1.5 overflow-hidden">
                {validProducts.slice(0, 4).map((item) => {
                  const itemImg = resolveDisplayImageUrl(item.product.imageUrl, item.product.localImagePath)
                  return (
                    <div
                      key={item.id}
                      className="inline-block h-6 w-6 overflow-hidden rounded-full border border-white bg-neutral-100 shadow-2xs"
                      title={`${item.product.name} (${item.product.brand || 'Tienda'})`}
                    >
                      {itemImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={itemImg} alt={item.product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-rose-50 text-[8px] text-[#831843]">
                          ♥
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {validProducts.length > 4 && (
                <span className="text-[10px] font-bold text-neutral-400">+{validProducts.length - 4}</span>
              )}
            </div>
          )}

          {/* Total Look Price */}
          <div className="mt-3 flex items-baseline justify-between rounded-xl bg-[#FAF7F2] p-2 border border-rose-100/60">
            <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              Total Foto:
            </span>
            <span className="text-sm font-bold text-[#831843]">
              {pin.totalPrice > 0 ? formatPrice(pin.totalPrice, pin.currency) : 'Precio sin calcular'}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 pt-2 border-t border-rose-50 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onSelect(pin)}
            className="w-full rounded-full border border-neutral-200 bg-white py-1.5 text-center text-xs font-semibold text-neutral-700 transition hover:border-[#831843] hover:text-[#831843] hover:bg-rose-50/50 shadow-2xs"
          >
            Ver productos del Look ({pin.productsCount}) →
          </button>

          <div className="flex items-center justify-between gap-1.5 text-xs">
            {pin.isArchived ? (
              onRestore && (
                <button
                  type="button"
                  onClick={() => onRestore(pin.id)}
                  className="flex-1 rounded-full border border-emerald-300 bg-emerald-50 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs"
                >
                  ↺ Restaurar Look
                </button>
              )
            ) : (
              onArchive && (
                <button
                  type="button"
                  onClick={() => onArchive(pin.id)}
                  className="flex-1 rounded-full border border-neutral-200 bg-white py-1.5 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 shadow-2xs"
                  title="Mandar este look completo al baúl (1 clic)"
                >
                  📦 Mandar al Baúl
                </button>
              )
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(pin.id)}
                className="rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] text-neutral-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 shadow-2xs"
                title="Eliminar Look y productos por completo (requiere confirmación)"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
