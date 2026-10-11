import { Minus, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Tile } from '../../components/Tile'
import { formatNaira } from '../../domain/money'
import type { Item, SaleLine, User } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'

type CartEntry = { item: Item; pricePointId: string; quantity: number }

export function QuickSaleScreen({ user, onSaleRecorded }: { user: User; onSaleRecorded: (message: string) => void }) {
  const repository = useInventoryRepository()
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPricePoint, setSelectedPricePoint] = useState<Record<string, string>>({})
  const [cart, setCart] = useState<Record<string, CartEntry>>({})
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({})
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([repository.listItems(), repository.listCategories(), repository.getStockLevels()])
      .then(([itemsList, categoriesList, levels]) => {
        setItems(itemsList)
        setCategories(categoriesList)
        setStockLevels(Object.fromEntries(levels.map((level) => [level.itemId, level.quantity])))
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Unable to load items.'))
  }, [repository])

  const visibleItems = useMemo(
    () => items.filter((item) => !item.archived).filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory
      return matchesCategory && item.name.toLowerCase().includes(search.toLowerCase())
    }),
    [items, search, selectedCategory],
  )
  const cartEntries = Object.values(cart)
  const maxQuantity = (item: Item, pricePointId: string) => {
    if (!item.trackStock) return Number.MAX_SAFE_INTEGER
    const point = item.pricePoints.find((option) => option.id === pricePointId)
    return point ? Math.floor((stockLevels[item.id] ?? 0) / point.baseUnitsUsed) : 0
  }
  const hasInvalidQuantity = cartEntries.some((entry) => {
    const draft = quantityDrafts[entry.item.id]
    if (draft === undefined || draft === '') return draft === ''
    const quantity = Number(draft)
    return !Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity(entry.item, entry.pricePointId)
  })
  const orderTotal = cartEntries.reduce((sum, entry) => {
    const point = entry.item.pricePoints.find((option) => option.id === entry.pricePointId)
    return sum + entry.quantity * (point?.priceKobo ?? 0)
  }, 0)
  const itemCount = cartEntries.reduce((count, entry) => count + entry.quantity, 0)

  const addItem = (item: Item) => {
    const pricePointId = selectedPricePoint[item.id] ?? item.pricePoints[0]?.id
    if (!pricePointId) {
      setError(`${item.name} does not have a sale price.`)
      return
    }
    const current = cart[item.id]
    const quantity = current?.pricePointId === pricePointId ? current.quantity : 0
    if (quantity + 1 > maxQuantity(item, pricePointId)) {
      setError(`Only ${stockLevels[item.id] ?? 0} ${item.baseUnit}${(stockLevels[item.id] ?? 0) === 1 ? '' : 's'} available for ${item.name}.`)
      return
    }
    setError('')
    setCart((entries) => ({
      ...entries,
      [item.id]: { item, pricePointId, quantity: quantity + 1 },
    }))
  }

  const setQuantity = (itemId: string, quantity: number) => {
    const entry = cart[itemId]
    if (!entry) return
    if (quantity < 1) {
      setCart((entries) => {
        const next = { ...entries }
        delete next[itemId]
        return next
      })
      setQuantityDrafts((current) => {
        const next = { ...current }
        delete next[itemId]
        return next
      })
      return
    }
    if (!Number.isInteger(quantity) || quantity > maxQuantity(entry.item, entry.pricePointId)) {
      setError(`Quantity exceeds available stock for ${entry.item.name}.`)
      return
    }
    setError('')
    setCart((entries) => ({ ...entries, [itemId]: { ...entry, quantity } }))
    setQuantityDrafts((current) => ({ ...current, [itemId]: String(quantity) }))
  }

  const changePricePoint = (item: Item, pricePointId: string) => {
    if (maxQuantity(item, pricePointId) < 1) {
      setError(`There is not enough stock for the selected ${item.pricePoints.find((point) => point.id === pricePointId)?.label ?? 'unit'}.`)
      return
    }
    setSelectedPricePoint((current) => ({ ...current, [item.id]: pricePointId }))
    if (cart[item.id]) {
      setCart((current) => ({ ...current, [item.id]: { item, pricePointId, quantity: 1 } }))
      setQuantityDrafts((current) => ({ ...current, [item.id]: '1' }))
    }
  }

  const handleConfirmSale = async () => {
    if (cartEntries.length === 0) return
    setBusy(true)
    setError('')
    try {
      const saleLines: SaleLine[] = cartEntries.map((entry) => {
        const point = entry.item.pricePoints.find((option) => option.id === entry.pricePointId)
        if (!point) throw new Error(`Select a valid price for ${entry.item.name}.`)
        return {
          itemId: entry.item.id,
          itemName: entry.item.name,
          pricePointId: point.id,
          pricePointLabel: point.label,
          quantity: entry.quantity,
          unitPriceKobo: point.priceKobo,
          baseUnitsDeducted: point.baseUnitsUsed,
          totalKobo: entry.quantity * point.priceKobo,
        }
      })
      await repository.recordSale({ staffId: user.id, lines: saleLines, status: 'waiting' })
      setCart({})
      onSaleRecorded(`Sale confirmed · ${formatNaira(orderTotal)}`)
      void repository.getStockLevels()
        .then((levels) => setStockLevels(Object.fromEntries(levels.map((level) => [level.itemId, level.quantity]))))
        .catch(() => setError('Sale confirmed, but stock levels could not be refreshed.'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to confirm this sale.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-40">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">Quick sale</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Create an order</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Items remain pending until you confirm the sale.</p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] px-3 py-3">
        <Search size={18} className="text-[var(--muted)]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full border-0 bg-transparent text-base text-[var(--text-color)] outline-none placeholder:text-[var(--muted)]"
          placeholder="Search items"
          aria-label="Search stock items"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>All</Chip>
        {categories.map((category) => (
          <Chip key={category.id} active={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)}>
            {category.name}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {visibleItems.map((item) => {
          const pricePointId = selectedPricePoint[item.id] ?? item.pricePoints[0]?.id ?? ''
          const pricePoint = item.pricePoints.find((point) => point.id === pricePointId) ?? item.pricePoints[0]
          const available = stockLevels[item.id] ?? 0
          const canAdd = !item.trackStock || (pricePoint !== undefined && available >= pricePoint.baseUnitsUsed)
          return (
            <div key={item.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-2">
              <Tile
                title={item.name}
                subtitle={pricePoint ? formatNaira(pricePoint.priceKobo) : 'Price not set'}
                image={item.photo}
                badge={cart[item.id] ? String(cart[item.id].quantity) : undefined}
                onClick={() => addItem(item)}
              />
              <div className="mt-3 space-y-2">
                {item.pricePoints.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {item.pricePoints.map((point) => (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => changePricePoint(item, point.id)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium ${
                          pricePointId === point.id ? 'border-[var(--text-color)] bg-[var(--text-color)] text-[var(--surface)]' : 'border-[var(--border-color)] text-[var(--text-color)]'
                        }`}
                      >
                        {point.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className={`text-xs ${canAdd ? 'text-[var(--muted)]' : 'font-medium text-red-700'}`}>
                  {item.trackStock ? (available > 0 ? `${available} in stock` : 'Out of stock') : 'Stock not tracked'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {cartEntries.length > 0 && (
        <section aria-label="Pending sale" className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Pending items</h3>
            <button type="button" onClick={() => { setCart({}); setQuantityDrafts({}); setError('') }} className="flex items-center gap-1 text-sm text-[var(--muted)]">
              <X size={16} /> Cancel sale
            </button>
          </div>
          {cartEntries.map((entry) => {
            const point = entry.item.pricePoints.find((option) => option.id === entry.pricePointId)!
            return (
              <div key={entry.item.id} className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] pt-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{point.label} · {formatNaira(point.priceKobo)} each</p>
                  <p className="text-sm font-semibold">{formatNaira(point.priceKobo * entry.quantity)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={`Decrease ${entry.item.name} quantity`} onClick={() => setQuantity(entry.item.id, entry.quantity - 1)} className="rounded-md border border-[var(--border-color)] p-1.5"><Minus size={14} /></button>
                  <input
                    aria-label={`${entry.item.name} quantity`}
                    type="number"
                    min="1"
                    max={maxQuantity(entry.item, entry.pricePointId)}
                    step="1"
                    value={quantityDrafts[entry.item.id] ?? String(entry.quantity)}
                    onChange={(event) => {
                      const value = event.target.value
                      setQuantityDrafts((current) => ({ ...current, [entry.item.id]: value }))
                      if (value !== '') setQuantity(entry.item.id, Number(value))
                    }}
                    onBlur={() => {
                      if (!quantityDrafts[entry.item.id]) setQuantityDrafts((current) => ({ ...current, [entry.item.id]: String(entry.quantity) }))
                    }}
                    className="w-12 rounded-md border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-1 py-1 text-center text-sm"
                  />
                  <button type="button" aria-label={`Increase ${entry.item.name} quantity`} disabled={entry.quantity >= maxQuantity(entry.item, entry.pricePointId)} onClick={() => setQuantity(entry.item.id, entry.quantity + 1)} className="rounded-md border border-[var(--border-color)] p-1.5 disabled:opacity-40"><Plus size={14} /></button>
                  <button type="button" aria-label={`Remove ${entry.item.name}`} onClick={() => setQuantity(entry.item.id, 0)} className="ml-1 rounded-md p-1.5 text-red-700"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md px-4 md:bottom-4 md:left-64 md:right-0 md:max-w-none md:px-8">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)] md:mx-auto md:max-w-5xl md:p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
            <span className="text-base font-semibold">{formatNaira(orderTotal)}</span>
          </div>
          <Button fullWidth onClick={() => void handleConfirmSale()} disabled={cartEntries.length === 0 || busy || hasInvalidQuantity}>
            <ShoppingBag size={17} className="mr-2" /> {busy ? 'Confirming…' : 'Confirm sale'}
          </Button>
        </div>
      </div>
    </div>
  )
}
