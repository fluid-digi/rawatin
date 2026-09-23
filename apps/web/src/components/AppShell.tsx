import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useOnlineStatus } from '../lib/useOnline'
import { InstallPrompt } from './InstallPrompt'

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth()
  const online = useOnlineStatus()
  const slug = session?.tenant.slug ?? sessionStorage.getItem('slug') ?? ''
  const nav = [
    { to: `/t/${slug}/`, label: 'Beranda', icon: '▦' },
    { to: `/t/${slug}/board`, label: 'Papan', icon: '≣' },
    { to: `/t/${slug}/intake`, label: 'Intake', icon: '＋' },
    { to: `/t/${slug}/customers`, label: 'Pelanggan', icon: '◉' },
    { to: `/t/${slug}/reports`, label: 'Laporan', icon: '▤' },
  ]
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-white/80 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2">
          {!online && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-pink-500" title="offline" />}
          {session?.tenant.logoUrl ? (
            <img src={session.tenant.logoUrl} alt="" className="h-9 w-9 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary-500 text-sm font-black text-white shadow-md shadow-primary-500/30">R</span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-slate-800">{session?.tenant.name ?? 'Rawatin'}</div>
            <div className="text-xs font-medium text-primary-600">rawatin.id/{slug}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link to={`/t/${slug}/settings`} className="grid h-9 w-9 place-items-center rounded-2xl text-slate-500 active:bg-slate-100" title="Pengaturan">
            ⚙
          </Link>
          <button onClick={() => logout()} className="grid h-9 w-9 place-items-center rounded-2xl text-slate-500 active:bg-slate-100" title="Keluar">
            ⎋
          </button>
        </div>
      </header>
      <InstallPrompt />
      <main className="flex-1 px-3 pb-28 pt-3">{children}</main>
      {/* Bottom nav (mobile-first, tombol tengah mengambang ala Style Guide) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-3xl px-3 pb-3">
          <div className="flex items-center justify-between rounded-[28px] bg-white px-2 py-2 shadow-[0_8px_30px_-6px_rgba(157,49,192,0.25)] ring-1 ring-primary-50">
            {nav.map((item, i) => {
              const isCenter = i === 2
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold ${
                      isActive && !isCenter ? 'text-primary-600' : isCenter ? '' : 'text-slate-400'
                    }`
                  }
                >
                  {isCenter ? (
                    <span className="-mt-8 grid h-14 w-14 place-items-center rounded-full bg-primary-500 text-2xl font-black text-white shadow-lg shadow-primary-500/40">
                      {item.icon}
                    </span>
                  ) : (
                    <span className="text-xl leading-none">{item.icon}</span>
                  )}
                  {!isCenter && item.label}
                </NavLink>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
