import { Link } from 'react-router-dom'
import { Activity, FileText, MoonStar, ShieldCheck, SunMedium, WifiOff, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import type { AppSettings, SaleRecord, User } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'
import { formatNaira } from '../../domain/money'
import { exportLocalBackup } from '../../data/syncService'

export function SettingsScreen({ user, onToggleTheme, theme }: { user: User; onToggleTheme: () => void; theme: string }) {
  const repository = useInventoryRepository()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [backupError, setBackupError] = useState('')

  useEffect(() => {
    ;(async () => {
      const next = await repository.getSettings()
      setSettings(next)
    })()
  }, [repository])

  const updateSetting = (changes: Partial<AppSettings>) => {
    const next = settings ? { ...settings, ...changes } : changes
    setSettings(next as AppSettings)
    repository.saveSettings(changes)
  }

  const downloadLocalBackup = async () => {
    setBackupMessage('')
    setBackupError('')
    try {
      const backup = await exportLocalBackup()
      const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dqueens-local-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setBackupMessage('Local backup downloaded.')
    } catch (caught) {
      setBackupError(caught instanceof Error ? caught.message : 'Unable to export the local backup.')
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="rounded-[24px] border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Settings</p>
        <h2 className="mt-1 text-[28px] font-extrabold tracking-[-0.04em]">Session</h2>
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-[var(--muted)]">Logged in as</div>
            <div className="font-extrabold">{user.name}</div>
          </div>
          <div className="rounded-full bg-[#111111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white dark:bg-white dark:text-[#111111]">
            {user.role}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">Theme</span>
          <button type="button" onClick={onToggleTheme} className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-3 py-2 text-sm font-semibold">
            {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">Offline mode</span>
          <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-3 py-2 text-sm font-semibold" onClick={() => updateSetting({ offlineMode: !settings?.offlineMode })}>
            {settings?.offlineMode ? <WifiOff size={16} /> : <Wifi size={16} />}
            {settings?.offlineMode ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">Business cutoff</span>
          <span className="text-sm text-[var(--muted)]">{settings?.businessCutoff ?? '23:00'}</span>
        </div>
      </div>

      <Button variant="secondary" fullWidth onClick={() => updateSetting({ offlineMode: true })}>
        Simulate offline sync
      </Button>

      <section className="rounded-[16px] border border-[var(--border-color)] bg-[var(--surface)] p-4">
        <h3 className="mb-2 text-sm font-semibold">Legal and support</h3>
        <div className="divide-y divide-[var(--border-color)]">
          {(user.role === 'owner' || user.role === 'manager') && (
            <Link to="/notifications" className="flex min-h-12 items-center gap-3 text-sm hover:text-[var(--muted)]">
              <ShieldCheck size={17} /> Notifications
            </Link>
          )}
          {user.role === 'owner' && repository.syncNow && (
            <Link to="/activity" className="flex min-h-12 items-center gap-3 text-sm hover:text-[var(--muted)]">
              <Activity size={17} /> Activity log
            </Link>
          )}
          <Link to="/privacy" className="flex min-h-12 items-center gap-3 text-sm hover:text-[var(--muted)]">
            <ShieldCheck size={17} /> Privacy Policy
          </Link>
          <Link to="/terms" className="flex min-h-12 items-center gap-3 text-sm hover:text-[var(--muted)]">
            <FileText size={17} /> Terms of Use
          </Link>
          <Link to="/about" className="flex min-h-12 items-center gap-3 text-sm hover:text-[var(--muted)]">
            About and support
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-[var(--muted)]">D'Queens · Made by Henry Me</p>
      </section>
      {user.role === 'owner' && <SalesRecordManagement user={user} />}
      {user.role === 'owner' && (
        <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-semibold">Local data backup</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Export the records currently stored on this device, including pending and rejected sync actions.</p>
          {backupError && <p role="alert" className="mt-3 text-sm text-red-700">{backupError}</p>}
          {backupMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{backupMessage}</p>}
          <Button className="mt-3" variant="secondary" fullWidth onClick={() => void downloadLocalBackup()}>
            Download local backup
          </Button>
        </section>
      )}
    </div>
  )
}

const csvCell = (value: string | number) => {
  const text = String(value)
  const safeValue = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeValue.replaceAll('"', '""')}"`
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)

function SalesRecordManagement({ user }: { user: User }) {
  const repository = useInventoryRepository()
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [password, setPassword] = useState('')
  const [reportPrepared, setReportPrepared] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void repository.listSales().then(setSales).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Unable to load sales records.')
    })
  }, [repository])

  const includedSales = sales.filter((sale) => {
    const saleDate = sale.createdAt.slice(0, 10)
    return (!from || saleDate >= from) && (!to || saleDate <= to)
  })
  const csv = () => {
    const heading = ['Sale date', 'Sale ID', 'Item', 'Quantity', 'Price point', 'Unit price (kobo)', 'Line total (kobo)', 'Staff', 'Sale total (kobo)']
    const rows = includedSales.flatMap((sale) => sale.lines.map((line) => [
      sale.createdAt, sale.id, line.itemName, line.quantity, line.pricePointLabel,
      line.unitPriceKobo, line.totalKobo, sale.staffName, sale.totalKobo,
    ]))
    return [heading, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  }
  const prepareCsv = () => {
    const url = URL.createObjectURL(new Blob([csv()], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `dqueens-sales-${from || 'all'}-to-${to || 'all'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setReportPrepared(true)
    setMessage(`CSV report prepared for ${includedSales.length} sales.`)
    setError('')
  }
  const printReport = () => {
    const rows = includedSales.flatMap((sale) => sale.lines.map((line) => `<tr><td>${escapeHtml(new Date(sale.createdAt).toLocaleString())}</td><td>${escapeHtml(sale.staffName)}</td><td>${escapeHtml(line.itemName)}</td><td>${line.quantity}</td><td>${escapeHtml(line.pricePointLabel)}</td><td>${escapeHtml(formatNaira(line.unitPriceKobo))}</td><td>${escapeHtml(formatNaira(line.totalKobo))}</td><td>${escapeHtml(formatNaira(sale.totalKobo))}</td><td>${escapeHtml(sale.id)}</td></tr>`)).join('')
    const report = window.open('', '_blank')
    if (!report) {
      setError('The print window was blocked. Allow pop-ups and try again.')
      return
    }
    report.document.write(`<!doctype html><title>D’Queens sales report</title><style>body{font:14px Arial,sans-serif;padding:24px;color:#111}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#eee}@media print{button{display:none}}</style><h1>D’Queens sales report</h1><p>${escapeHtml(from)} to ${escapeHtml(to)} · ${includedSales.length} sales · ${escapeHtml(formatNaira(includedSales.reduce((total, sale) => total + sale.totalKobo, 0)))}</p><table><thead><tr><th>Date</th><th>Staff</th><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>Line total</th><th>Sale total</th><th>Sale ID</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script>`)
    report.document.close()
    setReportPrepared(true)
    setMessage(`Printable report prepared for ${includedSales.length} sales.`)
    setError('')
  }
  const changeRange = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setReportPrepared(false)
    setMessage('')
  }
  const clearRecords = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reportPrepared) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const count = await repository.clearSales({ userId: user.id, password, from, to })
      setSales((current) => current.filter((sale) => {
        const saleDate = sale.createdAt.slice(0, 10)
        return saleDate < from || saleDate > to
      }))
      setPassword('')
      setReportPrepared(false)
      setMessage(`${count} sales records cleared. The activity log and stock movement history were retained.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to clear sales records.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-[var(--surface)] p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-800">Owner only</p>
        <h3 className="mt-1 text-lg font-semibold">Clear Storage</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Sales are kept until you explicitly clear a selected date range. Stock movements and the activity log are retained.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-[var(--muted)]">From
          <input type="date" value={from} onChange={(event) => changeRange(setFrom)(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-2 text-sm text-[var(--text-color)]" />
        </label>
        <label className="text-xs text-[var(--muted)]">To
          <input type="date" value={to} onChange={(event) => changeRange(setTo)(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-2 text-sm text-[var(--text-color)]" />
        </label>
      </div>
      <p className="text-sm">{includedSales.length} sale{includedSales.length === 1 ? '' : 's'} · {formatNaira(includedSales.reduce((total, sale) => total + sale.totalKobo, 0))}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={prepareCsv}>Download CSV</Button>
        <Button variant="secondary" onClick={printReport}>Print / Save PDF</Button>
      </div>
      <form onSubmit={(event) => void clearRecords(event)} className="space-y-3 border-t border-[var(--border-color)] pt-3">
        <label className="block text-sm font-medium" htmlFor="clear-sales-password">Confirm owner password</label>
        <input id="clear-sales-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-3 text-sm text-[var(--text-color)]" />
        <Button type="submit" fullWidth disabled={!reportPrepared || busy} className="bg-red-700 hover:bg-red-800">
          {busy ? 'Clearing…' : `Clear ${includedSales.length} sales records`}
        </Button>
        {!reportPrepared && <p className="text-xs text-[var(--muted)]">Download the CSV or print the report before clearing records.</p>}
      </form>
    </section>
  )
}
