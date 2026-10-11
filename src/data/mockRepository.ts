import { businessDate } from '../domain/business'
import type {
  AppSettings,
  AppNotification,
  AuditEntry,
  Category,
  Item,
  SaleRecord,
  StockLevel,
  StockMovement,
  User,
} from '../domain/types'
import type { InventoryRepository } from './repository'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

const now = new Date()
const today = new Date(now)
const yesterday = new Date(now)
yesterday.setDate(yesterday.getDate() - 1)

const categorySeed: Category[] = [
  { id: 'green-bottle-beers', name: 'Green Bottle Beers', sortOrder: 1 },
  { id: 'normal-beers', name: 'Normal Beers', sortOrder: 2 },
  { id: 'soft-drinks', name: 'Soft Drinks', sortOrder: 3 },
  { id: 'juice', name: 'Juice', sortOrder: 4 },
  { id: 'palm-wine', name: 'Palm Wine', sortOrder: 5 },
  { id: 'others', name: 'Others', sortOrder: 6 },
  { id: 'food', name: 'Food', sortOrder: 7 },
]

const itemSeed: Item[] = [
  {
    id: 'green-60',
    name: 'Green Bottle 60cl',
    categoryId: 'green-bottle-beers',
    categoryName: 'Green Bottle Beers',
    baseUnit: 'bottle',
    packSize: 12,
    trackStock: true,
    costPriceKobo: 7800,
    reorderLevel: 10,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2500, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'green-33',
    name: 'Green Bottle 33cl',
    categoryId: 'green-bottle-beers',
    categoryName: 'Green Bottle Beers',
    baseUnit: 'bottle',
    packSize: 24,
    trackStock: true,
    costPriceKobo: 5200,
    reorderLevel: 12,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2000, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1622483767028-3f66f2b4624d?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'lager-50',
    name: 'Lager 50cl',
    categoryId: 'normal-beers',
    categoryName: 'Normal Beers',
    baseUnit: 'bottle',
    packSize: 12,
    trackStock: true,
    costPriceKobo: 7200,
    reorderLevel: 10,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2600, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'stout-33',
    name: 'Stout 33cl',
    categoryId: 'normal-beers',
    categoryName: 'Normal Beers',
    baseUnit: 'bottle',
    packSize: 24,
    trackStock: true,
    costPriceKobo: 6500,
    reorderLevel: 18,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2200, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'cola-50',
    name: 'Cola 50cl',
    categoryId: 'soft-drinks',
    categoryName: 'Soft Drinks',
    baseUnit: 'bottle',
    packSize: 12,
    trackStock: true,
    costPriceKobo: 5800,
    reorderLevel: 12,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 1800, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1622483767028-3f66f2b4624d?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'orange-soda',
    name: 'Orange Soda 50cl',
    categoryId: 'soft-drinks',
    categoryName: 'Soft Drinks',
    baseUnit: 'bottle',
    packSize: 12,
    trackStock: true,
    costPriceKobo: 5600,
    reorderLevel: 12,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 1900, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'malt-33',
    name: 'Malt 33cl',
    categoryId: 'soft-drinks',
    categoryName: 'Soft Drinks',
    baseUnit: 'bottle',
    packSize: 24,
    trackStock: true,
    costPriceKobo: 6200,
    reorderLevel: 8,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2100, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'water-75',
    name: 'Water 75cl',
    categoryId: 'soft-drinks',
    categoryName: 'Soft Drinks',
    baseUnit: 'bottle',
    packSize: 12,
    trackStock: true,
    costPriceKobo: 4300,
    reorderLevel: 12,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 1500, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'orange-juice',
    name: 'Orange Juice 1L',
    categoryId: 'juice',
    categoryName: 'Juice',
    baseUnit: 'bottle',
    packSize: 12,
    trackStock: true,
    costPriceKobo: 6400,
    reorderLevel: 10,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2200, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'palm-wine',
    name: 'Palm Wine',
    categoryId: 'palm-wine',
    categoryName: 'Palm Wine',
    baseUnit: 'cup',
    packSize: 40,
    trackStock: true,
    costPriceKobo: 2600,
    reorderLevel: 20,
    pricePoints: [
      { id: 'cup', label: 'Cup', priceKobo: 1200, baseUnitsUsed: 1 },
      { id: 'bottle', label: 'Bottle', priceKobo: 4200, baseUnitsUsed: 4 },
    ],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'energy-drink',
    name: 'Energy Drink 33cl',
    categoryId: 'others',
    categoryName: 'Others',
    baseUnit: 'bottle',
    packSize: 24,
    trackStock: true,
    costPriceKobo: 7600,
    reorderLevel: 12,
    pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 2600, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'pepper-soup',
    name: 'Pepper Soup',
    categoryId: 'food',
    categoryName: 'Food',
    baseUnit: 'plate',
    packSize: 1,
    trackStock: false,
    costPriceKobo: 1600,
    reorderLevel: 0,
    pricePoints: [{ id: 'plate', label: 'Plate', priceKobo: 3500, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'suya-plate',
    name: 'Suya Plate',
    categoryId: 'food',
    categoryName: 'Food',
    baseUnit: 'plate',
    packSize: 1,
    trackStock: false,
    costPriceKobo: 2000,
    reorderLevel: 0,
    pricePoints: [{ id: 'plate', label: 'Plate', priceKobo: 4200, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1559847844-d7f939f52f83?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
  {
    id: 'fried-rice',
    name: 'Fried Rice and Chicken',
    categoryId: 'food',
    categoryName: 'Food',
    baseUnit: 'plate',
    packSize: 1,
    trackStock: false,
    costPriceKobo: 2600,
    reorderLevel: 0,
    pricePoints: [{ id: 'plate', label: 'Plate', priceKobo: 5500, baseUnitsUsed: 1 }],
    archived: false,
    photo: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    createdAt: new Date(yesterday).toISOString(),
  },
]

const userSeed: User[] = [
  { id: 'owner', name: 'Amaka Okafor', username: 'owner', password: 'password', role: 'owner', isActive: true, createdAt: new Date(yesterday).toISOString() },
  { id: 'manager', name: 'Tunde Adekoya', username: 'manager', password: 'password', role: 'manager', isActive: true, createdAt: new Date(yesterday).toISOString() },
  { id: 'staff-1', name: 'David Okon', username: 'staff1', password: 'password', role: 'staff', isActive: true, createdAt: new Date(yesterday).toISOString() },
  { id: 'staff-2', name: 'Sola Bello', username: 'staff2', password: 'password', role: 'staff', isActive: true, createdAt: new Date(yesterday).toISOString() },
]

const USERS_STORAGE_KEY = 'dqueens-users'
const SETTINGS_STORAGE_KEY = 'dqueens-settings'
const ITEMS_STORAGE_KEY = 'dqueens-items'
const CATEGORIES_STORAGE_KEY = 'dqueens-categories'
const MOVEMENTS_STORAGE_KEY = 'dqueens-movements'
const SALES_STORAGE_KEY = 'dqueens-sales'
const AUDIT_STORAGE_KEY = 'dqueens-audit'
const NOTIFICATIONS_STORAGE_KEY = 'dqueens-notifications'

type CredentialUser = User & { passwordHash?: string; passwordSalt?: string }

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [])

const hashPassword = async (password: string, salt = crypto.getRandomValues(new Uint8Array(16))) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    key,
    256,
  )
  return { passwordHash: bytesToHex(new Uint8Array(hash)), passwordSalt: bytesToHex(salt) }
}

const loadUsers = (): CredentialUser[] => {
  const stored = localStorage.getItem(USERS_STORAGE_KEY)
  if (stored === null) return [...userSeed]

  let users: unknown
  try {
    users = JSON.parse(stored)
  } catch {
    throw new Error('Saved account data is unreadable. Clear this site’s data to restore demo accounts.')
  }

  if (!Array.isArray(users) || !users.every((user) =>
    typeof user === 'object' && user !== null &&
    typeof user.id === 'string' && typeof user.name === 'string' &&
    typeof user.username === 'string' &&
    (typeof user.password === 'string' || (typeof user.passwordHash === 'string' && typeof user.passwordSalt === 'string')) &&
    (user.role === 'owner' || user.role === 'manager' || user.role === 'staff') &&
    typeof user.isActive === 'boolean' && typeof user.createdAt === 'string'
  )) {
    throw new Error('Saved account data is invalid. Clear this site’s data to restore demo accounts.')
  }

  return users.map((user) => {
    const savedUser = user as CredentialUser
    return { ...savedUser, password: savedUser.password ?? '' }
  })
}

const persistUsers = async (users: CredentialUser[]): Promise<CredentialUser[]> => {
  const storedUsers = await Promise.all(users.map(async (user) => {
    const credential = user.passwordHash && user.passwordSalt
      ? { passwordHash: user.passwordHash, passwordSalt: user.passwordSalt }
      : await hashPassword(user.password)
    const { password: _password, ...account } = user
    return { ...account, ...credential }
  }))
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(storedUsers))
  return storedUsers.map((user) => ({ ...user, password: '' }))
}

const loadSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (stored === null) return { ...settings }
  try {
    return { ...settings, ...JSON.parse(stored) as Partial<AppSettings> }
  } catch {
    throw new Error('Saved business settings are unreadable. Clear this site’s data to restore defaults.')
  }
}

