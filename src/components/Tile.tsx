type TileProps = {
  title: string
  subtitle: string
  image?: string
  badge?: string
  onClick?: () => void
}

import { BottleWine } from 'lucide-react'

export function Tile({ title, subtitle, image, badge, onClick }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full overflow-hidden rounded-[16px] border border-[var(--border-color)] bg-[var(--surface)] text-left shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="relative h-28 overflow-hidden bg-[var(--surface-elevated)]">
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)]">
            <BottleWine size={28} strokeWidth={1.8} />
          </div>
        )}
        {badge ? (
          <span className="absolute right-2 top-2 rounded-full bg-[#111111] px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-[#111111]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <div className="text-[15px] font-semibold text-[var(--text-color)] leading-5">{title}</div>
        <div className="text-sm font-medium text-[var(--muted)]">{subtitle}</div>
      </div>
    </button>
  )
}
