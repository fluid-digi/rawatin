import { useEffect, useState } from 'react'
import { Button } from './ui'

/**
 * Prompt install PWA ("Pasang Rawatin di layar utama HP-mu") — Modul 1.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<Event | null>(null)
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('install-dismissed') === '1')
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    const installed = () => setHidden(true)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  if (hidden || !deferred) return null
  const install = async () => {
    const e = deferred as Event & { prompt: () => Promise<void> }
    await e.prompt()
    setDeferred(null)
    sessionStorage.setItem('install-dismissed', '1')
    setHidden(true)
  }
  return (
    <div className="border-b border-primary-100 bg-primary-50 px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-primary-900">🔌 Pasang Rawatin di layar utama HP-mu.</p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" className="min-h-9 px-2 py-1 text-sm" onClick={() => {
            sessionStorage.setItem('install-dismissed', '1')
            setHidden(true)
          }}>
            Nanti
          </Button>
          <Button className="min-h-9 px-3 py-1 text-sm" onClick={install}>
            Pasang
          </Button>
        </div>
      </div>
    </div>
  )
}
