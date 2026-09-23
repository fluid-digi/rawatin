/**
 * Hash PIN dengan PBKDF2-SHA256 (Web Crypto — jalan di Node & Workers).
 */
const ITERATIONS = 100_000
const KEYLEN = 32

async function derive(secret: string, salt: Uint8Array): Promise<Uint8Array> {
  const saltBuf = toAB(Uint8Array.from(salt))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      KEYLEN * 8,
    ),
  )
}

function toAB(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

export function pinSalt(phone: string, globalSalt?: string) {
  return new TextEncoder().encode(`rawatin:${globalSalt ?? 'dev-salt'}:${phone}`)
}

export async function hashPin(pin: string, phone: string, globalSalt?: string) {
  const buf = await derive(pin, pinSalt(phone, globalSalt))
  return Buffer.from(buf).toString('hex')
}

export async function verifyPin(pin: string, expectedHash: string, phone: string, globalSalt?: string) {
  const actual = await derive(pin, pinSalt(phone, globalSalt))
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}
