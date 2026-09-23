import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Card, Button } from '../components/ui'
import { idr } from '../lib/format'

/** Modul 9 — 5 angka + 3 daftar + CSV. Tidak lebih. */
export function ReportsPage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week')
  const [data, setData] = useState<any>(null)
  const [reviewList, setReviewList] = useState<any[]>([])

  useEffect(() => {
    const now = new Date()
    const from = range === 'today' ? now.toISOString().slice(0, 10) : range === 'week' ? new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10) : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    api.get<any>(`/t/${slug}/reports?from=${from}`).then(setData).catch(() => undefined)
    api.get<{ orders: any[] }>(`/t/${slug}/orders?reviewPending=1`).then((r) => setReviewList(r.orders)).catch(() => undefined)
    const hasReview = new URLSearchParams(location.search).get('review')
    if (hasReview) document.getElementById('review-list')?.scrollIntoView({ behavior: 'smooth' })
  }, [slug, range])

  if (!data) return <p className="p-6 text-center text-slate-400">Memuat…</p>
  const cards = [
    ['Omzet', idr(data.omzet), 'text-teal-800'],
    ['Order', String(data.orderCount), 'text-slate-800'],
    ['Rata-rata/order', idr(data.avgPerOrder), 'text-slate-800'],
    ['Piutang', idr(data.piutang), 'text-red-600'],
    ['Belum diambil', String(data.uncollected), 'text-amber-600'],
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800">Laporan</h1>
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {(['today', 'week', 'month'] as const).map((r) => (
            <button key={r} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${range === r ? 'bg-teal-700 text-white' : 'text-slate-500'}`} onClick={() => setRange(r)}>
              {r === 'today' ? 'Hari' : r === 'week' ? '7 hari' : 'Bulan'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map(([label, val, color]) => (
          <Card key={label}>
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-lg font-black ${color}`}>{val}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-600">Layanan terlaris</h2>
          <a className="text-xs font-semibold text-teal-700" href={`/api/t/${slug}/reports/export.csv`}>
            ⬇ Export CSV
          </a>
        </div>
        {data.topServices.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada data.</p>
        ) : (
          <div className="space-y-1.5">
            {data.topServices.map((s: any) => (
              <div key={s.serviceName} className="flex justify-between text-sm">
                <span className="text-slate-600">{s.serviceName}</span>
                <span className="font-semibold text-slate-800">
                  {Number(s.n)}x · {idr(Number(s.value))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Pelanggan teratas</h2>
        <div className="space-y-1.5">
          {data.topCustomers.map((c: any) => (
            <div key={c.phone} className="flex justify-between text-sm">
              <span className="text-slate-600">{c.name}</span>
              <span className="font-semibold text-slate-800">{idr(Number(c.value))}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Order per staf</h2>
        <div className="space-y-1.5">
          {data.perStaff.map((s: any) => (
            <div key={s.userId ?? 'x'} className="flex justify-between text-sm">
              <span className="text-slate-600">{s.name ?? 'System'}</span>
              <span className="font-semibold text-slate-800">{Number(s.n)} order</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="bg-teal-50 ring-teal-100">
        <h2 className="mb-1 text-sm font-bold text-teal-800">Growth outlet</h2>
        <p className="text-xs text-teal-700">
          ⭐ Review diminta: <b>{data.reviewSent}</b> · ✨ Kartu dibagikan: <b>{data.shareEvents}</b>
        </p>
      </Card>

      <div id="review-list">
        <Card>
          <h2 className="mb-2 text-sm font-bold text-slate-600">Antrean minta review (selesai, belum diminta)</h2>
          {reviewList.length === 0 ? (
            <p className="text-sm text-slate-400">Kosong — semua sudah diminta 🎉</p>
          ) : (
            <div className="space-y-2">
              {reviewList.map((r) => (
                <div key={r.order.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-800">{r.customerName}</div>
                    <div className="text-xs text-slate-400">{r.order.orderCode}</div>
                  </div>
                  <Link to={`/t/${slug}/orders/${r.order.orderCode}`} className="shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-amber-950">
                    Minta ⭐
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Button variant="secondary" className="w-full" onClick={() => location.assign(`/api/t/${slug}/reports/export.csv`)}>
        ⬇ Export CSV semua order (data milik kamu)
      </Button>
    </div>
  )
}
