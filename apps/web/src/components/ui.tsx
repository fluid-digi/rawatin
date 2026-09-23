import type { ReactNode } from 'react'

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <div className={`h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent ${className}`} />
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled,
  ...rest
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  loading?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-teal-700 text-white active:bg-teal-800 disabled:bg-slate-300',
    secondary: 'bg-slate-200 text-slate-800 active:bg-slate-300 disabled:opacity-50',
    ghost: 'text-teal-700 active:bg-teal-50',
    danger: 'bg-red-600 text-white active:bg-red-700 disabled:bg-slate-300',
  }[variant]
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 ${onClick ? 'cursor-pointer active:bg-slate-50' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

export function Toast({ msg, onClose }: { msg: string | null; onClose: () => void }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl" onClick={onClose}>
        <span className="max-w-72">{msg}</span>
        <span className="text-slate-400">✕</span>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-safe sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="mb-3 text-lg font-bold text-slate-800">{title}</h3>}
        {children}
      </div>
    </div>
  )
}
