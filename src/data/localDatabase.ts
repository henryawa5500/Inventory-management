import Dexie, { type Table } from 'dexie'
import type {
  AppNotification,
  AuditEntry,
  Category,
  Item,
  RejectedSyncAction,
  SaleRecord,
  StockMovement,
  User,
} from '../domain/types'

export type QueuedActionType =
  | 'item.upsert'
  | 'item.archive'
  | 'item.delete'
  | 'category.save'
  | 'sale.confirm'
  | 'sale.void'
  | 'stock.purchase'
  | 'stock.adjustment'
  | 'settings.update'
  | 'notifications.read'

export type SyncQueueRecord = {
  clientUuid: string
  deviceId: string
  userId: string
  createdAtClient: string
  type: QueuedActionType
  payload: Record<string, unknown>
  attachmentItemId?: string
  status: 'pending' | 'synced' | 'rejected'
  attempts: number
  nextAttemptAt?: number
  error?: string
}

export type LocalMeta = {
  key: string
  value: string
}

export type LocalSetting = {
  key: string
  value: unknown
}

class DQueensDatabase extends Dexie {
  users!: Table<User, string>
  items!: Table<Item, string>
  categories!: Table<Category, string>
  sales!: Table<SaleRecord, string>
  saleItems!: Table<{ id: string; saleId: string; itemId: string; quantity: number }, string>
  stockEvents!: Table<StockMovement, string>
  notifications!: Table<AppNotification, string>
  activityLog!: Table<AuditEntry, string>
  syncQueue!: Table<SyncQueueRecord, string>
  rejectedActions!: Table<RejectedSyncAction, string>
  itemImages!: Table<{ itemId: string; image: Blob; contentType: string }, string>
  settings!: Table<LocalSetting, string>
  meta!: Table<LocalMeta, string>

  constructor(businessId?: string) {
    super(businessId ? `dqueens-offline-${businessId}` : 'dqueens-offline')
    this.version(1).stores({
      users: 'id, username, role, isActive',
      items: 'id, name, categoryId, archived',
      categories: 'id, sortOrder',
      sales: 'id, staffId, createdAt, status',
      saleItems: 'id, saleId, itemId',
      stockEvents: 'id, itemId, createdAt, type',
      notifications: 'id, createdAt, readAt',
      activityLog: 'id, userId, action, createdAt',
      syncQueue: 'clientUuid, status, createdAtClient, userId, nextAttemptAt',
      rejectedActions: 'clientUuid, createdAt, userId',
      itemImages: 'itemId',
      settings: 'key',
      meta: 'key',
    })
  }
}

export let localDatabase = new DQueensDatabase()

export async function activateBusinessDatabase(businessId: string, userId?: string) {
  if (!businessId) throw new Error('The account response did not include a business ID.')
  const currentBusinessId = localStorage.getItem('dqueens-business-id')
  if (currentBusinessId === businessId && localDatabase.name === `dqueens-offline-${businessId}`) return

  const legacyDatabase = localDatabase
  const legacySessionId = localStorage.getItem('bar-user')
  const legacyUser = currentBusinessId === null && legacyDatabase.name === 'dqueens-offline' && legacySessionId
    ? await legacyDatabase.users.get(legacySessionId)
    : undefined
  const shouldCopyLegacyData = Boolean(
    legacyUser
    && legacyUser.id === userId
    && (!legacyUser.businessId || legacyUser.businessId === businessId),
  )
  const businessDatabase = new DQueensDatabase(businessId)

  if (shouldCopyLegacyData) {
    await Promise.all([
      businessDatabase.users.bulkPut(await legacyDatabase.users.toArray()),
      businessDatabase.items.bulkPut(await legacyDatabase.items.toArray()),
      businessDatabase.categories.bulkPut(await legacyDatabase.categories.toArray()),
      businessDatabase.sales.bulkPut(await legacyDatabase.sales.toArray()),
      businessDatabase.saleItems.bulkPut(await legacyDatabase.saleItems.toArray()),
      businessDatabase.stockEvents.bulkPut(await legacyDatabase.stockEvents.toArray()),
      businessDatabase.notifications.bulkPut(await legacyDatabase.notifications.toArray()),
      businessDatabase.activityLog.bulkPut(await legacyDatabase.activityLog.toArray()),
      businessDatabase.syncQueue.bulkPut(await legacyDatabase.syncQueue.toArray()),
      businessDatabase.rejectedActions.bulkPut(await legacyDatabase.rejectedActions.toArray()),
      businessDatabase.itemImages.bulkPut(await legacyDatabase.itemImages.toArray()),
      businessDatabase.settings.bulkPut(await legacyDatabase.settings.toArray()),
      businessDatabase.meta.bulkPut(await legacyDatabase.meta.toArray()),
    ])
  }

  legacyDatabase.close()
  localDatabase = businessDatabase
  localStorage.setItem('dqueens-business-id', businessId)
}
