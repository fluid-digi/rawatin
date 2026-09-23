import { useRef, useState } from 'react'
import { compressToWebP, type CompressedPhoto } from '../lib/compress'

/**
 * Kamera langsung (capture) + kompresi client-side ≤150KB (Modul 3 & 11).
 */
export function PhotoCapture({
  onPhotos,
  max = 4,
  captureLabel = '📷 Kamera',
  galleryLabel = 'Galeri',
}: {
  onPhotos: (photos: CompressedPhoto[]) => void
  max?: number
  captureLabel?: string
  galleryLabel?: string
}) {
  const [photos, setPhotos] = useState<CompressedPhoto[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = max - photos.length
    const list = Array.from(files).slice(0, room)
    const next: CompressedPhoto[] = [...photos]
    for (const file of list) {
      try {
        const p = await compressToWebP(file)
        next.push(p)
      } catch {
        /* skip file rusak */
      }
      if (next.length >= max) break
    }
    setPhotos(next)
    onPhotos(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
      {photos.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <img src={p.dataUrl} alt={`foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-xs text-white"
                onClick={() => {
                  const next = photos.filter((_, j) => j !== i)
                  setPhotos(next)
                  onPhotos(next)
                }}
              >
                ✕
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">{Math.round(p.bytes / 1024)}KB</span>
            </div>
          ))}
        </div>
      )}
      {photos.length < max && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50 px-3 py-3 text-base font-bold text-primary-700 active:bg-primary-100"
          >
            {captureLabel} <span className="text-xs font-normal">({max - photos.length} lagi)</span>
          </button>
          <button onClick={() => inputRef.current?.click()} className="rounded-2xl border-2 border-dashed border-slate-200 px-3 py-3 text-base font-bold text-slate-600 active:bg-slate-50">
            {galleryLabel} ←
          </button>
        </div>
      )}
    </div>
  )
}
