import Link from 'next/link'
import PinterestOnboarding from '@/components/onboarding/PinterestOnboarding'
import { isPinterestConfigured, isServerSupabaseConfigured } from '@/lib/env/server'

export default function OnboardingPage() {
  const configured = isPinterestConfigured() && isServerSupabaseConfigured()
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/wishlist" className="text-sm text-neutral-500 hover:text-neutral-900">← Back to wishlist</Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.3em] text-pink-600">PinPinWish setup</p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold tracking-tight sm:text-5xl">Turn your Pinterest board into a wishlist.</h1>
        <p className="mt-4 max-w-2xl text-neutral-600">We only use Pinterest&apos;s official API. Product identification remains conservative: uncertain Pins wait for your review.</p>
        <div className="mt-10"><PinterestOnboarding configured={configured} /></div>
      </div>
    </main>
  )
}
