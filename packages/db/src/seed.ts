import 'dotenv/config'
import { createDb } from './client'
import * as schema from './schema'

/**
 * Preset 6 layanan standar — dimuat saat onboarding (Modul 1 langkah 2).
 * Harga/durasi default menyesuaikan vertikal; owner bisa edit.
 * Data ini adalah DATA (database), bukan string hard-coded di kode.
 */
export const DEFAULT_SERVICES = [
  {
    name: 'Deep Clean',
    price: 45000,
    durationDays: 3,
    category: 'Cuci',
    badge: '✨ Glow Up Complete',
  },
  {
    name: 'Fast Clean',
    price: 25000,
    durationDays: 1,
    category: 'Cuci',
    badge: '🧼 Fresh from Fast Clean',
  },
  {
    name: 'Unyellowing',
    price: 70000,
    durationDays: 4,
    category: 'Perawatan',
    badge: '☀️ Unyellowing Success',
  },
  {
    name: 'Repaint',
    price: 150000,
    durationDays: 5,
    category: 'Perbaikan',
    badge: '🎨 Repaint Reborn',
  },
  {
    name: 'Sole Protect',
    price: 30000,
    durationDays: 0,
    category: 'Perawatan',
    badge: '🛡️ Protected & Sealed',
  },
  {
    name: 'Repair (Sol/Resole)',
    price: 100000,
    durationDays: 5,
    category: 'Perbaikan',
    badge: '🔧 Repair Done Right',
  },
] as const

export const DEFAULT_ADDONS = [
  { name: 'Express +25rb', price: 25000, extraDurationDays: 0 },
  { name: 'Antar-Jemput', price: 20000, extraDurationDays: 0 },
] as const

export const DEFAULT_DISCLAIMER =
  'Saya menyatakan bahwa barang yang dititipkan dalam kondisi sebagaimana tercatat (termasuk foto) saat diterima outlet. ' +
  'Kerusakan/kondisi yang sudah tercatat di awal bukan tanggung jawab outlet. ' +
  'Barang yang tidak diambil lebih dari 30 hari dapat dikenakan biaya penitipan sesuai kebijakan outlet.'

export async function seedTenantDefaults(tenantId: string, db = createDb()) {
  const now = new Date()
  const serviceRows = DEFAULT_SERVICES.map((s, i) => ({
    id: crypto.randomUUID(),
    tenantId,
    ...s,
    pricingUnit: 'per_pair' as const,
    isActive: true,
    sortOrder: i,
    createdAt: now,
  }))
  await db.insert(schema.services).values(serviceRows)

  const addonRows = DEFAULT_ADDONS.map((a) => ({
    id: crypto.randomUUID(),
    tenantId,
    ...a,
    isActive: true,
    createdAt: now,
  }))
  await db.insert(schema.addons).values(addonRows)
  return { services: serviceRows, addons: addonRows }
}

async function main() {
  const db = createDb()
  // seedTenantDefaults dipanggil dari route onboarding; file ini hanya helper.
  console.log('Seed helper siap. Gunakan seedTenantDefaults(tenantId) dari API.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
