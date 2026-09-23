import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Card, Button, Field, inputCls, Badge, Toast } from '../components/ui'
import { Link } from 'react-router-dom'

export function SettingsPage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const isOwner = session!.user.role === 'owner'
  const [s, setS] = useState<any>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    api.get<any>(`/t/${slug}/settings`).then(setS).catch(() => undefined)
    api.get<{ services: any[] }>(`/t/${slug}/services`).then((r) => setS((prev: any) => ({ ...prev, services: r.services }))).catch(() => undefined)
  }, [slug])
  if (!s) return <p className="p-6 text-center text-slate-400">Memuat…</p>

  const save = async (patch: Record<string, unknown>) => {
    setSaved(false)
    try {
      await api.patch(`/t/${slug}/settings`, patch)
      setSaved(true)
      setToast('Tersimpan ✓')
      const fresh = await api.get<any>(`/t/${slug}/settings`)
      setS(fresh)
      setTimeout(() => setSaved(false), 1500)
    } catch (e: any) {
      setToast(e.message)
    }
  }

  const updateService = async (svc: any, patch: Record<string, unknown>) => {
    await api.patch(`/t/${slug}/services/${svc.id}`, patch).catch((e) => setToast(e.message))
    const r = await api.get<{ services: any[] }>(`/t/${slug}/services`)
    setS((prev: any) => ({ ...prev, services: r.services }))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-slate-800">Pengaturan</h1>
      {!isOwner && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Hanya owner yang bisa mengubah pengaturan.</div>}
      <Card>
        <h2 className="mb-3 text-sm font-bold text-slate-600">Outlet</h2>
        <div className="space-y-3">
          <Field label="Nama">
            <input className={inputCls} value={s.name} disabled={!isOwner} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <Field label="WA outlet">
            <input className={inputCls} inputMode="tel" value={s.whatsapp ?? ''} disabled={!isOwner} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} />
          </Field>
          <Field label="Link Google Maps (review)">
            <input className={inputCls} value={s.googleMapsReviewUrl ?? ''} disabled={!isOwner} onChange={(e) => setS({ ...s, googleMapsReviewUrl: e.target.value })} />
          </Field>
          <Field label="Jam buka (muncul di pesan WA)">
            <input className={inputCls} value={s.openingHours ?? ''} disabled={!isOwner} onChange={(e) => setS({ ...s, openingHours: e.target.value })} placeholder="Senin–Sabtu 09.00–18.00" />
          </Field>
          {isOwner && (
            <Button onClick={() => save({ name: s.name, whatsapp: s.whatsapp, googleMapsReviewUrl: s.googleMapsReviewUrl, openingHours: s.openingHours })}>
              Simpan outlet {saved && '✓'}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold text-slate-600">Katalog layanan ({s.itemLabel})</h2>
        <div className="space-y-2">
          {(s.services ?? []).map((svc: any) => (
            <div key={svc.id} className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">{svc.name}</span>
                <Badge className={svc.isActive ? 'bg-turquoise-100 text-turquoise-600' : 'bg-slate-200 text-slate-500'}>{svc.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
              </div>
              <div className="mt-2 flex gap-2">
                <input className={inputCls + ' !py-2 text-sm'} inputMode="numeric" value={svc.price} disabled={!isOwner} onChange={(e) => updateService(svc, { price: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
                <input className={inputCls + ' !w-24 !py-2 text-sm'} disabled={!isOwner} value={svc.badge ?? ''} onChange={(e) => updateService(svc, { badge: e.target.value })} />
                <Button variant="secondary" className="min-h-10 px-3 py-1" disabled={!isOwner} onClick={() => updateService(svc, { isActive: !svc.isActive })}>
                  {svc.isActive ? 'Off' : 'On'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Kebijakan bukti (v2 — anti-sengketa)</h2>
        <label className="flex items-center gap-2 py-1 text-sm text-slate-700">
          <input type="checkbox" className="h-5 w-5 accent-primary-600" checked={s.requirePickupProof} disabled={!isOwner} onChange={(e) => { setS({ ...s, requirePickupProof: e.target.checked }); save({ requirePickupProof: e.target.checked }) }} />
          Wajib foto bukti saat pengambilan (default ON — order tidak bisa Selesai tanpa foto)
        </label>
        <label className="flex items-center gap-2 py-1 text-sm text-slate-700">
          <input type="checkbox" className="h-5 w-5 accent-primary-600" checked={s.publishConsentDefault} disabled={!isOwner} onChange={(e) => { setS({ ...s, publishConsentDefault: e.target.checked }); save({ publishConsentDefault: e.target.checked }) }} />
          Izin publikasi foto default dicentang saat intake
        </label>
      </Card>

      {isOwner && (
        <Card>
          <h2 className="mb-2 text-sm font-bold text-slate-600">Disclaimer</h2>
          <textarea className={`${inputCls} min-h-32`} value={s.disclaimerText ?? ''} onChange={(e) => setS({ ...s, disclaimerText: e.target.value })} />
          <Button className="mt-2" onClick={() => save({ disclaimerText: s.disclaimerText })}>
            Simpan disclaimer {saved && '✓'}
          </Button>
        </Card>
      )}
      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Tim</h2>
        <Link to={`/t/${slug}/users`} className="text-sm font-semibold text-primary-600">
          Kelola staf & peran →
        </Link>
      </Card>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  )
}
