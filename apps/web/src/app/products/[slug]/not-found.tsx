import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center text-center px-4">
      <span className="text-7xl text-neutral-200 mb-4" aria-hidden="true">♥</span>
      <h1 className="text-2xl font-bold text-neutral-700">Product not found</h1>
      <p className="mt-2 text-sm text-neutral-400">This product doesn’t exist in the demo wishlist.</p>
      <Link
        href="/wishlist"
        className="mt-6 px-6 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-700 transition-colors"
      >
        Back to wishlist
      </Link>
    </main>
  )
}
