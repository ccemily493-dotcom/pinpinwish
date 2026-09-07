'use client'

import { useState, type FormEvent } from 'react'
import type { ManualWishlistItem } from '@/hooks/useWishlistData'

export default function AddWishlistItemForm({ onAdd, onClose }: { onAdd: (item: ManualWishlistItem) => Promise<void>; onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(undefined)
    const form = new FormData(event.currentTarget)
    const rawPrice = String(form.get('price') ?? '').trim()
    try {
      await onAdd({
        name: String(form.get('name') ?? '').trim(),
        brand: optional(form, 'brand'),
        category: String(form.get('category')) as ManualWishlistItem['category'],
        imageUrl: optional(form, 'imageUrl'),
        productUrl: optional(form, 'productUrl'),
        store: optional(form, 'store'),
        price: rawPrice ? Number(rawPrice) : undefined,
        currency: 'EUR',
        priority: String(form.get('priority')) as ManualWishlistItem['priority'],
        desiredSize: optional(form, 'desiredSize'),
        desiredColor: optional(form, 'desiredColor'),
        notes: optional(form, 'notes'),
      })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-item-title">
      <form onSubmit={(event) => void submit(event)} className="mx-auto my-8 max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-pink-600">Manual item</p><h2 id="add-item-title" className="mt-2 font-serif text-3xl font-bold">Add something lovely</h2></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-xl text-neutral-500 hover:bg-neutral-100">×</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Name *" required />
          <Field name="brand" label="Brand" />
          <Select name="category" label="Category" options={['clothes', 'shoes', 'beauty', 'home', 'other']} />
          <Select name="priority" label="Priority" options={['medium', 'high', 'dream', 'low']} />
          <Field name="price" label="Price (€)" type="number" step="0.01" min="0" />
          <Field name="store" label="Store" />
          <div className="sm:col-span-2"><Field name="productUrl" label="Product URL" type="url" /></div>
          <div className="sm:col-span-2"><Field name="imageUrl" label="Image URL" type="url" /></div>
          <Field name="desiredSize" label="Desired size" />
          <Field name="desiredColor" label="Desired color" />
          <label className="sm:col-span-2 text-sm font-medium text-neutral-700">Notes<textarea name="notes" rows={3} className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 focus:border-pink-400 focus:outline-none" /></label>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add to wishlist'}</button></div>
      </form>
    </div>
  )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...input } = props
  return <label className="text-sm font-medium text-neutral-700">{label}<input {...input} className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 focus:border-pink-400 focus:outline-none" /></label>
}
function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label className="text-sm font-medium capitalize text-neutral-700">{label}<select name={name} className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2">{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}
function optional(form: FormData, name: string) { return String(form.get(name) ?? '').trim() || undefined }
