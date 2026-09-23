import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getDb, orders, orderItems, orderItemServices, customers, tenants, services } from '@rawatin/db'
import { resolveTenant } from '../middleware/tenant'
import { requireAuth } from '../middleware/auth'
import { envOf } from '../env'
import type { Context } from 'hono'
import '../types'

/**
 * Modul 4 — PDF label QR A4 (12–24 label/lembar), sticker A4 murah.
 * Tanpa printer thermal di MVP (Fase 2). Fallback: kode besar di layar.
 */
export const labelRoutes = new Hono()

labelRoutes.get('/t/:slug/labels.pdf', resolveTenant, requireAuth, async (c) => {
  const tenant = c.get('tenant')
  const codes = (c.req.query('codes') ?? '').split(',').filter(Boolean).slice(0, 24)
  if (!codes.length) return c.json({ error: 'Pilih order dulu (param codes)' }, 400)
  const db = getDb()
  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), inArray(orders.orderCode, codes)))
  const orderMap = new Map(orderRows.map((o) => [o.orderCode, o]))
  const custIds = [...new Set(orderRows.map((o) => o.customerId))]
  const custRows = custIds.length ? await db.select().from(customers).where(inArray(customers.id, custIds)) : []
  const custMap = new Map(custRows.map((c) => [c.id, c]))
  const orderIds = orderRows.map((o) => o.id)
  const itemRows = orderIds.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)) : []
  const itemIds = itemRows.map((i) => i.id)
  const svcRows = itemIds.length ? await db.select().from(orderItemServices).where(inArray(orderItemServices.orderItemId, itemIds)) : []
  const labelRows: { order: typeof orders.$inferSelect; cust: typeof customers.$inferSelect; item: typeof orderItems.$inferSelect; svc: typeof orderItemServices.$inferSelect }[] = []
  for (const item of itemRows) {
    const order = orderMap.get(item.orderId) ?? orderRows.find((o) => o.id === item.orderId)
    const cust = order ? custMap.get(order.customerId) : undefined
    if (!order || !cust) continue
    labelRows.push({ order, cust, item, svc: svcRows.filter((s) => s.orderItemId === item.id)[0]! })
  }

  const base = envOf(c).APP_PUBLIC_URL ?? envOf(c).APP_BASE_URL ?? ''
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const PAGE_W = 210
  const PAGE_H = 297
  const COLS = 4
  const ROWS = 6
  const MARGIN = 9
  const cellW = (PAGE_W - MARGIN * 2) / COLS
  const cellH = (PAGE_H - MARGIN * 2) / ROWS

  let index = 0
  for (const row of labelRows) {
    if (index % (COLS * ROWS) === 0) {
      doc.addPage([PAGE_W, PAGE_H])
    }
    const page = doc.getPage(doc.getPageCount() - 1)
    const px = (index % COLS) * cellW + MARGIN
    const pyTop = PAGE_H - MARGIN - Math.floor(index / COLS) * cellH
    const qr = await QRCode.toDataURL(`${base.replace(/\/$/, '')}/r/${row.order.orderCode}`, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    const qrImg = await doc.embedPng(Buffer.from(qr.split(',')[1]!, 'base64'))
    const qrSize = cellH - 4
    page.drawImage(qrImg, { x: px + 1, y: pyTop + 1, width: qrSize, height: qrSize })
    const tx = px + qrSize + 3
    const tw = cellW - qrSize - 5
    let ty = pyTop + cellH - 3
    const line = (text: string, bold = false, size = 7) => {
      const f = bold ? fontBold : font
      page.drawText(text.slice(0, 40), { x: tx, y: ty, size, font: f, color: rgb(0.05, 0.09, 0.15), maxWidth: tw })
      ty -= size + 1.4
    }
    line(row.order.orderCode, true, 9)
    line(`${row.cust.name ?? ''} · ${row.cust.phone ?? ''}`)
    line(`${[row.item.brand, row.item.model].filter(Boolean).join(' ') || '-'} ${row.item.color ?? ''}`.trim())
    line(row.svc ? row.svc.serviceName : '')
    const order = row.order as typeof orders.$inferSelect
    const item = row.item as typeof orderItems.$inferSelect
    line(`${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(order.receivedAt)} · item ke-${(item.sortOrder ?? 0) + 1}/${item.quantity}`)
    line(tenant.name)
    index++
  }

  const bytes = await doc.save()
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="label-${tenant.slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
})
