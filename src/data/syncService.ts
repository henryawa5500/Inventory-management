import type {
  AppNotification,
  AppSettings,
  AuditEntry,
  Category,
  Item,
  SaleRecord,
  StockMovement,
  User,
} from '../domain/types'
import { apiBlobRequest, apiRequest, ApiError, clearServerSession, hasLocalSession } from './apiClient'
import { activateBusinessDatabase, localDatabase, type SyncQueueRecord } from './localDatabase'

const SESSION_KEY = 'bar-user'
const DEVICE_KEY = 'dqueens-device-id'
const CURSOR_KEY = 'last-sync-cursor'
const CURSOR_ID_KEY = 'last-sync-change-id'
const LAST_ACTION_TIME_KEY = 'dqueens-last-action-time'
const SESSION_UNTIL_KEY = 'dqueens-session-until'

type ServerSnapshot = {
  users: User[]
  categories: Category[]
  items: Item[]
  sales: SaleRecord[]
  movements: StockMovement[]
  stockLevels: Array<{ itemId: string; quantity: number; low: boolean; negative: boolean }>
  settings: Partial<AppSettings>
  activityLog: AuditEntry[]
  notifications: AppNotification[]
}

type SyncPushResponse = {
  results: Array<{
    clientUuid: string | null
    accepted: boolean
    result?: unknown
    error?: string
  }>
}

let currentSync: Promise<void> | undefined

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export async function getPendingCount() {
  return localDatabase.syncQueue.where('status').equals('pending').count()
}

export async function getRejectedCount() {
  const [queue, cached] = await Promise.all([
    localDatabase.syncQueue.where('status').equals('rejected').toArray(),
    localDatabase.rejectedActions.toArray(),
  ])
  return new Set([...queue.map((entry) => entry.clientUuid), ...cached.map((entry) => entry.clientUuid)]).size
}

export async function dispatchSyncState() {
  const [pendingCount, rejectedCount] = await Promise.all([getPendingCount(), getRejectedCount()])
  window.dispatchEvent(new CustomEvent('dq:sync-state', {
    detail: { pendingCount, rejectedCount, online: navigator.onLine },
  }))
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Unable to encode the local item image.'))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the local item image.'))
    reader.readAsDataURL(blob)
  })
}

async function makeWireAction(action: SyncQueueRecord) {
  const payload = structuredClone(action.payload)
  if (action.attachmentItemId) {
    const attachment = await localDatabase.itemImages.get(action.attachmentItemId)
    if (!attachment) throw new Error(`The saved image for item ${action.attachmentItemId} is missing.`)
    const dataUrl = await blobToDataUrl(attachment.image)
    const item = payload.item as Record<string, unknown> | undefined
    if (item) item.photo = dataUrl
  }
  return {
    clientUuid: action.clientUuid,
    deviceId: action.deviceId,
    createdAtClient: action.createdAtClient,
    type: action.type,
    payload,
  }
}

