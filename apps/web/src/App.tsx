import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { IntakePage } from './pages/IntakePage'
import { BoardPage } from './pages/BoardPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { CustomersPage } from './pages/CustomersPage'
import { UsersPage } from './pages/UsersPage'
import { SettingsPage } from './pages/SettingsPage'
import { ResiPage } from './pages/ResiPage'
import { AppShell } from './components/AppShell'
import { FullScreenSpinner } from './components/ui'
import { useOnlineStatus } from './lib/useOnline'

export function App() {
  const { session, loading } = useAuth()
  useOnlineStatus()
  if (loading) return <FullScreenSpinner />

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/daftar" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/t/:slug/login" element={<LoginPage />} />
      <Route path="/r/:code" element={<ResiPage />} />
      <Route
        path="/t/:slug/*"
        element={
          session ? (
            <AppShell>
              <Routes>
                <Route index element={session.onboardingDone ? <DashboardPage /> : <OnboardingPage />} />
                <Route path="intake" element={<IntakePage />} />
                <Route path="board" element={<BoardPage />} />
                <Route path="orders/:code" element={<OrderDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to={`/t/${session.tenant.slug}/`} replace />} />
              </Routes>
            </AppShell>
          ) : (
            <Navigate to={`/t/${location.pathname.split('/')[2]}/login`} replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Landing() {
  const { session } = useAuth()
  if (session) return <Navigate to={`/t/${session.tenant.slug}/`} replace />
  return <RegisterPage />
}
