export type Role = 'owner' | 'manager' | 'staff'
export type ThemeMode = 'light' | 'dark'
export type MovementType = 'opening' | 'purchase' | 'sale' | 'adjustment'
export type SaleStatus = 'synced' | 'waiting' | 'voided'

export type Category = {
  id: string
  name: string
  sortOrder: number
}

export type PricePoint = {
  id: string
  label: string
  priceKobo: number
  baseUnitsUsed: number
}

export type Item = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  baseUnit: string
  packSize: number
  trackStock: boolean
  costPriceKobo: number
  reorderLevel: number
  pricePoints: PricePoint[]
  archived: boolean
  photo?: string
  createdAt: string
}

export type User = {
  id: string
  name: string
  email?: string
  username: string
  password: string
  role: Role
  isActive: boolean
  createdAt: string
}

export type SaleLine = {
  itemId: string
  itemName: string
  pricePointId: string
  pricePointLabel: string
  quantity: number
  unitPriceKobo: number
  baseUnitsDeducted: number
  totalKobo: number
}

export type SaleRecord = {
  id: string
  staffId: string
  staffName: string
  createdAt: string
  totalKobo: number
  status: SaleStatus
  lines: SaleLine[]
  voidReason?: string
}

export type StockMovement = {
  id: string
  itemId: string
  itemName: string
  type: MovementType
  quantityChange: number
  description: string
  createdAt: string
  userId?: string
  unitCostKobo?: number
}

export type StockLevel = {
  itemId: string
  quantity: number
  low: boolean
  negative: boolean
}

export type AppSettings = {
  businessName?: string
  businessCutoff: string
  offlineSessionDays: number
  theme: ThemeMode
  offlineMode: boolean
  showSetup: boolean
}

export type AuditEntry = {
  id: string
  userId: string
  userName: string
  userRole: Role
  action: string
  what: string
  oldValue: string
  newValue: string
  createdAt: string
}

export type AppNotification = {
  id: string
  auditEntryId: string
  action: string
  what: string
  userName: string
  userRole: Role
  createdAt: string
  readAt?: string
}
