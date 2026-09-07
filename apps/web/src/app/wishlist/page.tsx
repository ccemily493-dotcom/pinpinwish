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
  const { items, mode, error, updateItem, addItem, resetLocalDemo } = useWishlistData()
  const [showAddForm, setShowAddForm] = useState(false)
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

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className={`${mode === 'cloud' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'} border-b px-4 py-2 text-center text-xs`}>
        {mode === 'loading' ? 'Loading your wishlist…' : mode === 'cloud' ? '✓ Synced securely with your account' : 'Local mode · changes are saved in this browser'}
      </div>

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-neutral-900" style={{ fontFamily: 'Georgia, serif' }}>
                MY WISHLIST
              </h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-neutral-500">
                <span>♡ {wantedItems.length} ITEMS</span>
                <span className="text-neutral-300">|</span>
                <span>{formatPrice(total, WISHLIST_CURRENCY)} TOTAL</span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link href="/review" className="text-center text-sm font-semibold text-neutral-600 hover:text-pink-600">Needs Review</Link>
              <Link href="/onboarding" className="rounded-full border border-neutral-300 px-4 py-2 text-center text-sm font-semibold hover:border-pink-300">Sync Pinterest</Link>
              <button type="button" onClick={() => setShowAddForm(true)} className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">+ Add item</button>
            </div>
            <div className="relative w-full sm:w-72">
              <label htmlFor="search" className="sr-only">Search wishlist</label>
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or brand…"
                className="w-full px-4 py-2 pl-10 text-sm border border-neutral-200 rounded-full bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Category tabs */}
          <div className="mt-6 flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Filter by category">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                role="tab"
                aria-selected={category === cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-1.5 text-xs font-semibold tracking-widest rounded-full whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                  category === cat.value
                    ? 'bg-neutral-900 text-white'
                    : 'bg-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {filteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            role="list"
            aria-label="Wishlist items"
          >
            {filteredItems.map((item) => (
              <WishlistCard key={item.id} item={item} currency={WISHLIST_CURRENCY} onUpdate={(id, updates) => void updateItem(id, updates)} />
            ))}
          </div>
        )}
      </div>
      {mode === 'local' && (
        <div className="mx-auto max-w-7xl px-6 pb-10 text-right">
          <button type="button" onClick={resetLocalDemo} className="text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-700">Reset local demo</button>
        </div>
      )}
      {showAddForm && <AddWishlistItemForm onAdd={addItem} onClose={() => setShowAddForm(false)} />}
    </main>
  )
}
