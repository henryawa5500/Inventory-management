import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { RoleGuard, StaffLayout } from './app/layouts'
import { DEFAULT_THEME } from './app/constants'
import { RepositoryProvider, useInventoryRepository } from './data/repositoryContext'
import { LoginScreen } from './features/auth/LoginScreen'
import { SetupScreen } from './features/auth/SetupScreen'
import { QuickSaleScreen } from './features/sale/QuickSaleScreen'
import { MySalesScreen } from './features/sale/MySalesScreen'
import { StockAvailabilityScreen } from './features/stock/StockAvailabilityScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { StaffAccountsScreen } from './features/accounts/StaffAccountsScreen'
import { NotificationsScreen } from './features/notifications/NotificationsScreen'
import { ActivityLogScreen } from './features/activity/ActivityLogScreen'
import { Toast } from './components/Toast'
import type { User } from './domain/types'
import { LegalInformationScreen, type LegalPage } from './features/legal/LegalInformationScreen'

const THEME_KEY = 'bar-app-theme'

function AppShell() {
  const repository = useInventoryRepository()
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME
  })
  const [toast, setToast] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    ;(async () => {
      const list = await repository.listUsers()
      setShowSetup(list.length === 0)

      const sessionUser = localStorage.getItem('bar-user')
      if (!sessionUser) return
      let userId = sessionUser
      try {
        const parsed = JSON.parse(sessionUser) as string | User
        userId = typeof parsed === 'string' ? parsed : parsed.id
      } catch {
        // Current sessions store a bare user ID; older sessions stored JSON.
      }
      const activeUser = list.find((user) => user.id === userId && user.isActive)
      if (activeUser) {
        localStorage.setItem('bar-user', activeUser.id)
        setLoggedInUser(activeUser)
      } else localStorage.removeItem('bar-user')
    })()
  }, [repository])

  const persistUser = (user: User) => {
    localStorage.setItem('bar-user', user.id)
    setLoggedInUser(user)
  }

  const handleCreateSetup = async (payload: {
    name: string
    businessName: string
    email: string
    username: string
    password: string
    role: 'owner'
  }) => {
    const created = await repository.createUser({
      name: payload.name,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      role: 'owner',
      isActive: true,
    })
    await repository.saveSettings({ businessName: payload.businessName.trim() })
    setShowSetup(false)
    setShowRegistration(false)
    persistUser(created)
  }

  const handleLogin = async (username: string, password: string) => {
    const user = await repository.authenticateUser(username, password)
    if (!user) return false
    persistUser(user)
    return true
  }

  const handleLogout = () => {
    localStorage.removeItem('bar-user')
    setLoggedInUser(null)
  }

  const handleToggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  if (!loggedInUser && legalPage) {
    return (
      <LegalInformationScreen
        page={legalPage}
        onBack={() => setLegalPage(null)}
        onOpenPage={setLegalPage}
      />
    )
  }

  if (!loggedInUser && showRegistration) {
    return (
      <SetupScreen
        onCreate={handleCreateSetup}
        onBackToLogin={() => setShowRegistration(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    )
  }

  if (!loggedInUser && !showSetup) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onOpenRegistration={() => setShowRegistration(true)}
        onOpenLegal={setLegalPage}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    )
  }

  if (showSetup) {
    return <SetupScreen onCreate={handleCreateSetup} theme={theme} onToggleTheme={handleToggleTheme} />
  }

  if (!loggedInUser) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<StaffLayout user={loggedInUser} onLogout={handleLogout} online waitingCount={2} />}>
          <Route path="/sale" element={<QuickSaleScreen user={loggedInUser} onSaleRecorded={setToast} />} />
          <Route path="/sales" element={<MySalesScreen user={loggedInUser} />} />
          <Route path="/stock" element={<StockAvailabilityScreen user={loggedInUser} />} />
          <Route path="/settings" element={<SettingsScreen user={loggedInUser} theme={theme} onToggleTheme={handleToggleTheme} />} />
          <Route
            path="/notifications"
            element={
              <RoleGuard allowedRoles={['owner', 'manager']} currentRole={loggedInUser.role}>
                <NotificationsScreen />
              </RoleGuard>
            }
          />
          <Route
            path="/activity"
            element={
              <RoleGuard allowedRoles={['owner']} currentRole={loggedInUser.role}>
                <ActivityLogScreen />
              </RoleGuard>
            }
          />
          <Route path="/privacy" element={<LegalRoute page="privacy" />} />
          <Route path="/terms" element={<LegalRoute page="terms" />} />
          <Route path="/about" element={<LegalRoute page="about" />} />
          <Route
            path="/staff"
            element={
              <RoleGuard allowedRoles={['owner', 'manager']} currentRole={loggedInUser.role}>
                <StaffAccountsScreen />
              </RoleGuard>
            }
          />
          <Route path="*" element={<Navigate to="/sale" replace />} />
        </Route>
      </Routes>
      <Toast message={toast} visible={Boolean(toast)} onUndo={() => setToast('')} />
    </BrowserRouter>
  )
}

function LegalRoute({ page }: { page: LegalPage }) {
  const navigate = useNavigate()
  return (
    <LegalInformationScreen
      page={page}
      onBack={() => navigate('/settings')}
      onOpenPage={(nextPage) => navigate(`/${nextPage}`)}
    />
  )
}

export default function App() {
  return (
    <RepositoryProvider>
      <AppShell />
    </RepositoryProvider>
  )
}
