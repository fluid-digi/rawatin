import type { Context } from 'hono'
import { envOf } from '../env'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Penyimpanan foto: Cloudflare R2 (S3-compatible, egress gratis) saat
 * dikonfigurasi; fallback disk lokal untuk dev. Put object memakai
 * AWS Signature V4 via Web Crypto — jalan di Node & Workers.
 */

export interface StoredFile {
  key: string
  url: string
}

async function sha256Hex(data: Uint8Array | string) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', toAB(Uint8Array.from(buf)))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toAB(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

export function requestDateIso(d: Date) {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function hmacKey(secret: string, date: string, region: string, service: string, key: Uint8Array) {
  return key
}

export async function getStore(c: Context) {
  const env = envOf(c)
  if (env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_ACCOUNT_ID) {
    return new R2Store(env)
  }
  return new LocalStore(c)
}

class R2Store {
  constructor(private env: Record<string, string | undefined>) {}

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredFile> {
    const { R2_ACCESS_KEY_ID: ak, R2_SECRET_ACCESS_KEY: sk, R2_BUCKET: bucket, R2_ACCOUNT_ID: acct, R2_PUBLIC_URL } =
      this.env
    if (!ak || !sk || !bucket || !acct) throw new Error('R2 belum dikonfigurasi')
    const endpoint = `https://${bucket}.${acct}.r2.cloudflarestorage.com`
    const url = `${endpoint}/${key}`
    const now = new Date()
    const amzDate = requestDateIso(now)
    const date = amzDate.slice(0, 8)
    const region = 'auto'
    const service = 's3'

    const bytes = Uint8Array.from(body)
    const payloadHash = await sha256Hex(bytes)
    const canonicalHeaders = `host:${new URL(url).host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = [
      'PUT',
      `/${key}`,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')
    const scope = `${date}/${region}/${service}/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n')

    const kDate = await importKeyHmac('AWS4' + sk, date)
    const kRegion = await hmac(kDate, region)
    const kService = await hmac(kRegion, service)
    const kSigning = await hmac(kService, 'aws4_request')
    const signature = toHex(await hmac(kSigning, stringToSign))

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Content-Type': contentType,
      },
      body: toAB(bytes),
    })
    if (!res.ok) throw new Error(`R2 put gagal: ${res.status} ${await res.text()}`)
    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}` : url
    return { key, url: publicUrl }
  }
}

async function importKeyHmac(secret: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return signHmac(key, Uint8Array.from(new TextEncoder().encode(salt)))
}

async function hmac(key: Uint8Array, value: string) {
  const kb = await crypto.subtle.importKey('raw', toAB(Uint8Array.from(key)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return signHmac(kb, new TextEncoder().encode(value))
}

async function signHmac(key: CryptoKey, data: Uint8Array) {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, toAB(Uint8Array.from(data))))
}

function toHex(buf: Uint8Array) {
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const FREE_DIR = join(process.cwd(), 'data', 'uploads')

class LocalStore {
  constructor(private c: Context) {}

  async put(key: string, body: Uint8Array): Promise<StoredFile> {
    const keyPath = `uploads/${key}`
    const filePath = join(FREE_DIR, keyPath)
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(filePath, body)
    const base = envOf(this.c).APP_BASE_URL ?? 'http://localhost:8787'
    return { key, url: `${base}/${keyPath}` }
  }
}

export function sha1Hex(data: Uint8Array) {
  return createHash('sha1').update(data).digest('hex')
}
