import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb, tenants, users, seedTenantDefaults, DEFAULT_DISCLAIMER } from '@rawatin/db'
import { hashPin, verifyPin } from '../lib/pin'
import { signSession, verifySession, getSessionToken, sessionCookie, clearSessionCookie } from '../lib/session'
import { envOf } from '../env'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import { sanitizeWhatsapp } from '../lib/wa'
import '../types'

export const reservedSlugs = new Set([
  'r', 'api', 'dashboard', 'login', 'admin', 'blog', 'pricing', 'daftar', 'onboarding',
  'app', 'www', 'auth', 'resi', 'files', 'upload', 'assets', 'settings', 'reports',
  'cms', 'help', 'docs', 'api-docs', 'status', 'about', 'contact', 'terms', 'privacy',
])

export const PIN_RE = /^\d{4,8}$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().regex(SLUG_RE, 'Slug hanya huruf kecil, angka, dan tanda strip'),
  city: z.string().max(60).optional(),
  phone: z.string().min(9).max(20),
  pin: z.string().regex(PIN_RE, 'PIN 4–8 digit'),
  whatsapp: z.string().max(20).optional(),
  googleMapsReviewUrl: z.string().url().optional().or(z.literal('')),
})

export const authRoutes = new Hono()

// ── Daftar outlet baru (Modul 1 langkah 1) ───────────────────────────────
authRoutes.post('/register', async (c) => {
  const body = registerSchema.safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Data tidak valid', detail: body.error.flatten() }, 400)
  const d = body.data
  if (reservedSlugs.has(d.slug)) return c.json({ error: 'Slug tidak tersedia (kata terlarang)' }, 400)

  const wa = d.whatsapp ? sanitizeWhatsapp(d.whatsapp) : sanitizeWhatsapp(d.phone)
  const db = getDb()
  const exists = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, d.slug)).limit(1)
  if (exists.length) return c.json({ error: 'Slug sudah dipakai outlet lain' }, 409)

  const tenant = await db
    .insert(tenants)
    .values({
      name: d.name,
      slug: d.slug,
      city: d.city ?? '',
      whatsapp: wa ?? d.phone,
      googleMapsReviewUrl: d.googleMapsReviewUrl || '',
      disclaimerText: DEFAULT_DISCLAIMER,
    })
    .returning()

  const t = tenant[0]!
  await seedTenantDefaults(t.id, db)

  const pinHash = await hashPin(d.pin, d.phone, envOf(c).PIN_SALT)
  const owner = await db
    .insert(users)
    .values({ tenantId: t.id, name: d.name, phone: d.phone, role: 'owner', pinHash })
    .returning()

  const secret = envOf(c).SESSION_SECRET ?? ''
  const token = await signSession(
    {
      uid: owner[0]!.id,
      tid: t.id,
      slug: t.slug,
      role: 'owner',
      name: owner[0]!.name,
      phone: owner[0]!.phone,
    },
    secret,
  )
  return new Response(JSON.stringify({ tenant: publicTenant(t), token }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token) },
  })
})

// ── Login: WA + PIN ──────────────────────────────────────────────────────
authRoutes.post('/t/:slug/auth/login', resolveTenant, async (c) => {
  const body = z
    .object({ phone: z.string().min(9).max(20), pin: z.string().min(4).max(8) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Nomor atau PIN salah format' }, 400)
  const tenant = c.get('tenant')
  const db = getDb()
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.phone, body.data.phone)))
    .limit(1)
  const user = rows[0]
  if (!user || !user.isActive) return c.json({ error: 'Nomor tidak terdaftar' }, 401)
  const ok = await verifyPin(body.data.pin, user.pinHash, user.phone, envOf(c).PIN_SALT)
  if (!ok) return c.json({ error: 'PIN salah' }, 401)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  const secret = envOf(c).SESSION_SECRET ?? ''
  const token = await signSession(
    { uid: user.id, tid: tenant.id, slug: tenant.slug, role: user.role, name: user.name, phone: user.phone },
    secret,
  )
  return new Response(JSON.stringify({ user: publicUser(user), token }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token) },
  })
})

// ── Sesi sekarang ────────────────────────────────────────────────────────
authRoutes.get('/t/:slug/auth/me', resolveTenant, requireAuth, async (c) => {
  const session = c.get('session')
  const tenant = c.get('tenant')
  const db = getDb()
  const user = (await db.select().from(users).where(eq(users.id, session.uid)).limit(1))[0]
  if (!user) return c.json({ error: 'User tidak ditemukan' }, 404)
  return c.json({ user: publicUser(user), tenant: publicTenant(tenant), onboardingDone: !!tenant.disclaimerText })
})

authRoutes.post('/logout', async (c) => {
  return c.json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } })
})

authRoutes.post('/t/:slug/auth/change-pin', resolveTenant, requireAuth, async (c) => {
  const body = z
    .object({ oldPin: z.string().min(4).max(8), newPin: z.string().regex(PIN_RE) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Format PIN tidak valid' }, 400)
  const user = c.get('dbUser')
  const ok = await verifyPin(body.data.oldPin, user.pinHash, user.phone, envOf(c).PIN_SALT)
  if (!ok) return c.json({ error: 'PIN lama salah' }, 400)
  const pinHash = await hashPin(body.data.newPin, user.phone, envOf(c).PIN_SALT)
  await getDb().update(users).set({ pinHash }).where(eq(users.id, user.id))
  return c.json({ ok: true })
})

function publicTenant(t: typeof tenants.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    city: t.city,
    logoUrl: t.logoUrl,
    whatsapp: t.whatsapp,
    googleMapsReviewUrl: t.googleMapsReviewUrl,
    plan: t.plan,
    itemLabel: t.itemLabel,
    itemLabelPlural: t.itemLabelPlural,
    requirePickupProof: t.requirePickupProof,
  }
}

function publicUser(u: typeof users.$inferSelect) {
  return { id: u.id, name: u.name, phone: u.phone, role: u.role, lastLoginAt: u.lastLoginAt }
}
