'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { WishlistItem } from '@pinpinwish/wishlist-core'
import { applyFilters, sortItems, calculateTotal, detectPossibleDuplicates } from '@pinpinwish/wishlist-core'
import type { WishlistFilters, WishlistSort } from '@pinpinwish/wishlist-core'
import type { Category, Priority, WishlistItemStatus } from '@pinpinwish/shared'
import { formatPrice } from '@pinpinwish/shared'
import WishlistCard from '@/components/wishlist/WishlistCard'
import WishlistFiltersBar from '@/components/wishlist/WishlistFiltersBar'
import EmptyState from '@/components/wishlist/EmptyState'
import AddWishlistItemForm from '@/components/wishlist/forms/AddWishlistItemForm'
import PinterestImportModal from '@/components/import/PinterestImportModal'
import WishlistDropZone from '@/components/wishlist/WishlistDropZone'
import EditWishlistItemModal from '@/components/wishlist/EditWishlistItemModal'
import PinCard from '@/components/pins/PinCard'
import PinDetailModal from '@/components/pins/PinDetailModal'
import { useWishlistData, type PinGroupView } from '@/hooks/useWishlistData'

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'clothes', label: 'CLOTHES' },
  { value: 'shoes', label: 'SHOES' },
  { value: 'beauty', label: 'BEAUTY' },
  { value: 'home', label: 'HOME' },
  { value: 'other', label: 'OTHER' },
]

const STATUS_TABS: { value: WishlistItemStatus | 'all'; label: string }[] = [
  { value: 'wanted', label: '🌸 En Wishlist' },
  { value: 'archived', label: '📦 Baúl / Archivo' },
  { value: 'purchased', label: '🛍️ Comprados' },
  { value: 'all', label: '🌐 Todos' },
]

const WISHLIST_CURRENCY = 'EUR' as const

