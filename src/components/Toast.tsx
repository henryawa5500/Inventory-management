type ToastProps = {
  message: string
  onUndo?: () => void
  visible: boolean
}

export function Toast({ message, onUndo, visible }: ToastProps) {
  if (!visible) return null

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center">
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-4 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-soft">
        <span>{message}</span>
        {onUndo ? (
          <button type="button" onClick={onUndo} className="font-semibold text-white underline underline-offset-4">
            Undo
          </button>
        ) : null}
      </div>
    </div>
  )
}
