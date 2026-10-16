import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Item, User } from '../../domain/types'
import { localDatabase } from '../localDatabase'
import { offlineRepository } from '../offlineRepository'

const owner: User = {
  id: 'owner-local',
  name: 'D’Queens Owner',
  username: 'owner',
  password: '',
  role: 'owner',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const item: Item = {
  id: 'item-water',
  name: 'Bottled Water',
  categoryId: 'drinks',
  categoryName: 'Drinks',
  baseUnit: 'bottle',
  packSize: 12,
  trackStock: true,
  costPriceKobo: 500,
  reorderLevel: 2,
  pricePoints: [{
    id: 'bottle',
    label: 'Bottle',
    priceKobo: 1200,
    baseUnitsUsed: 1,
  }],
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('offline-first repository', () => {
  beforeEach(async () => {
    await localDatabase.delete()
    await localDatabase.open()
    localStorage.clear()
    localStorage.setItem('bar-user', owner.id)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await localDatabase.users.put(owner)
    await localDatabase.items.put(item)
    await localDatabase.stockEvents.put({
      id: 'opening-stock',
      itemId: item.id,
      itemName: item.name,
      type: 'opening',
      quantityChange: 5,
      description: 'Opening count',
      createdAt: '2026-01-01T00:00:00.000Z',
      userId: owner.id,
    })
  })

  afterEach(async () => {
    await localDatabase.delete()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('persists an inventory change and its sync action locally as one workflow', async () => {
    const saved = await offlineRepository.saveItem({
      id: item.id,
      name: 'Bottled Water 500ml',
    }, owner.id)

    expect(saved.name).toBe('Bottled Water 500ml')
    expect((await localDatabase.items.get(item.id))?.name).toBe('Bottled Water 500ml')
    const queued = await localDatabase.syncQueue.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0].type).toBe('item.upsert')
    expect(queued[0].status).toBe('pending')
  })

  it('records sales offline and immediately subtracts their event-based stock', async () => {
    const sale = await offlineRepository.recordSale({
      staffId: owner.id,
      lines: [{
        itemId: item.id,
        itemName: item.name,
        pricePointId: 'bottle',
        pricePointLabel: 'Bottle',
        quantity: 2,
        unitPriceKobo: 1200,
        baseUnitsDeducted: 1,
        totalKobo: 2400,
      }],
    })

    expect(sale.status).toBe('waiting')
    expect((await offlineRepository.getStockLevels())[0].quantity).toBe(3)
    expect((await localDatabase.syncQueue.toArray())[0].type).toBe('sale.confirm')
  })

  it('blocks an offline sale that exceeds the remaining locally known stock', async () => {
    await offlineRepository.recordSale({
      staffId: owner.id,
      lines: [{
        itemId: item.id,
        itemName: item.name,
        pricePointId: 'bottle',
        pricePointLabel: 'Bottle',
        quantity: 3,
        unitPriceKobo: 1200,
        baseUnitsDeducted: 1,
        totalKobo: 3600,
      }],
    })

    await expect(offlineRepository.recordSale({
      staffId: owner.id,
      lines: [{
        itemId: item.id,
        itemName: item.name,
        pricePointId: 'bottle',
        pricePointLabel: 'Bottle',
        quantity: 3,
        unitPriceKobo: 1200,
        baseUnitsDeducted: 1,
        totalKobo: 3600,
      }],
    })).rejects.toThrow('Not enough Bottled Water in stock')
  })
})
