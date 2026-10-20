import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../../domain/types'

let mockRepository: typeof import('../mockRepository').mockRepository

async function createAccount(role: User['role'], username: string) {
  return await mockRepository.createUser({
    name: `${role} test account`,
    username,
    email: `${username}@example.com`,
    password: 'secure-test-password',
    role,
  })
}

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
  ;({ mockRepository } = await import('../mockRepository'))
})

afterEach(() => {
  localStorage.clear()
})

describe('empty local mock repository', () => {
  it('starts with no seeded accounts, items, sales or notifications', async () => {
    await expect(mockRepository.listUsers()).resolves.toEqual([])
    await expect(mockRepository.listItems()).resolves.toEqual([])
    await expect(mockRepository.listSales()).resolves.toEqual([])
    await expect(mockRepository.listNotifications()).resolves.toEqual([])
  })

  it('removes legacy fixtures without deleting locally created records', async () => {
    localStorage.setItem('dqueens-users', JSON.stringify([
      { id: 'owner', name: 'Demo Owner' },
      {
        id: 'local-owner',
        name: 'Local Owner',
        username: 'local-owner',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        role: 'owner',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ]))
    localStorage.setItem('dqueens-items', JSON.stringify([
      { id: 'green-60', name: 'Green Bottle 60cl' },
      { id: 'local-item', name: 'Local item' },
    ]))
    localStorage.setItem('dqueens-movements', JSON.stringify([
      { id: 'm-01', itemId: 'green-60' },
      { id: 'local-movement', itemId: 'local-item' },
    ]))
    localStorage.setItem('dqueens-sales', JSON.stringify([
      { id: 'sale-01' },
      { id: 'local-sale' },
    ]))
    localStorage.setItem('dqueens-audit', JSON.stringify([
      { id: 'audit-1' },
      { id: 'local-audit' },
    ]))
    localStorage.setItem('dqueens-notifications', JSON.stringify([{ id: 'local-notification' }]))
    localStorage.removeItem('dqueens-mock-data-version')

    vi.resetModules()
    const { mockRepository: migratedRepository } = await import('../mockRepository')

    await expect(migratedRepository.listUsers()).resolves.toMatchObject([{ id: 'local-owner' }])
    await expect(migratedRepository.listItems()).resolves.toEqual([{ id: 'local-item', name: 'Local item' }])
    expect(JSON.parse(localStorage.getItem('dqueens-movements') ?? '[]')).toEqual([
      { id: 'local-movement', itemId: 'local-item' },
    ])
    await expect(migratedRepository.listSales()).resolves.toEqual([{ id: 'local-sale' }])
    await expect(migratedRepository.listAuditLog()).resolves.toEqual([{ id: 'local-audit' }])
    await expect(migratedRepository.listNotifications()).resolves.toEqual([{ id: 'local-notification' }])
  })

  it('creates hashed owner credentials and supports email sign-in after reload', async () => {
    const email = `owner-${crypto.randomUUID()}@example.com`
    const created = await mockRepository.createUser({
      name: 'Registered Owner',
      businessName: 'New Business',
      email,
      password: 'secure-test-password',
      role: 'owner',
    })

    const savedUsers = JSON.parse(localStorage.getItem('dqueens-users') ?? '[]') as Array<Record<string, unknown>>
    const savedAccount = savedUsers.find((user) => user.id === created.id)
    expect(savedAccount?.passwordHash).toEqual(expect.any(String))
    expect(savedAccount?.passwordSalt).toEqual(expect.any(String))
    expect(savedAccount).not.toHaveProperty('password')

    vi.resetModules()
    const { mockRepository: reloadedRepository } = await import('../mockRepository')
    await expect(reloadedRepository.authenticateUser(email, 'secure-test-password')).resolves.toMatchObject({
      id: created.id,
      role: 'owner',
    })
    await expect(reloadedRepository.authenticateUser(email, 'incorrect')).resolves.toBeUndefined()
  })

  it('preserves event-based stock counts and manager permissions', async () => {
    const manager = await createAccount('manager', `manager-${crypto.randomUUID()}`)
    const staff = await createAccount('staff', `staff-${crypto.randomUUID()}`)
    const item = await mockRepository.saveItem({
      id: crypto.randomUUID(),
      name: 'Inventory test item',
      categoryId: 'category-test',
      categoryName: 'Test category',
      baseUnit: 'can',
      packSize: 6,
      trackStock: true,
      costPriceKobo: 1250,
      reorderLevel: 4,
      pricePoints: [{ id: 'can', label: 'Can', priceKobo: 2000, baseUnitsUsed: 1 }],
    }, manager.id)

    await mockRepository.recordStockIn({
      itemId: item.id,
      crates: 2,
      looseUnits: 2,
      unitCostKobo: 1250,
      supplier: 'Test supplier',
      userId: manager.id,
    })
    await expect(mockRepository.getStockLevels()).resolves.toContainEqual({
      itemId: item.id,
      quantity: 14,
      low: false,
      negative: false,
    })
    await expect(mockRepository.recordStockAdjustment({
      itemId: item.id,
      newQuantity: 12,
      reason: 'Physical count',
      userId: staff.id,
    })).rejects.toThrow('Only an active owner or manager')
  })
})
