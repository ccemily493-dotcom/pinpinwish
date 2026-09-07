import Link from 'next/link'
import LoginForm from '@/components/auth/LoginForm'
import { isSupabaseConfigured } from '@/lib/env/public'

export default function LoginPage() {
  const configured = isSupabaseConfigured()

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <section className="mx-auto max-w-md rounded-3xl border border-neutral-100 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-600">PinPinWish</p>
        <h1 className="mt-3 font-serif text-3xl font-bold text-neutral-900">Tu wishlist, siempre contigo</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">Accede por enlace mágico. No necesitas recordar otra contraseña.</p>
        {configured ? (
          <LoginForm />
        ) : (
          <div className="mt-8 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            Supabase todavía no está configurado. Puedes seguir usando la demo local mientras completas las variables de entorno.
          </div>
        )}
        <Link href="/wishlist" className="mt-6 inline-flex text-sm font-medium text-neutral-600 underline underline-offset-4">
          Abrir wishlist local
        </Link>
      </section>
    </main>
  )
}
