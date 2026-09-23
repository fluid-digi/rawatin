import { Hono } from 'hono'
import { z } from 'zod'
import { and, asc, eq } from 'drizzle-orm'
import { getDb, services, addons } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth, requireRole } from '../middleware/auth'
import '../types'

export const serviceRoutes = new Hono()

serviceRoutes.get('/t/:slug/services', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const db = getDb()
  const [svc, ad] = await Promise.all([
    db.select().from(services).where(eq(services.tenantId, tenant.id)).orderBy(asc(services.sortOrder)),
    db.select().from(addons).where(eq(addons.tenantId, tenant.id)).orderBy(asc(addons.createdAt)),
  ])
  return c.json({ services: svc, addons: ad })
})

const svcSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.number().int().min(0),
  durationDays: z.number().int().min(0).max(365),
  category: z.string().max(40).default('Cuci'),
  pricingUnit: z.enum(['per_item', 'per_pair', 'per_sqm', 'per_pcs']).default('per_pair'),
  isActive: z.boolean().default(true),
  badge: z.string().max(60).optional(),
})

serviceRoutes.post('/t/:slug/services', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = svcSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const rows = await getDb()
    .insert(services)
    .values({ tenantId: tenant.id, ...body.data, sortOrder: 999 })
    .returning()
  return c.json(rows[0], 201)
})

serviceRoutes.patch('/t/:slug/services/:id', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = svcSchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const id = c.req.param('id')!
  const rows = await getDb()
    .update(services)
    .set(body.data)
    .where(and(eq(services.id, id), eq(services.tenantId, tenant.id)))
    .returning()
  if (!rows.length) return c.json({ error: 'Layanan tidak ditemukan' }, 404)
  return c.json(rows[0])
})

const addonSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.number().int().min(0),
  extraDurationDays: z.number().int().min(0).max(365).default(0),
  isActive: z.boolean().default(true),
})

serviceRoutes.post('/t/:slug/addons', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = addonSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const rows = await getDb().insert(addons).values({ tenantId: tenant.id, ...body.data }).returning()
  return c.json(rows[0], 201)
})

serviceRoutes.patch('/t/:slug/addons/:id', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = addonSchema.partial().safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const id = c.req.param('id')!
  const rows = await getDb()
    .update(addons)
    .set(body.data)
    .where(and(eq(addons.id, id), eq(addons.tenantId, tenant.id)))
    .returning()
  if (!rows.length) return c.json({ error: 'Add-on tidak ditemukan' }, 404)
  return c.json(rows[0])
})
