import { useEffect, useMemo, useState } from 'react'
import { formatNaira } from '../../domain/money'
import type { SaleRecord, User } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'

export function MySalesScreen({ user }: { user: User }) {
  const repository = useInventoryRepository()
  const [sales, setSales] = useState<SaleRecord[]>([])

  useEffect(() => {
    ;(async () => {
      const list = await repository.listSales()
      setSales(list.filter((sale) => sale.staffId === user.id))
    })()
  }, [repository, user.id])

  const total = useMemo(
    () => sales.reduce((sum, sale) => sum + sale.totalKobo, 0),
    [sales],
  )

  return (
    <div className="space-y-4 pb-20">
      <div className="rounded-[24px] border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">My Sales</p>
            <h2 className="mt-1 text-[28px] font-extrabold tracking-[-0.04em]">Today</h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Total</div>
            <div className="text-xl font-extrabold">{formatNaira(total)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            No sales yet today.
          </div>
        ) : (
          sales.map((sale) => (
            <div key={sale.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold text-[var(--text-color)]">
                  {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${sale.status === 'waiting' ? 'bg-amber-100 text-amber-900' : sale.status === 'voided' ? 'bg-red-100 text-red-900' : 'bg-emerald-100 text-emerald-900'}`}>
                  {sale.status === 'waiting' ? 'Waiting to sync' : sale.status === 'voided' ? 'Voided' : 'Synced'}
                </div>
              </div>

              <div className="space-y-1 text-sm text-[var(--muted)]">
                {sale.lines.map((line) => (
                  <div key={`${sale.id}-${line.itemId}`} className="flex justify-between gap-3">
                    <span>
                      {line.itemName} · {line.quantity}x{line.pricePointLabel}
                    </span>
                    <span>{formatNaira(line.totalKobo)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--border-color)] pt-3 text-base font-extrabold">
                <span>Order total</span>
                <span>{formatNaira(sale.totalKobo)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
