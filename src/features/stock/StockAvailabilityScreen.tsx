import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, PackagePlus, Pencil, Plus, Search, TriangleAlert, X } from 'lucide-react'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { EmptyState } from '../../components/EmptyState'
import { formatNaira } from '../../domain/money'
import type { Category, Item, StockLevel, User } from '../../domain/types'
import { useInventoryRepository } from '../../data/repositoryContext'

type ItemFormValues = {
  name: string
  categoryId: string
  baseUnit: string
  packSize: string
  costPrice: string
  reorderLevel: string
  priceLabel: string
  salePrice: string
  trackStock: boolean
  photo?: string
}

type StockFormValues = {
  packs: string
  looseUnits: string
  unitCost: string
  supplier: string
  note: string
}

type AdjustmentFormValues = {
  countedQuantity: string
  reason: string
}

const emptyItemForm: ItemFormValues = {
  name: '',
  categoryId: '',
  baseUnit: 'unit',
  packSize: '1',
  costPrice: '',
  reorderLevel: '0',
  priceLabel: 'Unit',
  salePrice: '',
  trackStock: true,
}

const emptyStockForm: StockFormValues = { packs: '0', looseUnits: '', unitCost: '', supplier: '', note: '' }
const inputClass = 'h-[var(--input-height)] w-full rounded-[12px] border border-[var(--border-color)] bg-[var(--app-bg-soft)] px-4 text-base text-[var(--text-color)]'

