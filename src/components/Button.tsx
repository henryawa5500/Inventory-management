export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  fullWidth?: boolean
}) {
  const base = 'inline-flex items-center justify-center rounded-[12px] font-semibold text-[15px] tracking-[-0.01em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50'
  const variants = {
    primary: 'bg-[#111111] text-white border border-[#111111] shadow-[0_8px_18px_rgba(17,17,17,0.12)] hover:bg-[#1a1a1a] dark:bg-white dark:text-[#111111] dark:border-white dark:hover:bg-neutral-200',
    secondary: 'border border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-color)] hover:bg-[var(--surface-elevated)]',
    ghost: 'bg-transparent text-[var(--text-color)] hover:bg-[var(--surface-elevated)]',
  }

  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${props.className ?? ''}`}
      style={{ minHeight: 48 }}
    >
      {children}
    </button>
  )
}
