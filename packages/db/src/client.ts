import 'dotenv/config'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http'
import postgres from 'postgres'
import { drizzle as pgJsDrizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const DEFAULT_URL = 'postgres://postgres:postgres@localhost:5432/rawatin'

let cached: ReturnType<typeof createDb> | null = null

/**
 * Satu pemanggil DB untuk dua runtime:
 * - URL `postgres://...` (non-HTTP) → postgres.js (dev lokal, CLI, script backup)
 * - URL HTTP/Neon → @neondatabase/serverless (Cloudflare Workers)
 * Query builder & schema sama persis — hanya transport yang berbeda.
 */
export function createDb(url: string = process.env.DATABASE_URL ?? DEFAULT_URL) {
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    // Neon HTTP (serverless / Workers)
    neonConfig.fetchConnectionCache = true
    return neonDrizzle(neon(url), { schema })
  }
  const client = postgres(url, { max: 4, prepare: false })
  return pgJsDrizzle(client, { schema })
}

export function getDb() {
  if (!cached) cached = createDb()
  return cached
}

export type Db = ReturnType<typeof createDb>
