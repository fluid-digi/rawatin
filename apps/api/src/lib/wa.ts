/**
 * WA deeplink — Rp 0, tanpa API otomatis (prinsip #3 pull-before-push).
 */
export function sanitizeWhatsapp(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  if (!digits.startsWith('62')) {
    if (digits.startsWith('8')) digits = '62' + digits
    else return null
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export function waDeepLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export function fillTemplate(
  tpl: string,
  vars: Record<string, string | number | undefined>,
): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k]
    return v == null ? '' : String(v)
  })
}
