import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Button, Field, inputCls } from '../components/ui'

export function LoginPage() {
  const { slug: urlSlug } = useParams()
  const nav = useNavigate()
  const { login } = useAuth()
  const [slug, setSlug] = useState(urlSlug ?? '')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
      setError('Ketik slug outlet dulu (contoh: dipdemo)')
      return
    }
    setBusy(true)
    setError('')
    try {
      await login(slug, phone, pin)
      nav(`/t/${slug}/`)
    } catch (e: any) {
      setError(String(e.message).includes('tidak ditemukan') ? 'Outlet tidak ditemukan — periksa slug (mis. rawatin.id/dipdemo)' : e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white px-5">
      <div className="w-full">
        <h1 className="text-2xl font-black text-slate-900">Masuk Rawatin</h1>
        {urlSlug && (
          <p className="mt-1 text-slate-500">
            Outlet <span className="font-semibold text-primary-600">rawatin.id/{urlSlug}</span>
          </p>
        )}
        <div className="mt-6 space-y-3">
          <Field label="Slug outlet" hint="Bagian alamat setelah rawatin.id/ — mis. dipdemo">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">rawatin.id/</span>
              <input
                className={inputCls}
                placeholder="dipdemo"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
            </div>
          </Field>
          <Field label="Nomor WhatsApp">
            <input className={inputCls} inputMode="tel" placeholder="0812xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="PIN">
            <input
              className={inputCls}
              inputMode="numeric"
              type="password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </Field>
          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || !slug || phone.length < 9 || pin.length < 4} loading={busy}>
            Masuk
          </Button>
          <p className="text-center text-sm text-slate-400">
            Belum punya outlet?{' '}
            <Link to="/daftar" className="font-semibold text-primary-600">
              Daftar
            </Link>
          </p>
          {!urlSlug && (
            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">
              Demo: slug <b>dipdemo</b> · WA 081234567890 · PIN 123456
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
