import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { and, asc, count, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import {
  getDb,
  orders,
  orderItems,
  orderItemServices,
  customers,
  services,
  addons as addonsTable,
  photos,
  statusLogs,
  payments,
  notificationsLog,
  shareEvents,
  resiViews,
  offlineQueue,
  users,
  type Tenant,
  type User,
} from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import { formatOrderCode, base36 } from '../lib/order-code'
import { fillTemplate, sanitizeWhatsapp, waDeepLink } from '../lib/wa'
import { envOf } from '../env'
import { getStore } from '../lib/store'
import { daysBetween } from '../lib/format'
import '../types'

export const orderRoutes = new Hono()

// ── Validator payload intake (Modul 3) ───────────────────────────────────
const itemPhotoSchema = z.object({
  dataUrl: z.string().startsWith('data:image/'),
  width: z.number().int().max(4096).optional(),
  height: z.number().int().max(4096).optional(),
})

const intakeItemSchema = z.object({
  brand: z.string().max(80).default(''),
  model: z.string().max(120).optional(),
  color: z.string().max(60).optional(),
  conditionTags: z.array(z.string().max(40)).default([]),
  conditionNotes: z.string().max(500).optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  serviceIds: z.array(z.string()).min(1),
  addonIds: z.array(z.string()).default([]),
  photos: z.array(itemPhotoSchema).max(4).default([]),
})

const intakeSchema = z.object({
  clientId: z.string().max(64).optional(),
  customer: z.object({ phone: z.string().min(9).max(20), name: z.string().max(80).optional(), address: z.string().max(500).optional() }),
  items: z.array(intakeItemSchema).min(1).max(8),
  discount: z.number().int().min(0).max(100_000_000).default(0),
  payment: z.object({ amount: z.number().int().min(0), method: z.enum(['cash', 'qris', 'transfer']).default('cash') }).default({ amount: 0, method: 'cash' }),
  disclaimerAccepted: z.boolean().default(true),
  disclaimerAcceptedByName: z.string().max(80).optional(),
  publishConsent: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
})

const WA_TYPES = ['received', 'ready', 'reminder_14', 'reminder_30', 'payment', 'review_request'] as const

function resiUrl(base: string, code: string) {
  return `${base.replace(/\/$/, '')}/r/${code}`
}

function money(n: number | null) {
  return (n ?? 0).toLocaleString('id-ID')
}

type IntakeResult =
  | {
      order: typeof orders.$inferSelect
      items: any[]
      customer: { id: string; name: string; phone: string; totalOrders: number }
      estimatedReadyAt: Date
      resiUrl: string
      error?: never
    }
  | { error: true; status: 400 | 404 | 409 | 500; message: string; detail?: unknown; order?: never; items?: never; customer?: never; estimatedReadyAt?: never; resiUrl?: never }

// ── Proses intake (dipakai alur normal & offline sync) ───────────────────
async function processIntake(c: Context, tenant: Tenant, user: User, raw: unknown, clientId?: string): Promise<IntakeResult> {
  const body = intakeSchema.safeParse(raw)
  if (!body.success) return { error: true, status: 400, message: 'Data intake tidak valid', detail: body.error.flatten() }
  const d = body.data
  const db = getDb()

  // Customer upsert (unique per (tenant, phone))
  const phone = d.customer.phone.trim()
  const existing = await db.select().from(customers).where(and(eq(customers.tenantId, tenant.id), eq(customers.phone, phone))).limit(1)
  let customer = existing[0]
  if (!customer) {
    const name = d.customer.name?.trim() || `Pelanggan ${phone.slice(-4)}`
    customer = (await db.insert(customers).values({ tenantId: tenant.id, phone, name, address: d.customer.address }).returning())[0]!
  } else if (d.customer.name?.trim() && d.customer.name.trim() !== customer.name) {
    customer = (await db.update(customers).set({ name: d.customer.name.trim() }).where(eq(customers.id, customer.id)).returning())[0]!
  }

  // Ambil harga layanan & addon dari master (price snapshot)
  const allSvcIds = d.items.flatMap((i) => i.serviceIds)
  const svcRows = allSvcIds.length ? await db.select().from(services).where(inArray(services.id, allSvcIds)) : []
  const svcMap = new Map(svcRows.map((s) => [s.id, s]))
  const allAddonIds = d.items.flatMap((i) => i.addonIds)
  const addonRows = allAddonIds.length ? await db.select().from(addonsTable).where(inArray(addonsTable.id, allAddonIds)) : []
  const addonMap = new Map(addonRows.map((a) => [a.id, a]))
  for (const sid of allSvcIds) if (!svcMap.has(sid)) return { error: true, status: 400, message: 'Layanan tidak ditemukan' }

  // Kode order: urutan per tenant + suffix acak (retry saat konflik unik)
  const prefix = 'RWT'
  let orderCode = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const [countRow] = await db.select({ n: count() }).from(orders).where(eq(orders.tenantId, tenant.id))
    const seq = Number(countRow?.n ?? 0) + 1
    orderCode = formatOrderCode(prefix, seq)
    const dup = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, orderCode))).limit(1)
    if (!dup.length) break
    orderCode = `${prefix}-${base36(seq + attempt + 4)}-${formatOrderCode(prefix, 1).split('-')[2]}`
  }

  // Hitung total & estimasi
  let subtotal = 0
  let maxDuration = 0
  const itemRows = d.items.map((it, idx) => {
    const servicesPicked = it.serviceIds.map((sid) => svcMap.get(sid)!)
    const addonsPicked = it.addonIds.map((aid) => addonMap.get(aid)!).filter(Boolean)
    const unitValue = servicesPicked.reduce((sum, s) => sum + s.price, 0)
    const lineTotal = unitValue * it.quantity
    subtotal += lineTotal
    for (const s of servicesPicked) maxDuration = Math.max(maxDuration, s.durationDays)
    for (const a of addonsPicked) maxDuration += a.extraDurationDays
    return { ...it, servicesPicked, addonsPicked, unitValue, lineTotal, idx }
  })

  const discount = Math.min(d.discount, subtotal)
  const total = Math.max(0, subtotal - discount)
  const paidAmount = Math.min(d.payment.amount, total)
  const paymentStatus = paidAmount >= total && total > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
  const estimatedReadyAt = new Date(Date.now() + maxDuration * 86_400_000)
  const now = new Date()

  const created = await db.transaction(async (tx) => {
    const order = (
      await tx
        .insert(orders)
        .values({
          tenantId: tenant.id,
          orderCode,
          customerId: customer!.id,
          createdByUserId: user.id,
          status: 'received',
          subtotal,
          discount,
          total,
          paidAmount,
          paymentStatus,
          estimatedReadyAt,
          disclaimerAcceptedAt: d.disclaimerAccepted ? now : null,
          disclaimerAcceptedBy: d.disclaimerAcceptedByName ?? user.name,
          publishConsent: d.publishConsent,
          notes: d.notes,
        })
        .returning()
    )[0]!

    const items: any[] = []
    for (const it of itemRows) {
      const item = (
        await tx
          .insert(orderItems)
          .values({
            orderId: order.id,
            brand: it.brand,
            model: it.model,
            color: it.color,
            conditionTags: it.conditionTags,
            conditionNotes: it.conditionNotes,
            quantity: it.quantity,
            unitValue: it.unitValue,
            lineTotal: it.lineTotal,
            sortOrder: it.idx,
          })
          .returning()
      )[0]!
      for (const s of it.servicesPicked) {
        await tx.insert(orderItemServices).values({
          orderItemId: item.id,
          serviceId: s.id,
          serviceName: s.name,
          priceSnapshot: s.price,
          addonSnapshot: it.addonsPicked.map((a) => ({ id: a.id, name: a.name, price: a.price, extraDurationDays: a.extraDurationDays })),
        })
      }
      items.push({ ...item, services: it.servicesPicked.map((s) => ({ id: s.id, name: s.name, price: s.price })), addons: it.addonsPicked })

      // Foto inline (alur offline) → decode base64 lalu simpan
      for (const [pi, ph] of it.photos.entries()) {
        const b64 = ph.dataUrl.split(',')[1]
        if (!b64) continue
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
        const store = await getStore(c)
        const stored = await store.put(`${tenant.id}/${order.id}/${item.id}/before-${pi}-${Date.now()}.webp`, bytes, 'image/webp')
        await tx.insert(photos).values({
          orderId: order.id,
          orderItemId: item.id,
          type: 'before',
          url: stored.url,
          sizeBytes: bytes.length,
          uploadedByUserId: user.id,
          takenAt: now,
        })
      }
    }

    if (total > 0) await tx.insert(statusLogs).values({ orderId: order.id, fromStatus: null, toStatus: 'received', userId: user.id })

    if (paidAmount > 0) {
      await tx.insert(payments).values({
        orderId: order.id,
        amount: paidAmount,
        method: d.payment.method,
        receivedByUserId: user.id,
        createdAt: now,
      })
    }

    // Counter quota & streak pelanggan
    await tx
      .update(customers)
      .set({
        totalOrders: sql`${customers.totalOrders} + 1`,
        totalSpent: sql`${customers.totalSpent} + ${total}`,
        lastOrderAt: now,
      })
      .where(eq(customers.id, customer!.id))
    return { order, items }
  })

  return {
    order: created.order,
    items: created.items,
    customer: { id: customer!.id, name: customer!.name, phone: customer!.phone, totalOrders: customer!.totalOrders + 1 },
    estimatedReadyAt,
    resiUrl: resiUrl(envOf(c).APP_PUBLIC_URL ?? envOf(c).APP_BASE_URL ?? '', orderCode),
  }
}

