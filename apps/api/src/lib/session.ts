import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Context } from 'hono'

export const COOKIE_NAME = 'rawatin_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface SessionPayload extends JWTPayload {
  uid: string
  tid: string
  slug: string
  role: string
  name: string
  phone: string
}

function secretOf(secret: string) {
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>, secret: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretOf(secret))
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretOf(secret))
    if (!payload.uid || !payload.tid || !payload.slug || !payload.role) return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export function getSessionToken(c: Context): string | undefined {
  const cookie = c.req.header('cookie') ?? ''
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE_NAME) return decodeURIComponent(v.join('='))
  }
  const bearer = c.req.header('authorization')
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7)
  return undefined
}

export function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
