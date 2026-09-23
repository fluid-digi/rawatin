import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Button, Field, inputCls } from '../components/ui'

export function LoginPage() {
  const { slug } = useParams()
  const nav = useNavigate()
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await login(slug!, phone, pin)
      nav(`/t/${slug}/`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white px-5">
      <div className="w-full">
        <h1 className="text-2xl font-black text-slate-900">Masuk Rawatin</h1>
        <p className="mt-1 text-slate-500">
          Outlet <span className="font-semibold text-teal-700">rawatin.id/{slug}</span>
        </p>
        <div className="mt-6 space-y-3">
          <Field label="Nomor WhatsApp">
            <input className={inputCls} inputMode="tel" placeholder="0812xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="PIN">
            <input className={inputCls} inputMode="numeric" type="password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </Field>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || phone.length < 9 || pin.length < 4} loading={busy}>
            Masuk
          </Button>
          <p className="text-center text-sm text-slate-400">
            Belum punya outlet?{' '}
            <Link to="/daftar" className="font-semibold text-teal-700">
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
