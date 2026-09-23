import { Hono } from 'hono'
import { z } from 'zod'
import { and, desc, eq, like, or } from 'drizzle-orm'
import { getDb, customers, orders } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import '../types'

export const customerRoutes = new Hono()

customerRoutes.get('/t/:slug/customers', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const q = (c.req.query('q') ?? '').trim()
  const db = getDb()
  const rows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenant.id),
        q ? or(like(customers.name, `%${q}%`), like(customers.phone, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(customers.lastOrderAt))
    .limit(50)
  return c.json({ customers: rows })
})

customerRoutes.patch('/t/:slug/customers/:id', resolveTenant, requireAuth, async (c) => {
  const body = z.object({ notes: z.string().max(2000).optional(), address: z.string().max(500).optional() }).safeParse(
    await c.req.json().catch(() => null),
  )
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const id = c.req.param('id')!
  const rows = await getDb()
    .update(customers)
    .set(body.data)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenant.id)))
    .returning()
  if (!rows.length) return c.json({ error: 'Pelanggan tidak ditemukan' }, 404)
  return c.json(rows[0])
})

customerRoutes.get('/t/:slug/customers/:id/orders', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')!
  const rows = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), eq(orders.customerId, id)))
    .orderBy(desc(orders.receivedAt))
    .limit(30)
  return c.json({ orders: rows })
})
