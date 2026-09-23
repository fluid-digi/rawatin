import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb, tenants } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth, requireRole } from '../middleware/auth'
import '../types'

export const settingsRoutes = new Hono()

settingsRoutes.get('/t/:slug/settings', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  return c.json(tenant)
})

const settingsSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  city: z.string().max(60).optional(),
  logoUrl: z.string().optional(),
  whatsapp: z.string().max(20).optional(),
  googleMapsReviewUrl: z.string().optional(),
  openingHours: z.string().max(120).optional(),
  disclaimerText: z.string().max(4000).optional(),
  statusLabels: z.record(z.string(), z.string()).optional(),
  waTemplates: z.record(z.string(), z.string()).optional(),
  requirePickupProof: z.boolean().optional(),
  publishConsentDefault: z.boolean().optional(),
  itemLabel: z.string().max(12).optional(),
  itemLabelPlural: z.string().max(12).optional(),
  shareCardConfig: z
    .object({
      outletCounterOn: z.boolean().optional(),
      counterLabel: z.string().max(80).optional(),
      badgeMap: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
})

settingsRoutes.patch('/t/:slug/settings', resolveTenant, requireAuth, requireRole('owner'), async (c) => {
  const body = settingsSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid', detail: body.error.flatten() }, 400)
  const tenant = c.get('tenant')
  const patch: Record<string, unknown> = { ...body.data }
  if (body.data.whatsapp) patch.whatsapp = body.data.whatsapp
  const rows = await getDb().update(tenants).set(patch).where(eq(tenants.id, tenant.id)).returning()
  return c.json(rows[0])
})
