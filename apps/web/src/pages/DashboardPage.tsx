import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Badge } from '../components/ui'
import { idr, shortDate, ORDER_STATUS, daysAgo } from '../lib/format'
import { useAuth } from '../store/auth'

interface DashboardData {
  byStatus: Record<string, number>
  todayRevenue: number
  todayOrders: number
  piutang: number
  uncollected: Record<string, number>
  reviewQueue: number
  pickupProofCompliance: number | null
  recent: { order: any; customerName: string }[]
}

export function DashboardPage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const [data, setData] = useState<DashboardData | null>(null)
  const [queue, setQueue] = useState<any[]>([])

  useEffect(() => {
    api.get<DashboardData>(`/t/${slug}/dashboard`).then(setData).catch(() => undefined)
    api.get<{ orders: any[] }>(`/t/${slug}/orders?status=ready`).then((r) => setQueue(r.orders)).catch(() => undefined)
  }, [slug])

  if (!data) return <p className="p-6 text-center text-slate-400">Memuat…</p>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-slate-400">Omzet hari ini</div>
          <div className="text-xl font-black text-primary-700">{idr(data.todayRevenue)}</div>
          <div className="text-xs text-slate-400">{data.todayOrders} order</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-400">Piutang belum lunas</div>
          <div className="text-xl font-black text-red-600">{idr(data.piutang)}</div>
        </Card>
      </div>

      <Card>
        <div className="mb-2 text-xs font-semibold text-slate-400">Pekerjaan aktif</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {(['received', 'in_progress', 'finishing', 'ready'] as const).map((s) => (
            <Link key={s} to={`/t/${slug}/board`} className="rounded-2xl bg-slate-50 py-3">
              <div className="text-2xl font-black text-slate-800">{data.byStatus[s]}</div>
              <div className="text-[11px] text-slate-500">{ORDER_STATUS[s]!.label}</div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link to={`/t/${slug}/board?uncollected=7`}>
          <Card>
            <div className="text-xs text-slate-400">Barang belum diambil</div>
            <div className="text-lg font-black text-amber-600">
              {(data.uncollected.uncollectedOver7d ?? 0) + (data.uncollected.uncollectedOver14d ?? 0) + (data.uncollected.uncollectedOver30d ?? 0)}
            </div>
            <div className="text-[11px] text-slate-400">&gt;7 hari terkumpul</div>
          </Card>
        </Link>
        <Link to={`/t/${slug}/board?reviewPending=1`}>
          <Card>
            <div className="text-xs text-slate-400">Minta review ⭐</div>
            <div className="text-lg font-black text-primary-600">{data.reviewQueue}</div>
            <div className="text-[11px] text-slate-400">selesai, belum diminta</div>
          </Card>
        </Link>
      </div>

      {data.pickupProofCompliance !== null && (
        <Card className="bg-primary-50 ring-primary-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-primary-600">Kepatuhan bukti pengambilan</div>
              <div className="text-[11px] text-primary-600">{data.pickupProofCompliance}% order selesai punya foto bukti</div>
            </div>
            <Badge className={data.pickupProofCompliance >= 95 ? 'bg-turquoise-100 text-turquoise-600' : 'bg-amber-100 text-amber-700'}>
              {data.pickupProofCompliance >= 95 ? 'Aman ✓' : 'Cek staf!'}
            </Badge>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-400">Siap diambil — siapkan WA</div>
          <Link to={`/t/${slug}/board`} className="text-xs font-semibold text-primary-600">
            Lihat semua
          </Link>
        </div>
        {queue.length === 0 && <p className="text-sm text-slate-400">Tidak ada yang siap diambil.</p>}
        <div className="space-y-2">
          {queue.slice(0, 4).map((o) => (
            <Link key={o.order.id} to={`/t/${slug}/orders/${o.order.orderCode}`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800">{o.customerName}</div>
                <div className="text-xs text-slate-400">
                  {o.order.orderCode} · {daysAgo(o.order.readyAt ?? o.order.receivedAt)} hari
                </div>
              </div>
              <span className="text-xs font-semibold text-primary-600">Buka →</span>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 text-xs font-semibold text-slate-400">Order terbaru</div>
        <div className="space-y-2">
          {data.recent.map((r) => (
            <Link key={r.order.id} to={`/t/${slug}/orders/${r.order.orderCode}`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800">{r.customerName}</div>
                <div className="text-xs text-slate-400">
                  {r.order.orderCode} · {shortDate(r.order.receivedAt)}
                </div>
              </div>
              <Badge className={ORDER_STATUS[r.order.status]?.color}>{ORDER_STATUS[r.order.status]?.label}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
