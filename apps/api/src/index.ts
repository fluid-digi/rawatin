import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { envOf } from './env'
import { authRoutes } from './routes/auth'
import { onboardingRoutes } from './routes/onboarding'
import { serviceRoutes } from './routes/services'
import { settingsRoutes } from './routes/settings'
import { customerRoutes } from './routes/customers'
import { userRoutes } from './routes/users'
import { orderRoutes } from './routes/orders'
import { resiRoutes } from './routes/resi'
import { labelRoutes } from './routes/labels'
import { reportRoutes } from './routes/reports'
import { dashboardRoutes } from './routes/dashboard'
import { uploadRoutes } from './routes/upload'

export function createApp() {
  const app = new Hono()
  const origin = envOf(app as never)['WEB_ORIGIN'] ?? 'http://localhost:5173'
  app.use(
    '*',
    cors({
      origin: [origin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  app.use('*', logger())

  app.route('/api', authRoutes)
  app.route('/api', onboardingRoutes)
  app.route('/api', serviceRoutes)
  app.route('/api', settingsRoutes)
  app.route('/api', customerRoutes)
  app.route('/api', userRoutes)
  app.route('/api', orderRoutes)
  app.route('/api', resiRoutes)
  app.route('/api', labelRoutes)
  app.route('/api', reportRoutes)
  app.route('/api', dashboardRoutes)
  app.route('/api', uploadRoutes)

  app.get('/api/health', (c) => c.json({ ok: true, name: 'rawatin-api', time: new Date().toISOString() }))

  // Dev saja: sajikan foto lokal di data/uploads (R2 dipakai saat deploy Worker)
  app.get('/uploads/*', async (c) => {
    const isWorker = typeof (globalThis as unknown as { caches?: unknown }).caches !== 'undefined'
    if (isWorker) return c.notFound()
    const { readFile } = await import('node:fs/promises')
    const { join, normalize } = await import('node:path')
    const rel = c.req.path.replace(/^\/uploads\//, '')
    const filePath = normalize(join(process.cwd(), 'data', 'uploads', rel))
    if (!filePath.startsWith(normalize(join(process.cwd(), 'data', 'uploads')))) return c.notFound()
    try {
      const buf = await readFile(filePath)
      return new Response(buf, { headers: { 'Content-Type': mimeFor(rel), 'Cache-Control': 'public, max-age=31536000, immutable' } })
    } catch {
      return c.notFound()
    }
  })
  return app
}

function mimeFor(p: string) {
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

export const app = createApp()
