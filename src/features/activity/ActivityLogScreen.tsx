import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../../components/Button'
import type { AuditEntry, RejectedSyncAction, User } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'

const csvCell = (value: string) => {
  const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replaceAll('"', '""')}"`
}

export function ActivityLogScreen() {
  const repository = useInventoryRepository()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [rejectedActions, setRejectedActions] = useState<RejectedSyncAction[]>([])
  const [staffId, setStaffId] = useState('all')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void Promise.all([
      repository.listAuditLog(),
      repository.listUsers(),
      repository.listRejectedActions?.() ?? Promise.resolve([]),
    ])
      .then(([log, accounts, rejected]) => {
        setEntries(log)
        setUsers(accounts)
        setRejectedActions(rejected)
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Unable to load the activity log.'))
  }, [repository])

  const actions = useMemo(() => [...new Set(entries.map((entry) => entry.action))].sort(), [entries])
  const filtered = useMemo(() => entries.filter((entry) => {
    const day = entry.createdAt.slice(0, 10)
    return (staffId === 'all' || entry.userId === staffId) &&
      (action === 'all' || entry.action === action) &&
      (!from || day >= from) && (!to || day <= to)
  }), [action, entries, from, staffId, to])

  const exportLog = () => {
    const columns = ['Timestamp', 'User', 'Role', 'Action', 'Record', 'Before', 'After']
    const rows = filtered.map((entry) => [
      entry.createdAt, entry.userName, entry.userRole, entry.action, entry.what, entry.oldValue, entry.newValue,
    ])
    rows.push(...rejectedActions.map((entry) => [
      entry.createdAt,
      entry.userName,
      'unknown',
      'Sync action rejected',
      entry.actionType,
      '',
      entry.reason,
    ]))
    const csv = [columns, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `dqueens-activity-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 pb-20">
      <header className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Owner controls</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Activity log</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Sensitive changes are recorded as append-only events.</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {rejectedActions.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h3 className="text-sm font-semibold">Rejected offline changes · {rejectedActions.length}</h3>
          <p className="text-xs">These actions were retained and require owner review. They have not been silently discarded.</p>
          <ul className="space-y-2">
            {rejectedActions.map((entry) => (
              <li key={entry.clientUuid} className="rounded-xl border border-amber-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{entry.userName} · {entry.actionType}</span>
                  <time className="text-xs" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
                <p className="mt-1 break-words text-xs">{entry.reason}</p>
                <p className="mt-1 font-mono text-[10px]">Device {entry.deviceId} · {entry.clientUuid}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-3">
        <label className="text-xs text-[var(--muted)]">Staff
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-2 text-sm text-[var(--text-color)]">
            <option value="all">Everyone</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--muted)]">Action
          <select value={action} onChange={(event) => setAction(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-2 text-sm text-[var(--text-color)]">
            <option value="all">All actions</option>
            {actions.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--muted)]">From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-2 text-sm text-[var(--text-color)]" />
        </label>
        <label className="text-xs text-[var(--muted)]">To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-2 text-sm text-[var(--text-color)]" />
        </label>
        <Button variant="secondary" fullWidth onClick={exportLog} disabled={filtered.length === 0} className="col-span-2">
          <Download size={16} className="mr-2" />           Export {filtered.length + rejectedActions.length} entr{filtered.length + rejectedActions.length === 1 ? 'y' : 'ies'} as CSV
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No activity matches these filters.</div>
      ) : (
        <ol className="space-y-2">
          {filtered.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{entry.action} · {entry.what}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{entry.userName} · {entry.userRole}</p>
                </div>
                <time className="shrink-0 text-right text-xs text-[var(--muted)]" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
              </div>
              {(entry.oldValue || entry.newValue) && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-color)] pt-3 text-xs">
                  <p><span className="block text-[var(--muted)]">Before</span><span className="break-words">{entry.oldValue}</span></p>
                  <p><span className="block text-[var(--muted)]">After</span><span className="break-words">{entry.newValue}</span></p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
