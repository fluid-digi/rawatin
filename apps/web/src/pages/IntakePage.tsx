import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, uploadPhoto } from '../lib/api'
import { useAuth } from '../store/auth'
import { PhotoCapture } from '../components/PhotoCapture'
import { Button, Card, Field, inputCls, Toast } from '../components/ui'
import { idr, fullDate } from '../lib/format'
import { offlineQueue, generateClientId } from '../lib/offline-queue'
import { useOnlineStatus } from '../lib/useOnline'
import type { CompressedPhoto } from '../lib/compress'

interface Svc { id: string; name: string; price: number; durationDays: number; category: string; isActive: boolean }
interface Addon { id: string; name: string; price: number; extraDurationDays: number; isActive: boolean }
interface ItemForm {
  brand: string
  model: string
  color: string
  conditionTags: string[]
  conditionNotes: string
  serviceId: string
  addonIds: string[]
  photos: CompressedPhoto[]
}

const BRAND_SUGGEST = ['Nike', 'Adidas', 'Converse', 'Vans', 'New Balance', 'Puma']
const COLOR_CHIPS = ['Putih', 'Hitam', 'Coklat', 'Krem', 'Biru', 'Merah', 'Hijau', 'Abu']
const CONDITION_CHIPS = ['Sol menguning', 'Sol lepas', 'Cat pudar', 'Sobek', 'Bau', 'Jamur', 'Kotor berat']

const emptyItem = (svcId = ''): ItemForm => ({ brand: '', model: '', color: '', conditionTags: [], conditionNotes: '', serviceId: svcId, addonIds: [], photos: [] })

