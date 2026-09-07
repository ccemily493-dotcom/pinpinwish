import Link from 'next/link'
import PinterestOnboarding from '@/components/onboarding/PinterestOnboarding'

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/wishlist" className="text-xs font-semibold tracking-wider text-neutral-500 uppercase hover:text-[#831843]">
          ← Back to wishlist
        </Link>
        <span className="mt-8 block text-[11px] font-bold tracking-[0.25em] text-[#831843] uppercase">
          Local Automatic Setup
        </span>
        <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight sm:text-5xl text-neutral-900">
          Sync your Pinterest board.
        </h1>
        <p className="mt-3 max-w-2xl text-xs text-neutral-600 leading-relaxed">
          PinPinWish operates 100% locally. Paste your board URL to import your Pins, analyze product links, download images, and organize your wishlist automatically.
        </p>
        <div className="mt-8">
          <PinterestOnboarding configured={true} />
        </div>
      </div>
    </main>
  )
}
