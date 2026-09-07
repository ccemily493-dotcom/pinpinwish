'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ImportJobStats } from '@pinpinwish/shared'

interface SessionInfo {
  isLoggedIn: boolean
  hasSavedProfile: boolean
  message: string
}

export default function PinterestOnboarding({ configured: _configured }: { configured?: boolean }) {
  const [boardUrl, setBoardUrl] = useState('')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [checkingSession, setCheckingSession] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<ImportJobStats | null>(null)
  const [error, setError] = useState<string>()

  const checkSession = useCallback(async () => {
    setCheckingSession(true)
    try {
      const res = await fetch('/api/pinterest/session')
      if (res.ok) {
        const data = (await res.json()) as { session: SessionInfo }
        setSession(data.session)
      }
    } catch {
      // ignore
    } finally {
      setCheckingSession(false)
    }
  }, [])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pinterest/import/${job.id}`)
        if (res.ok) {
          const data = (await res.json()) as { job: ImportJobStats; done: boolean }
          setJob(data.job)
        }
      } catch {
        // ignore
      }
    }, 1200)

    return () => clearInterval(interval)
  }, [job])

  async function handleOpenLogin() {
    setLoggingIn(true)
    setError(undefined)
    try {
      const res = await fetch('/api/pinterest/session', { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as { session: SessionInfo }
        setSession(data.session)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open login window')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleStartImport() {
    if (!session?.isLoggedIn) {
      setError('Open Pinterest login once before starting the automatic import.')
      return
    }
    if (!boardUrl.trim()) {
      setError('Please paste a Pinterest board URL')
      return
    }

    setStarting(true)
    setError(undefined)
    try {
      const res = await fetch('/api/pinterest/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardUrl: boardUrl.trim() }),
      })

      const data = (await res.json()) as { ok?: boolean; job?: ImportJobStats; error?: string }

      if (!res.ok || !data.job) {
        throw new Error(data.error || 'Failed to start import')
      }

      setJob(data.job)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import')
    } finally {
      setStarting(false)
    }
  }

  const isRunning = job?.status === 'running' || job?.status === 'pending'
  const isCompleted = job?.status === 'completed'

  const total = job?.totalCount || 0
  const processed = job?.processedCount || 0
  const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : isCompleted ? 100 : isRunning ? 25 : 0

  return (
    <div className="space-y-6">
      {/* Session Card */}
      <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#831843] uppercase">Local Session</span>
            <h3 className="font-serif text-lg font-bold text-neutral-900">
              {session?.isLoggedIn ? 'Pinterest Account Linked Locally' : 'Pinterest Login Required'}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              {checkingSession
                ? 'Checking local browser profile…'
                : session?.isLoggedIn
                ? 'Session cookies are stored locally. Private and secret boards can be accessed.'
                : 'Pinterest currently redirects automated board visits to login. Sign in once; the local browser profile will be reused.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleOpenLogin()}
            disabled={loggingIn || isRunning}
            className="rounded-full border border-neutral-300 bg-[#FAF7F2] px-5 py-2.5 text-xs font-semibold text-neutral-800 transition hover:border-[#831843] hover:text-[#831843] disabled:opacity-40"
          >
            {loggingIn ? 'Window open…' : session?.isLoggedIn ? 'Re-open Login Session' : 'Open Pinterest Login Window'}
          </button>
        </div>
      </div>

      {/* Board Import Card */}
      <div className="rounded-3xl border border-rose-100 bg-white p-6 sm:p-8 shadow-2xs">
        <span className="text-[10px] font-bold tracking-widest text-[#831843] uppercase">Step 02</span>
        <h3 className="mt-1 font-serif text-2xl font-bold text-neutral-900">Import Board</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Paste the direct link to the Pinterest board you want to sync.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="url"
            value={boardUrl}
            onChange={(e) => setBoardUrl(e.target.value)}
            disabled={isRunning}
            placeholder="https://www.pinterest.com/username/board-slug/"
            className="w-full flex-1 rounded-full border border-neutral-200 bg-[#FAF7F2] px-4 py-3 text-xs shadow-2xs focus:border-[#831843] focus:outline-hidden focus:ring-2 focus:ring-[#fbc6e0] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleStartImport()}
            disabled={starting || isRunning || !boardUrl.trim() || !session?.isLoggedIn}
            className="rounded-full bg-neutral-900 px-6 py-3 text-xs font-semibold tracking-wider text-white shadow-md transition hover:bg-[#831843] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting
              ? 'Starting…'
              : isRunning
              ? 'Importing…'
              : !session?.isLoggedIn
              ? 'Log in first'
              : 'Start Import'}
          </button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-700">{error}</p>}

        {job && (
          <section className="mt-8 rounded-2xl border border-rose-100 bg-[#FAF7F2]/60 p-6 shadow-2xs" aria-live="polite">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-xl font-bold text-neutral-900">
                {isCompleted ? 'Import complete ✨' : 'Importing board…'}
              </h4>
              <span className="font-serif text-lg font-bold text-[#831843]">{progress}%</span>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full bg-linear-to-r from-pink-400 to-[#831843] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5 text-center text-xs sm:grid-cols-5">
              <div className="rounded-xl bg-white p-3 shadow-2xs">
                <strong className="block text-base font-bold text-neutral-900">{job.totalCount ?? '?'}</strong>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Pins Found</span>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-2xs">
                <strong className="block text-base font-bold text-neutral-900">{job.downloadedCount}</strong>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Images Saved</span>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-2xs">
                <strong className="block text-base font-bold text-emerald-700">{job.identifiedCount}</strong>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Identified</span>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-2xs">
                <strong className="block text-base font-bold text-amber-700">{job.needsReviewCount}</strong>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Needs Review</span>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-2xs">
                <strong className="block text-base font-bold text-neutral-700">{job.processedCount}</strong>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Processed</span>
              </div>
            </div>

            {isCompleted && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/wishlist" className="rounded-full bg-neutral-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#831843]">
                  View Wishlist
                </Link>
                <Link href="/review" className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 hover:border-[#831843]">
                  Review Unidentified Pins
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