export function StockAvailabilityScreen({ user }: { user: User }) {
  const repository = useInventoryRepository()
  const canManageInventory = user.role === 'owner' || user.role === 'manager'
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [search, setSearch] = useState('')
  const [showOnlyLow, setShowOnlyLow] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormValues>(emptyItemForm)
  const [stockItem, setStockItem] = useState<Item | null>(null)
  const [stockForm, setStockForm] = useState<StockFormValues>(emptyStockForm)
  const [adjustmentItem, setAdjustmentItem] = useState<Item | null>(null)
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormValues>({ countedQuantity: '', reason: '' })
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshInventory = useCallback(async () => {
    const [itemsList, categoriesList, levels] = await Promise.all([
      repository.listItems(),
      repository.listCategories(),
      repository.getStockLevels(),
    ])
    setItems(itemsList)
    setCategories(categoriesList)
    setStockLevels(levels)
  }, [repository])

  const handleInventoryLoadError = useCallback((caught: unknown) => {
    setError(caught instanceof Error ? caught.message : 'Unable to load inventory.')
  }, [])

  useEffect(() => {
    void refreshInventory().catch(handleInventoryLoadError)
  }, [handleInventoryLoadError, refreshInventory])

  const rows = useMemo(() => {
    const levels = new Map(stockLevels.map((level) => [level.itemId, level]))
    return items
      .filter((item) => showArchived ? item.archived : !item.archived)
      .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
      .filter((item) => !showOnlyLow || (!item.archived && item.trackStock && (levels.get(item.id)?.quantity ?? 0) <= item.reorderLevel))
      .map((item) => ({
        item,
        level: levels.get(item.id) ?? { itemId: item.id, quantity: 0, low: false, negative: false },
      }))
  }, [items, search, showArchived, showOnlyLow, stockLevels])

  const openNewItem = () => {
    setItemFormOpen(true)
    setEditingItem(null)
    setItemForm({ ...emptyItemForm, categoryId: categories[0]?.id ?? '' })
    setStockItem(null)
    setAdjustmentItem(null)
    setError('')
  }

  const openEditItem = (item: Item) => {
    setItemFormOpen(true)
    const pricePoint = item.pricePoints[0]
    setEditingItem(item)
    setItemForm({
      name: item.name,
      categoryId: item.categoryId,
      baseUnit: item.baseUnit,
      packSize: String(item.packSize),
      costPrice: (item.costPriceKobo / 100).toFixed(2),
      reorderLevel: String(item.reorderLevel),
      priceLabel: pricePoint?.label ?? 'Unit',
      salePrice: pricePoint ? (pricePoint.priceKobo / 100).toFixed(2) : '',
      trackStock: item.trackStock,
      photo: item.photo,
    })
    setStockItem(null)
    setAdjustmentItem(null)
    setError('')
  }

  const handleSaveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const category = categories.find((entry) => entry.id === itemForm.categoryId)
      if (!category) throw new Error('Select an inventory category.')
      const salePriceKobo = Math.round(Number(itemForm.salePrice) * 100)
      const saved = await repository.saveItem({
        ...(editingItem ? { id: editingItem.id } : {}),
        name: itemForm.name.trim(),
        categoryId: category.id,
        categoryName: category.name,
        baseUnit: itemForm.baseUnit.trim(),
        packSize: Number(itemForm.packSize),
        trackStock: itemForm.trackStock,
        costPriceKobo: Math.round(Number(itemForm.costPrice) * 100),
        reorderLevel: Number(itemForm.reorderLevel),
        pricePoints: [{
          id: editingItem?.pricePoints[0]?.id ?? `price-${Date.now()}`,
          label: itemForm.priceLabel.trim(),
          priceKobo: salePriceKobo,
          baseUnitsUsed: 1,
        }],
        photo: itemForm.photo,
      }, user.id)
      if (saved.archived) await repository.saveItem({ id: saved.id, archived: false }, user.id)
      await refreshInventory()
      setItemFormOpen(false)
      setEditingItem(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this item.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!stockItem) return
    setError('')
    setBusy(true)
    try {
      const cost = Number(stockForm.unitCost)
      await repository.recordStockIn({
        itemId: stockItem.id,
        crates: Number(stockForm.packs),
        looseUnits: Number(stockForm.looseUnits),
        unitCostKobo: Math.round(cost * 100),
        supplier: stockForm.supplier,
        note: stockForm.note,
        userId: user.id,
      })
      await refreshInventory()
      setStockItem(null)
      setStockForm(emptyStockForm)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record stock intake.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!adjustmentItem) return
    setError('')
    setBusy(true)
    try {
      await repository.recordStockAdjustment({
        itemId: adjustmentItem.id,
        newQuantity: Number(adjustmentForm.countedQuantity),
        reason: adjustmentForm.reason,
        userId: user.id,
      })
      await refreshInventory()
      setAdjustmentItem(null)
      setAdjustmentForm({ countedQuantity: '', reason: '' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to adjust stock.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    setError('')
    try {
      const created = await repository.saveCategory({
        id: `category-${Date.now()}`,
        name,
        sortOrder: categories.length + 1,
      }, user.id)
      await refreshInventory()
      setItemForm((current) => ({ ...current, categoryId: created.id }))
      setNewCategoryName('')
      setAddingCategory(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create category.')
    }
  }

  const handleArchive = async (item: Item) => {
    setError('')
    try {
      if (item.archived) {
        await repository.saveItem({ id: item.id, archived: false }, user.id)
      } else {
        await repository.archiveItem(item.id, user.id)
      }
      await refreshInventory()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this item.')
    }
  }

  const closeForms = () => {
    setItemFormOpen(false)
    setEditingItem(null)
    setStockItem(null)
    setAdjustmentItem(null)
    setAddingCategory(false)
    setError('')
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Inventory</p>
            <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">Stock and items</h2>
            {canManageInventory && <p className="mt-1 text-sm text-[var(--muted)]">Manage products and record deliveries.</p>}
          </div>
          {canManageInventory && !itemFormOpen && !editingItem && !stockItem && !adjustmentItem && (
            <Button type="button" onClick={openNewItem} aria-label="Add inventory item" className="w-12 p-0">
              <Plus size={19} />
            </Button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {canManageInventory && itemFormOpen && (
        <form onSubmit={handleSaveItem} className="space-y-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 xl:max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{editingItem ? 'Edit inventory item' : 'New inventory item'}</h3>
            <button type="button" onClick={closeForms} aria-label="Close item form" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)]"><X size={18} /></button>
          </div>
          <Field label="Item name" id="item-name">
            <input id="item-name" required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} placeholder="e.g. Lager 50cl" className={inputClass} />
          </Field>
          <Field label="Category" id="item-category">
            <select id="item-category" required value={itemForm.categoryId} onChange={(event) => setItemForm({ ...itemForm, categoryId: event.target.value })} className={inputClass}>
              <option value="" disabled>Select a category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {!addingCategory ? (
              <button type="button" onClick={() => setAddingCategory(true)} className="mt-2 text-sm font-medium underline underline-offset-4">Add category</button>
            ) : (
              <div className="mt-2 flex gap-2">
                <input autoFocus value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" className={inputClass} />
                <Button type="button" onClick={() => void handleSaveCategory()}>Add</Button>
              </div>
            )}
          </Field>
          <Field label="Item image" id="item-image">
            <input
              id="item-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={inputClass}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (!file) return
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                  setError('Choose a JPG, PNG or WebP image.')
                  return
                }
                if (file.size > 5 * 1024 * 1024) {
                  setError('Choose an image smaller than 5 MB.')
                  return
                }
                const image = new Image()
                const objectUrl = URL.createObjectURL(file)
                image.onload = () => {
                  URL.revokeObjectURL(objectUrl)
                  const canvas = document.createElement('canvas')
                  const scale = Math.min(1, 800 / Math.max(image.width, image.height))
                  canvas.width = Math.max(1, Math.round(image.width * scale))
                  canvas.height = Math.max(1, Math.round(image.height * scale))
                  const context = canvas.getContext('2d')
                  if (!context) {
                    setError('This image could not be processed.')
                    return
                  }
                  context.drawImage(image, 0, 0, canvas.width, canvas.height)
                  const compressed = canvas.toDataURL('image/webp', 0.78)
                  if (compressed.length > 550_000) {
                    setError('The compressed image is too large. Choose a smaller image.')
                    return
                  }
                  setItemForm((current) => ({ ...current, photo: compressed }))
                  setError('')
                }
                image.onerror = () => {
                  URL.revokeObjectURL(objectUrl)
                  setError('This image could not be opened.')
                }
                image.src = objectUrl
              }}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">JPG, PNG or WebP · up to 5 MB · compressed and stored in this browser only.</p>
            {itemForm.photo && (
              <div className="mt-2 flex items-center gap-3">
                <img src={itemForm.photo} alt="Item preview" className="h-16 w-16 rounded-lg object-cover" />
                <Button type="button" variant="secondary" onClick={() => setItemForm((current) => ({ ...current, photo: undefined }))}>Remove image</Button>
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base unit" id="item-unit">
              <input id="item-unit" required value={itemForm.baseUnit} onChange={(event) => setItemForm({ ...itemForm, baseUnit: event.target.value })} placeholder="bottle" className={inputClass} />
            </Field>
            <Field label="Units per pack" id="item-pack-size">
              <input id="item-pack-size" type="number" min="1" step="1" required value={itemForm.packSize} onChange={(event) => setItemForm({ ...itemForm, packSize: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Cost per base unit (₦)" id="item-cost">
              <input id="item-cost" type="number" min="0" step="0.01" required value={itemForm.costPrice} onChange={(event) => setItemForm({ ...itemForm, costPrice: event.target.value })} placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Low-stock alert threshold" id="item-reorder">
              <input id="item-reorder" type="number" min="0" step="1" required value={itemForm.reorderLevel} onChange={(event) => setItemForm({ ...itemForm, reorderLevel: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Sale price label" id="item-price-label">
              <input id="item-price-label" required value={itemForm.priceLabel} onChange={(event) => setItemForm({ ...itemForm, priceLabel: event.target.value })} placeholder="Bottle" className={inputClass} />
            </Field>
            <Field label="Sale price (₦)" id="item-sale-price">
              <input id="item-sale-price" type="number" min="0" step="0.01" required value={itemForm.salePrice} onChange={(event) => setItemForm({ ...itemForm, salePrice: event.target.value })} placeholder="0.00" className={inputClass} />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={itemForm.trackStock} onChange={(event) => setItemForm({ ...itemForm, trackStock: event.target.checked })} className="h-4 w-4 accent-black" />
            Track stock for this item
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={closeForms}>Cancel</Button>
            <Button type="submit" fullWidth disabled={busy}>{busy ? 'Saving…' : editingItem ? 'Save changes' : 'Add item'}</Button>
          </div>
        </form>
      )}

      {canManageInventory && stockItem && (
        <form onSubmit={handleSaveStock} className="space-y-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 xl:max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Record stock intake</h3>
              <p className="text-sm text-[var(--muted)]">{stockItem.name} · {stockItem.packSize} {stockItem.baseUnit}s per pack</p>
            </div>
            <button type="button" onClick={closeForms} aria-label="Close stock form" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)]"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Packs / crates" id="stock-packs">
              <input id="stock-packs" type="number" min="0" step="1" required value={stockForm.packs} onChange={(event) => setStockForm({ ...stockForm, packs: event.target.value })} className={inputClass} />
            </Field>
            <Field label={`Loose ${stockItem.baseUnit}s`} id="stock-loose">
              <input id="stock-loose" type="number" min="0" step="1" required value={stockForm.looseUnits} onChange={(event) => setStockForm({ ...stockForm, looseUnits: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Unit cost (₦)" id="stock-unit-cost">
              <input id="stock-unit-cost" type="number" min="0" step="0.01" required value={stockForm.unitCost} onChange={(event) => setStockForm({ ...stockForm, unitCost: event.target.value })} placeholder="0.00" className={inputClass} />
            </Field>
            <Field label="Supplier (optional)" id="stock-supplier">
              <input id="stock-supplier" value={stockForm.supplier} onChange={(event) => setStockForm({ ...stockForm, supplier: event.target.value })} placeholder="Supplier name" className={inputClass} />
            </Field>
          </div>
          <Field label="Note (optional)" id="stock-note">
            <input id="stock-note" value={stockForm.note} onChange={(event) => setStockForm({ ...stockForm, note: event.target.value })} placeholder="Invoice or delivery reference" className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={closeForms}>Cancel</Button>
            <Button type="submit" fullWidth disabled={busy}>{busy ? 'Saving…' : 'Save stock intake'}</Button>
          </div>
        </form>
      )}

      {canManageInventory && adjustmentItem && (
        <form onSubmit={handleSaveAdjustment} className="space-y-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--surface)] p-4 xl:max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Adjust stock count</h3>
              <p className="text-sm text-[var(--muted)]">{adjustmentItem.name}</p>
            </div>
            <button type="button" onClick={closeForms} aria-label="Close adjustment form" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)]"><X size={18} /></button>
          </div>
          <Field label={`Physical count (${adjustmentItem.baseUnit})`} id="stock-count">
            <input id="stock-count" type="number" min="0" step="1" required value={adjustmentForm.countedQuantity} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, countedQuantity: event.target.value })} placeholder="Enter the count on hand" className={inputClass} />
          </Field>
          <Field label="Reason for adjustment" id="stock-adjustment-reason">
            <input id="stock-adjustment-reason" required value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })} placeholder="e.g. Physical stock count" className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={closeForms}>Cancel</Button>
            <Button type="submit" fullWidth disabled={busy}>{busy ? 'Saving…' : 'Save adjustment'}</Button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 rounded-[14px] border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 shadow-sm">
        <Search size={18} className="text-[var(--muted)]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 w-full border-0 bg-transparent text-base text-[var(--text-color)] outline-none placeholder:text-[var(--muted)]"
          placeholder="Search inventory"
          aria-label="Search inventory"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!showArchived && <Chip active={showOnlyLow} onClick={() => setShowOnlyLow((value) => !value)}>Low stock only</Chip>}
        {canManageInventory && <Chip active={showArchived} onClick={() => { setShowArchived((value) => !value); setShowOnlyLow(false) }}>Archived items</Chip>}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 ? (
          <EmptyState title={showArchived ? 'No archived items' : 'No inventory items'} body={canManageInventory ? 'Add an item to start managing your inventory.' : 'Try a different filter or search term.'} />
        ) : rows.map(({ item, level }) => (
          <article key={item.id} className="rounded-[16px] border border-[var(--border-color)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-[var(--text-color)]">{item.name}</h3>
                <p className="text-sm text-[var(--muted)]">{item.categoryName}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{item.trackStock ? level.quantity : '—'}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{item.trackStock ? item.baseUnit : 'not tracked'}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {item.archived ? (
                <span className="rounded-full bg-[var(--surface-elevated)] px-2 py-1 font-medium text-[var(--muted)]">Archived</span>
              ) : !item.trackStock ? (
                <span className="rounded-full bg-[var(--surface-elevated)] px-2 py-1 font-medium text-[var(--muted)]">Stock tracking off</span>
              ) : level.negative ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700"><TriangleAlert size={14} /> Negative</span>
              ) : level.low ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 font-semibold text-orange-700">Low · {level.quantity} left</span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">In stock</span>
              )}
              <span className="text-[var(--muted)]">Cost {formatNaira(item.costPriceKobo)}</span>
              {item.pricePoints[0] && <span className="text-[var(--muted)]">Sale {formatNaira(item.pricePoints[0].priceKobo)}</span>}
            </div>

            {canManageInventory && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-color)] pt-3">
                {!item.archived && item.trackStock && (
                  <Button size="small" className="min-w-28 flex-1 px-3 text-center" type="button" variant="secondary" onClick={() => { setStockItem(item); setAdjustmentItem(null); setEditingItem(null); setItemFormOpen(false); setStockForm(emptyStockForm); setError('') }}>
                    <PackagePlus size={16} className="mr-2" /> Add stock
                  </Button>
                )}
                {!item.archived && item.trackStock && (
                  <Button size="small" className="min-w-28 flex-1 px-3 text-center" type="button" variant="secondary" onClick={() => { setAdjustmentItem(item); setStockItem(null); setEditingItem(null); setItemFormOpen(false); setAdjustmentForm({ countedQuantity: String(level.quantity), reason: '' }); setError('') }}>
                    Adjust count
                  </Button>
                )}
                {!item.archived && (
                  <Button size="small" className="min-w-28 flex-1 px-3 text-center" type="button" variant="secondary" onClick={() => openEditItem(item)}>
                    <Pencil size={16} className="mr-2" /> Edit item
                  </Button>
                )}
                <Button size="small" className="min-w-28 flex-1 px-3 text-center" type="button" variant="secondary" onClick={() => void handleArchive(item)}>
                  {item.archived ? <ArchiveRestore size={16} className="mr-2" /> : <Archive size={16} className="mr-2" />}
                  {item.archived ? 'Restore' : 'Archive'}
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
