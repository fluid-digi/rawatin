import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { idr, shortDate, fullDate } from '../lib/format'
import { sanitizePhone, openWa } from '../lib/wa'
import { renderShareCard, webShare } from '../lib/share-card'
import { Button } from '../components/ui'

/** ⭐ Modul 6 — Resi digital publik: rawatin.id/r/{kode}. Tanpa login. */
export function ResiPage() {
  const { code } = useParams()
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState('')
  const [shareBusy, setShareBusy] = useState(false)

  useEffect(() => {
    api.get<any>(`/r/${code}`).then(setD).catch((e) => setErr(e.message))
  }, [code])

  if (err) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🔍</div>
          <h1 className="mt-3 text-xl font-black text-slate-800">Resi tidak ditemukan</h1>
          <p className="mt-1 text-sm text-slate-500">Periksa kembali kode dari outlet, atau tanya lewat WA outlet.</p>
        </div>
      </div>
    )
  }
  if (!d) return <div className="grid min-h-dvh place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" /></div>

  const { resi, tenant } = d
  const t = tenant
  const before = resi.items.flatMap((i: any) => i.photos.before)
  const after = resi.items.flatMap((i: any) => i.photos.after)

  const share = async () => {
    if (shareBusy) return
    setShareBusy(true)
    try {
      const card = await renderShareCard(
        {
          beforeUrl: before[0]?.url,
          afterUrl: after[0]?.url,
          itemLabel: resi.items.map((i: any) => [i.brand, i.model].filter(Boolean).join(' ') || 'Item').join(', '),
          outletName: t.name,
          outletSlug: t.slug,
          badge: resi.badge,
          streak: resi.streak,
          orderCode: resi.code,
        },
        '1:1',
      )
      await webShare(card.url, card.blob, `Hasil cucian ${resi.code} ✨`)
      await api.post(`/r/${resi.code}/share-event`, {}).catch(() => undefined)
    } catch {
      /* user membatalkan share */
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-100 pb-16">
      {/* Header outlet */}
      <div className="bg-gradient-to-b from-teal-800 to-teal-700 px-5 pb-8 pt-6 text-white">
        <div className="flex items-center gap-3">
          {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-12 w-12 rounded-2xl bg-white object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-lg font-black">R</span>}
          <div>
            <div className="text-lg font-black">{t.name}</div>
            <div className="text-xs text-teal-100">{t.city || ''}{t.openingHours ? ` · ${t.openingHours}` : ''}</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-white/10 p-4">
          <div className="text-xs text-teal-100">Nomor resi</div>
          <div className="text-2xl font-black tracking-widest">{resi.code}</div>
          <div className="mt-1 text-sm text-teal-100">
            {resi.customerName} · dibuka {resi.views}x
          </div>
        </div>
      </div>

      <div className="-mt-4 space-y-4 px-4">
        {/* Progress bar */}
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-1 text-sm font-bold text-slate-800">{resi.statusLabel}</div>
          <div className="flex items-center gap-1">
            {resi.statusFlow.map((s: any, i: number) => (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${s.reached ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {s.reached ? '✓' : i + 1}
                </span>
                {i < resi.statusFlow.length - 1 && <span className={`h-1 flex-1 rounded ${resi.statusFlow[i + 1].reached ? 'bg-teal-600' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-400">{resi.statusFlow.map((s: any) => s.label).join(' → ')}</div>
          <div className="mt-3 text-sm text-slate-500">
            {resi.status === 'complete' || resi.status === 'completed'
              ? `Diambil ${fullDate(resi.pickedUpAt)}` + (resi.remaining > 0 ? ` · sisa ${idr(resi.remaining)}` : ' · lunas ✓')
              : `Perkiraan siap: ${shortDate(resi.estimatedReadyAt)}`}
          </div>
        </div>

        {/* Item + kondisi */}
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-600">Detail item</h2>
          <div className="space-y-3">
            {resi.items.map((it: any, i: number) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3">
                <div className="font-bold text-slate-800">
                  {it.brand} {it.model} {it.color && `(${it.color})`}
                </div>
                <div className="text-sm text-slate-500">{it.services.map((s: any) => s.serviceName).join(' + ')}</div>
                {it.conditionTags.length > 0 && <div className="mt-1 text-xs text-amber-700">{it.conditionTags.join(' · ')}</div>}
                {it.conditionNotes && <div className="text-xs text-slate-400">{it.conditionNotes}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Before / After */}
        {(before.length > 0 || after.length > 0) && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-600">Rapor kondisi barang</h2>
            {before.length > 0 && (
              <>
                <div className="mb-1 text-xs font-semibold text-slate-400">BEFORE — saat diterima</div>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {before.slice(0, 4).map((p: any, i: number) => <img key={i} src={p.url} alt="" className="aspect-square rounded-lg object-cover ring-1 ring-slate-200" />)}
                </div>
              </>
            )}
            {after.length > 0 && (
              <>
                <div className="mb-1 text-xs font-semibold text-teal-600">AFTER — hasil bersih ✨</div>
                <div className="grid grid-cols-4 gap-2">
                  {after.slice(0, 4).map((p: any, i: number) => <img key={i} src={p.url} alt="" className="aspect-square rounded-lg object-cover ring-1 ring-teal-200" />)}
                </div>
              </>
            )}
            {resi.streak && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">🏅 Cucian ke-{resi.streak} di {t.name}</div>}
          </div>
        )}

        {/* Bukti pengambilan */}
        {resi.photos.pickupProof.length > 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-bold text-slate-600">Bukti serah-terima 🧾</h2>
            <p className="mb-2 text-xs text-slate-400">Foto saat barang diambil · {fullDate(resi.pickedUpAt)}</p>
            <div className="grid grid-cols-4 gap-2">
              {resi.photos.pickupProof.map((p: any, i: number) => <img key={i} src={p.url} alt="" className="aspect-square rounded-lg object-cover ring-2 ring-emerald-400" />)}
            </div>
          </div>
        )}

        {/* Pembayaran */}
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-slate-600">Pembayaran</h2>
          <div className="space-y-1 text-sm text-slate-600">
            <div className="flex justify-between"><span>Total</span><span className="font-semibold">{idr(resi.total)}</span></div>
            {resi.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{idr(resi.discount)}</span></div>}
            <div className="flex justify-between"><span>Dibayar</span><span className="font-semibold text-emerald-600">{idr(resi.paidAmount)}</span></div>
            {resi.remaining > 0 && <div className="flex justify-between font-bold text-red-600"><span>Sisa</span><span>{idr(resi.remaining)}</span></div>}
          </div>
        </div>

        {/* Aksi */}
        <div className="space-y-2">
          {resi.canShare && after.length > 0 && before.length > 0 && (
            <Button className="w-full bg-fuchsia-700" loading={shareBusy} onClick={share}>
              ✨ Bagikan Hasil (before/after)
            </Button>
          )}
          {t.whatsapp && (
            <Button variant="secondary" className="w-full" onClick={() => openWa(t.whatsapp, `Halo ${t.name}, saya mau tanya soal resi ${resi.code}`)}>
              💬 Chat WA outlet
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={() => window.open(resi.shareUrl, '_blank')}>
            🔗 Salin link resi
          </Button>
        </div>
      </div>

      {/* Footer viral */}
      <div className="mt-8 text-center text-xs text-slate-400">
        <p>Dikelola dengan <b className="text-teal-700">Rawatin</b> — resi digital & bukti kondisi</p>
        <p className="mt-0.5">rawatin.id/{t.slug}</p>
      </div>
    </div>
  )
}
