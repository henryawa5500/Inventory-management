import { BarChart3, Bell, LogOut, Package2, Settings, ShoppingBag, UsersRound } from 'lucide-react'
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

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[var(--app-bg)] text-[var(--text-color)] shadow-[var(--shadow-soft)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--app-bg)]/90 px-4 pb-3 pt-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">{user.role}</p>
            <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{APP_NAME}</h1>
            <p className="text-[10px] text-[var(--muted)]">{APP_CREDIT}</p>
          </div>
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
      <main className="px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-[var(--border-color)] bg-[var(--app-bg)]/90 px-2 py-2 backdrop-blur-xl">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold ${
                  isActive ? 'bg-[#111111] text-white shadow-sm dark:bg-white dark:text-[#111111]' : 'text-[var(--muted)]'
                }`
              }
            >
              <Icon size={18} />
              {label}
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