async function applySnapshot(snapshot: ServerSnapshot) {
  const downloadedImages = await Promise.all(snapshot.items
    .filter((item) => item.photo?.startsWith('/api/items/'))
    .map(async (item) => ({
      itemId: item.id,
      ...await apiBlobRequest(`/items/${encodeURIComponent(item.id)}/image`).then(({ blob, contentType }) => ({
        image: blob,
        contentType,
      })),
    })))
  const optimisticActions = await localDatabase.syncQueue
    .where('status')
    .anyOf('pending', 'rejected')
    .sortBy('createdAtClient')
  const previousActivity = await localDatabase.activityLog.toArray()
  const previousNotifications = await localDatabase.notifications.toArray()
  const localEntries = optimisticActions.flatMap((action) => [
    ...previousActivity.filter((entry) => entry.id.startsWith(`pending-${action.clientUuid}`) || entry.id.startsWith(`rejected-${action.clientUuid}`)),
    ...previousNotifications.filter((entry) => entry.id.startsWith(`pending-${action.clientUuid}`)),
  ])
  const protectedItemIds = new Set(optimisticActions.flatMap((action) => {
    if (action.type === 'item.upsert') {
      const item = action.payload.item as Item | undefined
      return item ? [item.id] : []
    }
    return []
  }))
  await localDatabase.transaction(
    'rw',
    [
      localDatabase.users,
      localDatabase.categories,
      localDatabase.items,
      localDatabase.sales,
      localDatabase.saleItems,
      localDatabase.stockEvents,
      localDatabase.notifications,
      localDatabase.activityLog,
      localDatabase.settings,
      localDatabase.syncQueue,
      localDatabase.itemImages,
    ],
    async () => {
      await Promise.all([
        localDatabase.users.clear(),
        localDatabase.categories.clear(),
        localDatabase.items.clear(),
        localDatabase.sales.clear(),
        localDatabase.saleItems.clear(),
        localDatabase.stockEvents.clear(),
        localDatabase.notifications.clear(),
        localDatabase.activityLog.clear(),
        localDatabase.settings.clear(),
      ])
      await Promise.all([
        localDatabase.users.bulkPut(snapshot.users),
        localDatabase.categories.bulkPut(snapshot.categories),
        localDatabase.items.bulkPut(snapshot.items),
        localDatabase.sales.bulkPut(snapshot.sales),
        localDatabase.stockEvents.bulkPut(snapshot.movements),
        localDatabase.notifications.bulkPut(snapshot.notifications),
        localDatabase.activityLog.bulkPut(snapshot.activityLog),
        ...Object.entries(snapshot.settings).map(([key, value]) => localDatabase.settings.put({ key, value })),
        localDatabase.saleItems.bulkPut(snapshot.sales.flatMap((sale) => sale.lines.map((line, index) => ({
          id: `${sale.id}:${index}`,
          saleId: sale.id,
          itemId: line.itemId,
          quantity: line.quantity,
        })))),
      ])
      await localDatabase.activityLog.bulkPut(localEntries.filter((entry): entry is AuditEntry => 'userId' in entry))
      await localDatabase.notifications.bulkPut(localEntries.filter((entry): entry is AppNotification => 'auditEntryId' in entry))
      for (const action of optimisticActions) await reapplyPendingAction(action)
      await localDatabase.itemImages.bulkPut(downloadedImages)
      const savedImages = await localDatabase.itemImages.toArray()
      const validItemIds = new Set([
        ...snapshot.items.filter((item) => item.photo).map((item) => item.id),
        ...protectedItemIds,
      ])
      await localDatabase.itemImages.bulkDelete(savedImages.filter((image) => !validItemIds.has(image.itemId)).map((image) => image.itemId))
    },
  )
}

