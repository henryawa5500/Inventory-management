import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW()
  if (!needRefresh && !offlineReady) return null

  return (
    <aside role="status" className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-xl md:bottom-6">
      <p className="text-sm font-medium">
        {needRefresh ? 'An update is available.' : 'D’Queens is ready to work offline.'}
      </p>
      {needRefresh && (
        <button
          type="button"
          className="min-h-10 shrink-0 rounded-lg bg-[var(--text-color)] px-4 text-sm font-semibold text-[var(--surface)]"
          onClick={() => void updateServiceWorker(true)}
        >
          Update
        </button>
      )}
    </aside>
  )
}
