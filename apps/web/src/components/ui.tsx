import type { ReactNode } from 'react'

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-[#fdf5ff] via-[#f4f7ff] to-[#f2fbf9]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'turquoise' | 'pink'
  className?: string
  loading?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-primary-500 text-white shadow-md shadow-primary-500/30 active:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
    secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 active:bg-slate-50 disabled:opacity-50',
    ghost: 'text-primary-600 active:bg-primary-50',
    danger: 'bg-rose-500 text-white shadow-md shadow-rose-500/25 active:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400',
    turquoise: 'bg-turquoise-500 text-white shadow-md shadow-turquoise-500/25 active:bg-turquoise-600 disabled:bg-slate-200 disabled:text-slate-400',
    pink: 'bg-pink-500 text-white shadow-md shadow-pink-500/25 active:bg-pink-600 disabled:bg-slate-200 disabled:text-slate-400',
  }[variant]
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed ${styles} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{children}</span>
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(157,49,192,0.08)] ring-1 ring-primary-50 ${onClick ? 'cursor-pointer active:scale-[0.99] active:bg-primary-50/30' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100'

export function Toast({ msg, onClose }: { msg: string | null; onClose: () => void }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 px-4">
      <div
        className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl shadow-slate-900/20"
        onClick={onClose}
      >
        <span className="max-w-72">{msg}</span>
        <span className="text-slate-400">✕</span>
      </div>
    </div>
  )
}

/** Bottom sheet ala style guide: handle bar di atas, sudut membulat besar. */
export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-[28px] bg-white p-5 pb-safe shadow-2xl sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
        {title && <h3 className="mb-3 text-lg font-extrabold text-slate-800">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

/** Chip pilihan tunggal/multi dengan radio dot — mengikuti Style Guide. */
export function Chip({
  label,
  description,
  selected,
  onClick,
  icon,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
  icon?: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${
        selected ? 'border-primary-400 bg-primary-50' : 'border-slate-100 bg-white'
      }`}
    >
      {icon && <span className="text-2xl">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-400">{description}</span>}
      </span>
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
          selected ? 'border-primary-500' : 'border-slate-300'
        }`}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
      </span>
    </button>
  )
}

/** Toggle switch pil, mengikuti Style Guide. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${checked ? 'bg-primary-500' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
      {label && <span className="text-sm font-semibold text-slate-700">{label}</span>}
    </label>
  )
}

/** Chip tap-able kecil (kondisi, warna, merek) — pill outline/filled. */
export function TapChip({ active, onClick, children, tone = 'primary' }: { active: boolean; onClick: () => void; children: ReactNode; tone?: 'primary' | 'pink' | 'slate' }) {
  const activeCls = { primary: 'bg-primary-500 text-white', pink: 'bg-pink-500 text-white', slate: 'bg-slate-800 text-white' }[tone]
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? activeCls : 'bg-slate-100 text-slate-600'}`}>
      {children}
    </button>
  )
}

/** Stepper progres bernomor/centang — dipakai di resi publik. */
export function Stepper({ steps }: { steps: { label: string; state: 'done' | 'current' | 'upcoming' }[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex flex-1 items-center gap-1">
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
              s.state === 'done'
                ? 'bg-turquoise-500 text-white'
                : s.state === 'current'
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {s.state === 'done' ? '✓' : i + 1}
          </span>
          {i < steps.length - 1 && <span className={`h-1 flex-1 rounded ${steps[i + 1]!.state !== 'upcoming' ? 'bg-turquoise-400' : 'bg-slate-100'}`} />}
        </div>
      ))}
    </div>
  )
}
