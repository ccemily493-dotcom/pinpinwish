'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useWishlistData, type ManualWishlistItem } from '@/hooks/useWishlistData'

export default function NeedsReviewList() {
  const { items, mode, resolveItem } = useWishlistData()
  const [editing, setEditing] = useState<string>()
  const [error, setError] = useState<string>()
  const reviewItems = items.filter((item) => item.status !== 'removed' && !item.productId && item.product.offers.length === 0)

  async function submit(event: FormEvent<HTMLFormElement>, itemId: string, priority: ManualWishlistItem['priority']) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const price = String(form.get('price') ?? '').trim()
    setError(undefined)
    try {
      await resolveItem(itemId, {
        name: String(form.get('name') ?? '').trim(),
        brand: optional(form, 'brand'),
        category: String(form.get('category')) as ManualWishlistItem['category'],
        imageUrl: optional(form, 'imageUrl'),
        productUrl: optional(form, 'productUrl'),
        store: optional(form, 'store'),
        price: price ? Number(price) : undefined,
        currency: 'EUR', priority,
      })
      setEditing(undefined)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.') }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-500">{mode === 'cloud' ? 'Account data' : 'Local browser data'} · {reviewItems.length} pending</p>
        <Link href="/wishlist" className="text-sm font-semibold underline underline-offset-4">Back to wishlist</Link>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!reviewItems.length ? <div className="rounded-3xl bg-white p-10 text-center text-neutral-500">Nothing needs review right now.</div> : (
        <div className="space-y-5">
          {reviewItems.map((item) => (
            <article key={item.id} className="grid gap-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-[180px_1fr]">
              <div className="aspect-square overflow-hidden rounded-2xl bg-neutral-100">
                {/* Remote Pinterest/store hosts are dynamic and cannot be allow-listed ahead of time. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.product.imageUrl ? <img src={item.product.imageUrl} alt="Pinterest Pin" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl text-neutral-300">♥</div>}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-pink-600">Pinterest Pin</p>
                <h2 className="mt-2 font-serif text-2xl font-bold">{item.product.name}</h2>
                <p className="mt-2 text-sm text-neutral-500">No automatic match was accepted. Add the real product yourself or mark it as not a product.</p>
                {editing === item.id ? (
                  <form onSubmit={(event) => void submit(event, item.id, item.priority)} className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Input name="name" label="Product name *" defaultValue={item.product.name.replace(' (unidentified)', '')} required />
                    <Input name="brand" label="Brand" />
                    <label className="text-xs font-semibold text-neutral-600">Category<select name="category" defaultValue={item.product.category} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">{['clothes', 'shoes', 'beauty', 'home', 'other'].map((value) => <option key={value}>{value}</option>)}</select></label>
                    <Input name="price" label="Price (€)" type="number" step="0.01" min="0" />
                    <Input name="store" label="Store" />
                    <Input name="productUrl" label="Purchase URL" type="url" />
                    <div className="sm:col-span-2"><Input name="imageUrl" label="Image URL" type="url" defaultValue={item.product.imageUrl} /></div>
                    <div className="sm:col-span-2 flex gap-3"><button className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white">Save product</button><button type="button" onClick={() => setEditing(undefined)} className="px-4 text-sm">Cancel</button></div>
                  </form>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => setEditing(item.id)} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white">Identify manually</button>
                    <button type="button" onClick={() => void resolveItem(item.id, null)} className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold">None of these / not a product</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...input } = props
  return <label className="text-xs font-semibold text-neutral-600">{label}<input {...input} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></label>
}
function optional(form: FormData, name: string) { return String(form.get(name) ?? '').trim() || undefined }