async function reapplyPendingAction(action: SyncQueueRecord) {
  if (action.type === 'item.upsert') {
    const item = action.payload.item as Item | undefined
    if (item) await localDatabase.items.put(item)
  } else if (action.type === 'item.archive') {
    const itemId = action.payload.itemId
    if (typeof itemId === 'string') {
      const item = await localDatabase.items.get(itemId)
      if (item) await localDatabase.items.put({ ...item, archived: true })
    }
  } else if (action.type === 'item.delete') {
    const itemId = action.payload.itemId
    if (typeof itemId === 'string') await localDatabase.items.delete(itemId)
  } else if (action.type === 'category.save') {
    const category = action.payload.category as Category | undefined
    if (category) await localDatabase.categories.put(category)
  } else if (action.type === 'sale.confirm') {
    const sale = action.payload.sale as SaleRecord | undefined
    if (sale) {
      await localDatabase.sales.put(sale)
      await localDatabase.saleItems.bulkPut(sale.lines.map((line, index) => ({
        id: `${sale.id}:${index}`,
        saleId: sale.id,
        itemId: line.itemId,
        quantity: line.quantity,
      })))
      const quantities = new Map<string, number>()
      for (const line of sale.lines) {
        quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity * line.baseUnitsDeducted)
      }
      for (const [itemId, quantity] of quantities) {
        const item = await localDatabase.items.get(itemId)
        if (item?.trackStock) {
          await localDatabase.stockEvents.put({
            id: `${action.clientUuid}:${itemId}`,
            itemId,
            itemName: item.name,
            type: 'sale',
            quantityChange: -quantity,
            description: `Sale ${sale.id}`,
            createdAt: sale.createdAt,
            userId: action.userId,
          })
        }
      }
    }
  } else if (action.type === 'sale.void') {
    const saleId = action.payload.saleId
    if (typeof saleId === 'string') {
      const sale = await localDatabase.sales.get(saleId)
      if (sale) {
        await localDatabase.sales.put({
          ...sale,
          status: 'voided',
          voidReason: typeof action.payload.reason === 'string' ? action.payload.reason : 'No reason supplied',
        })
        const quantities = new Map<string, number>()
        for (const line of sale.lines) {
          quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity * line.baseUnitsDeducted)
        }
        for (const [itemId, quantity] of quantities) {
          const item = await localDatabase.items.get(itemId)
          if (item?.trackStock) {
            await localDatabase.stockEvents.put({
              id: `${action.clientUuid}:${itemId}`,
              itemId,
              itemName: item.name,
              type: 'adjustment',
              quantityChange: quantity,
              description: `Voided sale ${sale.id}`,
              createdAt: action.createdAtClient,
              userId: action.userId,
            })
          }
        }
      }
    }
  } else if (action.type === 'stock.purchase' || action.type === 'stock.adjustment') {
    const itemId = action.payload.itemId
    if (typeof itemId !== 'string') return
    const item = await localDatabase.items.get(itemId)
    if (item && typeof action.payload.quantityDelta === 'number' && typeof action.payload.description === 'string') {
      await localDatabase.stockEvents.put({
        id: action.clientUuid,
        itemId,
        itemName: item.name,
        type: action.type === 'stock.purchase' ? 'purchase' : 'adjustment',
        quantityChange: action.payload.quantityDelta,
        description: action.payload.description,
        createdAt: action.createdAtClient,
        userId: action.userId,
        ...(typeof action.payload.unitCostKobo === 'number' ? { unitCostKobo: action.payload.unitCostKobo } : {}),
      })
    }
  } else if (action.type === 'settings.update') {
    const settings = action.payload.settings as Record<string, unknown> | undefined
    if (settings) await Promise.all(Object.entries(settings).map(([key, value]) => localDatabase.settings.put({ key, value })))
  } else if (action.type === 'notifications.read') {
    const readAt = typeof action.payload.readAt === 'string' ? action.payload.readAt : action.createdAtClient
    const notifications = await localDatabase.notifications.toArray()
    await localDatabase.notifications.bulkPut(notifications.map((entry) => entry.readAt ? entry : { ...entry, readAt }))
  }
}

async function applyChanges(changes: Array<{ type: string; entityId: string; data: unknown }>) {
  for (const change of changes) {
    switch (change.type) {
      case 'item':
        {
          const item = change.data as Item
          await localDatabase.items.put(item)
          if (item.photo?.startsWith('/api/items/')) {
            const { blob, contentType } = await apiBlobRequest(`/items/${encodeURIComponent(item.id)}/image`)
            const image = { image: blob, contentType }
            await localDatabase.itemImages.put({ itemId: item.id, ...image })
          } else if (!item.photo) {
            await localDatabase.itemImages.delete(item.id)
          }
        }
        break
      case 'item.deleted':
        await localDatabase.items.delete(change.entityId)
        await localDatabase.itemImages.delete(change.entityId)
        break
      case 'category':
        await localDatabase.categories.put(change.data as Category)
        break
      case 'user':
        await localDatabase.users.put(change.data as User)
        break
      case 'sale': {
        const sale = change.data as SaleRecord
        await localDatabase.sales.put(sale)
        await localDatabase.saleItems.bulkPut(sale.lines.map((line, index) => ({
          id: `${sale.id}:${index}`,
          saleId: sale.id,
          itemId: line.itemId,
          quantity: line.quantity,
        })))
        break
      }
      case 'stockEvent':
        await localDatabase.stockEvents.put(change.data as StockMovement)
        break
      case 'activity':
        await localDatabase.activityLog.put(change.data as AuditEntry)
        break
      case 'notification':
        await localDatabase.notifications.put(change.data as AppNotification)
        break
      case 'settings': {
        const values = change.data as Record<string, unknown>
        await Promise.all(Object.entries(values).map(([key, value]) => localDatabase.settings.put({ key, value })))
        break
      }
      case 'sale.cleared':
        await localDatabase.sales.delete(change.entityId)
        await localDatabase.saleItems.where('saleId').equals(change.entityId).delete()
        break
    }
  }
}

