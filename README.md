# Rawatin — Sistem Operasional Barang Titipan (MVP)

> **Sepatu nggak ketuker. Pelanggan nggak nanya-nanya. Komplain ada buktinya.**

Rawatin adalah sistem operasional untuk outlet cuci sepatu: catat kondisi barang saat
masuk lengkap dengan foto, beri label QR anti-ketuker, dan kirim resi digital yang bisa
dilacak sendiri oleh pelanggan. **Bukan** "aplikasi kasir" — kasir hanyalah fitur.

Bangunan ini adalah implementasi **Fase 0 (Build MVP Wedge)** dari PRD v2, monorepo
satu bahasa TypeScript, satu deploy, ringan untuk solo founder.

## Stack (PRD §11)

| Lapis | Pilihan | Catatan |
|---|---|---|
| Frontend | Vite (React 19) + Tailwind v4 + PWA (vite-plugin-pwa) | Mobile-first, bottom navbar, offline queue IndexedDB |
| Backend | Hono.js (Cloudflare Workers / dev Node) | Satu API, tenant via slug path `/api/t/{slug}/*` |
| Database | Neon Postgres (serverless) via `@neondatabase/serverless`; dev lokal via `postgres.js` | Satu driver query (Drizzle), dua transport |
| ORM | Drizzle ORM + drizzle-kit | Migrasi + guard trigger SQL |
| Storage | Cloudflare R2 (S3, egress gratis) — fallback disk lokal saat dev | Foto dikompresi client-side ≤150KB WebP |
| Auth | Custom: WA + PIN (PBKDF2) + session JWT (jose, HttpOnly cookie) | Tanpa vendor, Rp 0 |
| Notifikasi & review | **WA deeplink** `wa.me` (Rp 0, manual, bukan otomatis) | Prinsip #3 pull-before-push |

Struktur URL sesuai PRD §5.2 (subdirectory, bukan subdomain):
`rawatin.id/{slug}/dashboard`, `rawatin.id/{slug}/intake`, `rawatin.id/r/{kode}`
(resi publik), `rawatin.id/daftar`, `rawatin.id/t/{slug}/login` (dev convenience).

## Struktur repo

```
packages/db/        Drizzle schema lengkap (PRD §10) + client + preset seed
apps/api/           Hono API: auth, onboarding, services, orders, status,
                    pickup, review, resi publik, label PDF, laporan, upload, dashboard
apps/web/           React PWA: onboarding wizard, intake <60dtk, papan status,
                    detail order, bukti ambil, share card canvas, resi publik, laporan
scripts/            smoke.mjs (e2e), backup.sh, restore-check.sh, gen-icons.mjs
.github/workflows/  backup.yml (pg_dump harian → R2)
```

## Mulai cepat (dev)

```bash
pnpm install
cp .env.example .env          # isi DATABASE_URL
./scripts/gen-icons.mjs       # buat ikon PWA
pnpm db:generate && pnpm db:migrate
pnpm dev                      # API :8787 + web :5173 (proxy /api)
```

Verifikasi end-to-end (48+ cek, meliputi seluruh alur PRD §12):

```bash
node scripts/smoke.mjs        # jalankan setelah API menyala dengan Postgres lokal
```

## Modul MVP → status

| Modul | Status |
|---|---|
| 1 Onboarding & setup outlet (wa+PIN, wizard 4 langkah, cek slug) | ✅ |
| 2 Katalog layanan konfigurabel (tidak ada string "sepatu" hard-coded) | ✅ |
| 3 ⭐ Intake <60 dtk (kamera → WebP ≤150KB, offline queue, diskon/DP) | ✅ |
| 4 Label QR → PDF A4 (16+ label/lembar, `labels.pdf?codes=...`) | ✅ |
| 5 Papan status (kartu, lanjut ≤2 tap, filter, riwayat/audit) | ✅ (ubah massal: F2) |
| 6 ⭐ Resi digital publik `/r/{kode}` (tanpa login, progress, bukti ambil) | ✅ |
| 7 WA deeplink (6 template diedit per outlet, log anti-spam) | ✅ |
| 8 Pembayaran/piutang & filter barang menganggur | ✅ piutang & umur; biaya penitipan F2 |
| 9 Laporan 5 angka + 3 daftar + export CSV | ✅ |
| 10 ⭐ Review Google Maps (manual, anti-spam, badge, filter, owner reset) | ✅ |
| 11 ⭐ Konfirmasi pengambilan (kamera wajib + trigger DB + compliance) | ✅ |
| 12 ⭐ Share card before/after (canvas client-side, 1:1 & 9:16, web share) | ✅ |
| 13 Multi-user & peran (owner/staff/tech) | ✅ (laporan/reset dibatasi owner) |

## Verifikasi kunci yang sudah terbukti (smoke e2e)

- Order **tidak bisa** `completed` via papan status — hanya lewat alur pengambilan
- DB trigger `rawatin_guard_completed_pickup_proof` memblokir bypass SQL
- Pickup tanpa foto → ditolak (saat `require_pickup_proof` aktif)
- Review request hanya untuk order Selesai, sekali per order (owner bisa reset)
- Resi publik tidak membocorkan WA/alamat pelanggan; `resi_views` & `share_events` tercatat
- Foto terkompresi client-side, `publish_consent` dibawa saat intake

## Deploy

- **API** → Cloudflare Workers: `wrangler deploy`, env via `wrangler secret put`
  (`DATABASE_URL` Neon, `SESSION_SECRET`, `PIN_SALT`, `R2_*`). Lihat `apps/api/wrangler.toml`.
- **Web** → Cloudflare Pages (root `apps/web`, build `pnpm build`, output `dist`):
  `_redirects` SPA sudah disediakan. `APP_PUBLIC_URL` menunjuk ke domain Pages
  agar URL resi benar.
- **Backup** → `scripts/backup.sh` (pg_dump → R2, dijadwalkan via Cloudflare
  Cron / cron VPS / scheduler apa pun) + uji restore bulanan
  `scripts/restore-check.sh` (PRD §11 — backup yang tidak diuji restore = tidak
  ada backup). Neon PITR & branching menyala sejak hari 1 sebagai lapisan utama.
  - Opsional GitHub Actions: `scripts/backup.github-actions.yml` — aktifkan saat
    GitHub App diberi izin "Workflows" (lihat komentar di file template).

## Keputusan scope (sesuai PRD §7 yang TIDAK dibangun di MVP)

Tidak ada: WhatsApp API otomatis (deeplink saja), printer thermal Bluetooth,
storefront publik, generator konten PRO, review otomatis Google, multi-cabang,
aplikasi native, payment gateway (QRIS statis + catat manual), loyalitas formal.
