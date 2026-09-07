'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { applyFilters, sortItems, calculateTotal, detectPossibleDuplicates } from '@pinpinwish/wishlist-core'
import type { WishlistFilters, WishlistSort } from '@pinpinwish/wishlist-core'
import type { Category, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { formatPrice } from '@pinpinwish/shared'
import WishlistCard from '@/components/wishlist/WishlistCard'
import WishlistFiltersBar from '@/components/wishlist/WishlistFiltersBar'
import EmptyState from '@/components/wishlist/EmptyState'
import AddWishlistItemForm from '@/components/wishlist/forms/AddWishlistItemForm'
import PinterestImportModal from '@/components/import/PinterestImportModal'
import { useWishlistData } from '@/hooks/useWishlistData'

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'clothes', label: 'CLOTHES' },
  { value: 'shoes', label: 'SHOES' },
  { value: 'beauty', label: 'BEAUTY' },
  { value: 'home', label: 'HOME' },
  { value: 'other', label: 'OTHER' },
]

const STATUS_TABS: { value: WishlistItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'wanted', label: 'Wanted' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'removed', label: 'Removed' },
]

const WISHLIST_CURRENCY = 'EUR' as const

export default function WishlistPage() {
  const { items, mode, error, updateItem, addItem, reload } = useWishlistData()
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [statusTab, setStatusTab] = useState<WishlistItemStatus | 'all'>('all')
  const [sort, setSort] = useState<WishlistSort>({ field: 'date', direction: 'desc' })
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [onlyUnresolved, setOnlyUnresolved] = useState(false)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)

  // Apply duplicate detection to all items
  const itemsWithDuplicates = useMemo(() => detectPossibleDuplicates(items), [items])

  const filteredItems = useMemo(() => {
    const filters: WishlistFilters = {
      search: search || undefined,
      category: category === 'all' ? undefined : category,
      priority: priority === 'all' ? undefined : priority,
      status: statusTab === 'all' ? undefined : statusTab,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      onlyUnresolved,
      onlyPossibleDuplicates: onlyDuplicates,
      currency: WISHLIST_CURRENCY,
    }
    return sortItems(applyFilters(itemsWithDuplicates, filters), sort, WISHLIST_CURRENCY)
  }, [search, category, priority, statusTab, sort, minPrice, maxPrice, onlyUnresolved, onlyDuplicates, itemsWithDuplicates])

  const wantedItems = itemsWithDuplicates.filter((i) => i.status === 'wanted')
  const total = calculateTotal(wantedItems, WISHLIST_CURRENCY)
  const reviewCount = itemsWithDuplicates.filter((i) => i.status !== 'removed' && !i.productId && i.product.offers.length === 0).length

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-neutral-900">
      {/* Top Banner */}
      <div className="border-b border-rose-100/70 bg-white/80 px-4 py-2 text-center text-xs tracking-wide text-neutral-600 backdrop-blur-xs">
        {mode === 'loading' ? (
          'Loading your local wishlist…'
        ) : (
          <span className="flex items-center justify-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Local Automatic Mode · Stored securely in SQLite
          </span>
        )}
      </div>

      {/* Header */}
      <div className="border-b border-rose-100/80 bg-white px-6 py-8 shadow-2xs">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-[0.25em] text-[#831843] uppercase">
                Curated Collection
              </span>
              <h1 className="mt-1 font-serif text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
                MY WISHLIST
              </h1>
              <div className="mt-3 flex items-center gap-4 text-xs font-medium tracking-wider text-neutral-500">
                <span>♡ {wantedItems.length} ITEMS</span>
                <span className="text-neutral-300">|</span>
                <span>{formatPrice(total, WISHLIST_CURRENCY)} TOTAL</span>
                {reviewCount > 0 && (
                  <>
                    <span className="text-neutral-300">|</span>
                    <Link href="/review" className="font-semibold text-amber-700 hover:underline">
                      ⚡ {reviewCount} NEEDS REVIEW
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#831843] px-5 py-2.5 text-xs font-semibold tracking-wider text-white shadow-md transition hover:bg-[#671028]"
              >
                <span>⚡ Import from Pinterest</span>
              </button>

              <Link
                href="/review"
                className="relative rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-center text-xs font-semibold tracking-wide text-neutral-700 transition hover:border-[#831843] hover:text-[#831843]"
              >
                Needs Review
                {reviewCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {reviewCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-semibold tracking-wide text-white transition hover:bg-neutral-800"
              >
                + Add item
              </button>
            </div>
          </div>

          {/* Search bar & Category tabs */}
          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Filter by category">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  role="tab"
                  aria-selected={category === cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-widest whitespace-nowrap transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0] ${
                    category === cat.value
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <label htmlFor="search" className="sr-only">
                Search wishlist
              </label>
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, brand, notes…"
                className="w-full rounded-full border border-neutral-200 bg-[#FAF7F2] px-4 py-2 pl-10 text-xs shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
              />
              <svg
                className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Sort */}
      <WishlistFiltersBar
        priority={priority}
        setPriority={setPriority}
        sort={sort}
        setSort={setSort}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        onlyUnresolved={onlyUnresolved}
        setOnlyUnresolved={setOnlyUnresolved}
        onlyDuplicates={onlyDuplicates}
        setOnlyDuplicates={setOnlyDuplicates}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        statusTabs={STATUS_TABS}
      />

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {mode === 'loading' && filteredItems.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="animate-pulse rounded-3xl border border-neutral-200 bg-white p-3">
                <div className="aspect-square rounded-2xl bg-neutral-200" />
                <div className="mt-3 h-4 w-3/4 rounded-sm bg-neutral-200" />
                <div className="mt-2 h-3 w-1/2 rounded-sm bg-neutral-200" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            role="list"
            aria-label="Wishlist items"
          >
            {filteredItems.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                currency={WISHLIST_CURRENCY}
                onUpdate={(id, updates) => void updateItem(id, updates)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddForm && <AddWishlistItemForm onAdd={addItem} onClose={() => setShowAddForm(false)} />}

      <PinterestImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => void reload()}
      />
    </main>
  )
}
