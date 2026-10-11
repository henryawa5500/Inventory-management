import { Activity, BarChart3, Bell, LogOut, Package2, Settings, ShoppingBag, UsersRound } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { SyncBadge } from '../components/SyncBadge'
import { APP_CREDIT, APP_NAME } from './constants'
import { useInventoryRepository } from '../data/repositoryContext'

export function StaffLayout({
  user,
  onLogout,
  online,
  waitingCount,
}: {
  user: { name: string; role: string }
  onLogout: () => void
  online: boolean
  waitingCount: number
}) {
  const repository = useInventoryRepository()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const canSeeNotifications = user.role === 'owner' || user.role === 'manager'

  useEffect(() => {
    if (!canSeeNotifications) return
    void repository.listNotifications().then((notifications) => {
      setUnreadCount(location.pathname === '/notifications' ? 0 : notifications.filter((notification) => !notification.readAt).length)
    })
  }, [canSeeNotifications, location.pathname, repository])

  const tabs = [
    { to: '/sale', label: 'Sale', icon: ShoppingBag },
    { to: '/sales', label: 'My Sales', icon: BarChart3 },
    { to: '/stock', label: 'Stock', icon: Package2 },
    { to: '/settings', label: 'Settings', icon: Settings },
    ...(canSeeNotifications ? [{ to: '/notifications', label: 'Alerts', icon: Bell }] : []),
    ...(canSeeNotifications ? [{ to: '/staff', label: 'Staff', icon: UsersRound }] : []),
  ]
  const navigation = [
    ...tabs,
    ...(user.role === 'owner' ? [{ to: '/activity', label: 'Activity log', icon: Activity }] : []),
  ]

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-color)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border-color)] bg-[var(--surface)] px-4 py-6 md:flex">
        <div className="mb-8 border-b border-[var(--border-color)] px-2 pb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{user.role}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">{APP_CREDIT}</p>
        </div>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                  isActive ? 'bg-[var(--app-bg-soft)] text-[var(--text-color)]' : 'text-[var(--muted)] hover:bg-[var(--app-bg-soft)] hover:text-[var(--text-color)]'
                }`
              }
            >
              <Icon size={18} />
              {label}
              {to === '/notifications' && unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--app-bg)]/90 px-4 pb-3 pt-4 backdrop-blur-xl sm:px-6 md:ml-64 md:px-8 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="md:hidden">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{user.role}</p>
            <h1 className="text-2xl font-extrabold tracking-[-0.04em]">{APP_NAME}</h1>
            <p className="text-[10px] text-[var(--muted)]">{APP_CREDIT}</p>
          </div>
          <p className="hidden text-sm font-medium text-[var(--muted)] md:block">{user.name}</p>
          <div className="flex items-center gap-2">
            <SyncBadge online={online} waitingCount={waitingCount} />
            {canSeeNotifications && (
              <NavLink to="/notifications" aria-label={`${unreadCount} unread notifications`} className="relative rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-2 text-[var(--muted)]">
                <Bell size={16} />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-700 px-1 text-center text-[10px] font-semibold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </NavLink>
            )}
            <button type="button" onClick={onLogout} className="rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-2 text-sm text-[var(--muted)]" aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 pb-32 pt-4 sm:px-6 md:ml-64 md:px-8 md:pb-10 md:pt-6">
        <div className="mx-auto w-full max-w-[1440px]">
          <Outlet />
        </div>
      </main>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-color)] bg-[var(--app-bg)]/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg gap-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[10px] font-semibold sm:px-2 sm:text-[11px] ${
                  isActive ? 'bg-[#111111] text-white shadow-sm dark:bg-white dark:text-[#111111]' : 'text-[var(--muted)]'
                }`
              }
            >
              <Icon size={17} />
              <span className="max-w-full truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export function RoleGuard({
  allowedRoles,
  currentRole,
  children,
}: {
  allowedRoles: string[]
  currentRole: string
  children: React.ReactNode
}) {
  if (!allowedRoles.includes(currentRole)) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Access denied for this role.</div>
  }

  return <>{children}</>
}
