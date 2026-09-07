'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ImportJobStats } from '@pinpinwish/shared'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

interface SessionInfo {
  isLoggedIn: boolean
  hasSavedProfile: boolean
  message: string
}

export default function PinterestImportModal({ isOpen, onClose, onImportComplete }: Props) {
  const [boardUrl, setBoardUrl] = useState('')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [checkingSession, setCheckingSession] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [job, setJob] = useState<ImportJobStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch session status when opened
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

  const restoreActiveJob = useCallback(async () => {
    try {
      const res = await fetch('/api/pinterest/import', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { job?: ImportJobStats | null }
      if (data.job) setJob(data.job)
    } catch {
      // A missing previous job is not an error for a new import.
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      void checkSession()
      void restoreActiveJob()
    }
  }, [isOpen, checkSession, restoreActiveJob])

  // Poll job status if a job is currently running
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
          if (data.done) {
            onImportComplete?.()
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 1200)

    return () => clearInterval(interval)
  }, [job, onImportComplete])

  async function connectPinterest(): Promise<SessionInfo | null> {
    setLoggingIn(true)
    setError(null)
    try {
      const res = await fetch('/api/pinterest/session', { method: 'POST' })
      const data = (await res.json()) as {
        session?: SessionInfo
        result?: { message?: string }
        error?: string
      }

      if (!res.ok || !data.session?.isLoggedIn) {
        throw new Error(
          data.result?.message || data.error || 'Pinterest login could not be confirmed. Please try again.'
        )
      }

      setSession(data.session)
      return data.session
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open login window')
      return null
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleOpenLogin() {
    await connectPinterest()
  }

  async function handleStartImport() {
    if (!boardUrl.trim()) {
      setError('Please paste a Pinterest board URL')
      return
    }

    setStarting(true)
    setError(null)
    try {
      let activeSession = session
      if (!activeSession?.isLoggedIn) {
        activeSession = await connectPinterest()
        if (!activeSession?.isLoggedIn) return
      }

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

  async function handleCancel() {
    if (!job) return
    try {
      await fetch(`/api/pinterest/import/${job.id}`, { method: 'DELETE' })
      setJob((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
    } catch {
      // ignore
    }
  }

  async function handleRetry() {
    if (!job) return
    setError(null)
    try {
      const res = await fetch(`/api/pinterest/import/${job.id}`, { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as { job: ImportJobStats }
        setJob(data.job)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
    }
  }

  if (!isOpen) return null

  const isRunning = job?.status === 'running' || job?.status === 'pending'
  const isCompleted = job?.status === 'completed'
  const isFailed = job?.status === 'failed'
  const isCancelled = job?.status === 'cancelled'

  const total = job?.totalCount || 0
  const processed = job?.processedCount || 0
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : isCompleted ? 100 : isRunning ? 25 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-rose-100 bg-[#FAF7F2] p-6 sm:p-8 shadow-2xl text-neutral-900">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isRunning}
          aria-label="Close"
          className="absolute right-5 top-5 rounded-full p-2 text-neutral-400 transition hover:bg-neutral-200/60 hover:text-neutral-700 disabled:opacity-30"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#831843] uppercase">
            Automatic Pinterest Import
          </span>
          <h2 id="import-modal-title" className="mt-1 font-serif text-3xl font-bold tracking-tight text-neutral-900">
            Import Wishlist
          </h2>
          <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
            Paste any Pinterest board URL. We will browse the board, download the images locally, analyze the products, and build your smart wishlist automatically.
          </p>
        </div>

        {/* Session Status Bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-100/80 bg-white/70 p-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                session?.isLoggedIn ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
            <span className="font-medium text-neutral-700">
              {checkingSession
                ? 'Checking local browser session…'
                : session?.isLoggedIn
                ? 'Pinterest session active in local profile'
                : 'Pinterest login required before the first import'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleOpenLogin()}
            disabled={loggingIn || isRunning}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-semibold text-neutral-700 transition hover:border-[#831843] hover:text-[#831843] disabled:opacity-40"
          >
            {loggingIn ? 'Complete login in the window…' : session?.isLoggedIn ? 'Reconnect' : 'Connect Pinterest'}
          </button>
        </div>

        {/* Form Inputs (when no active job or when not running) */}
        {!job && (
          <div className="space-y-4">
            <div>
              <label htmlFor="boardUrl" className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                Pinterest Board URL
              </label>
              <div className="relative">
                <input
                  id="boardUrl"
                  type="url"
                  value={boardUrl}
                  onChange={(e) => setBoardUrl(e.target.value)}
                  placeholder="https://www.pinterest.com/username/board-name/"
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm shadow-2xs focus:border-[#831843] focus:outline-none focus:ring-2 focus:ring-[#fbc6e0]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-white/70 px-4 py-3 text-xs leading-relaxed text-neutral-600">
              Product matching is automatic. When a Pin cannot be identified from its link or metadata,
              its downloaded image is sent to Google Lens to look for reliable matches.
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleStartImport()}
                disabled={starting || loggingIn || !boardUrl.trim()}
                className="rounded-full bg-neutral-900 px-6 py-2.5 text-xs font-semibold tracking-wider text-white shadow-md transition hover:bg-[#831843] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting || loggingIn
                  ? session?.isLoggedIn
                    ? 'Starting import…'
                    : 'Waiting for Pinterest login…'
                  : session?.isLoggedIn
                  ? 'Start Automatic Import'
                  : 'Connect & Import'}
              </button>
            </div>
          </div>
        )}

        {/* Live Progress Display */}
        {job && (
          <div className="space-y-5 rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-neutral-900">
                  {isCompleted
                    ? 'Import Completed!'
                    : isFailed
                    ? 'Import Failed'
                    : isCancelled
                    ? 'Import Cancelled'
                    : 'Importing Pins & Products…'}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isCompleted
                    ? 'All items have been processed into your wishlist.'
                    : isFailed
                    ? job.errorMessage || 'An error occurred during import.'
                    : isCancelled
                    ? 'The operation was stopped by user.'
                    : 'Scraping board and identifying products in background…'}
                </p>
              </div>
              <span className="font-serif text-xl font-bold text-[#831843]">{percent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-linear-to-r from-pink-400 via-[#ec4899] to-[#831843] transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 text-center sm:grid-cols-6">
              <MetricItem label="Found" value={job.totalCount ?? '?'} />
              <MetricItem label="Images" value={job.downloadedCount} />
              <MetricItem label="Analyzing" value={job.analyzingCount} />
              <MetricItem label="Identified" value={job.identifiedCount} highlight="emerald" />
              <MetricItem label="Review" value={job.needsReviewCount} highlight="amber" />
              <MetricItem label="Errors" value={job.errorCount} highlight={job.errorCount > 0 ? 'red' : undefined} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-[11px] text-neutral-400">
                {isRunning && 'You can close this modal; import continues in background.'}
              </div>
              <div className="flex gap-2">
                {isRunning && (
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Cancel import
                  </button>
                )}
                {(isFailed || isCancelled) && (
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-[#831843]"
                  >
                    Retry Import
                  </button>
                )}
                {(isCompleted || isCancelled || isFailed) && (
                  <button
                    type="button"
                    onClick={() => {
                      onImportComplete?.()
                      onClose()
                    }}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-[#831843]"
                  >
                    {isCompleted ? 'View Wishlist ✨' : 'Close'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: 'emerald' | 'amber' | 'red'
}) {
  const colorClass =
    highlight === 'emerald'
      ? 'text-emerald-700 font-bold'
      : highlight === 'amber'
      ? 'text-amber-700 font-bold'
      : highlight === 'red'
      ? 'text-red-600 font-bold'
      : 'text-neutral-900 font-semibold'

  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-2">
      <div className={`text-base ${colorClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  )
}
