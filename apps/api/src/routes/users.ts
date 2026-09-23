import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb, users } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth, requireRole } from '../middleware/auth'
import { hashPin } from '../lib/pin'
import { envOf } from '../env'
import { PIN_RE } from './auth'
import '../types'

export const userRoutes = new Hono()

userRoutes.get('/t/:slug/users', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const tenant = c.get('tenant')
  const rows = await getDb().select().from(users).where(eq(users.tenantId, tenant.id))
  return c.json({ users: rows.map(({ pinHash: _ph, ...u }) => u) })
})

userRoutes.post('/t/:slug/users', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = z
    .object({ name: z.string().min(1).max(80), phone: z.string().min(9).max(20), role: z.enum(['staff', 'tech', 'owner']), pin: z.string().regex(PIN_RE) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const d = body.data
  const dup = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.phone, d.phone)))
    .limit(1)
  if (dup.length) return c.json({ error: 'Nomor sudah terdaftar' }, 409)
  const pinHash = await hashPin(d.pin, d.phone, envOf(c).PIN_SALT)
  const rows = await getDb().insert(users).values({ tenantId: tenant.id, name: d.name, phone: d.phone, role: d.role, pinHash }).returning()
  const { pinHash: _ph, ...u } = rows[0]!
  return c.json(u, 201)
})

userRoutes.patch('/t/:slug/users/:id', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = z
    .object({ name: z.string().min(1).max(80).optional(), role: z.enum(['staff', 'tech', 'owner']).optional(), isActive: z.boolean().optional(), pin: z.string().regex(PIN_RE).optional() })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid' }, 400)
  const tenant = c.get('tenant')
  const db = getDb()
  const id = c.req.param('id')!
  const existing = (await db.select().from(users).where(and(eq(users.id, id), eq(users.tenantId, tenant.id))).limit(1))[0]
  if (!existing) return c.json({ error: 'User tidak ditemukan' }, 404)
  const patch: Record<string, unknown> = {}
  if (body.data.name !== undefined) patch.name = body.data.name
  if (body.data.role !== undefined) patch.role = body.data.role
  if (body.data.isActive !== undefined) patch.isActive = body.data.isActive
  if (body.data.pin) patch.pinHash = await hashPin(body.data.pin, existing.phone, envOf(c).PIN_SALT)
  const rows = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, existing.id))
    .returning()
  const { pinHash: _ph, ...u } = rows[0]!
  return c.json(u)
})
