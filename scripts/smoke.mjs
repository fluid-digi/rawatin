/**
 * Smoke test end-to-end alur MVP Rawatin (PRD §12).
 * Jalankan: node scripts/smoke.mjs  (API harus sudah jalan di :8787)
 */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:8787'

let cookie = ''
let failures = 0

async function api(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
  if (cookie) headers['Cookie'] = cookie
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('json') ? await res.json() : await res.text()
  return { status: res.status, data, headers: res.headers }
}

function check(name, cond, extra = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.error(`  ✗ ${name} ${extra}`)
  }
}

const slug = `smoke-${Math.random().toString(36).slice(2, 8)}`

console.log('── Modul 1: Onboarding ──')
{
  const r = await api('POST', '/api/register', {
    name: 'Dip Clean Smoke',
    slug,
    city: 'Bandung',
    phone: '081234567890',
    pin: '123456',
    whatsapp: '081234567890',
    googleMapsReviewUrl: 'https://g.page/r/abc123/review',
  })
  check('register 201', r.status === 201, JSON.stringify(r.data).slice(0, 200))
  check('6 layanan preset terisi', r.data.token && (await api('GET', `/api/t/${slug}/services`)).data.services.length === 6)
  const login = await api('POST', `/api/t/${slug}/auth/login`, { phone: '081234567890', pin: '999999' })
  check('PIN salah ditolak 401', login.status === 401)
  const ok = await api('POST', `/api/t/${slug}/auth/login`, { phone: '081234567890', pin: '123456' })
  check('login 200', ok.status === 200)
  const me = await api('GET', `/api/t/${slug}/auth/me`)
  check('me → owner + tenant', me.status === 200 && me.data.user.role === 'owner' && me.data.tenant.slug === slug)
}

let orderCode = ''
let orderId = ''
let itemId = ''
console.log('── Modul 3: Intake (<60 detik) ──')
{
  const svc = (await api('GET', `/api/t/${slug}/services`)).data.services
  const r = await api('POST', `/api/t/${slug}/orders`, {
    clientId: 'offline-abc-1',
    customer: { phone: '089876543210', name: 'Kak Rani' },
    items: [
      {
        brand: 'Nike',
        model: 'AF1',
        color: 'Putih',
        conditionTags: ['Sol menguning'],
        conditionNotes: 'sol belakang sudah lepas',
        quantity: 1,
        serviceIds: [svc[0].id],
        addonIds: [svc.length ? (await api('GET', `/api/t/${slug}/services`)).data.addons[0].id : ''],
      },
    ],
    discount: 5000,
    payment: { amount: 20000, method: 'qris' },
    disclaimerAccepted: true,
    publishConsent: true,
  })
  check('intake 201', r.status === 201, JSON.stringify(r.data).slice(0, 300))
  orderCode = r.data.order?.orderCode ?? ''
  orderId = r.data.order?.id ?? ''
  itemId = r.data.items?.[0]?.id ?? ''
  check('kode order RWT-xxxx', /^RWT-[0-9A-Z]+-[0-9A-Z]{4}$/.test(orderCode), orderCode)
  check('estimasi terisi', !!r.data.estimatedReadyAt)
  check('DP tercatat partial', r.data.order?.paymentStatus === 'partial')
  const dup = await api('POST', `/api/t/${slug}/orders`, { clientId: 'offline-abc-1', customer: { phone: '089876543210', name: 'Kak Rani' }, items: [{ brand: 'X', serviceIds: [svc[0].id] }] })
  check('idempotensi clientId (offline dedup)', dup.status === 200 && dup.data.dedup === true && dup.data.order?.orderCode === orderCode)
}

console.log('── Foto & kompresi path ──')
{
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const up = await api('POST', `/api/t/${slug}/upload?orderId=${orderId}`, png1x1, { headers: { 'x-photo-type': 'before', 'x-order-item-id': itemId, 'Content-Type': 'image/png' } })
  check('upload before 201', up.status === 201, JSON.stringify(up.data).slice(0, 200))
  const upProof = await api('POST', `/api/t/${slug}/upload?orderId=${orderId}`, png1x1, { headers: { 'x-photo-type': 'pickup_proof', 'Content-Type': 'image/png' } })
  check('upload pickup_proof 201', upProof.status === 201)
  globalThis.proofPhotoId = upProof.data?.id
  const detail = await api('GET', `/api/t/${slug}/orders/${orderCode}`)
  check('detail memuat foto & log', detail.data.photos?.length >= 2 && detail.data.statusLogs?.length >= 1)
}

