/**
 * Modul 12 (lite): Kartu Hasil before/after — render client-side canvas,
 * Rp 0 biaya server. Format 1:1 (feed) & 9:16 (story), download + Web Share.
 */
export interface ShareCardData {
  beforeUrl: string
  afterUrl: string
  itemLabel: string
  outletName: string
  outletSlug: string
  logoUrl?: string | null
  badge: string
  streak?: number | null
  counter?: number | null
  counterLabel?: string
  orderCode: string
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Gagal memuat ${url}`))
    img.src = url
  })
}

export async function renderShareCard(data: ShareCardData, ratio: '1:1' | '9:16' = '1:1'): Promise<{ canvas: HTMLCanvasElement; blob: Blob; url: string }> {
  const W = ratio === '1:1' ? 1080 : 1080
  const H = ratio === '1:1' ? 1080 : 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Latar gradien
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#022c22')
  grad.addColorStop(1, '#134e4a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  // Badge
  ctx.fillStyle = '#fbbf24'
  ctx.font = `bold ${ratio === '1:1' ? 54 : 60}px system-ui, sans-serif`
  ctx.fillText(data.badge, W / 2, ratio === '1:1' ? 130 : 150)

  // Foto before / after
  const pad = 80
  const gap = 40
  const photoArea = ratio === '1:1' ? H - 560 : H - 760
  const slotW = (W - pad * 2 - gap) / 2
  const slotH = photoArea * 0.72
  try {
    const [before, after] = await Promise.all([loadImg(data.beforeUrl), loadImg(data.afterUrl)])
    const draw = (img: HTMLImageElement, x: number, label: string) => {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath()
      ctx.roundRect(x, 220, slotW, slotH, 28)
      ctx.fill()
      const cover = Math.min(slotW / img.width, slotH / img.height)
      const dw = img.width * cover
      const dh = img.height * cover
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, 220, slotW, slotH, 28)
      ctx.clip()
      ctx.drawImage(img, x + (slotW - dw) / 2, 220 + (slotH - dh) / 2, dw, dh)
      ctx.restore()
      ctx.fillStyle = '#ecfdf5'
      ctx.font = `bold ${ratio === '1:1' ? 34 : 38}px system-ui`
      ctx.fillText(label, x + slotW / 2, 190)
      ctx.fillStyle = '#f0fdfa'
      ctx.font = `24px system-ui`
      ctx.fillText('→', W / 2, 220 + slotH / 2)
    }
    draw(before, pad, 'BEFORE')
    draw(after, pad + slotW + gap, 'AFTER')
  } catch {
    ctx.fillStyle = '#f0fdfa'
    ctx.font = '40px system-ui'
    ctx.fillText('foto tidak tersedia', W / 2, photoArea / 2)
  }

  // Item + gamifikasi
  const baseY = ratio === '1:1' ? 700 : 860
  ctx.fillStyle = '#f0fdfa'
  ctx.font = `bold ${ratio === '1:1' ? 44 : 46}px system-ui`
  ctx.fillText(data.itemLabel, W / 2, baseY)
  if (data.streak) {
    ctx.fillStyle = '#fbbf24'
    ctx.font = `${ratio === '1:1' ? 34 : 36}px system-ui`
    ctx.fillText(`Cucian ke-${data.streak} 🎉`, W / 2, baseY + 64)
  }

  // Footer outlet + watermark
  const footY = ratio === '1:1' ? H - 70 : H - 90
  ctx.fillStyle = '#99f6e4'
  ctx.font = `bold ${ratio === '1:1' ? 36 : 40}px system-ui`
  ctx.fillText(data.outletName, W / 2, footY - 40)
  ctx.fillStyle = 'rgba(153,246,228,0.8)'
  ctx.font = `30px system-ui`
  ctx.fillText(`rawatin.id/${data.outletSlug} · ${data.orderCode}`, W / 2, footY)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('gagal'))), 'image/png'))
  const url = canvas.toDataURL('image/png')
  return { canvas, blob, url }
}

export async function downloadCard(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export async function webShare(url: string, blob: Blob, title: string) {
  const file = new File([blob], 'hasil.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    await navigator.share({ title, text: 'Hasil cucian!', files: [file] })
    return true
  }
  await downloadCard(url, title)
  return false
}
