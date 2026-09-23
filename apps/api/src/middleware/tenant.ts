import type { Context, Next } from 'hono'
import { getDb, tenants } from '@rawatin/db'
import { eq } from 'drizzle-orm'
import '../types'

/**
 * Resolve tenant dari slug path (/api/t/{slug}/...) dan validasi bahwa
 * sesi milik tenant yang sama. Semua query ter-scope tenant_id.
 */
export async function resolveTenant(c: Context, next: Next) {
  const slug = c.req.param('slug')
  if (!slug) return c.json({ error: 'Slug wajib diisi' }, 400)
  const db = getDb()
  const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
  const tenant = rows[0]
  if (!tenant) return c.json({ error: 'Outlet tidak ditemukan' }, 404)
  c.set('tenant', tenant)
  await next()
}
