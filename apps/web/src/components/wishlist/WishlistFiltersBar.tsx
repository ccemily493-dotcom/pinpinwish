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
    <div className="bg-white border-b border-rose-100/80 px-6 py-3 shadow-2xs">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center justify-between">
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5" role="tablist" aria-label="Filter by status">
          {props.statusTabs.map((tab) => {
            const isActive = props.statusTab === tab.value
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={isActive}
                onClick={() => props.setStatusTab(tab.value)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0] shadow-2xs ${
                  isActive
                    ? 'bg-[#831843] text-white shadow-xs'
                    : 'bg-[#FAF7F2] text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200/80'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Priority filter */}
          <label className="sr-only" htmlFor="priority-filter">Filtrar por prioridad</label>
          <select
            id="priority-filter"
            value={props.priority}
            onChange={(e) => props.setPriority(e.target.value as Priority | 'all')}
            className="text-xs border border-neutral-200 rounded-full px-3.5 py-1.5 bg-[#FAF7F2] text-neutral-700 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Sort */}
          <label className="sr-only" htmlFor="sort-select">Ordenar por</label>
          <select
            id="sort-select"
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className="text-xs border border-neutral-200 rounded-full px-3.5 py-1.5 bg-[#FAF7F2] text-neutral-700 shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Price range */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 bg-[#FAF7F2] border border-neutral-200 rounded-full px-3 py-1 shadow-2xs">
            <span className="font-semibold text-[11px] text-neutral-500">Precio:</span>
            <input
              id="min-price"
              type="number"
              min={0}
              placeholder="Mín"
              value={props.minPrice}
              onChange={(e) => props.setMinPrice(e.target.value)}
              className="w-14 bg-white px-2 py-0.5 border border-neutral-200 rounded-lg text-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-[#831843]"
            />
            <span>–</span>
            <input
              id="max-price"
              type="number"
              min={0}
              placeholder="Máx"
              value={props.maxPrice}
              onChange={(e) => props.setMaxPrice(e.target.value)}
              className="w-14 bg-white px-2 py-0.5 border border-neutral-200 rounded-lg text-neutral-800 focus:outline-hidden focus:ring-1 focus:ring-[#831843]"
            />
          </div>

          {/* Special filters */}
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 cursor-pointer select-none bg-[#FAF7F2] border border-neutral-200 rounded-full px-3 py-1 shadow-2xs hover:border-[#831843]">
            <input
              type="checkbox"
              checked={props.onlyUnresolved}
              onChange={(e) => props.setOnlyUnresolved(e.target.checked)}
              className="rounded-sm accent-[#831843]"
            />
            Sin precio
          </label>

          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 cursor-pointer select-none bg-[#FAF7F2] border border-neutral-200 rounded-full px-3 py-1 shadow-2xs hover:border-[#831843]">
            <input
              type="checkbox"
              checked={props.onlyDuplicates}
              onChange={(e) => props.setOnlyDuplicates(e.target.checked)}
              className="rounded-sm accent-[#831843]"
            />
            Posibles duplicados
          </label>
        </div>
      </div>
    </div>
  )
}
