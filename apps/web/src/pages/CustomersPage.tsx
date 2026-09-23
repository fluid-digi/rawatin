import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Card, Badge } from '../components/ui'
import { shortDate, idr } from '../lib/format'

export function CustomersPage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    const t = setTimeout(() => api.get<{ customers: any[] }>(`/t/${slug}/customers?q=${encodeURIComponent(q)}`).then((r) => setRows(r.customers)).catch(() => undefined), 200)
    return () => clearTimeout(t)
  }, [slug, q])
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black text-slate-800">Pelanggan</h1>
      <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary-500" placeholder="Cari nama / nomor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {rows.map((c) => (
          <Card key={c.id} className="!p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-400">{c.phone}</div>
              </div>
              <div className="text-right">
                <Badge className={c.totalOrders >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}>
                  {c.totalOrders >= 5 ? `🏅 Cucian ke-${c.totalOrders}` : `${c.totalOrders}x`}
                </Badge>
                <div className="mt-1 text-xs font-semibold text-slate-600">{idr(c.totalSpent)}</div>
                <div className="text-[10px] text-slate-400">{c.lastOrderAt ? shortDate(c.lastOrderAt) : '-'}</div>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Belum ada pelanggan tercatat.</p>}
      </div>
    </div>
  )
}
