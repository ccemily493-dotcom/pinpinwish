'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { getBestOffer } from '@pinpinwish/wishlist-core'
import { formatPrice, formatDate } from '@pinpinwish/shared'
import type { Currency } from '@pinpinwish/shared'
import type { ProductOffer, PriceObservation } from '@pinpinwish/price-tracker'
import type { Priority, WishlistItemStatus } from '@pinpinwish/shared'

interface Props {
  item: WishlistItem
  currency: Currency
  storageMode?: 'local' | 'cloud'
  onUpdate?: (id: string, updates: { priority?: Priority; status?: WishlistItemStatus; desiredSize?: string; desiredColor?: string; notes?: string }) => Promise<void>
}

export default function ProductDetailView({ item, currency, storageMode = 'local', onUpdate }: Props) {
  const { product } = item
  const bestOffer = getBestOffer(product.offers, currency)
  const sortedOffers = [...product.offers].sort((a, b) => {
    if (a.currency === b.currency) return a.currentPrice - b.currentPrice
    if (a.currency === currency) return -1
    if (b.currency === currency) return 1
    return a.currency.localeCompare(b.currency)
  })

  // Track which store's price history is currently selected
  const offersWithHistory = product.offers.filter((o) => o.priceHistory.length > 0)
  const defaultOfferId = bestOffer?.priceHistory.length
    ? bestOffer.id
    : offersWithHistory[0]?.id ?? product.offers[0]?.id

  const [selectedOfferId, setSelectedOfferId] = useState<string | undefined>(defaultOfferId)

  const selectedOffer = product.offers.find((o) => o.id === selectedOfferId) ?? bestOffer
  const selectedHistory = selectedOffer?.priceHistory
    ? [...selectedOffer.priceHistory].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime())
    : []

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className={`${storageMode === 'cloud' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'} border-b px-4 py-2 text-center text-xs`}>
        {storageMode === 'cloud' ? '✓ Synced securely with your account' : 'Local mode · saved in this browser'}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/wishlist"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 mb-8 focus:outline-none focus:ring-2 focus:ring-pink-300 rounded"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to wishlist
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="rounded-3xl overflow-hidden bg-neutral-100 aspect-square">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-8xl text-neutral-200">♥</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4">
            {product.brand && (
              <p className="text-sm text-neutral-400 uppercase tracking-widest font-medium">
                {product.brand}
              </p>
            )}
            <h1 className="text-3xl font-bold text-neutral-900 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
              {product.name}
            </h1>

            {bestOffer && (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-neutral-900">
                  {formatPrice(bestOffer.currentPrice, bestOffer.currency)}
                </span>
                {bestOffer.availability === 'in_stock' ? (
                  <span className="text-sm text-green-600 font-medium">In stock</span>
                ) : bestOffer.availability === 'out_of_stock' ? (
                  <span className="text-sm text-red-500 font-medium">Out of stock</span>
                ) : (
                  <span className="text-sm text-amber-600 font-medium">Availability unknown</span>
                )}
              </div>
            )}

            {product.description && (
              <p className="text-sm text-neutral-600 leading-relaxed">{product.description}</p>
            )}

            {/* Meta */}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-neutral-400 uppercase tracking-wider">Category</dt>
                <dd className="font-medium capitalize text-neutral-800">{product.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-400 uppercase tracking-wider">Priority</dt>
                <dd className="font-medium capitalize text-neutral-800">{item.priority}</dd>
              </div>
              {item.desiredSize && (
                <div>
                  <dt className="text-xs text-neutral-400 uppercase tracking-wider">Desired Size</dt>
                  <dd className="font-medium text-neutral-800">{item.desiredSize}</dd>
                </div>
              )}
              {item.desiredColor && (
                <div>
                  <dt className="text-xs text-neutral-400 uppercase tracking-wider">Desired Color</dt>
                  <dd className="font-medium text-neutral-800">{item.desiredColor}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-neutral-400 uppercase tracking-wider">Added</dt>
                <dd className="font-medium text-neutral-800">{formatDate(item.createdAt)}</dd>
              </div>
              {item.sourceType && (
                <div>
                  <dt className="text-xs text-neutral-400 uppercase tracking-wider">Source</dt>
                  <dd className="font-medium text-neutral-800 capitalize">{item.sourceType.replace('_', ' ')}</dd>
                </div>
              )}
            </dl>

            {item.notes && (
              <div className="bg-neutral-100 rounded-xl p-3 text-sm text-neutral-600 italic">
                “{item.notes}”
              </div>
            )}

            {onUpdate && (
              <WishlistPreferences item={item} onUpdate={onUpdate} />
            )}

            {item.pinterestPinId && (
              <div className="text-xs text-neutral-400">
                <span className="font-medium">Pinterest Pin:</span> {item.pinterestPinId}
                {item.pinUrl && <a href={item.pinUrl} target="_blank" rel="noopener noreferrer" className="ml-2 font-semibold text-pink-600 underline underline-offset-4">View original Pin</a>}
              </div>
            )}
          </div>
        </div>

        {/* Store Offers */}
        {sortedOffers.length > 0 && (
          <section className="mt-10" aria-label="Store offers">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900">Available Stores</h2>
              <span className="text-xs text-neutral-500">{sortedOffers.length} {sortedOffers.length === 1 ? 'store' : 'stores'} found</span>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden border border-neutral-100 shadow-sm">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Store</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Variant / Info</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-right">Action</th>
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
                        className={`border-b border-neutral-50 last:border-0 cursor-pointer transition-colors ${
                          isSelected ? 'bg-pink-50/50' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-neutral-800">
                          <div className="flex items-center gap-2">
                            <span>{offer.store}</span>
                            {isBest && (
                              <span className="px-2 py-0.5 text-xs text-green-700 bg-green-100 rounded-full font-semibold">
                                Best price
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900">
                          {formatPrice(offer.currentPrice, offer.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
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
                        <td className="px-4 py-3">
                          {offer.availability === 'in_stock' ? (
                            <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              In stock
                            </span>
                          ) : offer.availability === 'out_of_stock' ? (
                            <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Out of stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Unknown
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={offer.storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${item.product.name} at ${offer.store}`}
                            className="px-3 py-1 text-xs font-semibold border border-neutral-200 rounded-full text-neutral-700 hover:border-pink-300 hover:text-pink-600"
                          >
                            VIEW PRODUCT
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

        {/* Price History — Separate per Store */}
        <section className="mt-10" aria-label="Price history">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Price History by Store</h2>
              <p className="text-xs text-neutral-500">Each store maintains its own dedicated price tracking series.</p>
            </div>
            {/* Store selector tabs */}
            {product.offers.length > 1 && (
              <div className="flex flex-wrap gap-1 bg-neutral-100 p-1 rounded-xl">
                {product.offers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                      offer.id === selectedOfferId
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    {offer.store} ({formatPrice(offer.currentPrice, offer.currency)})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
            {selectedOffer ? (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
                  <div>
                    <h3 className="font-semibold text-neutral-800 text-sm">{selectedOffer.store} Tracking</h3>
                    <p className="text-xs text-neutral-400">Current: {formatPrice(selectedOffer.currentPrice, selectedOffer.currency)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-neutral-400">{selectedHistory.length} {selectedHistory.length === 1 ? 'observation' : 'observations'}</span>
                  </div>
                </div>

                {selectedHistory.length >= 2 ? (
                  <SingleStorePriceChart history={selectedHistory} storeName={selectedOffer.store} />
                ) : (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    Showing single observation for {selectedOffer.store}. More observations will populate as history tracks.
                  </div>
                )}

                {/* Table of observations for the selected store */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Price</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Availability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedHistory].reverse().map((obs) => (
                        <tr key={obs.id} className="border-b border-neutral-50 last:border-0">
                          <td className="px-3 py-2 text-neutral-500 text-xs">{formatDate(obs.checkedAt)}</td>
                          <td className="px-3 py-2 font-semibold text-neutral-900 text-xs">{formatPrice(obs.price, obs.currency)}</td>
                          <td className="px-3 py-2 text-xs">
                            {obs.availability === 'in_stock' ? (
                              <span className="text-green-600 font-medium">In stock</span>
                            ) : obs.availability === 'out_of_stock' ? (
                              <span className="text-red-500 font-medium">Out of stock</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Unknown</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No price observations available for this product.</p>
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
    <form onSubmit={(event) => void submit(event)} className="mt-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Wishlist preferences</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-neutral-500">Priority<select name="priority" defaultValue={item.priority} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm capitalize">{['low', 'medium', 'high', 'dream'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-neutral-500">Status<select name="status" defaultValue={item.status} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm capitalize">{['wanted', 'purchased', 'removed'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-neutral-500">Size<input name="desiredSize" defaultValue={item.desiredSize} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm" /></label>
        <label className="text-xs text-neutral-500">Color<input name="desiredColor" defaultValue={item.desiredColor} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm" /></label>
        <label className="col-span-2 text-xs text-neutral-500">Notes<textarea name="notes" defaultValue={item.notes} rows={2} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm" /></label>
      </div>
      <div className="mt-3 flex items-center gap-3"><button disabled={saving} className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save preferences'}</button>{saved && <span className="text-xs font-medium text-green-600">Saved ✓</span>}</div>
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
        className="w-full h-36"
        role="img"
        aria-label={`Price history chart for ${storeName}`}
      >
        {/* Background gridlines */}
        <line x1={PADDING} y1={PADDING} x2={WIDTH - PADDING} y2={PADDING} stroke="#f5f5f5" strokeWidth="1" />
        <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="#f5f5f5" strokeWidth="1" />

        {/* Line */}
        <polyline
          fill="none"
          stroke="#ec4899"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
        {/* Points & price labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#ec4899" stroke="#ffffff" strokeWidth="2" />
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              className="text-[10px] font-bold fill-neutral-700"
            >
              €{p.price.toFixed(2)}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-2 text-[10px] text-neutral-400 mt-1">
        <span>{formatDate(history[0]!.checkedAt)}</span>
        <span>{formatDate(history[history.length - 1]!.checkedAt)}</span>
      </div>
    </div>
  )
}
