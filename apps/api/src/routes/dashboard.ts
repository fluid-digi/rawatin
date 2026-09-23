import { Hono } from 'hono'
import { and, count, eq, sql, desc, gte, lt } from 'drizzle-orm'
import { getDb, orders, payments, customers, photos } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import '../types'

export const dashboardRoutes = new Hono()

dashboardRoutes.get('/t/:slug/dashboard', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const db = getDb()
  const statusCond = (s: string) => and(eq(orders.tenantId, tenant.id), eq(orders.status, s as never))
  const [byStatus] = await db
    .select({
      received: sql<number>`count(*) filter (where ${orders.status} = 'received')`,
      in_progress: sql<number>`count(*) filter (where ${orders.status} = 'in_progress')`,
      finishing: sql<number>`count(*) filter (where ${orders.status} = 'finishing')`,
      ready: sql<number>`count(*) filter (where ${orders.status} = 'ready')`,
      completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')`,
      abandoned: sql<number>`count(*) filter (where ${orders.status} = 'abandoned')`,
    })
    .from(orders)
    .where(eq(orders.tenantId, tenant.id))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [todayRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(orders.tenantId, tenant.id), gte(payments.createdAt, today)))
  const [piutang] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.total} - ${orders.paidAmount}), 0)` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), sql`${orders.paidAmount} < ${orders.total}`))

  const ages: Record<string, number> = {}
  for (const days of [7, 14, 30, 60]) {
    const cutoff = new Date(Date.now() - days * 86_400_000)
    const [r] = await db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), lt(orders.receivedAt, cutoff), sql`${orders.status} not in ('completed','abandoned')`))
    ages[`uncollectedOver${days}d`] = Number(r?.n ?? 0)
  }
  const [reviewQueue] = await db.select({ n: count() }).from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.status, 'completed'), sql`${orders.reviewRequestSentAt} is null`))
  const [photoCompliance] = await db
    .select({ n: sql<number>`count(distinct ${orders.id})` })
    .from(orders)
    .innerJoin(photos, eq(photos.orderId, orders.id))
    .where(and(eq(orders.tenantId, tenant.id), eq(orders.status, 'completed'), eq(photos.type, 'pickup_proof')))
  const [totalCompleted] = await db.select({ n: count() }).from(orders).where(and(eq(orders.tenantId, tenant.id), eq(orders.status, 'completed')))
  const compliance = Number(totalCompleted?.n ?? 0) ? Math.round((Number(photoCompliance?.n ?? 0) / Number(totalCompleted?.n ?? 0)) * 100) : null
  const recent = await db
    .select({
      order: orders,
      customerName: customers.name,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(orders.tenantId, tenant.id))
    .orderBy(desc(orders.receivedAt))
    .limit(8)
  const [todayOrders] = await db.select({ n: count() }).from(orders).where(and(eq(orders.tenantId, tenant.id), gte(orders.receivedAt, today)))
  return c.json({
    byStatus: {
      received: Number(byStatus?.received ?? 0),
      in_progress: Number(byStatus?.in_progress ?? 0),
      finishing: Number(byStatus?.finishing ?? 0),
      ready: Number(byStatus?.ready ?? 0),
      completed: Number(byStatus?.completed ?? 0),
      abandoned: Number(byStatus?.abandoned ?? 0),
    },
    todayRevenue: Number(todayRevenue?.total ?? 0),
    todayOrders: Number(todayOrders?.n ?? 0),
    piutang: Number(piutang?.total ?? 0),
    uncollected: ages,
    reviewQueue: Number(reviewQueue?.n ?? 0),
    pickupProofCompliance: compliance,
    recent,
  })
})
