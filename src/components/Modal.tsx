import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}

export function Modal({ title, onClose, children, labelledBy = 'modal-title' }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = window.requestAnimationFrame(() => {
      const firstInput = dialogRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      const firstControl = firstInput
        ?? dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), [tabindex="0"]')
      firstControl?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )].filter((element) => element.offsetParent !== null)
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border-color)] bg-[var(--surface)] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-color)] p-4 sm:p-5">
          <h2 id={labelledBy} className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close dialog"
            className="shrink-0 rounded-lg border border-[var(--border-color)] p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  )
}