// ── Intake order (alur normal) ───────────────────────────────────────────
orderRoutes.post('/t/:slug/orders', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const raw = await c.req.json().catch(() => null)
  const clientId = typeof raw === 'object' && raw !== null && typeof (raw as any).clientId === 'string' ? (raw as any).clientId : undefined
  if (clientId) {
    const existing = await getDb().select().from(offlineQueue).where(and(eq(offlineQueue.tenantId, tenant.id), eq(offlineQueue.clientId, clientId))).limit(1)
    if (existing[0]?.processedAt) return c.json({ dedup: true, ...(existing[0].payload as object) }, 200)
  }
  const result = await processIntake(c, tenant, user, raw)
  if (result.error) return c.json({ error: result.message, detail: result.detail }, result.status)
  if (clientId) {
    await getDb()
      .insert(offlineQueue)
      .values({ tenantId: tenant.id, clientId, payload: result as unknown as Record<string, unknown>, processedAt: new Date() })
      .onConflictDoNothing()
  }
  return c.json({ order: result.order, items: result.items, customer: result.customer, estimatedReadyAt: result.estimatedReadyAt, resiUrl: result.resiUrl }, 201)
})

// ── Daftar order (papan & filter, Modul 5/8/9) ───────────────────────────
orderRoutes.get('/t/:slug/orders', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const q = c.req.query('q')?.trim()
  const status = c.req.query('status')
  const payment = c.req.query('payment')
  const staffId = c.req.query('staff')
  const uncollectedDays = c.req.query('uncollected') ? Number(c.req.query('uncollected')) : undefined
  const reviewPending = c.req.query('reviewPending') === '1'
  const db = getDb()
  const conditions = [eq(orders.tenantId, tenant.id)]
  if (status) conditions.push(eq(orders.status, status as never))
  if (payment) conditions.push(eq(orders.paymentStatus, payment as never))
  if (staffId) conditions.push(eq(orders.createdByUserId, staffId))
  if (uncollectedDays) {
    const cutoff = new Date(Date.now() - uncollectedDays * 86_400_000)
    conditions.push(lt(orders.receivedAt, cutoff), sql`${orders.status} not in ('completed','abandoned')`)
  }
  if (reviewPending) {
    conditions.push(eq(orders.status, 'completed'), sql`${orders.reviewRequestSentAt} is null`)
  }
  if (q) {
    const custSub = db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.tenantId, tenant.id), or(sql`${customers.name} ilike ${`%${q}%`}`, sql`${customers.phone} ilike ${`%${q}%`}`)))
    conditions.push(
      or(
        sql`${orders.orderCode} ilike ${`%${q.replace(/[^a-zA-Z0-9-]/g, '')}%`}`,
        sql`${orders.customerId} in (${custSub})`,
      )!,
    )
  }
  const rows = await db
    .select({
      order: orders,
      customerName: customers.name,
      customerPhone: customers.phone,
      photo: photos.url,
      itemCount: sql<number>`(select count(*) from order_items oi where oi.order_id = ${orders.id})`,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(photos, sql`${photos.id} = (select p.id from photos p where p.order_id = ${orders.id} and p.type = 'before' order by p.taken_at limit 1)`)
    .where(and(...conditions))
    .orderBy(desc(orders.receivedAt))
    .limit(Number(c.req.query('limit') ?? 100))
  return c.json({ orders: rows })
})

