type ChipProps = {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function Chip({ active = false, children, onClick, className = '' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all ${
        active ? 'border-[#111111] bg-[#111111] text-white shadow-sm dark:border-white dark:bg-white dark:text-[#111111]' : 'border-[var(--border-color)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text-color)]'
      } ${className}`}
    >
      {children}
    </button>
  )
}
