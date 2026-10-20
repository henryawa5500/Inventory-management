import type {
  AppNotification,
  AppSettings,
  AuditEntry,
  Item,
  RejectedSyncAction,
  SaleRecord,
  StockLevel,
  StockMovement,
  User,
} from '../domain/types'
import { calculateCartLineTotal, getStockFromMovements, isLowStock } from '../domain/stock'
import { ApiError, apiRequest, clearServerSession } from './apiClient'
import { activateBusinessDatabase, localDatabase, type SyncQueueRecord } from './localDatabase'
import {
  createQueuedAction,
  dispatchSyncState,
  getPendingCount,
  readLocalImage,
  removeLocalImage,
  storeLocalImage,
  syncNow,
} from './syncService'
import type { InventoryRepository } from './repository'

const SESSION_KEY = 'bar-user'
const SESSION_UNTIL_KEY = 'dqueens-session-until'

const DEFAULT_SETTINGS: AppSettings = {
  businessCutoff: '23:00',
  offlineSessionDays: 7,
  theme: 'dark',
  offlineMode: false,
  showSetup: false,
}

function reportBackgroundSync(error: unknown) {
  window.dispatchEvent(new CustomEvent('dq:sync-error', {
    detail: { message: error instanceof Error ? error.message : 'Sync could not complete.' },
  }))
}

function scheduleSync() {
  if (navigator.onLine) void syncNow().catch(reportBackgroundSync)
}

async function currentUser(userId?: string) {
  const id = userId ?? localStorage.getItem(SESSION_KEY)
  if (!id) throw new Error('Sign in to continue.')
  const user = await localDatabase.users.get(id)
  if (!user || !user.isActive) throw new Error('Your local account is unavailable. Connect to the internet and sign in again.')
  return user
}

function describeItem(item: Item) {
  return JSON.stringify({
    name: item.name,
    categoryName: item.categoryName,
    costPriceKobo: item.costPriceKobo,
    pricePoints: item.pricePoints,
    reorderLevel: item.reorderLevel,
    archived: item.archived,
    photo: item.photo ? (item.photo.startsWith('data:') ? 'Image set' : 'Image URL set') : 'No image',
  })
}

async function saveAudit(
  user: User,
  action: string,
  what: string,
  oldValue = '',
  newValue = '',
  localId?: string,
) {
  const entry: AuditEntry = {
    id: localId ?? `local-${crypto.randomUUID()}`,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action,
    what,
    oldValue,
    newValue,
    createdAt: new Date().toISOString(),
  }
  await localDatabase.activityLog.put(entry)
  return entry
}

function saveNotification(user: User, action: string, what: string, actionId: string, index = 0): AppNotification {
  return {
    id: `pending-${actionId}-${index}`,
    auditEntryId: `pending-${actionId}`,
    action,
    what,
    userName: user.name,
    userRole: user.role,
    createdAt: new Date().toISOString(),
  }
}

function makeAction(
  userId: string,
  type: SyncQueueRecord['type'],
  payload: Record<string, unknown>,
  options: { attachmentItemId?: string; clientUuid?: string } = {},
) {
  return createQueuedAction(userId, type, payload, options)
}

async function hydrateItem(item: Item): Promise<Item> {
  const photo = await readLocalImage(item.id)
  return photo ? { ...item, photo } : item
}

async function requireInventoryManager(userId: string) {
  const user = await currentUser(userId)
  if (!['owner', 'manager'].includes(user.role)) throw new Error('Only owners and managers can manage inventory.')
  return user
}

async function getMovementTotals() {
  const movements = await localDatabase.stockEvents.toArray()
  return new Map<string, number>(
    [...new Set(movements.map((movement) => movement.itemId))]
      .map((itemId) => [itemId, getStockFromMovements(movements.filter((movement) => movement.itemId === itemId))]),
  )
}

async function dataUrlToBlob(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('Choose a valid JPG, PNG or WebP image.')
  const binary = atob(match[2])
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const blob = new Blob([bytes], { type: match[1] })
  if (blob.size > 2 * 1024 * 1024) throw new Error('Compressed item images must be 2 MB or smaller.')
  return { blob, contentType: match[1] }
}