// ── Detail lengkap satu order ────────────────────────────────────────────
async function loadOrderDetail(db: ReturnType<typeof getDb>, tenantId: string, code: string) {
  const order = (await db.select().from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.orderCode, code))).limit(1))[0]
  if (!order) return null
  const [cust] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.sortOrder))
  const itemIds = items.map((i) => i.id)
  const svcRows = itemIds.length ? await db.select().from(orderItemServices).where(inArray(orderItemServices.orderItemId, itemIds)) : []
  const photoRows = await db.select().from(photos).where(eq(photos.orderId, order.id)).orderBy(asc(photos.takenAt))
  const logRows = await db.select().from(statusLogs).where(eq(statusLogs.orderId, order.id)).orderBy(asc(statusLogs.createdAt))
  const userIds = [...new Set(logRows.map((l) => l.userId).filter(Boolean))] as string[]
  const userRows = userIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)) : []
  const userMap = new Map(userRows.map((u) => [u.id, u.name]))
  const payRows = await db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(asc(payments.createdAt))
  const notifRows = await db.select().from(notificationsLog).where(eq(notificationsLog.orderId, order.id)).orderBy(desc(notificationsLog.sentAt))
  const shareRows = await db.select().from(shareEvents).where(eq(shareEvents.orderId, order.id)).orderBy(desc(shareEvents.createdAt))
  const [views] = await db.select({ n: count() }).from(resiViews).where(eq(resiViews.orderId, order.id))
  return {
    order,
    customer: cust ?? null,
    items: items.map((it) => ({
      ...it,
      services: svcRows.filter((s) => s.orderItemId === it.id),
      photos: photoRows.filter((p) => p.orderItemId === it.id || !p.orderItemId),
    })),
    photos: photoRows,
    statusLogs: logRows.map((l) => ({ ...l, userName: l.userId ? userMap.get(l.userId) ?? '-' : '-' })),
    payments: payRows,
    notifications: notifRows,
    shareEvents: shareRows,
    resiViews: views?.n ?? 0,
  }
}

