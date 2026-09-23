import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.png', 'pwa-512.png', 'favicon.svg'],
      manifest: {
        name: 'Rawatin — Sistem Operasional Outlet Cuci Sepatu',
        short_name: 'Rawatin',
        description: 'Catat kondisi barang, label QR anti-ketuker, resi digital yang bisa dilacak pelanggan.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f766e',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/r\//, /\.pdf$/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/r\/[^/]+$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'resi', expiration: { maxEntries: 60, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
})
