import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Button, Field, inputCls, Card } from '../components/ui'

const DEFAULT_LABELS: [string, string][] = [
  ['received', 'Diterima'],
  ['in_progress', 'Dikerjakan'],
  ['finishing', 'Finishing'],
  ['ready', 'Siap Diambil'],
  ['completed', 'Selesai'],
]

const DEFAULT_DISCLAIMER =
  'Saya menyatakan bahwa barang yang dititipkan dalam kondisi sebagaimana tercatat (termasuk foto) saat diterima outlet. Kerusakan yang sudah tercatat di awal bukan tanggung jawab outlet. Barang yang tidak diambil lebih dari 30 hari dapat dikenakan biaya penitipan.'

/** Modul 1: wizard 4 langkah — semua boleh dilewati ("Lewati, isi nanti"). */
export function OnboardingPage() {
  const nav = useNavigate()
  const { session, setSession } = useAuth()
  const slug = session!.tenant.slug
  const [step, setStep] = useState(1)
  const [wa, setWa] = useState(session!.tenant.whatsapp ?? '')
  const [maps, setMaps] = useState(session!.tenant.googleMapsReviewUrl ?? '')
  const [itemLabel, setItemLabel] = useState(session!.tenant.itemLabel ?? 'pasang')
  const [labels, setLabels] = useState(DEFAULT_LABELS)
  const [disclaimer, setDisclaimer] = useState(DEFAULT_DISCLAIMER)
  const [busy, setBusy] = useState(false)

  const finalize = async (patch: Record<string, unknown>) => {
    setBusy(true)
    try {
      await api.post(`/t/${slug}/onboarding/finalize`, patch)
      const me = await api.get<any>(`/t/${slug}/auth/me`)
      setSession(me)
      return true
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800">Setup outlet ({step}/4)</h1>
        <Button variant="ghost" className="min-h-9 py-1" onClick={() => nav(`/t/${slug}/`)}>
          Lewati, isi nanti
        </Button>
      </div>
      {step === 1 && (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Kontak outlet & review Maps</h2>
          <div className="space-y-3">
            <Field label="Nomor WA outlet (untuk tombol Chat di resi)">
              <input className={inputCls} inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} />
            </Field>
            <Field label="Link review Google Maps" hint="Buka Google Maps → profil outlet → bagikan → salin link. Dipakai tombol ⭐ Minta Review.">
              <input className={inputCls} value={maps} onChange={(e) => setMaps(e.target.value)} placeholder="https://g.page/r/.../review" />
            </Field>
            <Button
              className="w-full"
              loading={busy}
              onClick={async () => {
                await finalize({ whatsapp: wa, googleMapsReviewUrl: maps })
                setStep(2)
              }}
            >
              Lanjut
            </Button>
          </div>
        </Card>
      )}
      {step === 2 && (
        <Card>
          <h2 className="mb-1 text-lg font-bold">Katalog layanan</h2>
          <p className="mb-3 text-sm text-slate-500">6 layanan standar sudah terisi. Harga & durasi bisa diedit kapan pun di Pengaturan.</p>
          <Button
            className="w-full"
            onClick={() => {
              setStep(3)
            }}
          >
            Lanjut
          </Button>
        </Card>
      )}
      {step === 3 && (
        <Card>
          <h2 className="mb-1 text-lg font-bold">Nama tahapan status</h2>
          <div className="mb-3 grid gap-2">
            {labels.map(([key, label], i) => (
              <input key={key} className={inputCls} value={label} onChange={(e) => setLabels(labels.map((l, j) => (j === i ? [l[0], e.target.value] : l)))} />
            ))}
          </div>
          <Field label="Satuan item" hint="Bisa 'pasang', 'pcs', 'unit', 'm²' — sesuai jenis layanan.">
            <input className={inputCls} value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} />
          </Field>
          <Button
            className="mt-3 w-full"
            loading={busy}
            onClick={async () => {
              await finalize({ statusLabels: Object.fromEntries(labels), itemLabel, itemLabelPlural: itemLabel })
              setStep(4)
            }}
          >
            Lanjut
          </Button>
        </Card>
      )}
      {step === 4 && (
        <Card>
          <h2 className="mb-1 text-lg font-bold">Teks disclaimer</h2>
          <p className="mb-2 text-sm text-slate-500">Ditampilkan saat intake + checkbox persetujuan pelanggan.</p>
          <textarea className={`${inputCls} min-h-40`} value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} />
          <Button
            className="mt-3 w-full"
            loading={busy}
            onClick={async () => {
              await finalize({ disclaimerText: disclaimer })
              nav(`/t/${slug}/`)
            }}
          >
            Selesai — Mulai Pakai 🎉
          </Button>
        </Card>
      )}
    </div>
  )
}