console.log('── Modul 5: Pipeline status ──')
{
  const s1 = await api('POST', `/api/t/${slug}/orders/${orderCode}/status`, { to: 'in_progress' })
  check('received → in_progress', s1.status === 200 && s1.data.status === 'in_progress')
  const s2 = await api('POST', `/api/t/${slug}/orders/${orderCode}/status`, { to: 'finishing' })
  check('in_progress → finishing', s2.status === 200)
  const s3 = await api('POST', `/api/t/${slug}/orders/${orderCode}/status`, { to: 'ready' })
  check('finishing → ready (readyAt terisi)', s3.status === 200 && !!s3.data.readyAt)
  const blocked = await api('POST', `/api/t/${slug}/orders/${orderCode}/status`, { to: 'completed' })
  check('status → completed TERKUNCI (400)', blocked.status === 400, JSON.stringify(blocked.data))
}

console.log('── Modul 11: Konfirmasi pengambilan + bukti foto ──')
{
  const unpaid = await api('POST', `/api/t/${slug}/orders/${orderCode}/pickup`, { photoId: globalThis.proofPhotoId })
  check('belum lunas ditolak dengan sisa', unpaid.status === 400 && /Selesaikan pembayaran/i.test(unpaid.data.error ?? ''), JSON.stringify(unpaid.data))
  const pay = await api('POST', `/api/t/${slug}/orders/${orderCode}/payment`, { amount: 999999, method: 'cash' })
  check('pembayaran > sisa ditolak', pay.status === 400)
  const total = (await api('GET', `/api/t/${slug}/orders/${orderCode}`)).data.order.total
  const paid = (await api('GET', `/api/t/${slug}/orders/${orderCode}`)).data.order.paidAmount
  const settle = await api('POST', `/api/t/${slug}/orders/${orderCode}/payment`, { amount: total - paid, method: 'cash' })
  check('pelunasan → paid', settle.data.paymentStatus === 'paid')
  const noPhoto = await api('POST', `/api/t/${slug}/orders/${orderCode}/pickup`, {})
  check('tanpa foto ditolak (kamera wajib)', noPhoto.status === 400 && /WAJIB/i.test(noPhoto.data.error ?? ''), JSON.stringify(noPhoto.data))
  const pick = await api('POST', `/api/t/${slug}/orders/${orderCode}/pickup`, { photoId: globalThis.proofPhotoId, pickedUpByName: 'Suami Rani' })
  check('pickup 200 → completed', pick.status === 200 && pick.data.order.status === 'completed')
  check('pickedUpByName tercatat', pick.data.order.pickedUpByName === 'Suami Rani')
  const again = await api('POST', `/api/t/${slug}/orders/${orderCode}/pickup`, { photoId: globalThis.proofPhotoId })
  check('pickup kedua ditolak', again.status === 400)
}

console.log('── Order kedua (pelanggan sama) & trigger DB ──')
{
  const svc = (await api('GET', `/api/t/${slug}/services`)).data.services
  const r2 = await api('POST', `/api/t/${slug}/orders`, {
    clientId: 'offline-abc-2',
    customer: { phone: '089876543210', name: 'Kak Rani' },
    items: [{ brand: 'Adidas', model: 'Samba', serviceIds: [svc[1].id] }],
    payment: { amount: 0, method: 'cash' },
    disclaimerAccepted: true,
  })
  check('order kedua 201', r2.status === 201)
  const code2 = r2.data.order?.orderCode ?? ''
  const { execSync } = await import('node:child_process')
  let guarded = false
  try {
    execSync(`psql postgres://rawatin:rawatin@localhost:5432/rawatin -c "UPDATE orders SET status='completed' WHERE order_code='${code2}'"`, { stdio: 'pipe' })
  } catch (e) {
    guarded = String(e.stderr ?? e.message).includes('pickup_proof')
  }
  check('DB trigger memblokir completed tanpa bukti', guarded)
  const streak = await api('GET', `/api/r/${code2}`)
  check('streak pelanggan (cucian ke-2)', streak.data.resi.streak === 2, `streak=${streak.data.resi.streak}`)
}

