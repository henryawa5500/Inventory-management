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

  constructor() {
    super('dqueens-offline')
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

export const localDatabase = new DQueensDatabase()
