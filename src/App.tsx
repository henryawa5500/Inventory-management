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
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import type { User } from './domain/types'
import { LegalInformationScreen, type LegalPage } from './features/legal/LegalInformationScreen'
import {
  getPendingCount,
  getRejectedCount,
  initializeOfflineStorage,
} from './data/syncService'
import { logoutOfflineSession } from './data/offlineRepository'

const THEME_KEY = 'bar-app-theme'

function AppShell() {
  const repository = useInventoryRepository()
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [ownerRegistrationAvailable, setOwnerRegistrationAvailable] = useState(false)
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null)
  const [startupComplete, setStartupComplete] = useState(false)
  const [startupError, setStartupError] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [waitingCount, setWaitingCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
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
    let cancelled = false
    void (async () => {
      try {
        if (repository.syncNow) {
          await initializeOfflineStorage()
          if (navigator.onLine && localStorage.getItem('bar-user')) {
            try {
              await repository.syncNow()
              await initializeOfflineStorage()
            } catch (error) {
              setStartupError(error instanceof Error ? error.message : 'Unable to sync with the server.')
            }
          }
        }
        const users = await repository.listUsers()
        const sessionUser = localStorage.getItem('bar-user')
        const sessionId = sessionUser?.startsWith('{')
          ? (() => {
              try {
                const parsed = JSON.parse(sessionUser) as string | User
                return typeof parsed === 'string' ? parsed : parsed.id
              } catch {
                return sessionUser
              }
            })()
          : sessionUser
        const sessionUntil = Number(localStorage.getItem('dqueens-session-until') ?? 0)
        const sessionIsValid = !repository.syncNow || navigator.onLine || (sessionUntil > 0 && Date.now() < sessionUntil)
        const activeUser = sessionIsValid ? users.find((user) => user.id === sessionId && user.isActive) : undefined
        if (activeUser) {
          localStorage.setItem('bar-user', activeUser.id)
          if (!cancelled) setLoggedInUser(activeUser)
          return
        }
        localStorage.removeItem('bar-user')
        const ownerExists = repository.syncNow ? true : await repository.getSetupStatus()
        if (!cancelled) {
          setOwnerRegistrationAvailable(Boolean(repository.syncNow) || !ownerExists)
          setShowSetup(!repository.syncNow && !ownerExists)
        }
      } catch (error) {
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : 'Unable to load the application.')
          setShowSetup(false)
        }
      } finally {
        if (!cancelled) setStartupComplete(true)
      }
    })()
    return () => { cancelled = true }
  }, [repository])

  useEffect(() => {
    let active = true
    const refreshCounts = async () => {
      if (!repository.syncNow) return
      const [pending, rejected] = await Promise.all([getPendingCount(), getRejectedCount()])
      if (!active) return
      setWaitingCount(pending)
      setRejectedCount(rejected)
    }
    const runSync = () => {
      setOnline(navigator.onLine)
      void refreshCounts()
      if (navigator.onLine && repository.syncNow) {
        setSyncing(true)
        void repository.syncNow().catch((error: unknown) => {
          setToast(error instanceof Error ? error.message : 'Sync could not complete.')
        }).finally(() => setSyncing(false))
      }
    }
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ pendingCount: number; rejectedCount: number; online: boolean }>).detail
      setWaitingCount(detail.pendingCount)
      setRejectedCount(detail.rejectedCount)
      setOnline(detail.online)
    }
    const handleRevoked = () => {
      setLoggedInUser(null)
      setShowSetup(false)
      setStartupError('This account was deactivated. Contact the owner to restore access.')
    }
    const handleReauth = () => {
      setLoggedInUser(null)
      setStartupError('Your session expired. Sign in again while connected to the internet.')
    }
    const handleSyncError = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string }>).detail
      setToast(detail.message)
    }
    window.addEventListener('online', runSync)
    window.addEventListener('offline', runSync)
    window.addEventListener('dq:sync-state', handleStatus)
    window.addEventListener('dq:session-revoked', handleRevoked)
    window.addEventListener('dq:reauth-required', handleReauth)
    window.addEventListener('dq:sync-error', handleSyncError)
    const interval = window.setInterval(() => {
      if (navigator.onLine && repository.syncNow) runSync()
    }, 30_000)
    void refreshCounts()
    return () => {
      active = false
      window.removeEventListener('online', runSync)
      window.removeEventListener('offline', runSync)
      window.removeEventListener('dq:sync-state', handleStatus)
      window.removeEventListener('dq:session-revoked', handleRevoked)
      window.removeEventListener('dq:reauth-required', handleReauth)
      window.removeEventListener('dq:sync-error', handleSyncError)
      window.clearInterval(interval)
    }
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
      businessName: payload.businessName,
      email: payload.email,
      username: payload.username,
      password: payload.password,
      role: 'owner',
      isActive: true,
    })
    if (!repository.syncNow) {
      await repository.saveSettings({ businessName: payload.businessName.trim() })
    }
    setOwnerRegistrationAvailable(Boolean(repository.syncNow))
    setShowSetup(false)
    setStartupError('')
    persistUser(created)
  }

  const handleLogin = async (username: string, password: string) => {
    const user = await repository.authenticateUser(username, password)
    if (!user) return false
    setStartupError('')
    persistUser(user)
    return true
  }

  const handleLogout = async () => {
    if (repository.syncNow) {
      const pending = await getPendingCount()
      const rejected = await getRejectedCount()
      if (pending > 0) {
        const shouldSync = window.confirm(`${pending} change${pending === 1 ? '' : 's'} need to sync before you sign out. Sync now?`)
        if (!shouldSync) return
        try {
          setSyncing(true)
          await repository.syncNow()
        } catch (error) {
          setToast(error instanceof Error ? error.message : 'Sync could not complete.')
          return
        } finally {
          setSyncing(false)
        }
        if (await getPendingCount() > 0) {
          setToast('Some changes are still waiting to sync. Stay signed in and try again.')
          return
        }
      }
      if (rejected > 0 && !window.confirm(`${rejected} rejected change${rejected === 1 ? '' : 's'} will remain on this device for owner review. Sign out anyway?`)) return
      try {
        await logoutOfflineSession(rejected > 0)
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Unable to sign out safely.')
        return
      }
    } else {
      localStorage.removeItem('bar-user')
    }
    setLoggedInUser(null)
  }

  const handleToggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  if (!startupComplete) {
    return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Loading D’Queens…</div>
  }

  if (!loggedInUser && legalPage) {
    return (
      <LegalInformationScreen
        page={legalPage}
        onBack={() => setLegalPage(null)}
        onOpenPage={setLegalPage}
      />
    )
  }

  if (!loggedInUser && !showSetup) {
    return (
      <>
        {startupError && <p role="status" className="fixed inset-x-4 top-4 z-10 mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{startupError}</p>}
        <LoginScreen
          onLogin={handleLogin}
          onCreateAccount={() => setShowSetup(true)}
          onOpenLegal={setLegalPage}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      </>
    )
  }

  if (showSetup) {
    return (
      <SetupScreen
        onCreate={handleCreateSetup}
        onBackToLogin={() => setShowSetup(false)}
        registrationAvailable={ownerRegistrationAvailable}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    )
  }

  if (!loggedInUser) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<StaffLayout
          user={loggedInUser}
          onLogout={handleLogout}
          online={online}
          waitingCount={waitingCount}
          onSync={repository.syncNow ? () => {
            const sync = repository.syncNow
            if (!sync) return
            setSyncing(true)
            void sync().catch((error: unknown) => setToast(error instanceof Error ? error.message : 'Sync could not complete.')).finally(() => setSyncing(false))
          } : undefined}
          syncing={syncing}
          rejectedCount={rejectedCount}
        />}>
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
      <PWAUpdatePrompt />
    </RepositoryProvider>
  )
}
