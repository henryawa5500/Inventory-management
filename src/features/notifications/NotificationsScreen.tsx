import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import type { AppNotification } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'

export function NotificationsScreen() {
  const repository = useInventoryRepository()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void repository.listNotifications()
      .then(async (entries) => {
        setNotifications(entries)
        if (entries.some((entry) => !entry.readAt)) {
          await repository.markNotificationsRead()
          setNotifications((current) => current.map((entry) => entry.readAt ? entry : { ...entry, readAt: new Date().toISOString() }))
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Unable to load notifications.'))
  }, [repository])

  return (
    <div className="space-y-4 pb-20">
      <header className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Updates</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Notifications</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Inventory and sales changes for your team.</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No notifications yet.</div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((entry) => (
            <li key={entry.id} className="flex gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
              <Bell size={17} className="mt-0.5 shrink-0 text-[var(--muted)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{entry.action}: {entry.what}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{entry.userName} · {entry.userRole}</p>
                <time className="mt-1 block text-xs text-[var(--muted)]" dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
              {entry.readAt && <Check size={16} aria-label="Read" className="text-[var(--muted)]" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