orderRoutes.get('/t/:slug/orders/:code', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const detail = await loadOrderDetail(getDb(), tenant.id, c.req.param('code')!)
  if (!detail) return c.json({ error: 'Order tidak ditemukan' }, 404)
  const base = envOf(c).APP_PUBLIC_URL ?? envOf(c).APP_BASE_URL ?? ''
  return c.json({ ...detail, resiUrl: resiUrl(base, detail.order.orderCode) })
})

// ── Ubah status (Modul 5; Selesai TERKUNCI — lewat pickup saja) ─────────
const FORWARD: Record<string, string[]> = {
  received: ['in_progress'],
  in_progress: ['finishing', 'received'],
  finishing: ['ready', 'in_progress'],
  ready: ['finishing'],
}

orderRoutes.post('/t/:slug/orders/:code/status', resolveTenant, requireAuth, async (c) => {
  const body = z.object({ to: z.string(), note: z.string().max(500).optional() }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const db = getDb()
  const order = (await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  const to = body.data.to
  if (to === 'completed') {
    return c.json({ error: 'Order tidak bisa langsung Selesai — gunakan alur Konfirmasi Pengambilan (wajib foto bukti)' }, 400)
  }
  if (to === 'abandoned' && user.role !== 'owner') return c.json({ error: 'Hanya owner yang bisa menandai Diikhlaskan' }, 403)
  if (to !== 'abandoned') {
    const allowed = FORWARD[order.status] ?? []
    if (!allowed.includes(to)) return c.json({ error: `Status ${to} tidak valid dari ${order.status}` }, 400)
  }
  if (order.status === to) return c.json({ error: 'Status sudah sama' }, 400)
  const patch: Record<string, unknown> = { status: to }
  if (to === 'ready' && !order.readyAt) patch.readyAt = new Date()
  await db.transaction(async (tx) => {
    await tx.update(orders).set(patch).where(eq(orders.id, order.id))
    await tx.insert(statusLogs).values({ orderId: order.id, fromStatus: order.status, toStatus: to as never, userId: user.id, note: body.data.note })
  })
  const updated = (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0]!
  return c.json(updated)
})

// ── Catat pembayaran bertahap (Modul 8) ──────────────────────────────────
orderRoutes.post('/t/:slug/orders/:code/payment', resolveTenant, requireAuth, async (c) => {
  const body = z.object({ amount: z.number().int().min(1), method: z.enum(['cash', 'qris', 'transfer']).default('cash'), note: z.string().max(500).optional() }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const db = getDb()
  const order = (await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  const newPaid = order.paidAmount + body.data.amount
  if (newPaid > order.total) return c.json({ error: `Jumlah melebihi sisa (sisa ${order.total - order.paidAmount})` }, 400)
  await db.transaction(async (tx) => {
    await tx.insert(payments).values({ orderId: order.id, amount: body.data.amount, method: body.data.method, receivedByUserId: user.id, note: body.data.note })
    await tx
      .update(orders)
      .set({ paidAmount: newPaid, paymentStatus: newPaid >= order.total ? 'paid' : 'partial' })
      .where(eq(orders.id, order.id))
  })
  return c.json({ paidAmount: newPaid, paymentStatus: newPaid >= order.total ? 'paid' : 'partial', remaining: order.total - newPaid })
})

// ── ⭐ Konfirmasi Pengambilan + bukti foto (Modul 11) ────────────────────
orderRoutes.post('/t/:slug/orders/:code/pickup', resolveTenant, requireAuth, async (c) => {
  const body = z
    .object({
      photoId: z.string().optional(),
      pickedUpByName: z.string().max(80).optional(),
      overrideNote: z.string().max(500).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const db = getDb()
  const order = (await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  if (order.status === 'completed') return c.json({ error: 'Order sudah selesai — tidak bisa konfirmasi ulang' }, 400)

  const remaining = order.total - order.paidAmount
  const override = Boolean(body.data.overrideNote) && user.role === 'owner'
  if (remaining > 0 && !override) {
    return c.json({ error: `Selesaikan pembayaran dulu (sisa ${money(remaining)}) — atau owner bisa override dengan catatan`, remaining }, 400)
  }

  let proof: typeof photos.$inferSelect | undefined
  if (body.data.photoId) {
    proof = (await db.select().from(photos).where(and(eq(photos.id, body.data.photoId), eq(photos.orderId, order.id))).limit(1))[0]
    if (!proof) return c.json({ error: 'Foto bukti tidak ditemukan pada order ini' }, 400)
    if (proof.type !== 'pickup_proof') {
      proof = (await db.update(photos).set({ type: 'pickup_proof' }).where(eq(photos.id, proof.id)).returning())[0]
    }
  } else if (tenant.requirePickupProof) {
    return c.json({ error: 'Bukti foto pengambilan WAJIB — ambil foto dulu (kamera langsung)' }, 400)
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: 'completed',
        pickedUpAt: now,
        pickedUpByName: body.data.pickedUpByName || null,
        pickupConfirmedByUserId: user.id,
        paymentStatus: remaining <= 0 ? 'paid' : 'partial',
        notes: override ? `${order.notes ?? ''}\n[override] ${body.data.overrideNote}`.trim() : order.notes,
      })
      .where(eq(orders.id, order.id))
    await tx.insert(statusLogs).values({ orderId: order.id, fromStatus: order.status, toStatus: 'completed', userId: user.id, note: override ? `Override pembayaran: ${body.data.overrideNote}` : proof ? 'Konfirmasi pengambilan dengan foto bukti' : 'Konfirmasi pengambilan' })
  })
  const updated = (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0]!
  return c.json({ order: updated, proofPhotoId: proof?.id ?? null })
})

// ── ⭐ Follow-up review Google Maps (Modul 10) ───────────────────────────
orderRoutes.post('/t/:slug/orders/:code/review-sent', resolveTenant, requireAuth, async (c) => {
  const body = z.object({ method: z.enum(['manual']).default('manual') }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const db = getDb()
  const order = (await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  if (order.status !== 'completed') return c.json({ error: 'Minta review hanya untuk order yang sudah Selesai (diambil)' }, 400)
  if (order.reviewRequestSentAt) return c.json({ error: `Sudah pernah diminta review (${order.reviewRequestSentAt.toISOString()})` }, 400)
  if (!tenant.googleMapsReviewUrl) return c.json({ error: 'Link review Google Maps belum di-set di pengaturan outlet' }, 400)
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ reviewRequestSentAt: new Date(), reviewRequestSentByUserId: user.id }).where(eq(orders.id, order.id))
    await tx.insert(notificationsLog).values({ orderId: order.id, type: 'review_request', sentByUserId: user.id, sentAt: new Date() })
  })
  const updated = (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0]!
  return c.json(updated)
})

orderRoutes.post('/t/:slug/orders/:code/review-reset', resolveTenant, requireAuth, async (c) => {
  const user = c.get('dbUser')
  if (user.role !== 'owner') return c.json({ error: 'Hanya owner yang bisa reset' }, 403)
  const tenant = c.get('tenant')
  const order = (await getDb().select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  await getDb().update(orders).set({ reviewRequestSentAt: null, reviewRequestSentByUserId: null }).where(eq(orders.id, order.id))
  return c.json({ ok: true })
})

// ── WA deeplink (Modul 7 & 10) ───────────────────────────────────────────
orderRoutes.post('/t/:slug/orders/:code/wa/:type', resolveTenant, requireAuth, async (c) => {
  const type = c.req.param('type')!
  if (!(WA_TYPES as readonly string[]).includes(type)) return c.json({ error: 'Tipe template tidak dikenal' }, 400)
  const tenant = c.get('tenant')
  const user = c.get('dbUser')
  const db = getDb()
  const order = (await db.select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  const [cust] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
  if (!cust) return c.json({ error: 'Pelanggan tidak ditemukan' }, 404)
  const itemNames = await getItemSummary(db, order.id)
  const base = envOf(c).APP_PUBLIC_URL ?? envOf(c).APP_BASE_URL ?? ''
  const vars: Record<string, string> = {
    customer_name: cust.name?.split(' ')[0] ?? 'Kak',
    outlet: tenant.name,
    item_label: tenant.itemLabel,
    item: itemNames,
    order_code: order.orderCode,
    estimated_ready: new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(order.estimatedReadyAt ?? new Date()),
    total: money(order.total),
    remaining: money(order.total - order.paidAmount),
    ready_date: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(order.readyAt ?? new Date()),
    resi_url: resiUrl(base, order.orderCode),
    review_url: tenant.googleMapsReviewUrl || '',
    opening_hours: tenant.openingHours || 'sesuai jam buka',
  }
  const tpl = tenant.waTemplates?.[type] ?? (tenant.waTemplates?.['received'] ?? '')
  const message = fillTemplate(tpl, vars)
  const phone = sanitizeWhatsapp(cust.phone)
  if (!phone) return c.json({ error: 'Nomor WA pelanggan tidak valid' }, 400)
  await db.insert(notificationsLog).values({ orderId: order.id, type: type as never, sentByUserId: user.id, sentAt: new Date() })
  return c.json({ url: waDeepLink(phone, message), message, phone: cust.phone })
})

async function getItemSummary(db: ReturnType<typeof getDb>, orderId: string) {
  const items = await db.select({ brand: orderItems.brand, model: orderItems.model, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId)).limit(3)
  return items.map((i) => [i.brand, i.model].filter(Boolean).join(' ') || 'Item').join(', ')
}

// ── Share events (bukti ROI gamifikasi) ──────────────────────────────────
orderRoutes.post('/t/:slug/orders/:code/share-event', resolveTenant, requireAuth, async (c) => {
  const body = z.object({ actor: z.enum(['customer', 'staff']).default('staff'), format: z.enum(['1:1', '9:16']).default('1:1'), method: z.enum(['web_share', 'download']).default('download') }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const order = (await getDb().select().from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.orderCode, c.req.param('code')!))).limit(1))[0]
  if (!order) return c.json({ error: 'Order tidak ditemukan' }, 404)
  const row = await getDb()
    .insert(shareEvents)
    .values({ tenantId: tenant.id, orderId: order.id, actor: body.data.actor, format: body.data.format, method: body.data.method })
    .returning()
  return c.json(row[0], 201)
})

// ── Helper lain ──────────────────────────────────────────────────────────
export { loadOrderDetail, processIntake }
