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

const USERS_STORAGE_KEY = 'dqueens-users'
const SETTINGS_STORAGE_KEY = 'dqueens-settings'
const ITEMS_STORAGE_KEY = 'dqueens-items'
const CATEGORIES_STORAGE_KEY = 'dqueens-categories'
const MOVEMENTS_STORAGE_KEY = 'dqueens-movements'
const SALES_STORAGE_KEY = 'dqueens-sales'
const AUDIT_STORAGE_KEY = 'dqueens-audit'
const NOTIFICATIONS_STORAGE_KEY = 'dqueens-notifications'
const MOCK_STORAGE_VERSION_KEY = 'dqueens-mock-data-version'
const LEGACY_SEED_IDS: Record<string, Set<string>> = {
  [USERS_STORAGE_KEY]: new Set(['owner', 'manager', 'staff-1', 'staff-2']),
  [CATEGORIES_STORAGE_KEY]: new Set([
    'green-bottle-beers', 'normal-beers', 'soft-drinks', 'juice', 'palm-wine', 'others', 'food',
  ]),
  [ITEMS_STORAGE_KEY]: new Set([
    'green-60', 'green-33', 'lager-50', 'stout-33', 'cola-50', 'orange-soda', 'malt-33',
    'water-75', 'orange-juice', 'palm-wine', 'energy-drink', 'pepper-soup', 'suya-plate',
    'fried-rice',
  ]),
  [MOVEMENTS_STORAGE_KEY]: new Set(Array.from({ length: 27 }, (_, index) => `m-${String(index + 1).padStart(2, '0')}`)),
  [SALES_STORAGE_KEY]: new Set(Array.from({ length: 12 }, (_, index) => `sale-${String(index + 1).padStart(2, '0')}`)),
  [AUDIT_STORAGE_KEY]: new Set(['audit-1', 'audit-2']),
}

const removeLegacySeedRows = (key: string, seedIds: Set<string>) => {
  const stored = localStorage.getItem(key)
  if (stored === null) return

  let rows: unknown
  try {
    rows = JSON.parse(stored)
  } catch {
    throw new Error(`Saved ${key.replace('dqueens-', '')} data is unreadable; sample data could not be removed safely.`)
  }
  if (!Array.isArray(rows)) {
    throw new Error(`Saved ${key.replace('dqueens-', '')} data is invalid; sample data could not be removed safely.`)
  }

  const retained = rows.filter((row: unknown) =>
    typeof row !== 'object' || row === null || !('id' in row)
    || typeof row.id !== 'string' || !seedIds.has(row.id),
  )
  if (retained.length !== rows.length) localStorage.setItem(key, JSON.stringify(retained))
}

if (localStorage.getItem(MOCK_STORAGE_VERSION_KEY) !== '3') {
  for (const [key, seedIds] of Object.entries(LEGACY_SEED_IDS)) removeLegacySeedRows(key, seedIds)
  localStorage.setItem(MOCK_STORAGE_VERSION_KEY, '3')
}

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
  if (stored === null) return []

  let users: unknown
  try {
    users = JSON.parse(stored)
  } catch {
    throw new Error('Saved account data is unreadable.')
  }

  if (!Array.isArray(users) || !users.every((user) =>
    typeof user === 'object' && user !== null &&
    typeof user.id === 'string' && typeof user.name === 'string' &&
    typeof user.username === 'string' &&
    typeof user.passwordHash === 'string' && typeof user.passwordSalt === 'string' &&
    (user.role === 'owner' || user.role === 'manager' || user.role === 'staff') &&
    typeof user.isActive === 'boolean' && typeof user.createdAt === 'string'
  )) {
    throw new Error('Saved account data is invalid.')
  }

  return users.map((user) => ({ ...(user as CredentialUser), password: '' }))
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

const loadCollection = <T,>(key: string): T[] => {
  const stored = localStorage.getItem(key)
  if (stored === null) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Expected a list')
    return parsed as T[]
  } catch {
    throw new Error(`Saved ${key.replace('dqueens-', '')} data is unreadable.`)
  }
}

const settings: AppSettings = {
  businessName: '',
  businessCutoff: '23:00',
  offlineSessionDays: 3,
  theme: 'dark',
  offlineMode: false,
  showSetup: false,
}

const state = {
  items: loadCollection<Item>(ITEMS_STORAGE_KEY),
  categories: loadCollection<Category>(CATEGORIES_STORAGE_KEY),
  users: loadUsers(),
  stockMovements: loadCollection<StockMovement>(MOVEMENTS_STORAGE_KEY),
  sales: loadCollection<SaleRecord>(SALES_STORAGE_KEY),
  settings: loadSettings(),
  auditLog: loadCollection<AuditEntry>(AUDIT_STORAGE_KEY),
  notifications: loadCollection<AppNotification>(NOTIFICATIONS_STORAGE_KEY),
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
  if (!user.passwordHash || !user.passwordSalt) return false
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
    if (!staff || !['owner', 'staff'].includes(staff.role) || !staff.isActive) {
      throw new Error('An active owner or staff account is required to confirm a sale.')
    }
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

    const authenticated = await verifyPassword(user, password)
    if (!authenticated) return undefined
    return user
  },

  async createUser(user) {
    await delay(120)
    const username = user.username?.trim() || `owner-${crypto.randomUUID()}`
    if (state.users.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('That username is already in use')
    }
    const email = user.email?.trim().toLowerCase()
    if (email && state.users.some((entry) => entry.email?.toLowerCase() === email)) {
      throw new Error('Email already registered.')
    }
    const created: CredentialUser = {
      id: crypto.randomUUID(),
      name: user.name.trim(),
      ...(email ? { email } : {}),
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
