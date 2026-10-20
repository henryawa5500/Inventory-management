import { afterEach, describe, expect, it } from 'vitest'
import { activateBusinessDatabase, localDatabase } from '../localDatabase'
import type { Item, User } from '../../domain/types'

const ownerA: User = {
  id: 'owner-a',
  name: 'Owner A',
  username: 'owner-a',
  password: '',
  role: 'owner',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const itemA: Item = {
  id: 'item-a',
  name: 'Item A',
  categoryId: 'category-a',
  categoryName: 'Category A',
  baseUnit: 'unit',
  packSize: 1,
  trackStock: true,
  costPriceKobo: 0,
  reorderLevel: 0,
  pricePoints: [],
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('business-scoped local storage', () => {
  afterEach(async () => {
    await localDatabase.delete()
    await activateBusinessDatabase('business-b')
    await localDatabase.delete()
    localStorage.clear()
  })

  it('keeps each business in a separate IndexedDB database', async () => {
    await localDatabase.users.put(ownerA)
    await localDatabase.items.put(itemA)
    localStorage.setItem('bar-user', ownerA.id)
    await activateBusinessDatabase('business-a', ownerA.id)
    expect(await localDatabase.items.get(itemA.id)).toEqual(itemA)

    await activateBusinessDatabase('business-b')
    expect(await localDatabase.users.toArray()).toEqual([])
    const ownerB: User = { ...ownerA, id: 'owner-b', name: 'Owner B', username: 'owner-b', businessId: 'business-b' }
    await localDatabase.users.put(ownerB)

    await activateBusinessDatabase('business-a')
    expect((await localDatabase.users.toArray()).map((user) => user.id)).toEqual(['owner-a'])
  })
})