export const offlineRepository: InventoryRepository & { syncNow: () => Promise<void> } = {
  async listItems() {
    const items = await localDatabase.items.toArray()
    return await Promise.all(items.map(hydrateItem))
  },

  async getItem(id) {
    const item = await localDatabase.items.get(id)
    return item ? await hydrateItem(item) : undefined
  },

  async saveItem(changes, userId) {
    const actor = await requireInventoryManager(userId)
    const itemId = changes.id ?? crypto.randomUUID()
    const existing = await localDatabase.items.get(itemId)
    const item: Item = {
      id: itemId,
      name: changes.name ?? existing?.name ?? 'New item',
      categoryId: changes.categoryId ?? existing?.categoryId ?? 'others',
      categoryName: changes.categoryName ?? existing?.categoryName ?? 'General',
      baseUnit: changes.baseUnit ?? existing?.baseUnit ?? 'unit',
      packSize: changes.packSize ?? existing?.packSize ?? 1,
      trackStock: changes.trackStock ?? existing?.trackStock ?? true,
      costPriceKobo: changes.costPriceKobo ?? existing?.costPriceKobo ?? 0,
      reorderLevel: changes.reorderLevel ?? existing?.reorderLevel ?? 0,
      pricePoints: changes.pricePoints ?? existing?.pricePoints ?? [],
      archived: changes.archived ?? existing?.archived ?? false,
      createdAt: existing?.createdAt ?? changes.createdAt ?? new Date().toISOString(),
      ...(changes.photo !== undefined
        ? (changes.photo ? { photo: changes.photo } : {})
        : existing?.photo ? { photo: existing.photo } : {}),
    }
    const hasDataUrl = Boolean(item.photo?.startsWith('data:'))
    const image = hasDataUrl ? await dataUrlToBlob(item.photo!) : undefined
    if (image) {
      await storeLocalImage(itemId, image.blob, image.contentType)
      delete item.photo
    } else if (changes.photo === '') {
      await removeLocalImage(itemId)
      delete item.photo
    }
    const queueItem = { ...item } as Item
    if (hasDataUrl) delete queueItem.photo
    const action = makeAction(actor.id, 'item.upsert', { item: queueItem }, {
      ...(hasDataUrl ? { attachmentItemId: itemId } : {}),
    })
    const auditAction = !existing
      ? 'Created item'
      : (JSON.stringify(existing.pricePoints) !== JSON.stringify(item.pricePoints)
        ? 'Updated price'
        : existing.photo !== item.photo ? 'Changed item image' : 'Updated item')
    const entry: AuditEntry = {
      id: `pending-${action.clientUuid}`,
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      action: auditAction,
      what: item.name,
      oldValue: existing ? describeItem(existing) : 'Not available',
      newValue: describeItem(item),
      createdAt: action.createdAtClient,
    }
    await localDatabase.transaction('rw', [
      localDatabase.items,
      localDatabase.stockEvents,
      localDatabase.syncQueue,
      localDatabase.activityLog,
      localDatabase.notifications,
    ], async () => {
      await localDatabase.items.put(item)
      await localDatabase.syncQueue.add(action)
      await localDatabase.activityLog.put(entry)
      await localDatabase.notifications.put(saveNotification(actor, auditAction, item.name, action.clientUuid))
      const quantity = getStockFromMovements(await localDatabase.stockEvents.where('itemId').equals(itemId).toArray())
      if (item.trackStock && quantity <= item.reorderLevel && (!existing?.trackStock || quantity > existing.reorderLevel)) {
        await localDatabase.notifications.put(saveNotification(actor, 'Low stock', item.name, action.clientUuid, 1))
      }
    })
    await dispatchSyncState()
    scheduleSync()
    return await hydrateItem(item)
  },

  async archiveItem(id, userId) {
    const actor = await requireInventoryManager(userId)
    const item = await localDatabase.items.get(id)
    if (!item) throw new Error('Item not found.')
    const action = makeAction(actor.id, 'item.archive', { itemId: id })
    const archived = { ...item, archived: true }
    await localDatabase.transaction('rw', [localDatabase.items, localDatabase.syncQueue, localDatabase.activityLog, localDatabase.notifications], async () => {
      await localDatabase.items.put(archived)
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Archived item', item.name, 'Active', 'Archived', `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Archived item', item.name, action.clientUuid))
    })
    await dispatchSyncState()
    scheduleSync()
    return await hydrateItem(archived)
  },

  async deleteItem(id, userId) {
    const actor = await requireInventoryManager(userId)
    const item = await localDatabase.items.get(id)
    if (!item) return
    const [sales, movementCount] = await Promise.all([
      localDatabase.sales.toArray(),
      localDatabase.stockEvents.where('itemId').equals(id).count(),
    ])
    if (sales.some((sale) => sale.lines.some((line) => line.itemId === id)) || movementCount > 0) {
      throw new Error('This item has sales or stock history. Archive it instead to preserve records.')
    }
    const action = makeAction(actor.id, 'item.delete', { itemId: id })
    await localDatabase.transaction('rw', [localDatabase.items, localDatabase.itemImages, localDatabase.syncQueue, localDatabase.activityLog, localDatabase.notifications], async () => {
      await localDatabase.items.delete(id)
      await localDatabase.itemImages.delete(id)
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Deleted item', item.name, 'Available', 'Deleted', `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Deleted item', item.name, action.clientUuid))
    })
    await dispatchSyncState()
    scheduleSync()
  },

  async listCategories() {
    return await localDatabase.categories.orderBy('sortOrder').toArray()
  },

  async saveCategory(category, userId) {
    const actor = await requireInventoryManager(userId)
    const saved = { ...category, name: category.name.trim() }
    const action = makeAction(actor.id, 'category.save', { category: saved })
    await localDatabase.transaction('rw', [localDatabase.categories, localDatabase.syncQueue, localDatabase.activityLog, localDatabase.notifications], async () => {
      await localDatabase.categories.put(saved)
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Created category', saved.name, 'Not available', 'Created', `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Created category', saved.name, action.clientUuid))
    })
    await dispatchSyncState()
    scheduleSync()
    return saved
  },

  async recordSale({ staffId, lines }) {
    const actor = await currentUser(staffId)
    if (!['owner', 'staff'].includes(actor.role)) throw new Error('An active owner or staff account is required to confirm a sale.')
    if (lines.length === 0) throw new Error('Add at least one item before confirming the sale.')
    const requestedByItem = new Map<string, number>()
    let totalKobo = 0
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Sale quantities must be whole numbers greater than zero.')
      const item = await localDatabase.items.get(line.itemId)
      if (!item || item.archived) throw new Error(`${line.itemName} is no longer available.`)
      const pricePoint = item.pricePoints.find((point) => point.id === line.pricePointId)
      if (!pricePoint || pricePoint.priceKobo !== line.unitPriceKobo || pricePoint.baseUnitsUsed !== line.baseUnitsDeducted) {
        throw new Error(`${item.name} pricing has changed. Refresh the sale and try again.`)
      }
      if (calculateCartLineTotal(line) !== line.totalKobo) throw new Error(`The total for ${item.name} is invalid.`)
      totalKobo += line.totalKobo
      requestedByItem.set(item.id, (requestedByItem.get(item.id) ?? 0) + line.quantity * line.baseUnitsDeducted)
    }
    const currentStock = await getMovementTotals()
    for (const [itemId, quantity] of requestedByItem) {
      const item = await localDatabase.items.get(itemId)
      if (item?.trackStock && quantity > (currentStock.get(itemId) ?? 0)) {
        throw new Error(`Not enough ${item.name} in stock to confirm this sale.`)
      }
    }
    const action = makeAction(actor.id, 'sale.confirm', {})
    const sale: SaleRecord = {
      id: action.clientUuid,
      staffId: actor.id,
      staffName: actor.name,
      createdAt: action.createdAtClient,
      totalKobo,
      status: 'waiting',
      lines: lines.map((line) => ({ ...line })),
    }
    action.payload = { saleId: sale.id, sale, lines: sale.lines }
    await localDatabase.transaction('rw', [
      localDatabase.sales,
      localDatabase.saleItems,
      localDatabase.items,
      localDatabase.stockEvents,
      localDatabase.syncQueue,
      localDatabase.activityLog,
      localDatabase.notifications,
    ], async () => {
      await localDatabase.sales.put(sale)
      await localDatabase.saleItems.bulkPut(sale.lines.map((line, index) => ({
        id: `${sale.id}:${index}`,
        saleId: sale.id,
        itemId: line.itemId,
        quantity: line.quantity,
      })))
      for (const [itemId, quantity] of requestedByItem) {
        const item = await localDatabase.items.get(itemId)
        if (!item?.trackStock) continue
        await localDatabase.stockEvents.put({
          id: `${action.clientUuid}:${itemId}`,
          itemId,
          itemName: item.name,
          type: 'sale',
          quantityChange: -quantity,
          description: `Sale ${sale.id}`,
          createdAt: sale.createdAt,
          userId: actor.id,
        })
      }
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Confirmed sale', sale.id, 'Pending', `${sale.lines.length} line items · ${sale.totalKobo} kobo`, `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Confirmed sale', sale.id, action.clientUuid))
      let notificationIndex = 1
      for (const [itemId, quantity] of requestedByItem) {
        const stockBefore = currentStock.get(itemId) ?? 0
        const item = await localDatabase.items.get(itemId)
        if (item?.trackStock && stockBefore > item.reorderLevel && stockBefore - quantity <= item.reorderLevel) {
          await localDatabase.notifications.put(saveNotification(actor, 'Low stock', item.name, action.clientUuid, notificationIndex++))
        }
      }
    })
    await dispatchSyncState()
    scheduleSync()
    return sale
  },

  async voidSale(id, reason, userId) {
    const actor = await currentUser(userId)
    if (!['owner', 'manager'].includes(actor.role)) throw new Error('Only an owner or manager can void a sale.')
    const sale = await localDatabase.sales.get(id)
    if (!sale) return
    const action = makeAction(actor.id, 'sale.void', { saleId: id, reason: reason.trim() || 'No reason supplied' })
    const voided = { ...sale, status: 'voided' as const, voidReason: reason.trim() || 'No reason supplied' }
    await localDatabase.transaction('rw', [localDatabase.sales, localDatabase.stockEvents, localDatabase.syncQueue, localDatabase.activityLog, localDatabase.notifications], async () => {
      await localDatabase.sales.put(voided)
      const quantities = new Map<string, number>()
      for (const line of sale.lines) {
        quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity * line.baseUnitsDeducted)
      }
      for (const [itemId, quantity] of quantities) {
        const item = await localDatabase.items.get(itemId)
        if (!item?.trackStock) continue
        await localDatabase.stockEvents.put({
          id: `${action.clientUuid}:${itemId}`,
          itemId,
          itemName: item.name,
          type: 'adjustment',
          quantityChange: quantity,
          description: `Voided sale ${sale.id}`,
          createdAt: action.createdAtClient,
          userId: actor.id,
        })
      }
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Voided sale', id, sale.status, voided.voidReason!, `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Voided sale', id, action.clientUuid))
    })
    await dispatchSyncState()
    scheduleSync()
  },

  async listSales() {
    return (await localDatabase.sales.toArray()).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async recordStockIn({ itemId, crates, looseUnits, unitCostKobo, supplier, note, userId }) {
    const actor = await requireInventoryManager(userId)
    const item = await localDatabase.items.get(itemId)
    if (!item) throw new Error('Item not found.')
    if (!item.trackStock) throw new Error('Stock tracking is disabled for this item.')
    if (!Number.isInteger(crates) || crates < 0 || !Number.isInteger(looseUnits) || looseUnits < 0) {
      throw new Error('Stock quantities must be non-negative whole numbers.')
    }
    const quantityChange = crates * item.packSize + looseUnits
    if (!Number.isSafeInteger(quantityChange) || quantityChange <= 0) throw new Error('Enter a quantity greater than zero.')
    const description = [
      `${crates} packs + ${looseUnits} loose ${item.baseUnit}`,
      supplier?.trim() ? `Supplier: ${supplier.trim()}` : '',
      note?.trim() ?? '',
    ].filter(Boolean).join(' · ')
    const currentStock = await getMovementTotals()
    const previous = currentStock.get(itemId) ?? 0
    const action = makeAction(actor.id, 'stock.purchase', {
      itemId,
      quantityDelta: quantityChange,
      description,
      unitCostKobo,
    })
    const movement: StockMovement = {
      id: action.clientUuid,
      itemId,
      itemName: item.name,
      type: 'purchase',
      quantityChange,
      description,
      createdAt: action.createdAtClient,
      userId,
      unitCostKobo,
    }
    await localDatabase.transaction('rw', [localDatabase.stockEvents, localDatabase.syncQueue, localDatabase.activityLog, localDatabase.notifications], async () => {
      await localDatabase.stockEvents.put(movement)
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Added stock', item.name, `${previous} units`, `${previous + quantityChange} units · ${description}`, `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Added stock', item.name, action.clientUuid))
      if (previous > item.reorderLevel && previous + quantityChange <= item.reorderLevel) {
        await saveAudit(actor, 'Low stock', item.name, `${previous} units`, `${previous + quantityChange} units (reorder level ${item.reorderLevel})`, `pending-${action.clientUuid}-low`)
        await localDatabase.notifications.put(saveNotification(actor, 'Low stock', item.name, action.clientUuid, 1))
      }
    })
    await dispatchSyncState()
    scheduleSync()
    return movement
  },

  async recordStockAdjustment({ itemId, newQuantity, reason, userId }) {
    const actor = await requireInventoryManager(userId)
    const item = await localDatabase.items.get(itemId)
    if (!item) throw new Error('Item not found.')
    if (!item.trackStock) throw new Error('Stock tracking is disabled for this item.')
    if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error('Counted stock must be a non-negative whole number.')
    if (!reason.trim()) throw new Error('Enter a reason for the stock adjustment.')
    const totals = await getMovementTotals()
    const previous = totals.get(itemId) ?? 0
    const quantityChange = newQuantity - previous
    if (quantityChange === 0) throw new Error('The counted stock matches the current quantity.')
    const action = makeAction(actor.id, 'stock.adjustment', {
      itemId,
      quantityDelta: quantityChange,
      description: `Stock count ${previous} → ${newQuantity} · ${reason.trim()}`,
    })
    const movement: StockMovement = {
      id: action.clientUuid,
      itemId,
      itemName: item.name,
      type: 'adjustment',
      quantityChange,
      description: `Stock count ${previous} → ${newQuantity} · ${reason.trim()}`,
      createdAt: action.createdAtClient,
      userId,
    }
    await localDatabase.transaction('rw', [localDatabase.stockEvents, localDatabase.syncQueue, localDatabase.activityLog, localDatabase.notifications], async () => {
      await localDatabase.stockEvents.put(movement)
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Adjusted stock', item.name, `${previous} units`, `${newQuantity} units · ${reason.trim()}`, `pending-${action.clientUuid}`)
      await localDatabase.notifications.put(saveNotification(actor, 'Adjusted stock', item.name, action.clientUuid))
      if (previous > item.reorderLevel && newQuantity <= item.reorderLevel) {
        await saveAudit(actor, 'Low stock', item.name, `${previous} units`, `${newQuantity} units (reorder level ${item.reorderLevel})`, `pending-${action.clientUuid}-low`)
        await localDatabase.notifications.put(saveNotification(actor, 'Low stock', item.name, action.clientUuid, 1))
      }
    })
    await dispatchSyncState()
    scheduleSync()
    return movement
  },

  async listMovements() {
    return await localDatabase.stockEvents.orderBy('createdAt').toArray()
  },

  async getStockLevels() {
    const items = await localDatabase.items.toArray()
    const movements = await localDatabase.stockEvents.toArray()
    return items.map((item): StockLevel => {
      const quantity = getStockFromMovements(movements.filter((movement) => movement.itemId === item.id))
      return {
        itemId: item.id,
        quantity,
        low: item.trackStock && isLowStock(quantity, item.reorderLevel),
        negative: quantity < 0,
      }
    })
  },

  async listUsers() {
    return await localDatabase.users.toArray()
  },

  async authenticateUser(identifier, password) {
    try {
      const response = await apiRequest<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }, false)
      await activateBusinessDatabase(response.user.businessId ?? '', response.user.id)
      await localDatabase.users.put(response.user)
      localStorage.setItem(SESSION_KEY, response.user.id)
      localStorage.setItem(SESSION_UNTIL_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
      scheduleSync()
      return response.user
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return undefined
      throw error
    }
  },

  async createUser(input) {
    const activeUserId = localStorage.getItem(SESSION_KEY)
    if (input.role === 'owner' || !activeUserId) {
      if (!input.email?.trim()) throw new Error('A business owner email address is required.')
      const response = await apiRequest<{ user: User }>('/auth/register-owner', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          email: input.email,
          password: input.password,
          businessName: input.businessName?.trim(),
        }),
      }, false)
      await activateBusinessDatabase(response.user.businessId ?? '', response.user.id)
      await localDatabase.users.put(response.user)
      localStorage.setItem(SESSION_KEY, response.user.id)
      localStorage.setItem(SESSION_UNTIL_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
      scheduleSync()
      return response.user
    }
    const response = await apiRequest<User>('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        username: input.username,
        email: input.email,
        password: input.password,
        role: input.role ?? 'staff',
      }),
    })
    await localDatabase.users.put(response)
    return response
  },

  async updateUser(id, changes) {
    const response = await apiRequest<User>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    })
    await localDatabase.users.put(response)
    return response
  },

  async deleteUser(id) {
    await apiRequest<void>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await localDatabase.users.update(id, { isActive: false })
  },

  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...await getLocalSettings() }
  },

  async saveSettings(changes) {
    const actor = await currentUser()
    const previous = await getLocalSettings()
    const next = { ...DEFAULT_SETTINGS, ...previous, ...changes }
    const action = makeAction(actor.id, 'settings.update', { settings: changes as Record<string, unknown> })
    await localDatabase.transaction('rw', [localDatabase.settings, localDatabase.syncQueue, localDatabase.activityLog], async () => {
      await Promise.all(Object.entries(changes).map(([key, value]) => localDatabase.settings.put({ key, value })))
      await localDatabase.syncQueue.add(action)
      await saveAudit(actor, 'Updated business settings', 'Business settings', JSON.stringify(previous), JSON.stringify(changes), `pending-${action.clientUuid}`)
    })
    await dispatchSyncState()
    scheduleSync()
    return next
  },

  async listAuditLog() {
    return (await localDatabase.activityLog.toArray()).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async listRejectedActions() {
    const actor = await currentUser()
    if (actor.role !== 'owner') throw new Error('Only the owner can review rejected sync actions.')
    const rejected = await localDatabase.syncQueue.where('status').equals('rejected').toArray()
    const local = await Promise.all(rejected.map(async (action): Promise<RejectedSyncAction> => ({
        clientUuid: action.clientUuid,
        deviceId: action.deviceId,
        userId: action.userId,
        userName: (await localDatabase.users.get(action.userId))?.name ?? 'Unknown user',
        actionType: action.type,
        reason: action.error ?? 'Rejected by the server.',
        createdAt: action.createdAtClient,
      })))
    const cached = await localDatabase.rejectedActions.toArray()
    const all = [...local, ...cached]
    return [...new Map(all.map((entry) => [entry.clientUuid, entry])).values()]
  },

  async listNotifications() {
    return (await localDatabase.notifications.toArray()).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  },

  async markNotificationsRead() {
    const actor = await currentUser()
    const notifications = await localDatabase.notifications.toArray()
    const readAt = new Date().toISOString()
    const action = makeAction(actor.id, 'notifications.read', { readAt })
    await localDatabase.transaction('rw', [localDatabase.notifications, localDatabase.syncQueue], async () => {
      await localDatabase.notifications.bulkPut(notifications.map((entry) => entry.readAt ? entry : { ...entry, readAt }))
      await localDatabase.syncQueue.add(action)
    })
    await dispatchSyncState()
    scheduleSync()
  },

  async clearSales({ password, from, to }) {
    if (!navigator.onLine) throw new Error('Connect to the internet before clearing sales records.')
    if (await getPendingCount() > 0 || await localDatabase.syncQueue.where('status').equals('rejected').count() > 0) {
      throw new Error('Sync or resolve all queued changes before clearing sales records.')
    }
    const response = await apiRequest<{ clearedCount: number }>('/storage/clear-sales', {
      method: 'POST',
      body: JSON.stringify({ password, from, to }),
    })
    const sales = await localDatabase.sales.toArray()
    const cleared = sales.filter((sale) => {
      const date = sale.createdAt.slice(0, 10)
      return date >= from && date <= to
    })
    await localDatabase.transaction('rw', [localDatabase.sales, localDatabase.saleItems], async () => {
      await localDatabase.sales.bulkDelete(cleared.map((sale) => sale.id))
      for (const sale of cleared) await localDatabase.saleItems.where('saleId').equals(sale.id).delete()
    })
    return response.clearedCount
  },

  async syncNow() {
    await syncNow()
  },
}

async function getLocalSettings() {
  const entries = await localDatabase.settings.toArray()
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value])) as Partial<AppSettings>
}

export async function loginUserFromLocalSession() {
  const userId = localStorage.getItem(SESSION_KEY)
  if (!userId) return undefined
  const user = await localDatabase.users.get(userId)
  return user?.isActive ? user : undefined
}

export async function logoutOfflineSession(preserveLocalData = false) {
  const pending = await localDatabase.syncQueue.where('status').equals('pending').count()
  if (pending) throw new Error('Sync pending changes before signing out to avoid losing unsynced work.')
  if (navigator.onLine) await clearServerSession()
  if (!preserveLocalData) {
    await localDatabase.delete()
    localStorage.removeItem('dqueens-business-id')
  }
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_UNTIL_KEY)
}

export async function hasLocalAccount() {
  return (await localDatabase.users.count()) > 0
}

export async function pendingOfflineActions() {
  return await getPendingCount()
}
