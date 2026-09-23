/**
 * Kompresi foto client-side: canvas → WebP, maks sisi 1.200px,
 * kualitas dari 0.82 turun sampai ≤150KB (PRD Modul 3 — wajib).
 */
export const MAX_EDGE = 1200
export const MAX_BYTES = 150_000

export interface CompressedPhoto {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  bytes: number
}

export async function compressToWebP(source: Blob, maxBytes = MAX_BYTES): Promise<CompressedPhoto> {
  const img = await loadImage(source)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  let quality = 0.82
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }
  return {
    blob,
    dataUrl: await blobToDataUrl(blob),
    width: w,
    height: h,
    bytes: blob.size,
  }
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal membaca gambar'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal encode WebP'))), 'image/webp', quality))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Gagal baca blob'))
    reader.readAsDataURL(blob)
  })
}
