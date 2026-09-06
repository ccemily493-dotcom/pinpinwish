import { notFound } from 'next/navigation'
import { MOCK_WISHLIST_ITEMS } from '@/data/mock-items'
import ProductDetailView from '@/components/product/ProductDetailView'

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string }
}

export function generateStaticParams() {
  return MOCK_WISHLIST_ITEMS.map((item) => ({
    slug: item.product.slug,
  }))
}

export default async function ProductPage({ params }: PageProps) {
  const resolvedParams = await params
  const item = MOCK_WISHLIST_ITEMS.find((i) => i.product.slug === resolvedParams.slug)
  if (!item) notFound()

  return <ProductDetailView item={item} />
}
