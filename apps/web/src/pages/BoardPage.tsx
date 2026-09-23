import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Card, Badge, Modal, Button, Toast } from '../components/ui'
import { ORDER_STATUS, daysAgo, idr, shortDate } from '../lib/format'
import { openWa } from '../lib/wa'

type StatusKey = 'received' | 'in_progress' | 'finishing' | 'ready' | 'completed' | 'abandoned' | 'all'

/** Modul 5 — Papan kerja: filter, kartu, ubah status ≤2 tap, WA kontekstual. */
export function BoardPage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const [params, setParams] = useSearchParams()
  const active = (params.get('status') ?? 'received') as StatusKey
  const reviewPending = params.get('reviewPending') === '1'
  const uncollected = params.get('uncollected') ? Number(params.get('uncollected')) : undefined
  const [rows, setRows] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [payment, setPayment] = useState('')
  const [action, setAction] = useState<any | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = () => {
    const sp = new URLSearchParams()
    if (active !== 'all') sp.set('status', active)
    if (reviewPending) sp.set('reviewPending', '1')
    if (uncollected) sp.set('uncollected', String(uncollected))
    if (payment) sp.set('payment', payment)
    api.get<{ orders: any[] }>(`/t/${slug}/orders?${sp.toString()}`).then((r) => setRows(r.orders)).catch(() => undefined)
  }
  useEffect(load, [slug, active, reviewPending, uncollected, payment])

  const filtered = useMemo(() => rows.filter((r) => !q || (r.customerName + r.order.orderCode).toLowerCase().includes(q.toLowerCase())), [rows, q])

  const advance = async (order: any) => {
    const forward: Record<string, string> = { received: 'in_progress', in_progress: 'finishing', finishing: 'ready', ready: 'finishing' }
    const to = forward[order.status]
    if (!to) return
    try {
      await api.post(`/t/${slug}/orders/${order.orderCode}/status`, { to })
      setToast(`${order.orderCode} → ${ORDER_STATUS[to]!.label}`)
      load()
    } catch (e: any) {
      setToast(e.message)
    }
    setAction(null)
  }

  const tabs: { key: StatusKey; label: string }[] = [
    { key: 'received', label: 'Diterima' },
    { key: 'in_progress', label: 'Dikerjakan' },
    { key: 'finishing', label: 'Finishing' },
    { key: 'ready', label: 'Siap Ambil' },
    { key: 'completed', label: 'Selesai' },
  ]

  return (
    <div className="space-y-3">
      {reviewPending && (
        <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">⭐ Order selesai, belum diminta review</div>
      )}
      {uncollected && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">⏳ Barang belum diambil &gt; {uncollected} hari</div>
      )}
      <div className="flex gap-2">
        <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500" placeholder="Cari kode / nama / WA…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm" value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="">Semua bayar</option>
          <option value="unpaid">Belum</option>
          <option value="partial">DP</option>
          <option value="paid">Lunas</option>
        </select>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        <button className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${active === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`} onClick={() => setParams({})}>
          Semua
        </button>
        {tabs.map((t) => (
          <button key={t.key} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${active === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`} onClick={() => setParams({ status: t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Tidak ada order di sini.</p>}
      <div className="space-y-2">
        {filtered.map((r) => {
          const o = r.order
          const age = daysAgo(o.receivedAt)
          const ready = !!o.readyAt
          const dueBadge = o.status === 'ready' ? (ready && age > 3 ? '🔴' : '🟢') : age >= o.estimatedReadyAt ? '🟡' : '🟢'
          return (
            <Card key={o.id} className="!p-3">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/t/${slug}/orders/${o.orderCode}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800">{o.orderCode}</span>
                    <Badge className={ORDER_STATUS[o.status]?.color}>{ORDER_STATUS[o.status]?.label}</Badge>
                    <span className="text-xs">{dueBadge}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-600">{r.customerName}</div>
                  <div className="text-xs text-slate-400">
                    {o.itemCount} {session!.tenant.itemLabel} · {shortDate(o.receivedAt)} ·{' '}
                    {o.paymentStatus === 'paid' ? <span className="text-emerald-600">lunas</span> : o.paymentStatus === 'partial' ? <span className="text-amber-600">DP {idr(o.paidAmount)}</span> : <span className="text-red-500">belum bayar</span>}
                  </div>
                </Link>
                {r.photo && <img src={r.photo} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-100" />}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button variant="secondary" className="min-h-10 flex-1 px-2 py-2 text-sm" onClick={() => openWa(r.customerPhone, `Halo ${r.customerName ?? ''}, order ${o.orderCode} di ${session!.tenant.name} — cek status di ${location.origin}/r/${o.orderCode}`)}>
                  💬 WA
                </Button>
                {o.status === 'completed' ? (
                  o.reviewRequestSentAt ? (
                    <span className="flex flex-1 items-center justify-center rounded-xl bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-500">⭐ Review diminta · {shortDate(o.reviewRequestSentAt)}</span>
                  ) : (
                    <Link to={`/t/${slug}/orders/${o.orderCode}`} className="flex flex-1 items-center justify-center rounded-xl bg-amber-100 px-2 py-2 text-sm font-bold text-amber-800">
                      ⭐ Minta review
                    </Link>
                  )
                ) : (
                  <Button className="min-h-10 flex-1 px-2 py-2 text-sm" onClick={() => setAction(o)}>
                    Lanjut →
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={!!action} onClose={() => setAction(null)} title={action ? `Ubah status ${action.orderCode}` : ''}>
        {action && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {action.customerName} · {action.itemCount} item · total {idr(action.total)}
            </p>
            <Button className="w-full min-h-14 text-lg" onClick={() => advance(action)}>
              Lanjut ke {ORDER_STATUS[action.status === 'received' ? 'in_progress' : action.status === 'in_progress' ? 'finishing' : 'ready']!.label} →
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setAction(null)}>
              Batal
            </Button>
          </div>
        )}
      </Modal>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  )
}