/** ⭐ Modul 3 — Intake satu halaman, < 60 detik, offline-capable. */
export function IntakePage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const online = useOnlineStatus()
  const nav = useNavigate()
  const [services, setServices] = useState<Svc[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [customers, setCustomers] = useState<{ name: string; phone: string }[]>([])
  const [disclaimer, setDisclaimer] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [items, setItems] = useState<ItemForm[]>([emptyItem()])
  const [discount, setDiscount] = useState(0)
  const [payMode, setPayMode] = useState<'full' | 'dp' | 'later'>('full')
  const [payMethod, setPayMethod] = useState<'cash' | 'qris' | 'transfer'>('cash')
  const [disclaimerOk, setDisclaimerOk] = useState(false)
  const [publishOk, setPublishOk] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [done, setDone] = useState<{ code: string; resiUrl: string; itemCount: number } | null>(null)

  useEffect(() => {
    api.get<{ services: Svc[]; addons: Addon[] }>(`/t/${slug}/services`).then((r) => {
      setServices(r.services.filter((s) => s.isActive))
      setAddons(r.addons.filter((a) => a.isActive))
      setItems((it) => it.map((i) => ({ ...i, serviceId: i.serviceId || r.services[0]?.id || '' })))
    })
    api.get<{ customers: { name: string; phone: string }[] }>(`/t/${slug}/customers`).then((r) => setCustomers(r.customers))
    api.get<any>(`/t/${slug}/settings`).then((s) => setDisclaimer(s.disclaimerText ?? '')).catch(() => undefined)
  }, [slug])

  const subtotal = useMemo(
    () =>
      items.reduce((sum, it) => {
        const svc = services.find((s) => s.id === it.serviceId)
        const addonSum = addons.filter((a) => it.addonIds.includes(a.id)).reduce((s, a) => s + a.price, 0)
        return sum + (svc?.price ?? 0) + addonSum
      }, 0),
    [items, services, addons],
  )
  const total = Math.max(0, subtotal - discount)
  const dpAmount = Math.round(total / 2)

  const setItem = (i: number, patch: Partial<ItemForm>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))

  const submit = async () => {
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) return setToast('Nomor WA pelanggan wajib diisi')
    if (items.length === 0 || !items[0]?.serviceId) return setToast('Pilih minimal 1 layanan')
    const payload = {
      clientId: generateClientId(),
      customer: { phone: phone.trim(), name: name.trim() || undefined },
      items: items.map((it) => ({
        brand: it.brand,
        model: it.model,
        color: it.color,
        conditionTags: it.conditionTags,
        conditionNotes: it.conditionNotes,
        quantity: 1,
        serviceIds: [it.serviceId],
        addonIds: it.addonIds,
        photos: it.photos.map((p) => ({ dataUrl: p.dataUrl, width: p.width, height: p.height })),
      })),
      discount,
      payment: {
        amount: payMode === 'full' ? total : payMode === 'dp' ? dpAmount : 0,
        method: payMethod,
      },
      disclaimerAccepted: disclaimerOk,
      publishConsent: publishOk,
    }
    setBusy(true)
    try {
      if (!online) {
        await offlineQueue.push(slug, String((payload as { clientId: string }).clientId), payload)
        setToast('📴 Offline — order disimpan lokal, otomatis terkirim saat online')
        setDone({ code: 'OFFLINE', resiUrl: '', itemCount: items.length })
        return
      }
      const res = await api.post<{ order: { id: string; orderCode: string }; items: { id: string }[]; resiUrl: string }>(`/t/${slug}/orders`, payload)
      // Upload foto (kompresi client-side sudah ≤150KB — PRD wajib)
      for (const [idx, item] of items.entries()) {
        const itemId = res.items[idx]?.id
        if (!itemId) continue
        for (const ph of item.photos) {
          await uploadPhoto(res.order.id, ph.blob, 'before', itemId).catch(() => undefined)
        }
      }
      setDone({ code: res.order.orderCode, resiUrl: res.resiUrl, itemCount: items.length })
      setToast(`Order ${res.order.orderCode} tersimpan 🎉`)
    } catch (e: any) {
      setToast(e.message ?? 'Gagal menyimpan order')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <div className="text-5xl">✅</div>
          <h2 className="mt-2 text-2xl font-black text-slate-800">Order tersimpan!</h2>
          <div className="mt-3 rounded-2xl bg-primary-50 py-4 text-3xl font-black tracking-widest text-primary-700">{done.code}</div>
          <p className="mt-2 text-sm text-slate-500">
            {done.itemCount} {session!.tenant.itemLabel} · {fullDate(new Date())}
          </p>
        </Card>
        <div className="grid gap-2">
          {done.resiUrl && (
            <Button variant="secondary" onClick={() => window.open(done.resiUrl, '_blank')}>
              🔗 Buka resi digital
            </Button>
          )}
          <Button
            onClick={() => nav(`/t/${slug}/board`)}
          >
            📋 Lihat di papan
          </Button>
          <Button variant="secondary" onClick={() => location.assign(`/api/t/${slug}/labels.pdf?codes=${done.code}`)}>
            🖨 Cetak label QR
          </Button>
          <Button variant="ghost" onClick={() => setDone(null)}>
            ＋ Order baru
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-slate-800">Order baru</h1>
      {!online && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">📴 Offline — order akan masuk antrean lokal</div>
      )}

      <Card>
        <h2 className="mb-3 text-base font-bold text-slate-700">1 · Pelanggan</h2>
        <Field label="Nomor WA">
          <input
            className={inputCls}
            inputMode="tel"
            placeholder="0812xxxxxxx"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              const hit = customers.find((c) => c.phone.replace(/\D/g, '').endsWith(e.target.value.replace(/\D/g, '').slice(-6)) || c.phone === e.target.value)
              if (hit && !name) setName(hit.name)
            }}
          />
          {phone && (
            <div className="mt-1 max-h-28 overflow-auto">
              {customers
                .filter((c) => c.phone.replace(/\D/g, '').includes(phone.replace(/\D/g, '')))
                .slice(0, 3)
                .map((c) => (
                  <button key={c.phone} className="block w-full rounded-xl px-2 py-1.5 text-left text-sm text-primary-600 active:bg-primary-50" onClick={() => { setPhone(c.phone); setName(c.name) }}>
                    {c.name} · {c.phone}
                  </button>
                ))}
            </div>
          )}
        </Field>
        <Field label="Nama">
          <input className={inputCls} placeholder="Kak Rani" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </Card>

      {items.map((it, idx) => (
        <Card key={idx} className={idx > 0 ? 'ring-2 ring-primary-100' : ''}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-700">2 · Item {items.length > 1 ? idx + 1 : ''}</h2>
            {idx > 0 && (
              <button className="rounded-xl px-2 py-1 text-sm text-red-500" onClick={() => setItems(items.filter((_, j) => j !== idx))}>
                Hapus
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Field label="Merek/Model">
                <input className={inputCls} placeholder="Nike AF1" value={[it.brand, it.model].filter(Boolean).join(' ')} onChange={(e) => {
                  const [b = it.brand, ...m] = e.target.value.split(' ')
                  setItem(idx, { brand: e.target.value ? b : '', model: m.join(' ') })
                }} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BRAND_SUGGEST.map((b) => (
                <button key={b} className={`rounded-full px-3 py-1.5 text-sm font-medium ${it.brand === b ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setItem(idx, { brand: it.brand === b ? '' : b })}>
                  {b}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_CHIPS.map((c) => (
                <button key={c} className={`rounded-full px-3 py-1.5 text-sm font-medium ${it.color === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setItem(idx, { color: it.color === c ? '' : c })}>
                  {c}
                </button>
              ))}
            </div>
            <PhotoCapture max={4} onPhotos={(photos) => setItem(idx, { photos })} />
            <Field label="Kondisi (tap)">
              <div className="flex flex-wrap gap-1.5">
                {CONDITION_CHIPS.map((t) => (
                  <button key={t} className={`rounded-full px-3 py-1.5 text-sm font-medium ${it.conditionTags.includes(t) ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setItem(idx, { conditionTags: it.conditionTags.includes(t) ? it.conditionTags.filter((x) => x !== t) : [...it.conditionTags, t] })}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Layanan">
              <select className={inputCls} value={it.serviceId} onChange={(e) => setItem(idx, { serviceId: e.target.value })}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {idr(s.price)} ({s.durationDays} hari)
                  </option>
                ))}
              </select>
            </Field>
            {addons.length > 0 && (
              <Field label="Add-on">
                <div className="flex flex-wrap gap-1.5">
                  {addons.map((a) => (
                    <button key={a.id} className={`rounded-full px-3 py-1.5 text-sm font-medium ${it.addonIds.includes(a.id) ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setItem(idx, { addonIds: it.addonIds.includes(a.id) ? it.addonIds.filter((x) => x !== a.id) : [...it.addonIds, a.id] })}>
                      {a.name} · {idr(a.price)}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </Card>
      ))}
      <Button variant="secondary" className="w-full" onClick={() => setItems([...items, emptyItem(services[0]?.id ?? '')])}>
        ＋ Tambah item lagi
      </Button>

      <Card>
        <h2 className="mb-3 text-base font-bold text-slate-700">3 · Ringkasan & pembayaran</h2>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-semibold">{idr(subtotal)}</span>
        </div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">Diskon</span>
          <input className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-right" inputMode="numeric" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" />
        </div>
        <div className="mb-3 flex items-center justify-between border-t border-slate-100 pt-2 text-base font-black text-slate-800">
          <span>Total</span>
          <span>{idr(total)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['full', 'dp', 'later'] as const).map((m) => (
            <button key={m} className={`rounded-2xl px-2 py-2.5 text-sm font-bold ${payMode === m ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setPayMode(m)}>
              {m === 'full' ? 'Lunas' : m === 'dp' ? `DP ${idr(dpAmount)}` : 'Bayar Nanti'}
            </button>
          ))}
        </div>
        {payMode !== 'later' && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(['cash', 'qris', 'transfer'] as const).map((m) => (
              <button key={m} className={`rounded-2xl px-2 py-2 text-xs font-semibold ${payMethod === m ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setPayMethod(m)}>
                {m === 'cash' ? 'Tunai' : m === 'qris' ? 'QRIS' : 'Transfer'}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-bold text-slate-700">4 · Persetujuan 🔑</h2>
        <p className="mb-2 max-h-28 overflow-auto rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{disclaimer}</p>
        <label className="flex items-start gap-2 py-1 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-600" checked={disclaimerOk} onChange={(e) => setDisclaimerOk(e.target.checked)} />
          <span>Pelanggan setuju kondisi barang tercatat (foto + catatan) dan disclaimer outlet</span>
        </label>
        <label className="flex items-start gap-2 py-1 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-primary-600" checked={publishOk} onChange={(e) => setPublishOk(e.target.checked)} />
          <span>Izin publikasi foto (untuk konten sosmed outlet, mis. kartu hasil)</span>
        </label>
      </Card>

      <Button className="w-full" loading={busy} disabled={!disclaimerOk || items.length === 0} onClick={submit}>
        Simpan order {done ? '' : `· ${idr(total)}`}
      </Button>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  )
}
