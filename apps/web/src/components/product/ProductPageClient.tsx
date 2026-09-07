'use client'

import Link from 'next/link'
import ProductDetailView from './ProductDetailView'
import { useWishlistData } from '@/hooks/useWishlistData'

export default function ProductPageClient({ slug }: { slug: string }) {
  const { items, mode, updateItem } = useWishlistData()
  const item = items.find((candidate) => candidate.product.slug === slug)

  if (mode === 'loading' && !item) return <main className="min-h-screen bg-neutral-50 p-10 text-center text-neutral-500">Loading product…</main>
  if (!item) return (
    <main className="min-h-screen bg-neutral-50 p-10 text-center">
      <h1 className="font-serif text-3xl font-bold">Product not found</h1>
      <Link href="/wishlist" className="mt-5 inline-flex text-sm font-semibold underline">Back to wishlist</Link>
    </main>
  )
  return <ProductDetailView item={item} currency="EUR" storageMode={mode === 'cloud' ? 'cloud' : 'local'} onUpdate={updateItem} />
}