async function pullChanges() {
  const cursor = await localDatabase.meta.get(CURSOR_KEY)
  const changeCursor = await localDatabase.meta.get(CURSOR_ID_KEY)
  const query = cursor
    ? `?since=${encodeURIComponent(cursor.value)}${changeCursor ? `&after=${encodeURIComponent(changeCursor.value)}` : ''}`
    : ''
  const result = await apiRequest<{
    snapshot?: ServerSnapshot
    changes?: Array<{ type: string; entityId: string; data: unknown }>
    settings?: Partial<AppSettings>
    cursor: string
    changeId: string
    userActive: boolean
  }>(`/sync/pull${query}`)
  if (result.userActive === false) throw new ApiError('This account is inactive. Device data has been cleared.', 403)
  if (result.snapshot) await applySnapshot(result.snapshot)
  else await applyChanges(result.changes ?? [])
  const settings = result.settings
  if (settings) {
    await Promise.all(Object.entries(settings).map(([key, value]) => localDatabase.settings.put({ key, value })))
  }
  await localDatabase.meta.bulkPut([
    { key: CURSOR_KEY, value: result.cursor },
    { key: CURSOR_ID_KEY, value: result.changeId },
  ])
}

async function pullRejectedActions() {
  const userId = localStorage.getItem(SESSION_KEY)
  if (!userId) return
  const user = await localDatabase.users.get(userId)
  if (user?.role !== 'owner') return
  const rows = await apiRequest<Array<{
    client_uuid: string
    device_id: string
    user_id: string
    user_name: string
    action_type: string
    rejection_reason: string
    processed_at: string
  }>>('/sync/rejected')
  await localDatabase.rejectedActions.bulkPut(rows.map((row) => ({
    clientUuid: row.client_uuid,
    deviceId: row.device_id,
    userId: row.user_id,
    userName: row.user_name,
    actionType: row.action_type,
    reason: row.rejection_reason,
    createdAt: row.processed_at,
  })))
}

