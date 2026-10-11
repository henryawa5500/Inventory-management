import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockRepository } from '../mockRepository'

describe('mock repository sign-in', () => {
  afterEach(() => {
    localStorage.removeItem('dqueens-users')
    localStorage.removeItem('dqueens-items')
    localStorage.removeItem('dqueens-categories')
    localStorage.removeItem('dqueens-movements')
    localStorage.removeItem('dqueens-sales')
    localStorage.removeItem('dqueens-audit')
    localStorage.removeItem('dqueens-notifications')
  })

  it('authenticates seeded demo accounts by username and password', async () => {
    await expect(mockRepository.authenticateUser('manager', 'password')).resolves.toMatchObject({
      id: 'manager',
      role: 'manager',
    })
    await expect(mockRepository.authenticateUser('manager', 'incorrect')).resolves.toBeUndefined()
  })

  it('persists created accounts so they can sign in after an app reload', async () => {
    const username = `owner-${Date.now()}`
    const created = await mockRepository.createUser({
      name: 'Registered Owner',
      email: `${username}@example.com`,
      username,
      password: 'secure-test-password',
      role: 'owner',
    })

    const savedUsers = JSON.parse(localStorage.getItem('dqueens-users') ?? '[]') as Array<Record<string, unknown>>
    const savedAccount = savedUsers.find((user) => user.id === created.id)
    expect(savedAccount).toMatchObject({ username, role: 'owner' })
    expect(savedAccount?.passwordHash).toEqual(expect.any(String))
    expect(savedAccount?.passwordSalt).toEqual(expect.any(String))
    expect(savedAccount).not.toHaveProperty('password')
    vi.resetModules()
    const { mockRepository: reloadedRepository } = await import('../mockRepository')
    await expect(reloadedRepository.authenticateUser(username, 'secure-test-password')).resolves.toMatchObject({
      id: created.id,
      role: 'owner',
    })
    await expect(reloadedRepository.authenticateUser(`${username}@EXAMPLE.COM`, 'secure-test-password')).resolves.toMatchObject({
      id: created.id,
      role: 'owner',
    })
    await reloadedRepository.deleteUser(created.id)
  })

  it('creates inventory items and records stock intake and count adjustments', async () => {
    const id = `test-inventory-${Date.now()}`
    const item = await mockRepository.saveItem({
      id,
      name: 'Test inventory item',
      categoryId: 'others',
      categoryName: 'Others',
      baseUnit: 'can',
      packSize: 6,
      trackStock: true,
      costPriceKobo: 1250,
      reorderLevel: 4,
      pricePoints: [{ id: 'can', label: 'Can', priceKobo: 2000, baseUnitsUsed: 1 }],
    }, 'manager')

    await mockRepository.recordStockIn({
      itemId: item.id,
      crates: 2,
      looseUnits: 2,
      unitCostKobo: 1250,
      supplier: 'Test supplier',
      userId: 'manager',
    })
    await expect(mockRepository.getStockLevels()).resolves.toContainEqual({
      itemId: item.id,
      quantity: 14,
      low: false,
      negative: false,
    })

    await mockRepository.recordStockAdjustment({
      itemId: item.id,
      newQuantity: 12,
      reason: 'Physical count',
      userId: 'manager',
    })
    await expect(mockRepository.getStockLevels()).resolves.toContainEqual({
      itemId: item.id,
      quantity: 12,
      low: false,
      negative: false,
    })
  })

  it('persists confirmed sales, records activity and rejects sales above stock', async () => {
    const item = await mockRepository.saveItem({
      id: `sale-test-${Date.now()}`,
      name: 'Sale test item',
      categoryId: 'others',
      categoryName: 'Others',
      baseUnit: 'bottle',
      packSize: 1,
      trackStock: true,
      costPriceKobo: 100,
      reorderLevel: 1,
      pricePoints: [{ id: 'bottle', label: 'Bottle', priceKobo: 500, baseUnitsUsed: 1 }],
    }, 'manager')

    const line = {
      itemId: item.id,
      itemName: item.name,
      pricePointId: 'bottle',
      pricePointLabel: 'Bottle',
      quantity: 1,
      unitPriceKobo: 500,
      baseUnitsDeducted: 1,
      totalKobo: 500,
    }
    await expect(mockRepository.recordSale({ staffId: 'staff-1', lines: [line] })).rejects.toThrow('Not enough')

    await mockRepository.recordStockIn({
      itemId: item.id,
      crates: 0,
      looseUnits: 2,
      unitCostKobo: 100,
      userId: 'manager',
    })
    await expect(mockRepository.recordStockIn({
      itemId: item.id,
      crates: 0,
      looseUnits: 1,
      unitCostKobo: 100,
      userId: 'staff-1',
    })).rejects.toThrow('Only an active owner or manager')
    const sale = await mockRepository.recordSale({ staffId: 'staff-1', lines: [line] })
    const storedSales = JSON.parse(localStorage.getItem('dqueens-sales') ?? '[]') as Array<{ id: string }>
    expect(storedSales.some((entry) => entry.id === sale.id)).toBe(true)
    await expect(mockRepository.getStockLevels()).resolves.toContainEqual({
      itemId: item.id,
      quantity: 1,
      low: true,
      negative: false,
    })
    await expect(mockRepository.listAuditLog()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'Confirmed sale', userId: 'staff-1', userRole: 'staff' }),
      expect.objectContaining({ action: 'Added stock', userId: 'manager', userRole: 'manager' }),
    ]))
    await expect(mockRepository.listNotifications()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'Confirmed sale', userName: 'David Okon' }),
    ]))

    vi.resetModules()
    const { mockRepository: reloadedRepository } = await import('../mockRepository')
    await expect(reloadedRepository.listSales()).resolves.toContainEqual(expect.objectContaining({ id: sale.id }))
    await expect(reloadedRepository.listAuditLog()).resolves.toContainEqual(expect.objectContaining({ action: 'Confirmed sale' }))
  })

  it('clears sales only after owner verification and retains the audit history', async () => {
    const item = await mockRepository.saveItem({
      id: `clear-test-${Date.now()}`,
      name: 'Clear test item',
      categoryId: 'others',
      categoryName: 'Others',
      baseUnit: 'plate',
      packSize: 1,
      trackStock: false,
      costPriceKobo: 100,
      reorderLevel: 0,
      pricePoints: [{ id: 'plate', label: 'Plate', priceKobo: 500, baseUnitsUsed: 1 }],
    }, 'manager')
    const sale = await mockRepository.recordSale({
      staffId: 'staff-1',
      lines: [{
        itemId: item.id, itemName: item.name, pricePointId: 'plate', pricePointLabel: 'Plate',
        quantity: 1, unitPriceKobo: 500, baseUnitsDeducted: 1, totalKobo: 500,
      }],
    })
    const date = sale.createdAt.slice(0, 10)

    await expect(mockRepository.clearSales({ userId: 'manager', password: 'password', from: date, to: date })).rejects.toThrow('owner password')
    await expect(mockRepository.clearSales({ userId: 'owner', password: 'incorrect', from: date, to: date })).rejects.toThrow('owner password')
    const matchingSales = (await mockRepository.listSales()).filter((entry) => entry.createdAt.slice(0, 10) === date)
    await expect(mockRepository.clearSales({ userId: 'owner', password: 'password', from: date, to: date })).resolves.toBe(matchingSales.length)
    await expect(mockRepository.listSales()).resolves.not.toContainEqual(expect.objectContaining({ id: sale.id }))
    await expect(mockRepository.listAuditLog()).resolves.toContainEqual(expect.objectContaining({
      action: 'Cleared sales records',
      userId: 'owner',
    }))
    await expect(mockRepository.listNotifications()).resolves.toContainEqual(expect.objectContaining({
      action: 'Cleared sales records',
    }))
  })
})
