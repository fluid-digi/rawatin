import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './store/auth'
import { App } from './App'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { offlineQueue } from './lib/offline-queue'
import { api } from './lib/api'

registerSW({ immediate: true })

// Sinkron antrean offline saat koneksi pulih
window.addEventListener('online', () => {
  const slug = sessionStorage.getItem('slug')
  if (slug) offlineQueue.syncAll()
})
window.addEventListener('load', async () => {
  if (navigator.onLine) {
    const slug = sessionStorage.getItem('slug')
    if (slug) {
      try {
        await api.get<any>(`/t/${slug}/auth/me`)
        if (navigator.onLine) offlineQueue.syncAll()
      } catch {
        /* belum login / masih offline */
      }
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
