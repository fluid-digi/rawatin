import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb, tenants } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import { sanitizeWhatsapp } from '../lib/wa'
import '../types'

/**
 * Finalisasi onboarding (Modul 1 langkah 2–4). Semua field punya default,
 * wizard boleh skip — tidak ada layar kosong.
 */
export const onboardingRoutes = new Hono()

const finalizeSchema = z.object({
  whatsapp: z.string().max(20).optional(),
  googleMapsReviewUrl: z.string().optional(),
  city: z.string().max(60).optional(),
  logoUrl: z.string().optional(),
  openingHours: z.string().max(120).optional(),
  disclaimerText: z.string().max(4000).optional(),
  statusLabels: z.record(z.string(), z.string()).optional(),
  itemLabel: z.string().max(12).optional(),
  itemLabelPlural: z.string().max(12).optional(),
  requirePickupProof: z.boolean().optional(),
  publishConsentDefault: z.boolean().optional(),
})

onboardingRoutes.post('/t/:slug/onboarding/finalize', resolveTenant, requireAuth, async (c) => {
  const user = c.get('dbUser')
  if (user.role !== 'owner') return c.json({ error: 'Hanya owner' }, 403)
  const body = finalizeSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid', detail: body.error.flatten() }, 400)
  const d = body.data
  const tenant = c.get('tenant')
  const patch: Record<string, unknown> = {}
  if (d.city !== undefined) patch.city = d.city
  if (d.logoUrl !== undefined) patch.logoUrl = d.logoUrl
  if (d.openingHours !== undefined) patch.openingHours = d.openingHours
  if (d.disclaimerText !== undefined && d.disclaimerText.trim()) patch.disclaimerText = d.disclaimerText.trim()
  if (d.statusLabels && Object.keys(d.statusLabels).length) patch.statusLabels = d.statusLabels
  if (d.itemLabel !== undefined) patch.itemLabel = d.itemLabel
  if (d.itemLabelPlural !== undefined) patch.itemLabelPlural = d.itemLabelPlural
  if (d.requirePickupProof !== undefined) patch.requirePickupProof = d.requirePickupProof
  if (d.publishConsentDefault !== undefined) patch.publishConsentDefault = d.publishConsentDefault
  if (d.whatsapp) {
    const wa = sanitizeWhatsapp(d.whatsapp)
    if (wa) patch.whatsapp = wa
  }
  if (d.googleMapsReviewUrl !== undefined) patch.googleMapsReviewUrl = d.googleMapsReviewUrl
  await getDb().update(tenants).set(patch).where(eq(tenants.id, tenant.id))
  return c.json({ ok: true })
})
