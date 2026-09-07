import NeedsReviewList from '@/components/review/NeedsReviewList'

export default function ReviewPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-600">PinPinWish</p>
        <h1 className="mt-3 font-serif text-4xl font-bold">Needs Review</h1>
        <p className="mb-10 mt-3 max-w-2xl text-neutral-600">Your manual choice always wins over future automatic resolutions.</p>
        <NeedsReviewList />
      </div>
    </main>
  )
}
