import Link from 'next/link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { getBestOffer } from '@pinpinwish/wishlist-core'
import { formatPrice } from '@pinpinwish/shared'
import type { Currency } from '@pinpinwish/shared'
import type { Priority, WishlistItemStatus } from '@pinpinwish/shared'

const PRIORITY_STYLES = {
  dream: 'bg-purple-100 text-purple-700',
  high: 'bg-pink-100 text-pink-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-neutral-100 text-neutral-600',
}

const PRIORITY_LABELS = {
  dream: '✨ Dream',
  high: '♥ High',
  medium: 'Medium',
  low: 'Low',
}

type Props = {
  item: WishlistItem
  currency: Currency
  onUpdate?: (id: string, updates: { priority?: Priority; status?: WishlistItemStatus }) => void
}

export default function WishlistCard({ item, currency, onUpdate }: Props) {
  const bestOffer = getBestOffer(item.product.offers, currency)
  const isUnresolved = item.product.offers.length === 0
  const isPurchased = item.status === 'purchased'
  const isRemoved = item.status === 'removed'
  const isDuplicate = item.possibleDuplicateOf !== undefined

  return (
    <article
      className={`relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-pink-300 ${
        isPurchased ? 'opacity-70' : isRemoved ? 'opacity-50' : ''
      }`}
      role="listitem"
    >
      {/* Status badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {isPurchased && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full">
            Purchased
          </span>
        )}
        {isRemoved && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-neutral-500 text-white rounded-full">
            Removed
          </span>
        )}
        {isUnresolved && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-orange-400 text-white rounded-full">
            Unidentified
          </span>
        )}
        {isDuplicate && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-400 text-neutral-900 rounded-full">
            Possible duplicate
          </span>
        )}
      </div>

      {/* Priority badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${PRIORITY_STYLES[item.priority]}`}>
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>

      {/* Image */}
      <div className="aspect-[3/4] bg-neutral-100 overflow-hidden">
        {item.product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.product.imageUrl}
            alt={item.product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-100">
            <span className="text-4xl text-neutral-300">♥</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {item.product.brand && (
          <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium truncate">
            {item.product.brand}
          </p>
        )}
        <Link
          href={`/products/${item.product.slug}`}
          className="block mt-0.5 text-sm font-semibold text-neutral-900 hover:text-pink-600 leading-tight line-clamp-2 focus:outline-none"
        >
          {item.product.name}
        </Link>
        <div className="mt-1.5">
          {bestOffer ? (
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-neutral-900">
                {formatPrice(bestOffer.currentPrice, bestOffer.currency)}
              </span>
              {bestOffer.availability === 'out_of_stock' && (
                <span className="text-xs text-red-500 font-normal">(out of stock)</span>
              )}
              {bestOffer.availability === 'unknown' && (
                <span className="text-xs text-amber-600 font-normal">(unconfirmed)</span>
              )}
            </div>
          ) : isUnresolved ? (
            <span className="text-xs text-neutral-400 italic">Price unknown</span>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </div>
        {onUpdate && (
          <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
            <select
              aria-label={`Priority for ${item.product.name}`}
              value={item.priority}
              onChange={(event) => onUpdate(item.id, { priority: event.target.value as Priority })}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs capitalize"
            >
              {['low', 'medium', 'high', 'dream'].map((value) => <option key={value}>{value}</option>)}
            </select>
            <button
              type="button"
              onClick={() => onUpdate(item.id, { status: item.status === 'purchased' ? 'wanted' : 'purchased' })}
              className="rounded-lg border border-neutral-200 px-2 py-1 text-xs font-medium hover:bg-neutral-50"
            >
              {item.status === 'purchased' ? 'Undo' : 'Bought'}
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.product.name}`}
              onClick={() => onUpdate(item.id, { status: item.status === 'removed' ? 'wanted' : 'removed' })}
              className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-50"
            >
              {item.status === 'removed' ? 'Restore' : '×'}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
