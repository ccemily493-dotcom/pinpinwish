'use client'

import { useState, useEffect, useRef } from 'react'
import { extractDroppedProductPayload } from '@/lib/dnd-parser'

interface Props {
  onDropUrl: (payload: { url?: string; imageUrl?: string; title?: string }) => Promise<void>
  disabled?: boolean
}

export default function WishlistDropZone({ onDropUrl, disabled = false }: Props) {
  const [isWindowDragging, setIsWindowDragging] = useState(false)
  const [isOverZone, setIsOverZone] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const dragCounterRef = useRef(0)

  useEffect(() => {
    function handleWindowDragEnter(e: DragEvent) {
      if (disabled) return
      e.preventDefault()
      dragCounterRef.current += 1
      if (dragCounterRef.current === 1) {
        setIsWindowDragging(true)
      }
    }

    function handleWindowDragLeave(e: DragEvent) {
      if (disabled) return
      e.preventDefault()
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) {
        setIsWindowDragging(false)
        setIsOverZone(false)
      }
    }

    function handleWindowDragOver(e: DragEvent) {
      if (disabled) return
      e.preventDefault()
    }

    function handleWindowDrop(e: DragEvent) {
      if (disabled) return
      dragCounterRef.current = 0
      setIsWindowDragging(false)
      setIsOverZone(false)
    }

    window.addEventListener('dragenter', handleWindowDragEnter)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [disabled])

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsWindowDragging(false)
    setIsOverZone(false)
    setErrorMessage(undefined)

    const payload = extractDroppedProductPayload(e.dataTransfer)
    if (!payload.url && !payload.imageUrl && !payload.title) {
      setErrorMessage('No se detectó un enlace o imagen válida.')
      return
    }

    try {
      setIsLoading(true)
      await onDropUrl({
        url: payload.url,
        imageUrl: payload.imageUrl,
        title: payload.title,
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo procesar el producto.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleZoneDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!isOverZone) setIsOverZone(true)
  }

  function handleZoneDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsOverZone(false)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      {errorMessage && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-red-50 p-3 text-xs text-red-700">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(undefined)}
            className="text-neutral-400 hover:text-neutral-700"
          >
            ×
          </button>
        </div>
      )}

      <div
        onDragOver={handleZoneDragOver}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
          isOverZone
            ? 'scale-[1.01] border-[#831843] bg-[#fbc6e0]/25 shadow-lg ring-4 ring-[#831843]/10'
            : isWindowDragging
            ? 'border-dashed border-[#831843]/60 bg-[#FAF7F2] shadow-md animate-pulse'
            : 'border-dashed border-rose-200/80 bg-white/60 hover:border-rose-300 hover:bg-white'
        } p-4 sm:p-5`}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                isOverZone
                  ? 'bg-[#831843] text-white'
                  : 'bg-[#FAF7F2] text-[#831843] border border-rose-100'
              }`}
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span className="text-lg">📥</span>
              )}
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-neutral-900">
                {isLoading
                  ? 'Identificando y extrayendo producto desde la web…'
                  : isOverZone
                  ? '¡Suelta aquí para añadirlo a tu Wishlist!'
                  : isWindowDragging
                  ? 'Suelta el producto aquí o sobre una tarjeta'
                  : 'Arrastra y suelta productos desde cualquier tienda web'}
              </p>
              <p className="text-[11px] text-neutral-500">
                Arrastra un enlace o foto desde Zara, Amazon, Mango, ASOS, etc. PinPinWish extraerá precio, fotos y detalles automáticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold tracking-wider text-[#831843] uppercase md:inline-block">
              Drag & Drop Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
