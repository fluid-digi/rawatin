import { api, ApiError } from './api'

/**
 * Antrean offline PWA (Modul 3): saat offline, payload intake disimpan di
 * IndexedDB; begitu online, dikirim ulang (server idempoten via clientId).
 */
interface QueuedOrder {
  clientId: string
  slug: string
  createdAt: number
  payload: unknown
  status: 'pending' | 'synced' | 'failed'
  result?: unknown
  error?: string
}

const DB_NAME = 'rawatin-offline'
const STORE = 'intake'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientId' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const offlineQueue = {
  async push(slug: string, clientId: string, payload: unknown) {
    const item: QueuedOrder = { clientId, slug, createdAt: Date.now(), payload, status: 'pending' }
    await tx('readwrite', (s) => s.put(item))
  },
  async list(): Promise<QueuedOrder[]> {
    const out = await tx('readonly', (s) => s.getAll())
    return (out as QueuedOrder[]).sort((a, b) => a.createdAt - b.createdAt)
  },
  async syncAll(onProgress?: (done: number, total: number) => void): Promise<{ synced: number; failed: number }> {
    const items = await this.list()
    let synced = 0
    let failed = 0
    for (const item of items.filter((i) => i.status !== 'synced')) {
      try {
        const result = await api.post(`/t/${item.slug}/orders`, item.payload)
        await tx('readwrite', (s) => s.put({ ...item, status: 'synced', result }))
        synced++
      } catch (e) {
        const permanent = e instanceof ApiError && e.status !== 408 && e.status !== 429 && e.status >= 400 && e.status < 500
        if (permanent) {
          await tx('readwrite', (s) => s.put({ ...item, status: 'failed', error: String((e as Error).message) }))
          failed++
        }
      }
      onProgress?.(synced + failed, items.length)
    }
    return { synced, failed }
  },
  async clear() {
    await tx('readwrite', (s) => s.clear())
  },
}

export function generateClientId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
