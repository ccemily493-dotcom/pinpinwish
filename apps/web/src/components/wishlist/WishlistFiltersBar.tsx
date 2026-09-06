import type { WishlistSort } from '@pinpinwish/wishlist-core'
import type { Priority, WishlistItemStatus } from '@pinpinwish/shared'

type Props = {
  priority: Priority | 'all'
  setPriority: (v: Priority | 'all') => void
  sort: WishlistSort
  setSort: (v: WishlistSort) => void
  minPrice: string
  setMinPrice: (v: string) => void
  maxPrice: string
  setMaxPrice: (v: string) => void
  onlyUnresolved: boolean
  setOnlyUnresolved: (v: boolean) => void
  onlyDuplicates: boolean
  setOnlyDuplicates: (v: boolean) => void
  statusTab: WishlistItemStatus | 'all'
  setStatusTab: (v: WishlistItemStatus | 'all') => void
  statusTabs: { value: WishlistItemStatus | 'all'; label: string }[]
}

const PRIORITIES: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'dream', label: '✨ Dream' },
  { value: 'high', label: '♥ High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

export default function WishlistFiltersBar(props: Props) {
  const sortValue = `${props.sort.field}-${props.sort.direction}`

  function handleSortChange(value: string) {
    const [field, direction] = value.split('-') as [WishlistSort['field'], WishlistSort['direction']]
    if (field && direction) props.setSort({ field, direction })
  }

  return (
    <div className="bg-white border-b border-neutral-100 px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center">
        {/* Status tabs */}
        <div className="flex gap-1" role="tablist" aria-label="Filter by status">
          {props.statusTabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={props.statusTab === tab.value}
              onClick={() => props.setStatusTab(tab.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                props.statusTab === tab.value
                  ? 'bg-pink-100 text-pink-800'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-neutral-200" aria-hidden="true" />

        {/* Priority filter */}
        <label className="sr-only" htmlFor="priority-filter">Filter by priority</label>
        <select
          id="priority-filter"
          value={props.priority}
          onChange={(e) => props.setPriority(e.target.value as Priority | 'all')}
          className="text-xs border border-neutral-200 rounded-full px-3 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-pink-300"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Sort */}
        <label className="sr-only" htmlFor="sort-select">Sort by</label>
        <select
          id="sort-select"
          value={sortValue}
          onChange={(e) => handleSortChange(e.target.value)}
          className="text-xs border border-neutral-200 rounded-full px-3 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-pink-300"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Price range */}
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <span>Price:</span>
          <label className="sr-only" htmlFor="min-price">Min price</label>
          <input
            id="min-price"
            type="number"
            min={0}
            placeholder="Min"
            value={props.minPrice}
            onChange={(e) => props.setMinPrice(e.target.value)}
            className="w-16 px-2 py-1 border border-neutral-200 rounded-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
          <span>–</span>
          <label className="sr-only" htmlFor="max-price">Max price</label>
          <input
            id="max-price"
            type="number"
            min={0}
            placeholder="Max"
            value={props.maxPrice}
            onChange={(e) => props.setMaxPrice(e.target.value)}
            className="w-16 px-2 py-1 border border-neutral-200 rounded-full text-neutral-700 focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>

        {/* Special filters */}
        <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={props.onlyUnresolved}
            onChange={(e) => props.setOnlyUnresolved(e.target.checked)}
            className="rounded accent-pink-500"
          />
          Unidentified
        </label>

        <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={props.onlyDuplicates}
            onChange={(e) => props.setOnlyDuplicates(e.target.checked)}
            className="rounded accent-pink-500"
          />
          Possible duplicates
        </label>
      </div>
    </div>
  )
}
