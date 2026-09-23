export function sanitizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  if (!d.startsWith('62')) d = '62' + d
  return d
}

export function openWa(phone: string, text: string) {
  const url = `https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener')
  return url
}
