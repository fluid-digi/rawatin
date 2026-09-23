import type { Context } from 'hono'

/**
 * Baca env dari binding Worker (c.env) atau process.env (dev lokal).
 */
export function envOf(c: Context): Record<string, string | undefined> {
  const worker = (c as unknown as { env?: Record<string, string> }).env
  return { ...(worker ?? {}), ...process.env }
}

export type Env = ReturnType<typeof envOf>