const loadCollection = <T,>(key: string, seed: T[]): T[] => {
  const stored = localStorage.getItem(key)
  if (stored === null) return [...seed]
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Expected a list')
    return parsed as T[]
  } catch {
    throw new Error(`Saved ${key.replace('dqueens-', '')} data is unreadable. Clear this site's data to restore demo records.`)
  }
}

const stockMovements: StockMovement[] = [
  { id: 'm-01', itemId: 'green-60', itemName: 'Green Bottle 60cl', type: 'opening', quantityChange: 18, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-02', itemId: 'green-60', itemName: 'Green Bottle 60cl', type: 'purchase', quantityChange: 24, description: 'Crate purchase', createdAt: new Date(yesterday.getTime() - 86400000).toISOString(), userId: 'manager', unitCostKobo: 8400 },
  { id: 'm-03', itemId: 'green-60', itemName: 'Green Bottle 60cl', type: 'sale', quantityChange: -8, description: 'Quick sale', createdAt: new Date(yesterday).toISOString(), userId: 'staff-1' },
  { id: 'm-04', itemId: 'green-60', itemName: 'Green Bottle 60cl', type: 'sale', quantityChange: -5, description: 'Quick sale', createdAt: new Date(today).toISOString(), userId: 'staff-2' },
  { id: 'm-05', itemId: 'green-33', itemName: 'Green Bottle 33cl', type: 'opening', quantityChange: 20, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-06', itemId: 'green-33', itemName: 'Green Bottle 33cl', type: 'purchase', quantityChange: 18, description: 'Supplier restock', createdAt: new Date(yesterday.getTime() - 86400000).toISOString(), userId: 'manager', unitCostKobo: 6500 },
  { id: 'm-07', itemId: 'green-33', itemName: 'Green Bottle 33cl', type: 'sale', quantityChange: -6, description: 'Quick sale', createdAt: new Date(yesterday).toISOString(), userId: 'staff-1' },
  { id: 'm-08', itemId: 'green-33', itemName: 'Green Bottle 33cl', type: 'sale', quantityChange: -4, description: 'Quick sale', createdAt: new Date(today).toISOString(), userId: 'staff-2' },
  { id: 'm-09', itemId: 'lager-50', itemName: 'Lager 50cl', type: 'opening', quantityChange: 12, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-10', itemId: 'lager-50', itemName: 'Lager 50cl', type: 'purchase', quantityChange: 12, description: 'Crate purchase', createdAt: new Date(yesterday.getTime() - 86400000).toISOString(), userId: 'manager', unitCostKobo: 7800 },
  { id: 'm-11', itemId: 'lager-50', itemName: 'Lager 50cl', type: 'sale', quantityChange: -7, description: 'Staff sale', createdAt: new Date(yesterday).toISOString(), userId: 'staff-1' },
  { id: 'm-12', itemId: 'lager-50', itemName: 'Lager 50cl', type: 'sale', quantityChange: -9, description: 'Staff sale', createdAt: new Date(today).toISOString(), userId: 'staff-2' },
  { id: 'm-13', itemId: 'cola-50', itemName: 'Cola 50cl', type: 'opening', quantityChange: 13, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-14', itemId: 'cola-50', itemName: 'Cola 50cl', type: 'purchase', quantityChange: 10, description: 'Stock in', createdAt: new Date(yesterday.getTime() - 86400000).toISOString(), userId: 'manager', unitCostKobo: 6000 },
  { id: 'm-15', itemId: 'cola-50', itemName: 'Cola 50cl', type: 'sale', quantityChange: -4, description: 'Quick sale', createdAt: new Date(today).toISOString(), userId: 'staff-1' },
  { id: 'm-16', itemId: 'orange-soda', itemName: 'Orange Soda 50cl', type: 'opening', quantityChange: 10, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-17', itemId: 'orange-soda', itemName: 'Orange Soda 50cl', type: 'purchase', quantityChange: 12, description: 'Top-up', createdAt: new Date(yesterday).toISOString(), userId: 'manager', unitCostKobo: 6200 },
  { id: 'm-18', itemId: 'malt-33', itemName: 'Malt 33cl', type: 'opening', quantityChange: 6, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-19', itemId: 'malt-33', itemName: 'Malt 33cl', type: 'purchase', quantityChange: 8, description: 'Restock', createdAt: new Date(yesterday).toISOString(), userId: 'manager', unitCostKobo: 6800 },
  { id: 'm-20', itemId: 'water-75', itemName: 'Water 75cl', type: 'opening', quantityChange: 14, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-21', itemId: 'water-75', itemName: 'Water 75cl', type: 'purchase', quantityChange: 12, description: 'Crate purchase', createdAt: new Date(yesterday).toISOString(), userId: 'manager', unitCostKobo: 4200 },
  { id: 'm-22', itemId: 'orange-juice', itemName: 'Orange Juice 1L', type: 'opening', quantityChange: 9, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-23', itemId: 'orange-juice', itemName: 'Orange Juice 1L', type: 'purchase', quantityChange: 12, description: 'Crate purchase', createdAt: new Date(yesterday).toISOString(), userId: 'manager', unitCostKobo: 6500 },
  { id: 'm-24', itemId: 'palm-wine', itemName: 'Palm Wine', type: 'opening', quantityChange: 30, description: 'Opening keg', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-25', itemId: 'palm-wine', itemName: 'Palm Wine', type: 'purchase', quantityChange: 20, description: 'Keg refill', createdAt: new Date(yesterday).toISOString(), userId: 'manager', unitCostKobo: 4200 },
  { id: 'm-26', itemId: 'energy-drink', itemName: 'Energy Drink 33cl', type: 'opening', quantityChange: 15, description: 'Opening stock', createdAt: new Date(yesterday.getTime() - 2 * 86400000).toISOString(), userId: 'owner' },
  { id: 'm-27', itemId: 'energy-drink', itemName: 'Energy Drink 33cl', type: 'purchase', quantityChange: 20, description: 'Top-up order', createdAt: new Date(yesterday).toISOString(), userId: 'manager', unitCostKobo: 7600 },
]

const sales: SaleRecord[] = [
  { id: 'sale-01', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(yesterday.getTime() + 3 * 3600000).toISOString(), totalKobo: 9500, status: 'synced', lines: [{ itemId: 'green-60', itemName: 'Green Bottle 60cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2500, baseUnitsDeducted: 1, totalKobo: 5000 }, { itemId: 'cola-50', itemName: 'Cola 50cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 1800, baseUnitsDeducted: 1, totalKobo: 3600 }, { itemId: 'pepper-soup', itemName: 'Pepper Soup', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 3500, baseUnitsDeducted: 1, totalKobo: 3500 }] },
  { id: 'sale-02', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(yesterday.getTime() + 5 * 3600000).toISOString(), totalKobo: 9200, status: 'synced', lines: [{ itemId: 'palm-wine', itemName: 'Palm Wine', pricePointId: 'cup', pricePointLabel: 'Cup', quantity: 4, unitPriceKobo: 1200, baseUnitsDeducted: 1, totalKobo: 4800 }, { itemId: 'malt-33', itemName: 'Malt 33cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2100, baseUnitsDeducted: 1, totalKobo: 4200 }] },
  { id: 'sale-03', staffId: 'staff-2', staffName: 'Sola Bello', createdAt: new Date(yesterday.getTime() + 7.5 * 3600000).toISOString(), totalKobo: 10700, status: 'waiting', lines: [{ itemId: 'lager-50', itemName: 'Lager 50cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 3, unitPriceKobo: 2600, baseUnitsDeducted: 1, totalKobo: 7800 }, { itemId: 'water-75', itemName: 'Water 75cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 1, unitPriceKobo: 1500, baseUnitsDeducted: 1, totalKobo: 1500 }, { itemId: 'suya-plate', itemName: 'Suya Plate', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 4200, baseUnitsDeducted: 1, totalKobo: 4200 }] },
  { id: 'sale-04', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(today.getTime() + 1 * 3600000).toISOString(), totalKobo: 6100, status: 'synced', lines: [{ itemId: 'orange-soda', itemName: 'Orange Soda 50cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 1900, baseUnitsDeducted: 1, totalKobo: 3800 }, { itemId: 'fried-rice', itemName: 'Fried Rice and Chicken', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 5500, baseUnitsDeducted: 1, totalKobo: 5500 }] },
  { id: 'sale-05', staffId: 'staff-2', staffName: 'Sola Bello', createdAt: new Date(today.getTime() + 1.5 * 3600000).toISOString(), totalKobo: 7900, status: 'waiting', lines: [{ itemId: 'green-33', itemName: 'Green Bottle 33cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2000, baseUnitsDeducted: 1, totalKobo: 4000 }, { itemId: 'energy-drink', itemName: 'Energy Drink 33cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2600, baseUnitsDeducted: 1, totalKobo: 5200 }] },
  { id: 'sale-06', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(today.getTime() + 2 * 3600000).toISOString(), totalKobo: 8400, status: 'synced', lines: [{ itemId: 'palm-wine', itemName: 'Palm Wine', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 4200, baseUnitsDeducted: 4, totalKobo: 8400 }] },
  { id: 'sale-07', staffId: 'staff-2', staffName: 'Sola Bello', createdAt: new Date(today.getTime() + 3 * 3600000).toISOString(), totalKobo: 6200, status: 'synced', lines: [{ itemId: 'water-75', itemName: 'Water 75cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 1500, baseUnitsDeducted: 1, totalKobo: 3000 }, { itemId: 'orange-juice', itemName: 'Orange Juice 1L', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2200, baseUnitsDeducted: 1, totalKobo: 4400 }] },
  { id: 'sale-08', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(today.getTime() + 4 * 3600000).toISOString(), totalKobo: 6900, status: 'synced', lines: [{ itemId: 'lager-50', itemName: 'Lager 50cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2600, baseUnitsDeducted: 1, totalKobo: 5200 }, { itemId: 'pepper-soup', itemName: 'Pepper Soup', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 3500, baseUnitsDeducted: 1, totalKobo: 3500 }] },
  { id: 'sale-09', staffId: 'staff-2', staffName: 'Sola Bello', createdAt: new Date(today.getTime() + 5 * 3600000).toISOString(), totalKobo: 5100, status: 'waiting', lines: [{ itemId: 'malt-33', itemName: 'Malt 33cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 1, unitPriceKobo: 2100, baseUnitsDeducted: 1, totalKobo: 2100 }, { itemId: 'green-60', itemName: 'Green Bottle 60cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 1, unitPriceKobo: 2500, baseUnitsDeducted: 1, totalKobo: 2500 }, { itemId: 'suya-plate', itemName: 'Suya Plate', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 4200, baseUnitsDeducted: 1, totalKobo: 4200 }] },
  { id: 'sale-10', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(today.getTime() + 6 * 3600000).toISOString(), totalKobo: 7800, status: 'synced', lines: [{ itemId: 'cola-50', itemName: 'Cola 50cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 3, unitPriceKobo: 1800, baseUnitsDeducted: 1, totalKobo: 5400 }, { itemId: 'fried-rice', itemName: 'Fried Rice and Chicken', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 5500, baseUnitsDeducted: 1, totalKobo: 5500 }] },
  { id: 'sale-11', staffId: 'staff-2', staffName: 'Sola Bello', createdAt: new Date(today.getTime() + 7 * 3600000).toISOString(), totalKobo: 7300, status: 'synced', lines: [{ itemId: 'orange-soda', itemName: 'Orange Soda 50cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 1900, baseUnitsDeducted: 1, totalKobo: 3800 }, { itemId: 'green-60', itemName: 'Green Bottle 60cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 1, unitPriceKobo: 2500, baseUnitsDeducted: 1, totalKobo: 2500 }, { itemId: 'pepper-soup', itemName: 'Pepper Soup', pricePointId: 'plate', pricePointLabel: 'Plate', quantity: 1, unitPriceKobo: 3500, baseUnitsDeducted: 1, totalKobo: 3500 }] },
  { id: 'sale-12', staffId: 'staff-1', staffName: 'David Okon', createdAt: new Date(today.getTime() + 8 * 3600000).toISOString(), totalKobo: 9800, status: 'synced', lines: [{ itemId: 'energy-drink', itemName: 'Energy Drink 33cl', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2600, baseUnitsDeducted: 1, totalKobo: 5200 }, { itemId: 'orange-juice', itemName: 'Orange Juice 1L', pricePointId: 'bottle', pricePointLabel: 'Bottle', quantity: 2, unitPriceKobo: 2200, baseUnitsDeducted: 1, totalKobo: 4400 }] },
]

const auditLog: AuditEntry[] = [
  { id: 'audit-1', userId: 'owner', userName: 'Amaka Okafor', userRole: 'owner', action: 'Updated price', what: 'Green Bottle 60cl', oldValue: '₦2,500', newValue: '₦2,700', createdAt: new Date(yesterday.getTime() - 12 * 3600000).toISOString() },
  { id: 'audit-2', userId: 'manager', userName: 'Tunde Adekoya', userRole: 'manager', action: 'Created item', what: 'Rock City Water', oldValue: 'N/A', newValue: 'Created', createdAt: new Date(yesterday.getTime() - 6 * 3600000).toISOString() },
]

const settings: AppSettings = {
  businessName: "D'Queens",
  businessCutoff: '23:00',
  offlineSessionDays: 3,
  theme: 'dark',
  offlineMode: false,
  showSetup: false,
}

const state = {
  items: loadCollection(ITEMS_STORAGE_KEY, itemSeed),
  categories: loadCollection(CATEGORIES_STORAGE_KEY, categorySeed),
  users: loadUsers() as CredentialUser[],
  stockMovements: loadCollection(MOVEMENTS_STORAGE_KEY, stockMovements),
  sales: loadCollection(SALES_STORAGE_KEY, sales),
  settings: loadSettings(),
  auditLog: loadCollection(AUDIT_STORAGE_KEY, auditLog),
  notifications: loadCollection<AppNotification>(NOTIFICATIONS_STORAGE_KEY, []),
}

const persistAuditEvent = (userId: string, action: string, what: string, oldValue: string, newValue: string) => {
  const actor = state.users.find((user) => user.id === userId)
  if (!actor) throw new Error('The user responsible for this change could not be verified.')
  const entry: AuditEntry = {
    id: `audit-${crypto.randomUUID()}`,
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    action,
    what,
    oldValue,
    newValue,
    createdAt: new Date().toISOString(),
  }
  const notification: AppNotification = {
    id: `notification-${crypto.randomUUID()}`,
    auditEntryId: entry.id,
    action,
    what,
    userName: actor.name,
    userRole: actor.role,
    createdAt: entry.createdAt,
  }
  const auditEntries = [...state.auditLog, entry]
  const notifications = [notification, ...state.notifications]
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditEntries))
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
  state.auditLog = auditEntries
  state.notifications = notifications
}

const verifyPassword = async (user: CredentialUser, password: string) => {
  if (!user.passwordHash || !user.passwordSalt) return user.password === password
  return (await hashPassword(password, hexToBytes(user.passwordSalt))).passwordHash === user.passwordHash
}

const stockQuantity = (itemId: string) => state.stockMovements
  .filter((movement) => movement.itemId === itemId)
  .reduce((total, movement) => total + movement.quantityChange, 0)

const requireInventoryManager = (userId: string) => {
  const actor = state.users.find((user) => user.id === userId)
  if (!actor || !['owner', 'manager'].includes(actor.role) || !actor.isActive) {
    throw new Error('Only an active owner or manager can change inventory.')
  }
  return actor
}

const computeStockLevels = (): StockLevel[] => {
  const entries = new Map<string, number>()

  for (const movement of state.stockMovements) {
    if (!state.items.find((item) => item.id === movement.itemId)?.trackStock) continue
    entries.set(movement.itemId, (entries.get(movement.itemId) ?? 0) + movement.quantityChange)
  }

  return state.items
    .filter((item) => item.trackStock)
    .map((item) => {
      const quantity = entries.get(item.id) ?? 0
      return { itemId: item.id, quantity, low: quantity <= item.reorderLevel, negative: quantity < 0 }
    })
}

export const mockRepository: InventoryRepository = {
  async listItems() {
    await delay(200)
    return [...state.items]
  },

  async getItem(id) {
    await delay(120)
    return state.items.find((item) => item.id === id)
  },

  async saveItem(item, userId) {
    await delay(160)
    requireInventoryManager(userId)

    if (item.id) {
      const index = state.items.findIndex((entry) => entry.id === item.id)
      if (index >= 0) {
        const existing = state.items[index]
        const updated = { ...existing, ...item }
        const nextItems = state.items.map((entry) => entry.id === item.id ? updated : entry)
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems))
        const priceChanged = JSON.stringify(existing.pricePoints) !== JSON.stringify(updated.pricePoints)
        const imageChanged = existing.photo !== updated.photo
        const describe = (value: Item) => JSON.stringify({
          name: value.name,
          categoryName: value.categoryName,
          costPriceKobo: value.costPriceKobo,
          pricePoints: value.pricePoints,
          reorderLevel: value.reorderLevel,
          archived: value.archived,
          photo: value.photo ? (value.photo.startsWith('data:') ? 'Local image set' : 'Image URL set') : 'No image',
        })
        const action = [
          priceChanged ? 'Updated price' : '',
          imageChanged ? 'Changed item image' : '',
        ].filter(Boolean).join(' and ') || 'Updated item'
        persistAuditEvent(userId, action, updated.name, describe(existing), describe(updated))
        state.items = nextItems
        const quantity = stockQuantity(updated.id)
        if (updated.trackStock && quantity <= updated.reorderLevel && (!existing.trackStock || quantity > existing.reorderLevel)) {
          persistAuditEvent(userId, 'Low stock', updated.name, `${quantity} units`, `At or below reorder level (${updated.reorderLevel})`)
        }
        return updated
      }
    }

    const created: Item = {
      ...item,
      id: item.id ?? `item-${Date.now()}`,
      createdAt: item.createdAt ?? new Date().toISOString(),
      categoryName: item.categoryName ?? 'General',
      archived: item.archived ?? false,
      pricePoints: item.pricePoints ?? [],
      trackStock: item.trackStock ?? true,
      name: item.name ?? 'New item',
      categoryId: item.categoryId ?? 'others',
      baseUnit: item.baseUnit ?? 'unit',
      packSize: item.packSize ?? 1,
      costPriceKobo: item.costPriceKobo ?? 0,
      reorderLevel: item.reorderLevel ?? 0,
    }

    const nextItems = [...state.items, created]
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems))
    state.items = nextItems
    persistAuditEvent(userId, 'Created item', created.name, 'Not available', JSON.stringify({
      category: created.categoryName,
      pricePoints: created.pricePoints,
      reorderLevel: created.reorderLevel,
      image: created.photo ? 'Image added' : 'No image',
    }))
    if (created.trackStock && stockQuantity(created.id) <= created.reorderLevel) {
      persistAuditEvent(userId, 'Low stock', created.name, `${stockQuantity(created.id)} units`, `At or below reorder level (${created.reorderLevel})`)
    }
    return created
  },

  async archiveItem(id, userId) {
    await delay(150)
    requireInventoryManager(userId)
    const item = state.items.find((entry) => entry.id === id)
    if (!item) throw new Error('Item not found')
    const updated = { ...item, archived: true }
    const nextItems = state.items.map((entry) => entry.id === id ? updated : entry)
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems))
    state.items = nextItems
    persistAuditEvent(userId, 'Archived item', item.name, 'Active', 'Archived')
    return updated
  },

  async deleteItem(id, userId) {
    await delay(140)
    requireInventoryManager(userId)
    const item = state.items.find((entry) => entry.id === id)
    if (!item) return
    const sales = state.sales.some((sale) => sale.lines.some((line) => line.itemId === id))
    const stock = state.stockMovements.some((movement) => movement.itemId === id)
    if (sales || stock) {
      throw new Error('This item has sales or stock history. Archive it instead to preserve records.')
    }
    const nextItems = state.items.filter((entry) => entry.id !== id)
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems))
    state.items = nextItems
    persistAuditEvent(userId, 'Deleted item', item.name, 'Available', 'Deleted')
  },

  async listCategories() {
    await delay(120)
    return [...state.categories]
  },

  async saveCategory(category, userId) {
    await delay(120)
    requireInventoryManager(userId)
    const index = state.categories.findIndex((entry) => entry.id === category.id)
    if (index >= 0) {
      const updated = { ...state.categories[index], ...category }
      const nextCategories = state.categories.map((entry) => entry.id === category.id ? updated : entry)
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(nextCategories))
      state.categories = nextCategories
      persistAuditEvent(userId, 'Updated category', updated.name, 'Existing category', 'Updated')
      return updated
    }

    const created = { ...category, id: category.id || `cat-${Date.now()}` }
    const nextCategories = [...state.categories, created]
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(nextCategories))
    state.categories = nextCategories
    persistAuditEvent(userId, 'Created category', created.name, 'Not available', 'Created')
    return created
  },

  async recordSale({ staffId, lines, status = 'waiting' }) {
    await delay(250)
    const staff = state.users.find((user) => user.id === staffId)
    if (!staff || staff.role !== 'staff' || !staff.isActive) throw new Error('An active staff account is required to confirm a sale.')
    if (lines.length === 0) throw new Error('Add at least one item before confirming the sale.')
    const requestedByItem = new Map<string, number>()
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Sale quantities must be whole numbers greater than zero.')
      const item = state.items.find((entry) => entry.id === line.itemId && !entry.archived)
      if (!item) throw new Error(`${line.itemName} is no longer available.`)
      const pricePoint = item.pricePoints.find((point) => point.id === line.pricePointId)
      if (!pricePoint || pricePoint.priceKobo !== line.unitPriceKobo || pricePoint.baseUnitsUsed !== line.baseUnitsDeducted) {
        throw new Error(`${item.name} pricing has changed. Refresh the sale and try again.`)
      }
      if (!Number.isInteger(pricePoint.baseUnitsUsed) || pricePoint.baseUnitsUsed < 1) {
        throw new Error(`${item.name} has an invalid stock conversion and cannot be sold.`)
      }
      if (line.totalKobo !== line.quantity * line.unitPriceKobo) throw new Error(`The total for ${item.name} is invalid.`)
      requestedByItem.set(line.itemId, (requestedByItem.get(line.itemId) ?? 0) + line.quantity * line.baseUnitsDeducted)
    }
    for (const [itemId, quantity] of requestedByItem) {
      const item = state.items.find((entry) => entry.id === itemId)!
      if (item.trackStock && quantity > stockQuantity(itemId)) throw new Error(`Not enough ${item.name} in stock to confirm this sale.`)
    }

    const record: SaleRecord = {
      id: `sale-${Date.now()}`,
      staffId,
      staffName: staff?.name ?? 'Staff',
      createdAt: new Date().toISOString(),
      totalKobo: lines.reduce((sum, line) => sum + line.totalKobo, 0),
      status,
      lines,
    }

    const nextSales = [record, ...state.sales]
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(nextSales))
    state.sales = nextSales

    const newMovements: StockMovement[] = []
    for (const line of lines) {
      const item = state.items.find((entry) => entry.id === line.itemId)
      if (!item || !item.trackStock) continue
      newMovements.push({
        id: `mov-${Date.now()}-${line.itemId}`,
        itemId: item.id,
        itemName: item.name,
        type: 'sale',
        quantityChange: -line.quantity * line.baseUnitsDeducted,
        description: `Sale by ${staff?.name ?? 'staff'}`,
        createdAt: new Date().toISOString(),
        userId: staffId,
      })
    }

    if (newMovements.length > 0) {
      const nextMovements = [...state.stockMovements, ...newMovements]
      localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(nextMovements))
      state.stockMovements = nextMovements
    }

    persistAuditEvent(staffId, 'Confirmed sale', record.id, 'Pending', `${lines.length} line items · ${record.totalKobo} kobo`)
    for (const [itemId, quantity] of requestedByItem) {
      const item = state.items.find((entry) => entry.id === itemId)!
      const after = stockQuantity(itemId)
      const before = after + quantity
      if (item.trackStock && before > item.reorderLevel && after <= item.reorderLevel) {
        persistAuditEvent(staffId, 'Low stock', item.name, `${before} units`, `${after} units (reorder level ${item.reorderLevel})`)
      }
    }
    return record
  },

  async voidSale(id, reason, userId) {
    await delay(150)
    const actor = state.users.find((user) => user.id === userId && ['owner', 'manager'].includes(user.role))
    if (!actor) throw new Error('Only an owner or manager can void a sale.')
    const sale = state.sales.find((entry) => entry.id === id)
    if (!sale) return
    const previousStatus = sale.status
    sale.status = 'voided'
    sale.voidReason = reason
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(state.sales))
    persistAuditEvent(userId, 'Voided sale', sale.id, previousStatus, reason.trim() || 'No reason supplied')
  },

  async listSales() {
    await delay(140)
    return [...state.sales]
  },

  async recordStockIn({ itemId, crates, looseUnits, unitCostKobo, supplier, note, userId }) {
    await delay(180)
    requireInventoryManager(userId)

    const item = state.items.find((entry) => entry.id === itemId)
    if (!item) throw new Error('Item not found')

    if (!item.trackStock) throw new Error('Stock tracking is disabled for this item')
    if (!Number.isInteger(crates) || crates < 0 || !Number.isInteger(looseUnits) || looseUnits < 0) {
      throw new Error('Stock quantities must be non-negative whole numbers')
    }
    const quantityChange = crates * item.packSize + looseUnits
    if (quantityChange <= 0) throw new Error('Enter a quantity greater than zero')
    const movement: StockMovement = {
      id: `movement-${Date.now()}`,
      itemId,
      itemName: item.name,
      type: 'purchase',
      quantityChange,
      description: [
        `${crates} packs + ${looseUnits} loose ${item.baseUnit}`,
        supplier?.trim() ? `Supplier: ${supplier.trim()}` : '',
        note?.trim() ?? '',
      ].filter(Boolean).join(' · '),
      createdAt: new Date().toISOString(),
      userId,
      unitCostKobo,
    }

    const currentQuantity = stockQuantity(itemId)
    const nextMovements = [...state.stockMovements, movement]
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(nextMovements))
    state.stockMovements = nextMovements
    persistAuditEvent(userId, 'Added stock', item.name, `${currentQuantity} units`, `${currentQuantity + quantityChange} units · ${movement.description}`)
    if (currentQuantity > item.reorderLevel && currentQuantity + quantityChange <= item.reorderLevel) {
      persistAuditEvent(userId, 'Low stock', item.name, `${currentQuantity} units`, `${currentQuantity + quantityChange} units (reorder level ${item.reorderLevel})`)
    }
    return movement
  },

  async recordStockAdjustment({ itemId, newQuantity, reason, userId }) {
    await delay(180)
    requireInventoryManager(userId)
    const item = state.items.find((entry) => entry.id === itemId)
    if (!item) throw new Error('Item not found')
    if (!item.trackStock) throw new Error('Stock tracking is disabled for this item')
    if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error('Counted stock must be a non-negative whole number')
    if (!reason.trim()) throw new Error('Enter a reason for the stock adjustment')

    const currentQuantity = stockQuantity(itemId)
    const quantityChange = newQuantity - currentQuantity
    if (quantityChange === 0) throw new Error('The counted stock matches the current quantity')

    const movement: StockMovement = {
      id: `adjustment-${Date.now()}`,
      itemId,
      itemName: item.name,
      type: 'adjustment',
      quantityChange,
      description: `Stock count ${currentQuantity} → ${newQuantity} · ${reason.trim()}`,
      createdAt: new Date().toISOString(),
      userId,
    }
    const nextMovements = [...state.stockMovements, movement]
    localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(nextMovements))
    state.stockMovements = nextMovements
    persistAuditEvent(userId, 'Adjusted stock', item.name, `${currentQuantity} units`, `${newQuantity} units · ${reason.trim()}`)
    if (currentQuantity > item.reorderLevel && newQuantity <= item.reorderLevel) {
      persistAuditEvent(userId, 'Low stock', item.name, `${currentQuantity} units`, `${newQuantity} units (reorder level ${item.reorderLevel})`)
    }
    return movement
  },

  async listMovements() {
    await delay(120)
    return [...state.stockMovements]
  },

  async getStockLevels() {
    await delay(120)
    return computeStockLevels()
  },

  async listUsers() {
    await delay(120)
    return [...state.users]
  },

  async authenticateUser(identifier, password) {
    await delay(120)
    const normalizedIdentifier = identifier.trim().toLowerCase()
    const user = state.users.find((entry) =>
      (entry.username.toLowerCase() === normalizedIdentifier || entry.email?.toLowerCase() === normalizedIdentifier) &&
      entry.isActive,
    )
    if (!user) return undefined

    const authenticated = user.passwordHash && user.passwordSalt
      ? (await hashPassword(password, hexToBytes(user.passwordSalt))).passwordHash === user.passwordHash
      : user.password === password
    if (!authenticated) return undefined

    if (!user.passwordHash || !user.passwordSalt) {
      state.users = await persistUsers(state.users)
      return state.users.find((entry) => entry.id === user.id)
    }
    return user
  },

  async createUser(user) {
    await delay(120)
    const username = user.username.trim()
    if (state.users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('That username is already in use')
    }
    const created: CredentialUser = {
      id: `user-${Date.now()}`,
      name: user.name.trim(),
      ...(user.email ? { email: user.email.trim().toLowerCase() } : {}),
      username,
      password: user.password,
      role: user.role ?? 'staff',
      isActive: user.isActive ?? true,
      createdAt: new Date().toISOString(),
    }
    state.users = await persistUsers([...state.users, created])
    return state.users.find((entry) => entry.id === created.id)!
  },

  async updateUser(id, changes) {
    await delay(120)
    const user = state.users.find((entry) => entry.id === id)
    if (!user) throw new Error('User not found')
    const username = changes.username.trim()
    if (state.users.some((entry) => entry.id !== id && entry.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('That username is already in use')
    }
    const updated: CredentialUser = {
      ...user,
      name: changes.name.trim(),
      username,
      ...(changes.password
        ? { password: changes.password, passwordHash: undefined, passwordSalt: undefined }
        : {}),
      ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
    }
    const nextUsers = state.users.map((entry) => entry.id === id ? updated : entry)
    state.users = await persistUsers(nextUsers)
    return state.users.find((entry) => entry.id === id)!
  },

  async deleteUser(id) {
    await delay(120)
    const index = state.users.findIndex((entry) => entry.id === id)
    if (index === -1) throw new Error('User not found')
    const nextUsers = state.users.filter((entry) => entry.id !== id)
    state.users = await persistUsers(nextUsers)
  },

  async getSettings() {
    await delay(120)
    return { ...state.settings }
  },

  async saveSettings(settings) {
    await delay(150)
    const nextSettings = { ...state.settings, ...settings }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
    state.settings = nextSettings
    return { ...state.settings }
  },

  async listAuditLog() {
    await delay(120)
    return state.auditLog.map((entry) => ({ ...entry })).reverse()
  },

  async listNotifications() {
    await delay(100)
    return state.notifications.map((entry) => ({ ...entry }))
  },

  async markNotificationsRead() {
    const readAt = new Date().toISOString()
    const notifications = state.notifications.map((entry) => entry.readAt ? entry : { ...entry, readAt })
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
    state.notifications = notifications
  },

  async clearSales({ userId, password, from, to }) {
    await delay(160)
    const owner = state.users.find((user) => user.id === userId && user.role === 'owner' && user.isActive)
    if (!owner || !(await verifyPassword(owner, password))) throw new Error('The owner password could not be verified.')
    const validDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
      const parsed = new Date(`${value}T00:00:00.000Z`)
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    }
    if (!validDate(from) || !validDate(to) || from > to) {
      throw new Error('Select a valid date range.')
    }
    const retainedSales = state.sales.filter((sale) => {
      const saleDate = sale.createdAt.slice(0, 10)
      return saleDate < from || saleDate > to
    })
    const clearedCount = state.sales.length - retainedSales.length
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(retainedSales))
    state.sales = retainedSales
    persistAuditEvent(userId, 'Cleared sales records', `${from} to ${to}`, `${clearedCount} records removed`, 'Report generated before clearing')
    return clearedCount
  },
}

export const currentBusinessDate = () => businessDate(Date.now())
