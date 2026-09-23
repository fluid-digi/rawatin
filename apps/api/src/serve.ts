import { config } from 'dotenv'
import { serve } from '@hono/node-server'
import { app } from './index'

// Dev lokal: muat .env dari root repo (produksi memakai env Worker/wrangler)
config({ path: new URL('../../../.env', import.meta.url).pathname })

const port = Number(process.env.PORT ?? 8787)
console.log(`[rawatin-api] listening on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