export default function WishlistPage() {
  const {
    items,
    pins,
    mode,
    error,
    updateItem,
    archiveItem,
    restoreItem,
    deleteItem,
    archivePin,
    restorePin,
    deletePin,
    deduplicate,
    addItem,
    dropResolveItem,
    dropProductOnPin,
    quickAddFromUrl,
    reload,
  } = useWishlistData()

  const [viewMode, setViewMode] = useState<'pins' | 'products'>('pins')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isDeduplicating, setIsDeduplicating] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [statusTab, setStatusTab] = useState<WishlistItemStatus | 'all'>('wanted')
  const [sort, setSort] = useState<WishlistSort>({ field: 'date', direction: 'desc' })
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [onlyUnresolved, setOnlyUnresolved] = useState(false)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [toastMessage, setToastMessage] = useState<string>()

  // Active selected pin derived from live pins list
  const selectedPin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) ?? null,
    [pins, selectedPinId]
  )

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

  const filteredPins = useMemo(() => {
    let result = pins

    if (statusTab === 'archived') {
      result = result.filter((p) => p.isArchived)
    } else if (statusTab === 'wanted') {
      result = result.filter((p) => !p.isArchived)
    }

    if (!search) return result
    const q = search.toLowerCase()
    return result.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.items.some((i) => i.product.name.toLowerCase().includes(q) || i.product.brand?.toLowerCase().includes(q))
    )
  }, [pins, search, statusTab])

  const wantedItems = itemsWithDuplicates.filter((i) => i.status === 'wanted')
  const archivedItems = itemsWithDuplicates.filter((i) => i.status === 'archived' || i.status === 'removed')
  const activePins = pins.filter((p) => !p.isArchived)
  const total = calculateTotal(wantedItems, WISHLIST_CURRENCY)
  const reviewCount = itemsWithDuplicates.filter(
    (i) =>
      i.status !== 'removed' &&
      i.status !== 'archived' &&
      (i.resolutionStatus === 'needs_review' || !i.productId)
  ).length

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? undefined : current))
    }, 4500)
  }

  async function handleDeduplicate() {
    try {
      setIsDeduplicating(true)
      const res = await deduplicate()
      showToast(`✨ ${res.message}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar duplicados')
    } finally {
      setIsDeduplicating(false)
    }
  }

  async function handleDropOnGeneralZone(payload: { url?: string; imageUrl?: string; title?: string }) {
    const newItem = await quickAddFromUrl(payload)
    if (newItem?.product?.name) {
      showToast(`✨ ¡Producto añadido a tu wishlist: ${newItem.product.name}!`)
    } else {
      showToast('✨ ¡Producto añadido con éxito desde la web!')
    }
  }

  async function handleDropOnCard(itemId: string, payload: { url?: string; imageUrl?: string; title?: string }) {
    const updated = await dropResolveItem(itemId, payload)
    if (updated?.product?.name) {
      showToast(`✨ ¡Producto identificado con éxito: ${updated.product.name}!`)
    } else {
      showToast('✨ ¡Producto identificado y actualizado!')
    }
  }

  async function handleDropOnPin(pinId: string, payload: { url?: string; imageUrl?: string; title?: string }) {
    await dropProductOnPin(pinId, payload)
    showToast('✨ ¡Prenda/producto añadido al Look!')
  }

  async function handleDeleteItem(id: string) {
    const item = items.find((candidate) => candidate.id === id)
    const label = item?.product.name || 'este producto'
    if (!window.confirm(`¿Eliminar permanentemente “${label}”? Esta acción no se puede deshacer.`)) return false
    await deleteItem(id)
    showToast('🗑️ Producto eliminado permanentemente')
    return true
  }

  async function handleDeletePin(id: string) {
    const pin = pins.find((candidate) => candidate.id === id)
    const label = pin?.title || 'este Pin / Look'
    if (!window.confirm(`¿Eliminar permanentemente “${label}” y todos sus productos? Esta acción no se puede deshacer.`)) return false
    await deletePin(id)
    showToast('🗑️ Look y productos eliminados permanentemente')
    return true
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-neutral-900 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-slide-up rounded-2xl border border-rose-200 bg-neutral-900 px-5 py-3.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(undefined)}
              className="ml-auto text-neutral-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium tracking-wider text-neutral-500">
                <span>📍 {pins.length} PINES / LOOKS</span>
                <span className="text-neutral-300">|</span>
                <span>♡ {wantedItems.length} EN WISHLIST</span>
                {archivedItems.length > 0 && (
                  <>
                    <span className="text-neutral-300">|</span>
                    <button
                      type="button"
                      onClick={() => setStatusTab('archived')}
                      className="font-semibold text-neutral-700 hover:text-[#831843] transition"
                    >
                      📦 {archivedItems.length} EN EL BAÚL
                    </button>
                  </>
                )}
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

            <div className="flex w-full flex-wrap gap-2.5 sm:w-auto sm:items-center">
              <button
                type="button"
                onClick={handleDeduplicate}
                disabled={isDeduplicating}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#831843] shadow-xs transition hover:bg-rose-50 hover:border-[#831843] disabled:opacity-50"
                title="Detecta y elimina prendas o pines duplicados manteniendo los mejores datos"
              >
                <span>{isDeduplicating ? '🧹 Limpiando…' : '🧹 Eliminar Duplicados'}</span>
              </button>

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

          {/* View Mode Switcher (Pines / Looks vs Todos los Productos) */}
          <div className="mt-8 flex items-center justify-between border-t border-rose-100/70 pt-6">
            <div className="inline-flex rounded-full bg-[#FAF7F2] p-1 border border-rose-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('pins')}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-wider transition ${
                  viewMode === 'pins'
                    ? 'bg-[#831843] text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                }`}
              >
                <span>📍 Pines / Looks (Outfits)</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${viewMode === 'pins' ? 'bg-white/20 text-white' : 'bg-rose-100 text-[#831843]'}`}>
                  {pins.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('products')}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-wider transition ${
                  viewMode === 'products'
                    ? 'bg-[#831843] text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                }`}
              >
                <span>🛍️ Todos los Productos</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${viewMode === 'products' ? 'bg-white/20 text-white' : 'bg-rose-100 text-[#831843]'}`}>
                  {wantedItems.length}
                </span>
              </button>
            </div>

            {/* Quick Search in view switcher */}
            <div className="relative hidden md:block w-72">
              <label htmlFor="search-top" className="sr-only">
                Buscar en wishlist
              </label>
              <input
                id="search-top"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={viewMode === 'pins' ? 'Buscar en looks o prendas…' : 'Buscar por nombre, marca…'}
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

          {/* Category Tabs for Products view */}
          {viewMode === 'products' && (
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
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
            </div>
          )}
        </div>
      </div>

      {/* Drag & Drop Zone from External Web Stores */}
      <WishlistDropZone onDropUrl={handleDropOnGeneralZone} />

      {/* Filters + Sort only in Products view */}
      {viewMode === 'products' ? (
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
      ) : (
        /* Status bar for Pins view */
        <div className="bg-white border-b border-rose-100/80 px-6 py-3 shadow-2xs">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5" role="tablist" aria-label="Filter pins by status">
              {STATUS_TABS.filter((t) => t.value !== 'purchased').map((tab) => {
                const isActive = statusTab === tab.value
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatusTab(tab.value)}
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

            <span className="text-[11px] font-medium text-neutral-500">
              {statusTab === 'archived'
                ? `Mostrando ${filteredPins.length} looks en el Baúl`
                : `Mostrando ${filteredPins.length} looks activos`}
            </span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {/* VIEW MODE 1: PINES / LOOKS (Outfits with total look price) */}
        {viewMode === 'pins' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-neutral-900">
                  {statusTab === 'archived' ? '📦 Baúl de Looks' : 'Pines de Pinterest & Looks'} ({filteredPins.length})
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {statusTab === 'archived'
                    ? 'Looks archivados en el baúl. Puedes restaurarlos a tu wishlist activa o eliminarlos por completo.'
                    : 'Haz clic en un Pin para ver y gestionar todas las prendas individuales de la foto con sus precios y tiendas.'}
                </p>
              </div>
            </div>

            {mode === 'loading' && filteredPins.length === 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="animate-pulse rounded-3xl border border-neutral-200 bg-white p-3">
                    <div className="aspect-[3/4] rounded-2xl bg-neutral-200" />
                    <div className="mt-3 h-4 w-3/4 rounded-sm bg-neutral-200" />
                    <div className="mt-2 h-3 w-1/2 rounded-sm bg-neutral-200" />
                  </div>
                ))}
              </div>
            ) : filteredPins.length === 0 ? (
              <div className="rounded-3xl border border-rose-100 bg-white p-12 text-center text-neutral-500">
                <span className="text-3xl">{statusTab === 'archived' ? '📦' : '📍'}</span>
                <h3 className="mt-2 font-serif text-lg font-bold text-neutral-900">
                  {statusTab === 'archived' ? 'No hay Looks en el Baúl' : 'No hay Pines aún'}
                </h3>
                <p className="mt-1 text-xs text-neutral-400">
                  {statusTab === 'archived'
                    ? 'Los looks que mandes al baúl aparecerán aquí.'
                    : 'Importa un tablero de Pinterest arriba o arrastra un producto desde la web.'}
                </p>
              </div>
            ) : (
              <div
                className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4"
                role="list"
                aria-label="Pines y looks"
              >
                {filteredPins.map((pin) => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    onSelect={(p) => setSelectedPinId(p.id)}
                    onDropProduct={handleDropOnPin}
                    onArchive={async (pinId) => {
                      await archivePin(pinId)
                      showToast('📦 Look mandado al baúl')
                    }}
                    onRestore={async (pinId) => {
                      await restorePin(pinId)
                      showToast('↺ Look restaurado a la wishlist activa')
                    }}
                    onDelete={async (pinId) => {
                      await handleDeletePin(pinId)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 2: TODOS LOS PRODUCTOS INDIVIDUALES */}
        {viewMode === 'products' && (
          <div>
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
                    onDelete={async (id) => {
                      await handleDeleteItem(id)
                    }}
                    onEdit={(itm) => setEditingItem(itm)}
                    onDropResolve={handleDropOnCard}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forms & Modals */}
      {showAddForm && <AddWishlistItemForm onAdd={addItem} onClose={() => setShowAddForm(false)} />}

      <PinterestImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => void reload()}
      />

      <EditWishlistItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={async (id, updates) => {
          await updateItem(id, updates)
          showToast('✨ ¡Pin actualizado con éxito!')
        }}
      />

      {/* Detail Modal for Pin / Look with multiple products */}
      <PinDetailModal
        pin={selectedPin}
        isOpen={Boolean(selectedPin)}
        onClose={() => setSelectedPinId(null)}
        onDropProduct={handleDropOnPin}
        onUpdateItem={async (id, updates) => {
          await updateItem(id, updates)
        }}
        onDeleteItem={async (id) => {
          await handleDeleteItem(id)
        }}
        onArchivePin={async (id) => {
          await archivePin(id)
          showToast('📦 Look mandado al baúl')
        }}
        onRestorePin={async (id) => {
          await restorePin(id)
          showToast('↺ Look restaurado a la wishlist activa')
        }}
        onDeletePin={handleDeletePin}
      />
    </main>
  )
}
