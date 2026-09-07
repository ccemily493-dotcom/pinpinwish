import Link from 'next/link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { getBestOffer } from '@pinpinwish/wishlist-core'
import { formatPrice } from '@pinpinwish/shared'
import type { Currency, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { resolveDisplayImageUrl } from '@/lib/image-url'

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
  onUpdate?: (id: string, updates: { priority?: Priority; status?: WishlistItemStatus }) => void
}

export default function WishlistCard({ item, currency, onUpdate }: Props) {
  const bestOffer = getBestOffer(item.product.offers, currency)
  const isUnresolved = item.product.offers.length === 0
  const isPurchased = item.status === 'purchased'
  const isRemoved = item.status === 'removed'
  const isDuplicate = item.possibleDuplicateOf !== undefined
  const displayImage = resolveDisplayImageUrl(item.product.imageUrl, item.product.localImagePath)

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-rose-100/70 bg-white shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        isPurchased ? 'opacity-70 grayscale-30' : isRemoved ? 'opacity-40' : ''
      }`}
      role="listitem"
    >
      {/* Status & duplicate badges */}
      <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
        {isPurchased && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
            Purchased
          </span>
        )}
        {isRemoved && (
          <span className="rounded-full bg-neutral-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-xs">
            Removed
          </span>
        )}
        {isUnresolved && !isPurchased && !isRemoved && (
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
          {item.product.brand && (
            <p className="truncate text-[10px] font-bold tracking-widest text-[#831843] uppercase">
              {item.product.brand}
            </p>
          )}
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
              <span className="text-[11px] italic text-neutral-400">Price unknown</span>
            ) : (
              <span className="text-[11px] text-neutral-400">—</span>
            )}
          </div>
        </div>

        {onUpdate && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-rose-50 pt-2.5 text-xs">
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
            <button
              type="button"
              onClick={() =>
                onUpdate(item.id, {
                  status: item.status === 'purchased' ? 'wanted' : 'purchased',
                })
              }
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-[#831843] hover:text-[#831843]"
            >
              {item.status === 'purchased' ? 'Undo' : 'Bought'}
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.product.name}`}
              onClick={() =>
                onUpdate(item.id, {
                  status: item.status === 'removed' ? 'wanted' : 'removed',
                })
              }
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
            >
              {item.status === 'removed' ? '↺' : '×'}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
