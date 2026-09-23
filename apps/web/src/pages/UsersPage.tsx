import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Card, Button, Field, inputCls, Badge, Toast, Modal } from '../components/ui'

export function UsersPage() {
  const { session } = useAuth()
  const slug = session!.tenant.slug
  const [users, setUsers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', role: 'staff', pin: '' })

  const load = () => api.get<{ users: any[] }>(`/t/${slug}/users`).then((r) => setUsers(r.users)).catch(() => undefined)
  useEffect(() => {
    void load()
  }, [slug])

  const add = async () => {
    try {
      await api.post(`/t/${slug}/users`, form)
      setOpen(false)
      setForm({ name: '', phone: '', role: 'staff', pin: '' })
      load()
    } catch (e: any) {
      setToast(e.message)
    }
  }
  const toggle = async (u: any) => {
    await api.patch(`/t/${slug}/users/${u.id}`, { isActive: !u.isActive }).catch((e) => setToast(e.message))
    load()
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800">Staf</h1>
        <Button className="min-h-10 px-3 py-2" onClick={() => setOpen(true)}>
          ＋ Tambah
        </Button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="!p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">
                  {u.name} {!u.isActive && <span className="text-xs text-red-500">(nonaktif)</span>}
                </div>
                <div className="text-xs text-slate-400">{u.phone}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={u.role === 'owner' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}>{u.role}</Badge>
                {u.role !== 'owner' && (
                  <button className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => toggle(u)}>
                    {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Tambah staf">
        <div className="space-y-3">
          <Field label="Nama">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Nomor WA">
            <input className={inputCls} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Peran">
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staf/Kasir</option>
              <option value="tech">Teknisi</option>
            </select>
          </Field>
          <Field label="PIN awal">
            <input className={inputCls} inputMode="numeric" type="password" maxLength={8} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Button className="w-full" onClick={add} disabled={!form.name || form.phone.length < 9 || form.pin.length < 4}>
            Simpan
          </Button>
        </div>
      </Modal>
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  )
}
