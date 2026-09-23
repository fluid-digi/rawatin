import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setAuthToken } from '../lib/api'
import { Button, Field, inputCls } from '../components/ui'
import { useAuth } from '../store/auth'

/** Modul 1 langkah 1: daftar via nomor WA + PIN, cek slug real-time. */
export function RegisterPage() {
  const nav = useNavigate()
  const { setSession } = useAuth()
  const [form, setForm] = useState({ name: '', slug: '', city: '', phone: '', whatsapp: '', pin: '' })
  const [mapsUrl, setMapsUrl] = useState('')
  const [slugState, setSlugState] = useState<'idle' | 'ok' | 'taken' | 'invalid'>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const checkSlug = (value: string) => {
    setForm((f) => ({ ...f, slug: value }))
    if (!value) return setSlugState('idle')
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(value)) return setSlugState('invalid')
    fetch(`/api/t/${value}/services`, { credentials: 'include' })
      .then((r) => setSlugState(r.status === 404 ? 'ok' : 'taken'))
      .catch(() => setSlugState('ok'))
  }

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await api.post<{ tenant: { slug: string }; token: string }>('/register', {
        name: form.name,
        slug: form.slug,
        city: form.city || undefined,
        phone: form.phone,
        pin: form.pin,
        whatsapp: form.whatsapp || form.phone,
        googleMapsReviewUrl: mapsUrl || undefined,
      })
      setAuthToken(res.token)
      sessionStorage.setItem('slug', res.tenant.slug)
      localStorage.setItem('rawatin_slug', res.tenant.slug)
      const me = await api.get<any>(`/t/${res.tenant.slug}/auth/me`)
      setSession(me)
      nav(`/t/${res.tenant.slug}/`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-white px-5 py-8">
      <div className="mb-6">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-600 text-2xl font-black text-white">R</span>
        <h1 className="mt-4 text-2xl font-black text-slate-900">Rawatin</h1>
        <p className="text-slate-500">Sepatu nggak ketuker. Pelanggan nggak nanya-nanya. Komplain ada buktinya.</p>
      </div>
      <div className="space-y-3">
        <Field label="Nama outlet">
          <input className={inputCls} placeholder="Dip Clean Shoes" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Slug outlet" hint="Jadi alamat resi & halaman toko kamu.">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">rawatin.id/</span>
            <input className={inputCls} placeholder="dipclean" value={form.slug} onChange={(e) => checkSlug(e.target.value.toLowerCase())} />
          </div>
          {slugState === 'ok' && <span className="text-xs text-turquoise-600">✓ Tersedia</span>}
          {slugState === 'taken' && <span className="text-xs text-red-500">Sudah dipakai outlet lain</span>}
          {slugState === 'invalid' && <span className="text-xs text-amber-600">Huruf kecil, angka, strip (min 3)</span>}
        </Field>
        <Field label="Kota">
          <input className={inputCls} placeholder="Bandung" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Nomor WhatsApp owner">
          <input className={inputCls} inputMode="tel" placeholder="0812xxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Link review Google Maps (opsional)" hint="Nanti diisi juga bisa — untuk tombol Minta Review.">
          <input className={inputCls} placeholder="https://g.page/r/.../review" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} />
        </Field>
        <Field label="PIN (4–8 digit)" hint="Dipakai login staf. Simpan baik-baik.">
          <input className={inputCls} inputMode="numeric" type="password" maxLength={8} placeholder="••••" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
        </Field>
        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={busy || slugState !== 'ok' || !form.name || form.pin.length < 4} loading={busy}>
          Daftar & Mulai
        </Button>
        <p className="text-center text-sm text-slate-400">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-primary-600">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
