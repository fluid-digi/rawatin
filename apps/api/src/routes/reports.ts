import { Hono } from 'hono'
import { and, asc, count, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'
import { getDb, orders, orderItems, orderItemServices, customers, payments, users, notificationsLog, shareEvents } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth, requireRole } from '../middleware/auth'
import '../types'

/**
 * Modul 9 — 5 angka + 3 daftar + export CSV. Tidak lebih.
 */
export const reportRoutes = new Hono()

function toRange(c: { req: { query: (k: string) => string | undefined } }, tenantId: string) {
  const from = c.req.query('from') ? new Date(c.req.query('from')!) : new Date(new Date().setHours(0, 0, 0, 0))
  const to = c.req.query('to') ? new Date(c.req.query('to')!) : new Date()
  return { start: from, end: to }
}

reportRoutes.get('/t/:slug/reports', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const db = getDb()
  const { start, end } = toRange(c, tenant.id)

  const [omzet] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(orders.tenantId, tenant.id), gte(payments.createdAt, start), lte(payments.createdAt, end)))
  const [orderAgg] = await db
    .select({
      n: count(),
      totalValue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      avg: sql<number>`coalesce(avg(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), gte(orders.receivedAt, start), lte(orders.receivedAt, end)))
  const [piutang] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.total} - ${orders.paidAmount}), 0)`, n: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), sql`${orders.paidAmount} < ${orders.total}`, sql`${orders.status} != 'abandoned'`))
  const [uncollected] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), sql`${orders.status} not in ('completed','abandoned')`))
  const [countPaidItems] = await db
    .select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.tenantId, tenant.id), gte(orders.receivedAt, start), lte(orders.receivedAt, end)))

  // 3 daftar: layanan terlaris, pelanggan teratas, order per staf
  const topServices = await db
    .select({ serviceName: orderItemServices.serviceName, n: count(), value: sql<number>`coalesce(sum(${orderItemServices.priceSnapshot}), 0)` })
    .from(orderItemServices)
    .innerJoin(orderItems, eq(orderItems.id, orderItemServices.orderItemId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.tenantId, tenant.id), gte(orders.receivedAt, start), lte(orders.receivedAt, end)))
    .groupBy(orderItemServices.serviceName)
    .orderBy(desc(count()))
    .limit(5)

  const topCustomers = await db
    .select({ name: customers.name, phone: customers.phone, n: count(), value: sql<number>`coalesce(sum(${orders.total}), 0)` })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.tenantId, tenant.id), gte(orders.receivedAt, start), lte(orders.receivedAt, end)))
    .groupBy(customers.name, customers.phone)
    .orderBy(desc(sql`sum(${orders.total})`))
    .limit(5)

  const perStaff = await db
    .select({ userId: orders.createdByUserId, name: users.name, n: count(), value: sql<number>`coalesce(sum(${orders.total}), 0)` })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.createdByUserId))
    .where(and(eq(orders.tenantId, tenant.id), gte(orders.receivedAt, start), lte(orders.receivedAt, end)))
    .groupBy(orders.createdByUserId, users.name)
    .orderBy(desc(count()))
    .limit(10)

  const [reviewSent] = await db
    .select({ n: count() })
    .from(notificationsLog)
    .innerJoin(orders, eq(orders.id, notificationsLog.orderId))
    .where(and(eq(orders.tenantId, tenant.id), eq(notificationsLog.type, 'review_request'), gte(notificationsLog.sentAt, start), lte(notificationsLog.sentAt, end)))
  const [shareCount] = await db
    .select({ n: count() })
    .from(shareEvents)
    .where(and(eq(shareEvents.tenantId, tenant.id), gte(shareEvents.createdAt, start), lte(shareEvents.createdAt, end)))

  return c.json({
    start,
    end,
    omzet: omzet?.total ?? 0,
    orderCount: Number(orderAgg?.n ?? 0),
    totalValue: orderAgg?.totalValue ?? 0,
    avgPerOrder: Math.round((orderAgg?.avg ?? 0) as number),
    itemCount: Number(countPaidItems?.n ?? 0),
    piutang: piutang?.total ?? 0,
    piutangOrders: Number(piutang?.n ?? 0),
    uncollected: Number(uncollected?.n ?? 0),
    topServices,
    topCustomers,
    perStaff,
    reviewSent: Number(reviewSent?.n ?? 0),
    shareEvents: Number(shareCount?.n ?? 0),
  })
})

reportRoutes.get('/t/:slug/reports/export.csv', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const tenant = c.get('tenant')
  const db = getDb()
  const rows = await db
    .select({
      orderCode: orders.orderCode,
      receivedAt: orders.receivedAt,
      status: orders.status,
      customerName: customers.name,
      customerPhone: customers.phone,
      total: orders.total,
      paidAmount: orders.paidAmount,
      paymentStatus: orders.paymentStatus,
      estimatedReadyAt: orders.estimatedReadyAt,
      pickedUpAt: orders.pickedUpAt,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(orders.tenantId, tenant.id))
    .orderBy(desc(orders.receivedAt))
    .limit(5000)
  const header = ['order_code', 'received_at', 'status', 'customer_name', 'customer_phone', 'total', 'paid_amount', 'payment_status', 'estimated_ready_at', 'picked_up_at']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [header.join(','), ...rows.map((r) => [r.orderCode, r.receivedAt?.toISOString() ?? '', r.status, r.customerName, r.customerPhone, r.total, r.paidAmount, r.paymentStatus, r.estimatedReadyAt?.toISOString() ?? '', r.pickedUpAt?.toISOString() ?? ''].map(esc).join(','))]
  return new Response('\uFEFF' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rawatin-${tenant.slug}-orders.csv"`,
    },
  })
})