async function processQueue() {
  const currentUserId = localStorage.getItem(SESSION_KEY)
  if (!currentUserId) return false
  const actions = await localDatabase.syncQueue
    .where('status').equals('pending')
    .sortBy('createdAtClient')
  const due = actions.filter((action) =>
    action.userId === currentUserId && (!action.nextAttemptAt || action.nextAttemptAt <= Date.now()),
  )
  if (due.length === 0) return false
  const batch = due.slice(0, 100)
  const firstAttachment = batch.findIndex((action) => action.attachmentItemId)
  const sendable = firstAttachment === 0 ? batch.slice(0, 1) : firstAttachment > 0 ? batch.slice(0, firstAttachment) : batch
  const requestActions = await Promise.all(sendable.map(makeWireAction))
  const response = await apiRequest<SyncPushResponse>('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ actions: requestActions }),
  })
  const resultByUuid = new Map(response.results.filter((entry) => entry.clientUuid).map((entry) => [entry.clientUuid!, entry]))
  for (const action of due.slice(0, requestActions.length)) {
    const result = resultByUuid.get(action.clientUuid)
    if (!result) throw new Error(`The server returned no result for queued action ${action.clientUuid}.`)
    if (result.accepted) {
      await localDatabase.syncQueue.update(action.clientUuid, {
        status: 'synced',
        attempts: action.attempts + 1,
        error: undefined,
      })
      if (action.type === 'sale.confirm') {
        const saleId = typeof action.payload.saleId === 'string' ? action.payload.saleId : action.clientUuid
        const sale = await localDatabase.sales.get(saleId)
        if (sale) await localDatabase.sales.put({ ...sale, status: 'synced' })
      }
      await localDatabase.activityLog.delete(`pending-${action.clientUuid}`)
      await localDatabase.notifications
        .where('id')
        .startsWith(`pending-${action.clientUuid}`)
        .delete()
      if (action.attachmentItemId) {
        const item = await localDatabase.items.get(action.attachmentItemId)
        if (item) {
          const serverItem = result.result as Item | undefined
          await localDatabase.items.put({ ...item, ...(serverItem?.photo ? { photo: serverItem.photo } : {}) })
        }
      }
    } else {
      const reason = result.error ?? 'The server rejected this action.'
      await localDatabase.syncQueue.update(action.clientUuid, {
        status: 'rejected',
        attempts: action.attempts + 1,
        error: reason,
      })
      const user = await localDatabase.users.get(action.userId)
      if (user) {
        const entry: AuditEntry = {
          id: `rejected-${action.clientUuid}`,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'Sync action rejected',
          what: action.type,
          oldValue: '',
          newValue: reason,
          createdAt: new Date().toISOString(),
        }
        await localDatabase.activityLog.put(entry)
      }
    }
    return true
  }
}

async function clearAfterDeactivation() {
  try {
    await clearServerSession()
  } catch (error) {
    window.dispatchEvent(new CustomEvent('dq:sync-error', {
      detail: { message: error instanceof Error ? error.message : 'Unable to revoke the server session.' },
    }))
  }
  await localDatabase.delete()
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('dqueens-business-id')
  localStorage.removeItem(CURSOR_KEY)
  localStorage.removeItem(CURSOR_ID_KEY)
  localStorage.removeItem(SESSION_UNTIL_KEY)
  window.dispatchEvent(new CustomEvent('dq:session-revoked'))
}

async function performSync() {
  if (!navigator.onLine || !hasLocalSession()) return
  try {
    while (await processQueue()) {}
    await pullChanges()
    await pullRejectedActions()
    localStorage.setItem(SESSION_UNTIL_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
    await dispatchSyncState()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && /inactive/i.test(error.message)) {
      await clearAfterDeactivation()
      return
    }
    if (error instanceof ApiError && error.status === 401) {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_UNTIL_KEY)
      window.dispatchEvent(new CustomEvent('dq:reauth-required'))
      return
    }
    const userId = localStorage.getItem(SESSION_KEY)
    const first = userId ? await localDatabase.syncQueue
      .where('status').equals('pending')
      .sortBy('createdAtClient')
      .then((actions) => actions.find((action) => action.userId === userId)) : undefined
    if (first && (error instanceof ApiError ? error.status === 0 : true)) {
      const attempts = first.attempts + 1
      await localDatabase.syncQueue.update(first.clientUuid, {
        attempts,
        nextAttemptAt: Date.now() + Math.min(30 * 1000 * (2 ** Math.min(attempts - 1, 10)), 30 * 60 * 1000),
        error: error instanceof Error ? error.message : 'Sync failed.',
      })
    }
    await dispatchSyncState()
    throw error
  }
}

export function syncNow() {
  if (!currentSync) {
    currentSync = performSync().finally(() => {
      currentSync = undefined
    })
  }
  return currentSync
}

export async function initializeOfflineStorage() {
  const sessionUserId = localStorage.getItem(SESSION_KEY)
  const cachedUser = sessionUserId ? await localDatabase.users.get(sessionUserId) : undefined
  const businessId = localStorage.getItem('dqueens-business-id') ?? cachedUser?.businessId
  if (businessId) await activateBusinessDatabase(businessId, cachedUser?.id ?? sessionUserId ?? undefined)
  if (navigator.storage?.persist) await navigator.storage.persist()
}

