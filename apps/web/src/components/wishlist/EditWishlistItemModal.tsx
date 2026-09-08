'use client'

import { useState, type FormEvent } from 'react'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import type { Category, Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { resolveDisplayImageUrl } from '@/lib/image-url'
import type { UpdateWishlistItemPayload } from '@/hooks/useWishlistData'

interface Props {
  item: WishlistItem | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, updates: UpdateWishlistItemPayload) => Promise<void>
}

export default function EditWishlistItemModal({ item, isOpen, onClose, onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [customImageUrl, setCustomImageUrl] = useState<string>()

  if (!isOpen || !item) return null

  const bestOffer = item.product.offers[0]
  const initialImage = resolveDisplayImageUrl(item.product.imageUrl, item.product.localImagePath)
  const currentImage = customImageUrl !== undefined ? customImageUrl : initialImage

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!item) return

    setErrorMessage(undefined)
    const form = new FormData(e.currentTarget)

    const name = String(form.get('name') ?? '').trim()
    if (!name) {
      setErrorMessage('El nombre del producto es obligatorio.')
      return
    }

    const priceRaw = String(form.get('price') ?? '').trim()
    const price = priceRaw ? Number(priceRaw) : undefined
    const brand = optionalString(form.get('brand'))
    const category = form.get('category') as Category
    const imageUrl = optionalString(form.get('imageUrl'))
    const store = optionalString(form.get('store'))
    const storeUrl = optionalString(form.get('storeUrl'))
    const priority = form.get('priority') as Priority
    const status = form.get('status') as WishlistItemStatus
    const desiredSize = optionalString(form.get('desiredSize'))
    const desiredColor = optionalString(form.get('desiredColor'))
    const notes = optionalString(form.get('notes'))

    try {
      setIsSaving(true)
      await onSave(item.id, {
        name,
        brand,
        category,
        imageUrl,
        store,
        storeUrl,
        price,
        currency: 'EUR',
        priority,
        status,
        desiredSize,
        desiredColor,
        notes,
      })
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar los cambios.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
    >
      <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 bg-[#FAF7F2] px-6 py-4">
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#831843] uppercase">
              Editar Artículo
            </span>
            <h2 id="edit-modal-title" className="font-serif text-xl font-bold text-neutral-900">
              Modificar Pin de la Wishlist
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de edición"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Top section: image preview & main fields */}
          <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
            {/* Image Preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-rose-100 bg-[#FAF7F2] shadow-2xs">
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentImage}
                    alt={item.product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-rose-200">
                    ♥
                  </div>
                )}
              </div>
              <span className="text-[10px] text-neutral-400">Vista previa</span>
            </div>

            {/* Core Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={item.product.name.replace(' (unidentified)', '').replace('Pin pendiente de identificar', '')}
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700">Marca / Diseñador</label>
                  <input
                    type="text"
                    name="brand"
                    defaultValue={item.product.brand || ''}
                    placeholder="Ej. Zara, Mango, Nike"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700">Categoría</label>
                  <select
                    name="category"
                    defaultValue={item.product.category || 'other'}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                  >
                    <option value="clothes">Ropa (Clothes)</option>
                    <option value="shoes">Zapatos (Shoes)</option>
                    <option value="beauty">Belleza (Beauty)</option>
                    <option value="home">Hogar (Home)</option>
                    <option value="other">Otro (Other)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">URL de Imagen</label>
                <input
                  type="url"
                  name="imageUrl"
                  defaultValue={item.product.imageUrl || ''}
                  onChange={(e) => setCustomImageUrl(e.target.value.trim() || undefined)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                />
              </div>
            </div>
          </div>

          {/* Price & Store Offer */}
          <div className="rounded-2xl border border-rose-100/80 bg-[#FAF7F2]/50 p-4 space-y-3">
            <span className="text-[10px] font-bold tracking-wider text-[#831843] uppercase">
              Precio y Tienda
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700">Precio (€)</label>
                <input
                  type="number"
                  name="price"
                  step="0.01"
                  min="0"
                  defaultValue={bestOffer?.currentPrice !== undefined ? bestOffer.currentPrice : ''}
                  placeholder="49.95"
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">Nombre de Tienda</label>
                <input
                  type="text"
                  name="store"
                  defaultValue={bestOffer?.store || ''}
                  placeholder="Ej. Zara, ASOS"
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">Enlace de Compra</label>
                <input
                  type="url"
                  name="storeUrl"
                  defaultValue={bestOffer?.storeUrl || ''}
                  placeholder="https://tienda.com/producto"
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
                />
              </div>
            </div>
          </div>

          {/* Preferences & Wishlist details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Prioridad</label>
              <select
                name="priority"
                defaultValue={item.priority}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
              >
                <option value="dream">✨ Dream (Deseo Máximo)</option>
                <option value="high">♥ High (Alta)</option>
                <option value="medium">Medium (Media)</option>
                <option value="low">Low (Baja)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700">Talla deseada</label>
              <input
                type="text"
                name="desiredSize"
                defaultValue={item.desiredSize || ''}
                placeholder="Ej. S, 38, M"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700">Color deseado</label>
              <input
                type="text"
                name="desiredColor"
                defaultValue={item.desiredColor || ''}
                placeholder="Ej. Burdeos, Negro"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
              />
            </div>
          </div>

          {/* Status & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Estado</label>
              <select
                name="status"
                defaultValue={item.status}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
              >
                <option value="wanted">En mi Wishlist activa (Wanted)</option>
                <option value="archived">En el Baúl / Archivo (Archived)</option>
                <option value="purchased">Comprado (Purchased)</option>
                <option value="removed">Eliminado (Removed)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700">Notas personales</label>
              <input
                type="text"
                name="notes"
                defaultValue={item.notes || ''}
                placeholder="Ej. Esperar a rebajas, pedir para cumpleaños…"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3.5 py-2 text-xs text-neutral-900 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-rose-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-[#831843] px-6 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#671028] disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando…
                </>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const str = String(value ?? '').trim()
  return str.length > 0 ? str : undefined
}
