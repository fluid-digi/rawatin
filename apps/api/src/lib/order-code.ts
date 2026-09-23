/**
 * Kode order: prefix outlet + urutan pendek + suffix acak (tidak mudah ditebak).
 * Contoh: RWT-0412-7K3Q
 */
const ALPHABET = 'ACDEFGHJKLMNPQRSTUVWXYZ2345679'

export function randomSuffix(len = 4) {
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (const n of arr) out += ALPHABET[n % ALPHABET.length]!
  return out
}

export function randomBigSuffix(len = 6) {
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (const n of arr) out += ALPHABET[n % ALPHABET.length]!
  return out
}

export function base36(n: number) {
  return n.toString(36).toUpperCase().padStart(4, '0')
}

export function formatOrderCode(prefix: string, seq: number): string {
  return `${prefix}-${base36(seq)}-${randomSuffix()}`
}

export function generateClientId() {
  return `c-${Date.now().toString(36)}-${randomBigSuffix()}`
}