export async function clearLocalData() {
  await localDatabase.delete()
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('dqueens-business-id')
  localStorage.removeItem(CURSOR_KEY)
  localStorage.removeItem(CURSOR_ID_KEY)
  localStorage.removeItem(SESSION_UNTIL_KEY)
}

export async function exportLocalBackup() {
  const [
    users,
    items,
    categories,
    sales,
    saleItems,
    stockEvents,
    notifications,
    activityLog,
    syncQueue,
    rejectedActions,
    settings,
  ] = await Promise.all([
    localDatabase.users.toArray(),
    localDatabase.items.toArray(),
    localDatabase.categories.toArray(),
    localDatabase.sales.toArray(),
    localDatabase.saleItems.toArray(),
    localDatabase.stockEvents.toArray(),
    localDatabase.notifications.toArray(),
    localDatabase.activityLog.toArray(),
    localDatabase.syncQueue.toArray(),
    localDatabase.rejectedActions.toArray(),
    localDatabase.settings.toArray(),
  ])
  const itemImages = await Promise.all((await localDatabase.itemImages.toArray()).map(async (entry) => ({
    itemId: entry.itemId,
    contentType: entry.contentType,
    dataUrl: await blobToDataUrl(entry.image),
  })))
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    users,
    items,
    categories,
    sales,
    saleItems,
    stockEvents,
    notifications,
    activityLog,
    syncQueue,
    rejectedActions,
    settings,
    itemImages,
  }, null, 2)
}

export async function enqueueAction(
  userId: string,
  type: SyncQueueRecord['type'],
  payload: Record<string, unknown>,
  options: { attachmentItemId?: string; clientUuid?: string } = {},
) {
  const action = createQueuedAction(userId, type, payload, options)
  await localDatabase.syncQueue.add(action)
  await dispatchSyncState()
  return action
}

export function createQueuedAction(
  userId: string,
  type: SyncQueueRecord['type'],
  payload: Record<string, unknown>,
  options: { attachmentItemId?: string; clientUuid?: string } = {},
): SyncQueueRecord {
  const previousTime = Number(localStorage.getItem(LAST_ACTION_TIME_KEY) ?? 0)
  const actionTime = Math.max(Date.now(), previousTime + 1)
  localStorage.setItem(LAST_ACTION_TIME_KEY, String(actionTime))
  return {
    clientUuid: options.clientUuid ?? crypto.randomUUID(),
    deviceId: getDeviceId(),
    userId,
    createdAtClient: new Date(actionTime).toISOString(),
    type,
    payload,
    ...(options.attachmentItemId ? { attachmentItemId: options.attachmentItemId } : {}),
    status: 'pending',
    attempts: 0,
  }
}

export async function saveLocalImage(itemId: string, dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('The item image must be JPG, PNG or WebP.')
  const binary = atob(match[2])
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error('Compressed item images must be 2 MB or smaller.')
  await localDatabase.itemImages.put({
    itemId,
    contentType: match[1],
    image: new Blob([bytes], { type: match[1] }),
  })
}

export async function storeLocalImage(itemId: string, image: Blob, contentType: string) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('The item image must be JPG, PNG or WebP.')
  }
  if (image.size > 2 * 1024 * 1024) throw new Error('Compressed item images must be 2 MB or smaller.')
  await localDatabase.itemImages.put({ itemId, image, contentType })
}

export async function readLocalImage(itemId: string) {
  const attachment = await localDatabase.itemImages.get(itemId)
  return attachment ? await blobToDataUrl(attachment.image) : undefined
}

export async function removeLocalImage(itemId: string) {
  await localDatabase.itemImages.delete(itemId)
}

export async function readSettings() {
  const records = await localDatabase.settings.toArray()
  return Object.fromEntries(records.map(({ key, value }) => [key, value])) as Partial<AppSettings>
}