console.log('── Modul 10: Follow-up review Google Maps ──')
{
  const wrongState = await api('POST', `/api/t/${slug}/orders/${orderCode}/review-sent`, {})
  check('selesai → review bisa diminta', wrongState.status === 200, JSON.stringify(wrongState.data))
  const again = await api('POST', `/api/t/${slug}/orders/${orderCode}/review-sent`, {})
  check('anti-spam: kedua kali ditolak', again.status === 400)
  const reset = await api('POST', `/api/t/${slug}/orders/${orderCode}/review-reset`, {})
  check('owner reset ok', reset.status === 200)
  const resent = await api('POST', `/api/t/${slug}/orders/${orderCode}/review-sent`, {})
  check('reset → bisa minta lagi', resent.status === 200)
  const wa = await api('POST', `/api/t/${slug}/orders/${orderCode}/wa/review_request`, {})
  check('WA review deeplink berisi link Maps + resi', wa.status === 200 && wa.data.url.startsWith('https://wa.me/62') && wa.data.url.includes(encodeURIComponent('https://g.page/r/abc123/review')) && decodeURIComponent(wa.data.url).includes(`/r/${orderCode}`))
}

console.log('── Modul 7: WA deeplink notifikasi ──')
{
  const wa = await api('POST', `/api/t/${slug}/orders/${orderCode}/wa/received`, {})
  check('WA received terbuka terisi', wa.status === 200 && wa.data.url.startsWith('https://wa.me/62'))
  check('template memuat kode order', wa.data.message.includes(orderCode))
  check('template memuat resi url', wa.data.message.includes(`/r/${orderCode}`))
}

console.log('── Modul 12: Share events ──')
{
  const se = await api('POST', `/api/t/${slug}/orders/${orderCode}/share-event`, { actor: 'staff', format: '9:16', method: 'download' })
  check('share event 201', se.status === 201)
}

console.log('── Modul 6: Resi digital publik ──')
{
  const r1 = await api('GET', `/api/r/${orderCode}`)
  check('resi 200 tanpa login', r1.status === 200)
  check('status + progress', r1.data.resi.status === 'completed' && r1.data.resi.statusFlow.at(-1).reached === true)
  check('bukti pengambilan muncul', r1.data.resi.photos.pickupProof.length === 1)
  check('before photo ada', r1.data.resi.photos.beforeCount >= 1)
  check('streak tampil setelah order ke-2', r1.data.resi.streak === 2, `streak=${r1.data.resi.streak}`)
  check('tanpa alamat/WA pelanggan bocor', !JSON.stringify(r1.data).includes('089876543210') && !JSON.stringify(r1.data).includes('Jl.'))
  const r2 = await api('GET', `/api/r/${orderCode}`)
  check('resi_views tercatat', r2.data.resi.views === 2, `views=${r2.data.resi.views}`)
}

console.log('── Modul 4: Label QR PDF ──')
{
  const r = await fetch(`${BASE}/api/t/${slug}/labels.pdf?codes=${orderCode}`, { headers: { Cookie: cookie } })
  const buf = await r.arrayBuffer()
  check('PDF 200 + header', r.status === 200 && r.headers.get('content-type') === 'application/pdf' && buf.byteLength > 1000, `len=${buf.byteLength}`)
}

console.log('── Modul 8/9: Dashboard & laporan ──')
{
  const d = await api('GET', `/api/t/${slug}/dashboard`)
  check('dashboard 200 + compliance 100%', d.status === 200 && d.data.byStatus.completed === 1 && d.data.pickupProofCompliance === 100, JSON.stringify(d.data).slice(0, 200))
  const rep = await api('GET', `/api/t/${slug}/reports`)
  check('laporan omzet > 0', rep.status === 200 && rep.data.omzet > 0, JSON.stringify(rep.data).slice(0, 200))
  check('review terkiri tercatat', rep.data.reviewSent >= 2)
  const csv = await fetch(`${BASE}/api/t/${slug}/reports/export.csv`, { headers: { Cookie: cookie } })
  const text = await csv.text()
  check('CSV export berisi order', csv.status === 200 && text.includes(orderCode))
}

console.log(failures === 0 ? '\n✅ SEMUA SMOKE TEST LULUS' : `\n❌ ${failures} CHECK GAGAL`)
process.exit(failures === 0 ? 0 : 1)
