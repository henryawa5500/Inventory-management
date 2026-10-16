type SyncBadgeProps = {
  online: boolean
  waitingCount?: number
}

export function SyncBadge({ online, waitingCount = 0 }: SyncBadgeProps) {
  const label = !online
    ? 'Offline'
    : waitingCount > 0
      ? `${waitingCount} ${waitingCount === 1 ? 'change' : 'changes'} pending sync`
      : 'Synced'
  return (
    <div aria-live="polite" className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
      {label}
    </div>
  )
}
