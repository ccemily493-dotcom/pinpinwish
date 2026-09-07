'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { getBestOffer } from '@pinpinwish/wishlist-core'
import { formatPrice, formatDate } from '@pinpinwish/shared'
import type { Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import type { ProductOffer, PriceObservation } from '@pinpinwish/price-tracker'
import { resolveDisplayImageUrl } from '@/lib/image-url'

interface Props {
  item: WishlistItem
  currency: Currency
  storageMode?: 'local' | 'cloud'
  onUpdate?: (id: string, updates: { priority?: Priority; status?: WishlistItemStatus; desiredSize?: string; desiredColor?: string; notes?: string }) => Promise<void>
}

export default function ProductDetailView({ item, currency, onUpdate }: Props) {
  const { product } = item
  const bestOffer = getBestOffer(product.offers, currency)
  const sortedOffers = [...product.offers].sort((a, b) => {
    if (a.currency === b.currency) return a.currentPrice - b.currentPrice
    if (a.currency === currency) return -1
    if (b.currency === currency) return 1
    return a.currency.localeCompare(b.currency)
  })

  const offersWithHistory = product.offers.filter((o) => o.priceHistory.length > 0)
  const defaultOfferId = bestOffer?.priceHistory.length
    ? bestOffer.id
    : offersWithHistory[0]?.id ?? product.offers[0]?.id

  const [selectedOfferId, setSelectedOfferId] = useState<string | undefined>(defaultOfferId)

  const selectedOffer = product.offers.find((o) => o.id === selectedOfferId) ?? bestOffer
  const selectedHistory = selectedOffer?.priceHistory
    ? [...selectedOffer.priceHistory].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())
    : []

  const displayImage = resolveDisplayImageUrl(product.imageUrl, product.localImagePath)

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-neutral-900 pb-16">
      {/* Header Banner */}
      <div className="border-b border-rose-100/70 bg-white/80 px-4 py-2 text-center text-xs tracking-wide text-neutral-600 backdrop-blur-xs">
        <span className="flex items-center justify-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Local Database · SQLite
        </span>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link
          href="/wishlist"
          className="mb-8 inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-neutral-500 transition hover:text-[#831843] uppercase focus:outline-hidden"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to wishlist
        </Link>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {/* Main Image */}
          <div className="aspect-square overflow-hidden rounded-3xl border border-rose-100/80 bg-white shadow-sm">
            {displayImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#FAF7F2]">
                <span className="text-8xl text-rose-200">♥</span>
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col gap-4">
            {product.brand && (
              <p className="text-xs font-bold tracking-[0.2em] text-[#831843] uppercase">
                {product.brand}
              </p>
            )}
            <h1 className="font-serif text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">
              {product.name}
            </h1>

            {bestOffer && (
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-neutral-900">
                  {formatPrice(bestOffer.currentPrice, bestOffer.currency)}
                </span>
                {bestOffer.availability === 'in_stock' ? (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    In stock
                  </span>
                ) : bestOffer.availability === 'out_of_stock' ? (
                  <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    Out of stock
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Stock unconfirmed
                  </span>
                )}
              </div>
            )}

            {product.description && (
              <p className="text-xs text-neutral-600 leading-relaxed">{product.description}</p>
            )}

            {/* Meta Grid */}
            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-rose-100/70 bg-white/70 p-4 text-xs">
              <div>
                <dt className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Category</dt>
                <dd className="mt-0.5 font-medium capitalize text-neutral-800">{product.category}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Priority</dt>
                <dd className="mt-0.5 font-medium capitalize text-neutral-800">{item.priority}</dd>
              </div>
              {item.desiredSize && (
                <div>
                  <dt className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Desired Size</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">{item.desiredSize}</dd>
                </div>
              )}
              {item.desiredColor && (
                <div>
                  <dt className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Desired Color</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">{item.desiredColor}</dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Added</dt>
                <dd className="mt-0.5 font-medium text-neutral-800">{formatDate(item.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Source</dt>
                <dd className="mt-0.5 font-medium capitalize text-neutral-800">{item.sourceType?.replace('_', ' ') || 'Pinterest'}</dd>
              </div>
            </dl>

            {item.notes && (
              <div className="rounded-2xl border border-rose-100 bg-white p-3 text-xs text-neutral-600 italic">
                “{item.notes}”
              </div>
            )}

            {onUpdate && <WishlistPreferences item={item} onUpdate={onUpdate} />}

            {item.pinterestPinId && (
              <div className="text-xs text-neutral-500 pt-2">
                <span className="font-semibold">Pinterest Pin:</span> {item.pinterestPinId}
                {item.pinUrl && (
                  <a
                    href={item.pinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 font-semibold text-[#831843] underline underline-offset-4 hover:text-[#671028]"
                  >
                    View original Pin ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Store Offers */}
        {sortedOffers.length > 0 && (
          <section className="mt-12" aria-label="Store offers">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#831843] uppercase">Pricing</span>
                <h2 className="font-serif text-2xl font-bold text-neutral-900">Available Stores</h2>
              </div>
              <span className="text-xs text-neutral-500">
                {sortedOffers.length} {sortedOffers.length === 1 ? 'store offer' : 'store offers'}
              </span>
            </div>

            <div className="overflow-hidden rounded-3xl border border-rose-100/80 bg-white shadow-2xs">
              <table className="w-full text-xs" role="table">
                <thead>
                  <tr className="border-b border-rose-100/70 bg-[#FAF7F2]/60">
                    <th className="px-5 py-3.5 text-left font-bold tracking-wider text-neutral-500 uppercase">Store</th>
                    <th className="px-5 py-3.5 text-left font-bold tracking-wider text-neutral-500 uppercase">Price</th>
                    <th className="px-5 py-3.5 text-left font-bold tracking-wider text-neutral-500 uppercase">Variant</th>
                    <th className="px-5 py-3.5 text-left font-bold tracking-wider text-neutral-500 uppercase">Stock</th>
                    <th className="px-5 py-3.5 text-right font-bold tracking-wider text-neutral-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOffers.map((offer: ProductOffer) => {
                    const isSelected = offer.id === selectedOfferId
                    const isBest = offer.id === bestOffer?.id
                    return (
                      <tr
                        key={offer.id}
                        onClick={() => setSelectedOfferId(offer.id)}
                        className={`border-b border-rose-50/70 last:border-0 cursor-pointer transition ${
                          isSelected ? 'bg-rose-50/50' : 'hover:bg-neutral-50/80'
                        }`}
                      >
                        <td className="px-5 py-4 font-semibold text-neutral-900">
                          <div className="flex items-center gap-2">
                            <span>{offer.store}</span>
                            {isBest && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                Best price
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold text-neutral-900">
                          {formatPrice(offer.currentPrice, offer.currency)}
                        </td>
                        <td className="px-5 py-4 text-neutral-500">
                          {offer.variant ? (
                            <span>
                              {[offer.variant.size && `Size ${offer.variant.size}`, offer.variant.color]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {offer.availability === 'in_stock' ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              In stock
                            </span>
                          ) : offer.availability === 'out_of_stock' ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-red-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Out of stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-amber-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Unknown
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <a
                            href={offer.storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold tracking-wider text-neutral-700 transition hover:border-[#831843] hover:text-[#831843]"
                          >
                            VIEW PRODUCT ↗
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Price History */}
        <section className="mt-12" aria-label="Price history">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#831843] uppercase">Tracking</span>
              <h2 className="font-serif text-2xl font-bold text-neutral-900">Price History by Store</h2>
            </div>

            {product.offers.length > 1 && (
              <div className="flex flex-wrap gap-1 rounded-2xl border border-rose-100 bg-white p-1">
                {product.offers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      offer.id === selectedOfferId
                        ? 'bg-[#831843] text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {offer.store} ({formatPrice(offer.currentPrice, offer.currency)})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-rose-100/80 bg-white p-6 shadow-2xs">
            {selectedOffer ? (
              <div>
                <div className="mb-6 flex items-center justify-between border-b border-rose-100/70 pb-4">
                  <div>
                    <h3 className="font-serif text-base font-bold text-neutral-900">{selectedOffer.store} Tracking Series</h3>
                    <p className="text-xs text-neutral-400">Current: {formatPrice(selectedOffer.currentPrice, selectedOffer.currency)}</p>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {selectedHistory.length} {selectedHistory.length === 1 ? 'observation' : 'observations'}
                  </span>
                </div>

                {selectedHistory.length >= 2 ? (
                  <SingleStorePriceChart history={selectedHistory} storeName={selectedOffer.store} />
                ) : (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    Showing initial observation for {selectedOffer.store}. Historical trend will appear as prices update.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No price observations available for this product.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function WishlistPreferences({ item, onUpdate }: { item: WishlistItem; onUpdate: NonNullable<Props['onUpdate']> }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    const form = new FormData(event.currentTarget)
    await onUpdate(item.id, {
      priority: String(form.get('priority')) as Priority,
      status: String(form.get('status')) as WishlistItemStatus,
      desiredSize: String(form.get('desiredSize') ?? ''),
      desiredColor: String(form.get('desiredColor') ?? ''),
      notes: String(form.get('notes') ?? ''),
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-2 rounded-2xl border border-rose-100/80 bg-white p-4 shadow-2xs">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#831843]">Wishlist Preferences</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-neutral-500">
          Priority
          <select
            name="priority"
            defaultValue={item.priority}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-2.5 py-1.5 text-xs capitalize"
          >
            {['low', 'medium', 'high', 'dream'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Status
          <select
            name="status"
            defaultValue={item.status}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-2.5 py-1.5 text-xs capitalize"
          >
            {['wanted', 'purchased', 'removed'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Size
          <input
            name="desiredSize"
            defaultValue={item.desiredSize}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Color
          <input
            name="desiredColor"
            defaultValue={item.desiredColor}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="col-span-2 text-xs text-neutral-500">
          Notes
          <textarea
            name="notes"
            defaultValue={item.notes}
            rows={2}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-[#FAF7F2] px-2.5 py-1.5 text-xs"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={saving}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#831843] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>}
      </div>
    </form>
  )
}

function SingleStorePriceChart({ history, storeName }: { history: PriceObservation[]; storeName: string }) {
  if (history.length < 2) return null

  const prices = history.map((h) => h.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const range = maxPrice - minPrice || 1

  const WIDTH = 600
  const HEIGHT = 140
  const PADDING = 24

  const points = history.map((h, i) => {
    const x = PADDING + (i / (history.length - 1)) * (WIDTH - PADDING * 2)
    const y = HEIGHT - PADDING - ((h.price - minPrice) / range) * (HEIGHT - PADDING * 2)
    return { x, y, price: h.price, date: h.checkedAt }
  })

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-36 w-full"
        role="img"
        aria-label={`Price history chart for ${storeName}`}
      >
        <line x1={PADDING} y1={PADDING} x2={WIDTH - PADDING} y2={PADDING} stroke="#f5e6e8" strokeWidth="1" />
        <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="#f5e6e8" strokeWidth="1" />

        <polyline
          fill="none"
          stroke="#831843"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#831843" stroke="#ffffff" strokeWidth="2" />
            <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-neutral-700 text-[10px] font-bold">
              €{p.price.toFixed(2)}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-2 text-[10px] text-neutral-400">
        <span>{formatDate(history[0]!.checkedAt)}</span>
        <span>{formatDate(history[history.length - 1]!.checkedAt)}</span>
      </div>
    </div>
  )
}
