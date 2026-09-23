import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { getDb, orders, orderItems, photos } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import { getStore } from '../lib/store'
import '../types'

/**
 * Upload foto — body mentah (sudah dikompresi client-side ≤150KB),
 * lalu simpan ke R2 (produksi) atau disk (dev).
 */
export const uploadRoutes = new Hono()

uploadRoutes.post('/t/:slug/upload', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const type = (c.req.header('x-photo-type') ?? 'before') as typeof photos.$inferSelect.type
  if (!['before', 'after', 'issue', 'signature', 'pickup_proof'].includes(type)) {
    return c.json({ error: 'Tipe foto tidak dikenal' }, 400)
  }
  const orderId = c.req.header('x-order-id') ?? c.req.query('orderId')
  if (!orderId) return c.json({ error: 'orderId wajib (header x-order-id)' }, 400)
  const db = getDb()
  const order = (await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan pada tenant ini' }, 404)

  const itemId = c.req.header('x-order-item-id') || null
  if (itemId) {
    const item = (await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id))).limit(1))[0]
    if (!item) return c.json({ error: 'Item tidak ditemukan pada order ini' }, 404)
  }

  const buf = new Uint8Array(await c.req.arrayBuffer())
  if (buf.byteLength === 0) return c.json({ error: 'Foto kosong' }, 400)
  if (buf.byteLength > 700_000) return c.json({ error: 'Foto terlalu besar (>700KB) — kompresi client-side wajib' }, 413)
  const ext = type === 'signature' ? 'png' : 'webp'
  const key = `${tenant.id}/${order.id}/${type}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const store = await getStore(c)
  const stored = await store.put(key, buf, `image/${ext}`)
  const row = await db
    .insert(photos)
    .values({ orderId: order.id, orderItemId: itemId, type: type as never, url: stored.url, sizeBytes: buf.byteLength, uploadedByUserId: user.id })
    .returning()
  return c.json(row[0], 201)
})
