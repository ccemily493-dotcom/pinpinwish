'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { getBestOffer } from '@pinpinwish/wishlist-core'
import { formatPrice } from '@pinpinwish/shared'
import type { Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { resolveDisplayImageUrl } from '@/lib/image-url'
import { extractDroppedProductPayload } from '@/lib/dnd-parser'
import { resolveOriginLink } from '@/lib/origin-link'
import type { UpdateWishlistItemPayload } from '@/hooks/useWishlistData'

const PRIORITY_STYLES: Record<Priority, string> = {
  dream: 'bg-purple-100 text-purple-800 border-purple-200',
  high: 'bg-rose-100 text-[#831843] border-rose-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  dream: '✨ Dream',
  high: '♥ High',
  medium: 'Medium',
  low: 'Low',
}

type Props = {
  item: WishlistItem
  currency: Currency
  onUpdate?: (id: string, updates: UpdateWishlistItemPayload) => void
  onDelete?: (id: string) => void
  onEdit?: (item: WishlistItem) => void
  onDropResolve?: (id: string, payload: { url?: string; imageUrl?: string; title?: string }) => Promise<void>
}

export default function WishlistCard({ item, currency, onUpdate, onDelete, onEdit, onDropResolve }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  const bestOffer = getBestOffer(item.product.offers, currency)
  const isUnresolved = item.resolutionStatus === 'needs_review' || !item.productId
  const isPurchased = item.status === 'purchased'
  const isArchived = item.status === 'archived' || item.status === 'removed'
  const isDuplicate = item.possibleDuplicateOf !== undefined
  const displayImage = resolveDisplayImageUrl(item.product.imageUrl, item.product.localImagePath)
  const originLink = resolveOriginLink(item)

  async function handleDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setErrorMessage(undefined)

    if (!onDropResolve) return

    const payload = extractDroppedProductPayload(e.dataTransfer)
    if (!payload.url && !payload.imageUrl && !payload.title) {
      setErrorMessage('No se encontró enlace o imagen válida.')
      return
    }

    try {
      setIsResolving(true)
      await onDropResolve(item.id, {
        url: payload.url,
        imageUrl: payload.imageUrl,
        title: payload.title,
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al resolver producto.')
    } finally {
      setIsResolving(false)
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
      } ${isPurchased ? 'opacity-70 grayscale-30' : isArchived ? 'opacity-60 bg-neutral-50/70' : ''}`}
      role="listitem"
    >
      {/* Drop overlay when dragged over */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#831843]/85 p-4 text-center text-white backdrop-blur-xs transition-all">
          <span className="text-3xl animate-bounce">✨</span>
          <p className="mt-2 font-serif text-sm font-bold">Soltar aquí para asociar</p>
          <p className="mt-0.5 text-[10px] text-rose-100">Se extraerán precio, tienda y fotos de la web</p>
        </div>
      )}

      {/* Resolving spinner overlay */}
      {isResolving && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 p-4 text-center text-neutral-900 backdrop-blur-xs">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#831843] border-t-transparent" />
          <p className="mt-2 text-xs font-semibold text-[#831843]">Identificando producto…</p>
          <p className="mt-0.5 text-[10px] text-neutral-400">Consultando metadatos de la tienda</p>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="absolute top-2 left-2 right-2 z-20 rounded-xl bg-red-600 px-2 py-1 text-center text-[10px] font-semibold text-white shadow-sm">
          {errorMessage}
        </div>
      )}

      {/* Status & duplicate badges */}
      <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
        {isPurchased && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
            Purchased
          </span>
        )}
        {isArchived && (
          <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
            📦 Baúl
          </span>
        )}
        {isUnresolved && !isPurchased && !isArchived && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
            Needs review
          </span>
        )}
        {isDuplicate && (
          <span className="rounded-full bg-amber-200 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-xs">
            Duplicate?
          </span>
        )}
      </div>

      {/* Priority badge */}
      <div className="absolute right-2.5 top-2.5 z-10">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-2xs backdrop-blur-xs ${
            PRIORITY_STYLES[item.priority]
          }`}
        >
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>

      {/* Image container */}
      <Link
        href={`/products/${item.product.slug}`}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-neutral-100"
      >
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage}
            alt={item.product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#FAF7F2]">
            <span className="text-3xl text-rose-200">♥</span>
          </div>
        )}
      </Link>

      {/* Card Info */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <div className="flex items-center justify-between gap-1">
            {item.product.brand && (
              <p className="truncate text-[10px] font-bold tracking-widest text-[#831843] uppercase">
                {item.product.brand}
              </p>
            )}
            {originLink.url && (
              <a
                href={originLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold text-[#831843] hover:underline"
                title={`Abrir en ${originLink.storeName} (1 clic)`}
              >
                {originLink.storeName} ↗
              </a>
            )}
          </div>

          <Link
            href={`/products/${item.product.slug}`}
            className="mt-0.5 block font-serif text-sm font-semibold leading-tight text-neutral-900 transition hover:text-[#831843] line-clamp-2"
          >
            {item.product.name}
          </Link>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            {bestOffer ? (
              <>
                <span className="text-sm font-bold text-neutral-900">
                  {formatPrice(bestOffer.currentPrice, bestOffer.currency)}
                </span>
                {bestOffer.availability === 'out_of_stock' && (
                  <span className="text-[10px] font-medium text-red-500">(Out of stock)</span>
                )}
              </>
            ) : isUnresolved ? (
              <span className="text-[11px] italic text-neutral-400">Price unknown · Drag link here</span>
            ) : (
              <span className="text-[11px] text-neutral-400">—</span>
            )}
          </div>
        </div>

        {/* Action Bar with Priority, Edit, Bought, Baúl and confirmed deletion */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-rose-50 pt-2.5 text-xs">
          {onUpdate && !isArchived && (
            <select
              aria-label={`Priority for ${item.product.name}`}
              value={item.priority}
              onChange={(event) => onUpdate(item.id, { priority: event.target.value as Priority })}
              className="min-w-0 flex-1 rounded-full border border-neutral-200 bg-[#FAF7F2] px-2 py-1 text-[11px] font-medium capitalize text-neutral-700 focus:outline-hidden"
            >
              {['low', 'medium', 'high', 'dream'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          )}

          {onEdit && (
            <button
              type="button"
              aria-label={`Editar ${item.product.name}`}
              onClick={() => onEdit(item)}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-[#831843] hover:text-[#831843]"
              title="Editar datos del producto"
            >
              ✏️
            </button>
          )}

          {onUpdate && !isArchived && (
            <button
              type="button"
              onClick={() =>
                onUpdate(item.id, {
                  status: item.status === 'purchased' ? 'wanted' : 'purchased',
                })
              }
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-[#831843] hover:text-[#831843]"
              title={item.status === 'purchased' ? 'Desmarcar comprado' : 'Marcar como comprado'}
            >
              {item.status === 'purchased' ? '✓ Comprado' : 'Comprado'}
            </button>
          )}

          {onUpdate && isArchived && (
            <button
              type="button"
              onClick={() => onUpdate(item.id, { status: 'wanted' })}
              className="flex-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-2xs"
              title="Restaurar a mi wishlist activa"
            >
              ↺ Restaurar
            </button>
          )}

          {onUpdate && !isArchived && (
            <button
              type="button"
              aria-label={`Mandar ${item.product.name} al baúl`}
              onClick={() => onUpdate(item.id, { status: 'archived' })}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 shadow-2xs"
              title="Mandar al baúl (archivar)"
            >
              📦 Baúl
            </button>
          )}

          {/* Confirmed permanent deletion */}
          {onDelete && (
            <button
              type="button"
              aria-label={`Eliminar por completo ${item.product.name}`}
              onClick={() => onDelete(item.id)}
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 shadow-2xs"
              title="Eliminar producto permanentemente (requiere confirmación)"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
