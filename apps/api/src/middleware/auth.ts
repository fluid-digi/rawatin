import type { Context, Next } from 'hono'
import { getSessionToken, verifySession, type SessionPayload } from '../lib/session'
import { envOf } from '../env'
import { getDb, users } from '@rawatin/db'
import { eq } from 'drizzle-orm'
import '../types'

export interface AuthContext {
  session: SessionPayload
  dbUser: NonNullable<Awaited<ReturnType<typeof loadDbUser>>>
}

async function loadDbUser(session: SessionPayload) {
  const db = getDb()
  const rows = await db.select().from(users).where(eq(users.id, session.uid)).limit(1)
  return rows[0] ?? null
}

export async function requireAuth(c: Context, next: Next) {
  const secret = envOf(c).SESSION_SECRET ?? ''
  const token = getSessionToken(c)
  if (!token || !secret) return c.json({ error: 'Sesi tidak valid — silakan login' }, 401)
  const session = await verifySession(token, secret)
  if (!session) return c.json({ error: 'Sesi kedaluwarsa — silakan login' }, 401)
  const dbUser = await loadDbUser(session)
  if (!dbUser || !dbUser.isActive) return c.json({ error: 'Akun nonaktif' }, 401)
  if (dbUser.tenantId !== session.tid) return c.json({ error: 'Sesi salah tenant' }, 401)
  c.set('session', session)
  c.set('dbUser', dbUser)
  await next()
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('dbUser')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Tidak punya izin untuk aksi ini' }, 403)
    }
    await next()
  }
}
