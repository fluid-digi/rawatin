import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export interface Session {
  user: { id: string; name: string; phone: string; role: string; lastLoginAt: string | null }
  tenant: {
    id: string
    name: string
    slug: string
    city: string | null
    logoUrl: string | null
    whatsapp: string | null
    googleMapsReviewUrl: string
    plan: string
    itemLabel: string
    itemLabelPlural: string
    requirePickupProof: boolean
  }
  onboardingDone: boolean
}

interface AuthCtx {
  session: Session | null
  loading: boolean
  login: (slug: string, phone: string, pin: string) => Promise<void>
  logout: () => Promise<void>
  setSession: (s: Session | null) => void
}

const Ctx = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const slug = sessionStorage.getItem('slug')
    if (!slug) {
      setLoading(false)
      return
    }
    api
      .get<Session>(`/t/${slug}/auth/me`)
      .then((s) => {
        setSession(s)
        if (s.tenant.slug) sessionStorage.setItem('slug', s.tenant.slug)
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (slug: string, phone: string, pin: string) => {
    const res = await api.post<{ user: Session['user']; token: string }>(`/t/${slug}/auth/login`, { phone, pin })
    void res
    sessionStorage.setItem('slug', slug)
    const me = await api.get<Session>(`/t/${slug}/auth/me`)
    setSession(me)
  }, [])

  const logout = useCallback(async () => {
    await api.post('/logout').catch(() => undefined)
    sessionStorage.removeItem('slug')
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, loading, login, logout, setSession }), [session, loading, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
