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
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          {!online && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" title="offline" />}
          {session?.tenant.logoUrl ? (
            <img src={session.tenant.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">R</span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-800">{session?.tenant.name ?? 'Rawatin'}</div>
            <div className="text-xs text-slate-400">rawatin.id/{slug}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to={`/t/${slug}/settings`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 active:bg-slate-100" title="Pengaturan">
            ⚙
          </Link>
          <button onClick={() => logout()} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 active:bg-slate-100" title="Keluar">
            ⎋
          </button>
        </div>
      </header>
      <InstallPrompt />
      <main className="flex-1 px-3 pb-28 pt-3">{children}</main>
      {/* Bottom nav (mobile-first, persona Rani) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {nav.map((item, i) => {
            const isCenter = i === 2
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                    isActive && !isCenter ? 'text-teal-700' : 'text-slate-400'
                  }`
                }
              >
                {isCenter ? (
                  <span className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-teal-700 text-2xl font-black text-white shadow-lg shadow-teal-700/30">
                    {item.icon}
                  </span>
                ) : (
                  <span className="text-xl leading-none">{item.icon}</span>
                )}
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
