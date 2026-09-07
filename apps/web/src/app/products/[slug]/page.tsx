import ProductPageClient from '@/components/product/ProductPageClient'

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string }
}

export default async function ProductPage({ params }: PageProps) {
  const resolvedParams = await params
  return <ProductPageClient slug={resolvedParams.slug} />
}
