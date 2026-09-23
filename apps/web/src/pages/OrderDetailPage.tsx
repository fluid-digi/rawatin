import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, uploadPhoto } from '../lib/api'
import { useAuth } from '../store/auth'
import { Button, Card, Badge, Field, inputCls, Modal, Toast } from '../components/ui'
import { ORDER_STATUS, idr, shortDate, fullDate } from '../lib/format'
import { PhotoCapture } from '../components/PhotoCapture'
import { renderShareCard, downloadCard, webShare } from '../lib/share-card'
import { useOnlineStatus } from '../lib/useOnline'
import type { CompressedPhoto } from '../lib/compress'

export function OrderDetailPage() {
  const { code } = useParams()
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const online = useOnlineStatus()
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [pickupOpen, setPickupOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [pickupPhotos, setPickupPhotos] = useState<CompressedPhoto[]>([])
  const [pickedUpBy, setPickedUpBy] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [afterPhotos, setAfterPhotos] = useState<CompressedPhoto[]>([])
  const [payAmount, setPayAmount] = useState('')
  const [customNote, setCustomNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get<any>(`/t/${slug}/orders/${code}`).then(setD).catch((e) => setErr(e.message))
  useEffect(() => {
    void load()
  }, [slug, code])

  if (err) return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</div>
  if (!d) return <p className="p-6 text-center text-slate-400">Memuat…</p>
  const o = d.order
  const remaining = o.total - o.paidAmount
  const beforeFirst = d.photos.find((p: any) => p.type === 'before')?.url
  const afterFirst = d.photos.find((p: any) => p.type === 'after')?.url
  const proof = d.photos.filter((p: any) => p.type === 'pickup_proof')
  const showShare = ['ready', 'completed'].includes(o.status) && beforeFirst && afterFirst

  const advance = async (to: string) => {
    try {
      await api.post(`/t/${slug}/orders/${o.orderCode}/status`, { to })
      setToast(`→ ${ORDER_STATUS[to]!.label}`)
      load()
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const waTemplate = async (type: string) => {
    try {
      const r = await api.post<{ url: string }>(`/t/${slug}/orders/${o.orderCode}/wa/${type}`, {})
      window.open(r.url, '_blank')
      setToast('WA terbuka — pesan sudah terisi 💬')
      load()
    } catch (e: any) {
      setToast(e.message)
    }
    setWaOpen(false)
  }

  const doPickup = async () => {
    setBusy(true)
    try {
      // Upload foto bukti dulu (gambar dari kamera langsung sudah terkompresi)
      let proofId: string | undefined
      if (pickupPhotos[0]) {
        const up = await uploadPhoto(o.id, pickupPhotos[0].blob, 'pickup_proof')
        proofId = up.id
      }
      await api.post(`/t/${slug}/orders/${o.orderCode}/pickup`, {
        photoId: proofId,
        pickedUpByName: pickedUpBy || undefined,
        overrideNote: overrideNote || undefined,
      })
      setToast('✅ Order selesai — bukti foto tersimpan')
      setPickupOpen(false)
      setPickupPhotos([])
      load()
    } catch (e: any) {
      setToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  const doPayment = async () => {
    const amount = Number(payAmount.replace(/\D/g, ''))
    if (!amount) return
    try {
      await api.post(`/t/${slug}/orders/${o.orderCode}/payment`, { amount, method: 'cash', note: customNote || undefined })
      setToast('Pembayaran tercatat ✓')
      setPayOpen(false)
      setPayAmount('')
      load()
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const uploadAfter = async () => {
    if (!afterPhotos.length || !online) return
    for (const ph of afterPhotos) {
      await uploadPhoto(o.id, ph.blob, 'after').catch(() => undefined)
    }
    setAfterPhotos([])
    load()
    setToast('Foto after terupload ✓')
  }

  const share = async (ratio: '1:1' | '9:16') => {
    try {
      const card = await renderShareCard(
        {
          beforeUrl: beforeFirst,
          afterUrl: afterFirst,
          itemLabel: d.items.map((i: any) => [i.brand, i.model].filter(Boolean).join(' ') || 'Item').join(', '),
          outletName: session!.tenant.name,
          outletSlug: slug,
          badge: d.resiUrl ? '✨ Glow Up Complete' : '✨ Glow Up Complete',
          streak: null,
          orderCode: o.orderCode,
        },
        ratio,
      )
      const used = await webShare(card.url, card.blob, `Hasil cucian ${o.orderCode} ✨`)
      await api.post(`/t/${slug}/orders/${o.orderCode}/share-event`, { actor: 'staff', format: ratio, method: used ? 'web_share' : 'download' }).catch(() => undefined)
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const markReview = async () => {
    try {
      const r = await api.post<{ url: string } | any>(`/t/${slug}/orders/${o.orderCode}/wa/review_request`, {})
      if (r.url) window.open(r.url, '_blank')
      await api.post(`/t/${slug}/orders/${o.orderCode}/review-sent`, {}).catch((e: any) => setToast(e.message))
      setToast('⭐ Pesan review terbuka di WA. Setelah pelanggan lihat, sudah ditandai terkirim.')
      load()
    } catch (e: any) {
      setToast(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-wider text-slate-800">{o.orderCode}</h1>
        <Badge className={ORDER_STATUS[o.status]?.color}>{ORDER_STATUS[o.status]?.label}</Badge>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-800">{d.customer?.name}</div>
            <div className="text-sm text-slate-400">{d.customer?.phone}</div>
          </div>
          <a href={`/r/${o.orderCode}`} target="_blank" rel="noreferrer" className="rounded-xl bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700">
            🔗 Resi publik
          </a>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-xs text-slate-400">Terkirim</div>
            {shortDate(o.receivedAt)}
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-xs text-slate-400">Estimasi siap</div>
            {shortDate(o.estimatedReadyAt)}
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-xs text-slate-400">Tagihan</div>
            {idr(o.total)} · bayar {idr(o.paidAmount)}
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <div className="text-xs text-slate-400">Sisa</div>
            <span className={remaining > 0 ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>{remaining > 0 ? idr(remaining) : 'Lunas ✓'}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-600">Item</h2>
          <button className="text-sm font-semibold text-teal-700" onClick={() => location.assign(`/api/t/${slug}/labels.pdf?codes=${o.orderCode}`)}>
            🖨 Cetak label
          </button>
        </div>
        <div className="space-y-3">
          {d.items.map((it: any) => (
            <div key={it.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-800">
                  {it.brand} {it.model}
                </span>
                {it.color && <Badge className="bg-white text-slate-500 ring-1 ring-slate-200">{it.color}</Badge>}
                {it.quantity > 1 && <Badge className="bg-slate-800 text-white">×{it.quantity}</Badge>}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {it.services.map((s: any) => `${s.serviceName} ${idr(s.priceSnapshot)}${s.addonSnapshot.length ? ` + ${s.addonSnapshot.map((a: any) => a.name).join(', ')}` : ''}`).join(' · ')}
              </div>
              {it.conditionTags.length > 0 && <div className="mt-1 text-xs text-amber-700">{it.conditionTags.join(' · ')}</div>}
              {it.conditionNotes && <div className="mt-1 text-xs text-slate-400">{it.conditionNotes}</div>}
              {it.photos.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {it.photos.slice(0, 4).map((p: any) => (
                    <img key={p.id} src={p.url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Foto after & bukti pengambilan</h2>
        <div className="grid grid-cols-4 gap-2">
          {d.photos.filter((p: any) => p.type === 'after').map((p: any) => (
            <img key={p.id} src={p.url} alt="" className="aspect-square rounded-lg object-cover ring-1 ring-slate-200" />
          ))}
          {proof.map((p: any) => (
            <div key={p.id} className="relative">
              <img src={p.url} alt="" className="aspect-square rounded-lg object-cover ring-2 ring-emerald-400" />
              <span className="absolute bottom-1 left-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">BUKTI AMBIL</span>
            </div>
          ))}
        </div>
        {['received', 'in_progress', 'finishing', 'ready'].includes(o.status) && (
          <div className="mt-3">
            <PhotoCapture max={4} onPhotos={setAfterPhotos} captureLabel="📷 Foto hasil (after)" />
            {afterPhotos.length > 0 && (
              <Button className="mt-2 w-full" onClick={uploadAfter} disabled={!online}>
                Simpan foto after
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Aksi</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPayOpen(true)}>
            💳 Bayar
          </Button>
          <Button variant="secondary" onClick={() => setWaOpen(true)} disabled={!d.customer?.phone}>
            💬 WA template
          </Button>
          {o.status !== 'completed' && o.status !== 'abandoned' && (
            <Button className="col-span-2 bg-emerald-700" onClick={() => setPickupOpen(true)}>
              📦 Konfirmasi Pengambilan
            </Button>
          )}
          {o.status === 'completed' && !o.reviewRequestSentAt && (
            <Button className="col-span-2 bg-amber-500" onClick={markReview}>
              ⭐ Minta Review Google Maps
            </Button>
          )}
          {showShare && (
            <Button className="col-span-2 bg-fuchsia-700" onClick={() => setShareOpen(true)}>
              ✨ Buat Kartu Hasil (share)
            </Button>
          )}
        </div>
        {['received', 'in_progress', 'finishing', 'ready'].includes(o.status) && (
          <div className="mt-3 flex gap-2">
            {o.status === 'received' && (
              <Button className="flex-1" onClick={() => advance('in_progress')}>
                ▶️ Mulai kerjakan
              </Button>
            )}
            {o.status === 'in_progress' && (
              <Button className="flex-1" onClick={() => advance('finishing')}>
                ▶️ Ke finishing
              </Button>
            )}
            {o.status === 'finishing' && (
              <Button className="flex-1" onClick={() => advance('ready')}>
                ▶️ Siap diambil 🎉
              </Button>
            )}
            {o.status === 'ready' && (
              <Button variant="secondary" className="flex-1" onClick={() => advance('finishing')}>
                ↩️ Balik ke finishing
              </Button>
            )}
          </div>
        )}
        {o.reviewRequestSentAt && (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            ⭐ Review diminta {fullDate(o.reviewRequestSentAt)} · pada card order tampil badge (anti-spam ganda). Owner bisa reset di laporan.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Riwayat status & pembayaran</h2>
        <div className="space-y-1.5 text-sm">
          {d.statusLogs.map((l: any) => (
            <div key={l.id} className="flex justify-between gap-2 text-slate-500">
              <span>
                {l.fromStatus ? `${ORDER_STATUS[l.fromStatus]?.label} → ` : ''}
                <b className="text-slate-700">{ORDER_STATUS[l.toStatus]?.label}</b> · {l.userName}
              </span>
              <span className="text-xs text-slate-400">{shortDate(l.createdAt)}</span>
            </div>
          ))}
          {d.payments.map((p: any) => (
            <div key={p.id} className="flex justify-between gap-2 text-slate-500">
              <span>
                💰 {idr(p.amount)} · {p.method}
              </span>
              <span className="text-xs text-slate-400">{fullDate(p.createdAt)}</span>
            </div>
          ))}
          {o.disclaimerAcceptedAt && <div className="text-xs text-slate-400">🔑 Disclaimer disetujui {fullDate(o.disclaimerAcceptedAt)} oleh {o.disclaimerAcceptedBy}</div>}
          {d.resiViews > 0 && <div className="text-xs text-slate-400">👁 Resi dibuka {d.resiViews}x</div>}
          {d.shareEvents.length > 0 && <div className="text-xs text-slate-400">✨ Kartu dibagikan {d.shareEvents.length}x</div>}
        </div>
      </Card>

      {/* WA deeplink */}
      <Modal open={waOpen} onClose={() => setWaOpen(false)} title="Kirim WA (deeplink, Rp 0)">
        <div className="grid gap-2">
          {(
            [
              ['received', '📥 Order diterima'],
              ['ready', '🎉 Siap diambil'],
              ['reminder_14', '⏰ Ingatkan belum diambil (H+14)'],
              ['reminder_30', '🚨 Tegas (H+30)'],
              ['payment', '💰 Tagihan'],
              ['review_request', '⭐ Minta review Google Maps'],
            ] as [string, string][]
          ).map(([t, label]) => (
            <Button key={t} variant="secondary" className="w-full justify-start" onClick={() => waTemplate(t)}>
              {label}
            </Button>
          ))}
        </div>
      </Modal>

      {/* Pembayaran */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Pembayaran · sisa ${idr(remaining)}`}>
        <div className="space-y-3">
          <input className={inputCls} inputMode="numeric" placeholder={String(remaining)} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <input className={inputCls} placeholder="Catatan (opsional)" value={customNote} onChange={(e) => setCustomNote(e.target.value)} />
          <Button className="w-full" onClick={doPayment} disabled={!Number(payAmount.replace(/\D/g, ''))}>
            Catat pembayaran
          </Button>
        </div>
      </Modal>

      {/* ⭐ Konfirmasi pengambilan — kamera wajib */}
      <Modal open={pickupOpen} onClose={() => setPickupOpen(false)} title="Konfirmasi Pengambilan">
        <div className="space-y-3">
          {remaining > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Sisa bayar {idr(remaining)} — wajib lunas dulu{session!.user.role === 'owner' ? ' (atau override dengan catatan)' : ''}.
            </div>
          )}
          {session!.tenant.requirePickupProof && (
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">Foto bukti serah-terima (kamera langsung, wajib)</p>
              <PhotoCapture max={1} onPhotos={setPickupPhotos} captureLabel="📷 Foto bukti ambil" />
            </div>
          )}
          <Field label="Diambil oleh (opsional)">
            <input className={inputCls} placeholder="Suami / kurir / teman" value={pickedUpBy} onChange={(e) => setPickedUpBy(e.target.value)} />
          </Field>
          {remaining > 0 && session!.user.role === 'owner' && (
            <Field label="Catatan override (owner)">
              <input className={inputCls} placeholder="mis. 'sudah transfer, bukti menyusul'" value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} />
            </Field>
          )}
          <Button
            className="w-full min-h-14 bg-emerald-700 text-lg"
            loading={busy}
            disabled={session!.tenant.requirePickupProof && pickupPhotos.length === 0}
            onClick={doPickup}
          >
            📸 Selesaikan order (wajib foto)
          </Button>
        </div>
      </Modal>

      {/* ✨ Share card */}
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Kartu Hasil Before/After">
        <p className="mb-3 text-sm text-slate-500">Kartu digambar di HP ini (canvas) — Rp 0. Pilih format:</p>
        <div className="grid grid-cols-2 gap-2">
          <Button className="min-h-24 flex-col" onClick={() => share('1:1')}>
            <span className="text-2xl">▢</span>
            Feed 1:1
          </Button>
          <Button className="min-h-24 flex-col bg-fuchsia-800" onClick={() => share('9:16')}>
            <span className="text-2xl">▯</span>
            Story 9:16
          </Button>
        </div>
      </Modal>

      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  )
}
