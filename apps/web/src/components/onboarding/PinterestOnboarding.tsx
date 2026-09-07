'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Board = {
  id: string
  pinterest_board_id: string
  name: string
  description: string | null
  image_url: string | null
  pin_count: number
  last_synced_at: string | null
}

type ImportJob = {
  id: string
  status: string
  processed_count: number
  identified_count: number
  needs_review_count: number
  total_count: number | null
}

export default function PinterestOnboarding({ configured }: { configured: boolean }) {
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoard, setSelectedBoard] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState<string>()
  const [job, setJob] = useState<ImportJob>()

  const loadBoards = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    setError(undefined)
    try {
      const response = await fetch('/api/pinterest/boards', { cache: 'no-store' })
      const data = await response.json() as { connected?: boolean; boards?: Board[]; error?: string }
      if (response.status === 401) {
        setError('Inicia sesión antes de conectar Pinterest.')
        return
      }
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los tableros.')
      setConnected(Boolean(data.connected))
      setBoards(data.boards ?? [])
      setSelectedBoard((current) => current || data.boards?.[0]?.id || '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los tableros.')
    } finally {
      setLoading(false)
    }
  }, [configured])

  useEffect(() => { void loadBoards() }, [loadBoards])

  async function importBoard() {
    if (!selectedBoard) return
    setError(undefined)
    try {
      const start = await fetch('/api/pinterest/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: selectedBoard }),
      })
      const started = await start.json() as { job?: ImportJob; error?: string }
      if (!start.ok || !started.job) throw new Error(started.error ?? 'No se pudo iniciar la importación.')
      let current = started.job
      setJob(current)

      while (current.status !== 'completed') {
        const response = await fetch(`/api/pinterest/import/${current.id}`, { method: 'POST' })
        const result = await response.json() as { job?: ImportJob; done?: boolean; error?: string }
        if (!response.ok || !result.job) throw new Error(result.error ?? 'La importación se interrumpió.')
        current = result.job
        setJob(current)
        if (result.done) break
      }
      await loadBoards()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La importación se interrumpió.')
    }
  }

  const progress = job?.total_count
    ? Math.min(100, Math.round((job.processed_count / job.total_count) * 100))
    : job?.status === 'completed' ? 100 : 0

  return (
    <div className="space-y-6">
      {!configured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          El modo local ya funciona. Para importar tu tablero real faltan las variables gratuitas de Supabase y las credenciales de una app oficial de Pinterest.
        </div>
      )}

      <ol className="grid gap-4 md:grid-cols-3">
        <Step number="01" title="Connect Pinterest" active={!connected} complete={connected}>
          {configured ? (
            <a href="/api/pinterest/connect" className="mt-4 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
              {connected ? 'Reconnect Pinterest' : 'Connect Pinterest'}
            </a>
          ) : <p className="mt-4 text-sm text-neutral-500">Disponible al añadir las claves.</p>}
        </Step>
        <Step number="02" title="Select Board" active={connected && !job} complete={Boolean(job)}>
          <select
            aria-label="Pinterest board"
            value={selectedBoard}
            onChange={(event) => setSelectedBoard(event.target.value)}
            disabled={!boards.length || Boolean(job && job.status !== 'completed')}
            className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {!boards.length && <option>No boards loaded</option>}
            {boards.map((board) => <option key={board.id} value={board.id}>{board.name} · {board.pin_count} Pins</option>)}
          </select>
        </Step>
        <Step number="03" title="Import Wishlist" active={Boolean(selectedBoard)} complete={job?.status === 'completed'}>
          <button
            type="button"
            disabled={!selectedBoard || Boolean(job && job.status !== 'completed')}
            onClick={() => void importBoard()}
            className="mt-4 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {job?.status === 'running' ? 'Importing…' : 'Import Wishlist'}
          </button>
        </Step>
      </ol>

      {loading && <p className="text-sm text-neutral-500">Loading Pinterest boards…</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <Link href="/login" className="font-semibold underline">Login</Link></p>}

      {job && (
        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl font-bold">{job.status === 'completed' ? 'Import complete' : 'Building your wishlist'}</h2>
            <span className="text-sm text-neutral-500">{progress}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full bg-pink-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
            <Metric label="Imported" value={`${job.processed_count} / ${job.total_count ?? '?'}`} />
            <Metric label="Identified" value={String(job.identified_count)} />
            <Metric label="Needs review" value={String(job.needs_review_count)} />
          </div>
          {job.status === 'completed' && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/wishlist" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white">View wishlist</Link>
              <Link href="/review" className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold">Review unidentified Pins</Link>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Step({ number, title, active, complete, children }: { number: string; title: string; active: boolean; complete: boolean; children: React.ReactNode }) {
  return (
    <li className={`rounded-3xl border bg-white p-5 ${active ? 'border-pink-300 shadow-sm' : 'border-neutral-200'}`}>
      <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-pink-600">{number}</span>{complete && <span className="text-green-600">✓</span>}</div>
      <h2 className="mt-3 font-serif text-xl font-bold">{title}</h2>
      {children}
    </li>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-neutral-50 p-3"><strong className="block text-lg text-neutral-900">{value}</strong><span className="text-xs text-neutral-500">{label}</span></div>
}
