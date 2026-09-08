'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useWishlistData, type ManualWishlistItem } from '@/hooks/useWishlistData'
import { resolveDisplayImageUrl } from '@/lib/image-url'
import { extractDroppedProductPayload } from '@/lib/dnd-parser'

export default function NeedsReviewList() {
  const { items, resolveItem, dropResolveItem } = useWishlistData()
  const [editing, setEditing] = useState<string>()
  const [error, setError] = useState<string>()
  const [dragOverItemId, setDragOverItemId] = useState<string>()
  const [resolvingItemId, setResolvingItemId] = useState<string>()

  const reviewItems = items.filter(
    (item) => item.status !== 'removed' && (item.resolutionStatus === 'needs_review' || !item.productId)
  )

  async function submit(event: FormEvent<HTMLFormElement>, itemId: string, priority: ManualWishlistItem['priority']) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const price = String(form.get('price') ?? '').trim()
    setError(undefined)
    try {
      await resolveItem(itemId, {
        name: String(form.get('name') ?? '').trim(),
        brand: optional(form, 'brand'),
        category: String(form.get('category')) as ManualWishlistItem['category'],
        imageUrl: optional(form, 'imageUrl'),
        productUrl: optional(form, 'productUrl'),
        store: optional(form, 'store'),
        price: price ? Number(price) : undefined,
        currency: 'EUR',
        priority,
      })
      setEditing(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar.')
    }
  }

  async function handleDropOnItem(itemId: string, e: React.DragEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverItemId(undefined)
    setError(undefined)

    const payload = extractDroppedProductPayload(e.dataTransfer)
    if (!payload.url && !payload.imageUrl && !payload.title) {
      setError('No se detectó un enlace o imagen válida.')
      return
    }

    try {
      setResolvingItemId(itemId)
      await dropResolveItem(itemId, {
        url: payload.url,
        imageUrl: payload.imageUrl,
        title: payload.title,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al identificar producto arrastrado.')
    } finally {
      setResolvingItemId(undefined)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#831843] uppercase">Review Queue</span>
          <p className="text-xs text-neutral-500">{reviewItems.length} unidentified pins pending confirmation</p>
        </div>
        <Link
          href="/wishlist"
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:border-[#831843] hover:text-[#831843]"
        >
          ← Back to wishlist
        </Link>
      </div>

      {error && <p className="mb-4 rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700">{error}</p>}

      {!reviewItems.length ? (
        <div className="rounded-3xl border border-rose-100/70 bg-white p-12 text-center text-neutral-500 shadow-2xs">
          <span className="text-3xl">✨</span>
          <h3 className="mt-2 font-serif text-lg font-bold text-neutral-900">All caught up!</h3>
          <p className="mt-1 text-xs text-neutral-400">All imported pins have been identified or confirmed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviewItems.map((item) => {
            const displayImg = resolveDisplayImageUrl(item.product.imageUrl, item.product.localImagePath)
            const isDraggingOverThis = dragOverItemId === item.id
            const isResolvingThis = resolvingItemId === item.id

            return (
              <article
                key={item.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (dragOverItemId !== item.id) setDragOverItemId(item.id)
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOverItemId(item.id)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (dragOverItemId === item.id) setDragOverItemId(undefined)
                }}
                onDrop={(e) => void handleDropOnItem(item.id, e)}
                className={`relative grid gap-6 rounded-3xl border p-5 shadow-2xs transition-all duration-300 md:grid-cols-[180px_1fr] ${
                  isDraggingOverThis
                    ? 'border-[#831843] bg-[#fbc6e0]/20 shadow-xl ring-4 ring-[#831843]/15 scale-[1.01]'
                    : 'border-rose-100/80 bg-white'
                }`}
              >
                {/* Drag over overlay */}
                {isDraggingOverThis && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl bg-[#831843]/85 p-4 text-center text-white backdrop-blur-xs">
                    <span className="text-3xl animate-bounce">✨</span>
                    <p className="mt-2 font-serif text-base font-bold">Soltar producto aquí para identificar</p>
                    <p className="mt-0.5 text-xs text-rose-100">Se extraerán precio, marca, tienda y datos de la web</p>
                  </div>
                )}

                {/* Resolving overlay */}
                {isResolvingThis && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl bg-white/95 p-4 text-center text-neutral-900 backdrop-blur-xs">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#831843] border-t-transparent" />
                    <p className="mt-2 text-xs font-semibold text-[#831843]">Identificando producto desde la web…</p>
                    <p className="mt-0.5 text-[10px] text-neutral-400">Extrayendo datos de la tienda</p>
                  </div>
                )}

                <div className="aspect-square overflow-hidden rounded-2xl border border-neutral-100 bg-[#FAF7F2]">
                  {displayImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayImg} alt="Pinterest Pin" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-4xl text-rose-200">♥</div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold tracking-widest text-[#831843] uppercase">
                      Unidentified Pin
                    </span>
                    <span className="hidden sm:inline-block rounded-full bg-rose-50 border border-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-[#831843]">
                      💡 Arrastra un enlace o foto aquí
                    </span>
                  </div>
                  <h2 className="mt-1 font-serif text-2xl font-bold text-neutral-900">{item.product.name}</h2>
                  <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                    No automatic high-confidence match was verified. You can drag and drop a product link from Zara, Amazon, etc. directly onto this card, identify it manually, or mark it as not a product.
                  </p>

                  {editing === item.id ? (
                    <form onSubmit={(event) => void submit(event, item.id, item.priority)} className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Input name="name" label="Product name *" defaultValue={item.product.name.replace(' (unidentified)', '').replace('Pin pendiente de identificar', '')} required />
                      <Input name="brand" label="Brand" />
                      <label className="text-xs font-semibold text-neutral-600">
                        Category
                        <select name="category" defaultValue={item.product.category} className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3 py-2 text-xs">
                          {['clothes', 'shoes', 'beauty', 'home', 'other'].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <Input name="price" label="Price (€)" type="number" step="0.01" min="0" />
                      <Input name="store" label="Store" />
                      <Input name="productUrl" label="Purchase URL" type="url" />
                      <div className="sm:col-span-2">
                        <Input name="imageUrl" label="Image URL" type="url" defaultValue={item.product.imageUrl} />
                      </div>
                      <div className="sm:col-span-2 flex gap-3 pt-2">
                        <button className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-[#831843]">
                          Save product
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(undefined)}
                          className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEditing(item.id)}
                        className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold tracking-wide text-white transition hover:bg-[#831843]"
                      >
                        Identify manually
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolveItem(item.id, null)}
                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        None of these / Not a product
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...input } = props
  return (
    <label className="text-xs font-semibold text-neutral-600">
      {label}
      <input {...input} className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-3 py-2 text-xs" />
    </label>
  )
}

function optional(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim() || undefined
}
