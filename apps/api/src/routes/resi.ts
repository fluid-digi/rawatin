import { Hono } from 'hono'
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { getDb, orders, orderItems, orderItemServices, customers, photos, payments, tenants, resiViews, shareEvents } from '@rawatin/db'
import { hashIp } from '../lib/format'
import { envOf } from '../env'
import '../types'

/**
 * ⭐ Resi digital publik (Modul 6) — `rawatin.id/r/{kode}`.
 * Tanpa login, tanpa install. Tanpa alamat/WA pelanggan & tanpa alamat lengkap outlet.
 */
export const resiRoutes = new Hono()

resiRoutes.get('/r/:code', async (c) => {
  const db = getDb()
  const code = c.req.param('code').toUpperCase()
  const order = (await db.select().from(orders).where(eq(orders.orderCode, code)).limit(1))[0]
  if (!order) return c.json({ error: 'Resi tidak ditemukan' }, 404)
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId)).limit(1)
  if (!tenant) return c.json({ error: 'Outlet tidak ditemukan' }, 404)
  const [cust] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.sortOrder))
  const itemIds = items.map((i) => i.id)
  const svcRows = itemIds.length ? await db.select().from(orderItemServices).where(inArray(orderItemServices.orderItemId, itemIds)) : []
  const photoRows = await db.select().from(photos).where(eq(photos.orderId, order.id)).orderBy(asc(photos.takenAt))
  const payRows = await db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(asc(payments.createdAt))
  const before = photoRows.filter((p) => p.type === 'before')
  const after = photoRows.filter((p) => p.type === 'after')
  const pickupProof = photoRows.filter((p) => p.type === 'pickup_proof')
  const canShare = order.status === 'ready' || order.status === 'completed'
  const badge = pickBadge(tenant, svcRows)

  // Catat view, baru hitung jumlah — urutan penting supaya respons akurat
  const ua = c.req.header('user-agent') ?? ''
  if (!/bot|spider|crawl/i.test(ua)) {
    await db.insert(resiViews).values({
      orderId: order.id,
      viewedAt: new Date(),
      ipHash: hashIp(c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')),
      userAgent: ua.slice(0, 200),
    })
  }
  const [views] = await db.select({ n: count() }).from(resiViews).where(eq(resiViews.orderId, order.id))

  const base = envOf(c).APP_PUBLIC_URL ?? envOf(c).APP_BASE_URL ?? ''
  const shareUrl = `${base.replace(/\/$/, '')}/r/${order.orderCode}`

  return c.json({
    resi: {
      code: order.orderCode,
      status: order.status,
      statusLabel: tenant.statusLabels?.[order.status] ?? order.status,
      statusFlow: ['received', 'in_progress', 'finishing', 'ready', 'completed'].map((s) => ({
        key: s,
        label: tenant.statusLabels?.[s] ?? s,
        reached: isReached(order.status, s),
      })),
      estimatedReadyAt: order.estimatedReadyAt,
      readyAt: order.readyAt,
      pickedUpAt: order.pickedUpAt,
      receivedAt: order.receivedAt,
      disclaimerAcceptedAt: order.disclaimerAcceptedAt,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      paidAmount: order.paidAmount,
      remaining: Math.max(0, order.total - order.paidAmount),
      payments: payRows.map((p) => ({ amount: p.amount, method: p.method, createdAt: p.createdAt })),
      items: items.map((it) => ({
        brand: it.brand,
        model: it.model,
        color: it.color,
        conditionTags: it.conditionTags,
        conditionNotes: it.conditionNotes,
        quantity: it.quantity,
        lineTotal: it.lineTotal,
        services: svcRows.filter((s) => s.orderItemId === it.id),
        photos: {
          before: before.filter((p) => !p.orderItemId || p.orderItemId === it.id),
          after: after.filter((p) => !p.orderItemId || p.orderItemId === it.id),
        },
      })),
      photos: {
        beforeCount: before.length,
        afterCount: after.length,
        pickupProof: pickupProof.map((p) => ({ url: p.url, takenAt: p.takenAt })),
      },
      customerName: cust?.name ?? '',
      shareUrl,
      canShare,
      streak: (cust?.totalOrders ?? 0) > 1 ? cust!.totalOrders : null,
      views: views?.n ?? 0,
      badge,
    },
    tenant: {
      name: tenant.name,
      slug: tenant.slug,
      city: tenant.city,
      logoUrl: tenant.logoUrl,
      whatsapp: tenant.whatsapp,
      openingHours: tenant.openingHours,
      plan: tenant.plan,
      itemLabel: tenant.itemLabel,
      shareCardConfig: tenant.shareCardConfig,
    },
    shareUrl,
  })
})

// Share event dari halaman resi publik (pelanggan) — bukti ROI gamifikasi
resiRoutes.post('/r/:code/share-event', async (c) => {
  const db = getDb()
  const code = c.req.param('code').toUpperCase()
  const order = (await db.select().from(orders).where(eq(orders.orderCode, code)).limit(1))[0]
  if (!order) return c.json({ error: 'Resi tidak ditemukan' }, 404)
  await db.insert(shareEvents).values({ tenantId: order.tenantId, orderId: order.id, actor: 'customer', format: '1:1', method: 'web_share' })
  return c.json({ ok: true }, 201)
})

function isReached(current: string, target: string) {
  const order = ['received', 'in_progress', 'finishing', 'ready', 'completed']
  return order.indexOf(target) <= order.indexOf(current)
}

function pickBadge(tenant: typeof tenants.$inferSelect, svcRows: typeof orderItemServices.$inferSelect[]) {
  const map = tenant.shareCardConfig?.badgeMap ?? {}
  const first = svcRows[0]
  if (!first) return '✨ Glow Up Complete'
  if (map[first.serviceName]) return map[first.serviceName]
  if (first.serviceName === 'Deep Clean') return '✨ Glow Up Complete'
  if (first.serviceName === 'Fast Clean') return '🧼 Fresh from Fast Clean'
  if (first.serviceName === 'Unyellowing') return '☀️ Unyellowing Success'
  if (first.serviceName === 'Repaint') return '🎨 Repaint Reborn'
  return '✨ Glow Up Complete'
}
