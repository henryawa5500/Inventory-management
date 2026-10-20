import type {
  AppSettings,
  AppNotification,
  AuditEntry,
  Item,
  RejectedSyncAction,
  SaleLine,
  SaleRecord,
  StockLevel,
  StockMovement,
  User,
} from '../domain/types'

export interface InventoryRepository {
  getSetupStatus: () => Promise<boolean>
  syncNow?: () => Promise<void>
  listRejectedActions?: () => Promise<RejectedSyncAction[]>
  listItems: () => Promise<Item[]>
  getItem: (id: string) => Promise<Item | undefined>
  saveItem: (item: Partial<Item>, userId: string) => Promise<Item>
  archiveItem: (id: string, userId: string) => Promise<Item>
  deleteItem: (id: string, userId: string) => Promise<void>
  listCategories: () => Promise<Array<{ id: string; name: string; sortOrder: number }>>
  saveCategory: (category: { id: string; name: string; sortOrder: number }, userId: string) => Promise<{ id: string; name: string; sortOrder: number }>
  recordSale: (payload: { staffId: string; lines: SaleLine[]; status?: SaleRecord['status'] }) => Promise<SaleRecord>
  voidSale: (id: string, reason: string, userId: string) => Promise<void>
  listSales: () => Promise<SaleRecord[]>
  recordStockIn: (payload: { itemId: string; crates: number; looseUnits: number; unitCostKobo: number; supplier?: string; note?: string; userId: string }) => Promise<StockMovement>
  recordStockAdjustment: (payload: { itemId: string; newQuantity: number; reason: string; userId: string }) => Promise<StockMovement>
  listMovements: () => Promise<StockMovement[]>
  getStockLevels: () => Promise<StockLevel[]>
  listUsers: () => Promise<User[]>
  authenticateUser: (username: string, password: string) => Promise<User | undefined>
  createUser: (user: Pick<User, 'name' | 'username' | 'password'> & Partial<Pick<User, 'email' | 'role' | 'isActive'>> & { businessName?: string }) => Promise<User>
  updateUser: (id: string, changes: Pick<User, 'name' | 'username'> & Partial<Pick<User, 'password' | 'isActive'>>) => Promise<User>
  deleteUser: (id: string) => Promise<void>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  listAuditLog: () => Promise<AuditEntry[]>
  listNotifications: () => Promise<AppNotification[]>
  markNotificationsRead: () => Promise<void>
  clearSales: (payload: { userId: string; password: string; from: string; to: string }) => Promise<number>
}
