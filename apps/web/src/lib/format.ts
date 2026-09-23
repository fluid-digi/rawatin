export function idr(n: number | null | undefined) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)
}

export function shortDate(d: string | Date | null | undefined) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d))
}

export function fullDate(d: string | Date | null | undefined) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export const ORDER_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  received: { label: 'Diterima', color: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  in_progress: { label: 'Dikerjakan', color: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  finishing: { label: 'Finishing', color: 'bg-fuchsia-100 text-fuchsia-800', dot: 'bg-fuchsia-500' },
  ready: { label: 'Siap Diambil', color: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  completed: { label: 'Selesai', color: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  abandoned: { label: 'Diikhlaskan', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
}

export function daysAgo(d: string | Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000))
}
